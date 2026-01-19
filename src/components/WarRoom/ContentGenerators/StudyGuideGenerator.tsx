import React, { useState, useCallback } from 'react';
import { KnowledgeDoc } from '../../../services/ragService';
import { processWithModel } from '../../../services/geminiService';
import toast from 'react-hot-toast';

interface StudySection {
  title: string;
  content: string;
  keyPoints: string[];
}

interface Question {
  question: string;
  answer: string;
  type: 'multiple-choice' | 'short-answer';
  options?: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

interface Flashcard {
  front: string;
  back: string;
}

interface StudyGuide {
  title: string;
  summary: string;
  sections: StudySection[];
  questions: Question[];
  flashcards: Flashcard[];
  generatedAt: Date;
}

interface StudyGuideGeneratorProps {
  documents: KnowledgeDoc[];
  activeContextIds: Set<string>;
  apiKey: string;
  onClose: () => void;
}

export const StudyGuideGenerator: React.FC<StudyGuideGeneratorProps> = ({
  documents,
  activeContextIds,
  apiKey,
  onClose
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [studyGuide, setStudyGuide] = useState<StudyGuide | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'questions' | 'flashcards'>('overview');
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());

  // Get documents to use
  const docsToUse = activeContextIds.size > 0
    ? documents.filter(d => activeContextIds.has(d.id) && d.processing_status === 'completed')
    : documents.filter(d => d.processing_status === 'completed');

  const generateStudyGuide = useCallback(async () => {
    if (docsToUse.length === 0) {
      toast.error('No documents available to generate study guide');
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    try {
      // Combine document content
      const combinedContent = docsToUse
        .map(d => `## ${d.title}\n\n${d.text_content || d.ai_summary || ''}`)
        .join('\n\n---\n\n')
        .substring(0, 50000); // Limit content size

      setProgress(10);

      // Generate study guide using AI
      const prompt = `You are an expert educator. Analyze the following documents and create a comprehensive study guide.

DOCUMENTS:
${combinedContent}

Generate a study guide in the following JSON format (respond ONLY with valid JSON, no markdown):
{
  "title": "Study Guide: [Topic]",
  "summary": "A 2-3 sentence overview of the main topics covered",
  "sections": [
    {
      "title": "Section Title",
      "content": "Detailed explanation of this section (2-3 paragraphs)",
      "keyPoints": ["Key point 1", "Key point 2", "Key point 3"]
    }
  ],
  "questions": [
    {
      "question": "Question text?",
      "answer": "Correct answer",
      "type": "multiple-choice",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "difficulty": "medium"
    },
    {
      "question": "Short answer question?",
      "answer": "Expected answer",
      "type": "short-answer",
      "difficulty": "easy"
    }
  ],
  "flashcards": [
    {
      "front": "Term or concept",
      "back": "Definition or explanation"
    }
  ]
}

Requirements:
- Create 3-5 sections covering the main topics
- Generate 8-10 practice questions (mix of multiple-choice and short-answer)
- Create 10-15 flashcards for key terms and concepts
- Vary question difficulty (easy, medium, hard)
- Make content educational and accurate based on the source material`;

      setProgress(30);

      const response = await processWithModel(apiKey, prompt);
      setProgress(80);

      if (!response) {
        throw new Error('No response from AI');
      }

      // Parse the JSON response
      let parsed: StudyGuide;
      try {
        // Clean up response - remove markdown code blocks if present
        let cleanResponse = response.trim();
        if (cleanResponse.startsWith('```json')) {
          cleanResponse = cleanResponse.slice(7);
        }
        if (cleanResponse.startsWith('```')) {
          cleanResponse = cleanResponse.slice(3);
        }
        if (cleanResponse.endsWith('```')) {
          cleanResponse = cleanResponse.slice(0, -3);
        }

        parsed = JSON.parse(cleanResponse.trim());
        parsed.generatedAt = new Date();
      } catch (parseError) {
        console.error('Failed to parse study guide:', parseError);
        throw new Error('Failed to parse AI response');
      }

      setProgress(100);
      setStudyGuide(parsed);
      toast.success('Study guide generated!');

    } catch (error) {
      console.error('Study guide generation failed:', error);
      toast.error('Failed to generate study guide');
    } finally {
      setIsGenerating(false);
    }
  }, [docsToUse, apiKey]);

  const toggleCard = (index: number) => {
    setFlippedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const exportStudyGuide = useCallback(() => {
    if (!studyGuide) return;

    let markdown = `# ${studyGuide.title}\n\n`;
    markdown += `*Generated: ${studyGuide.generatedAt.toLocaleString()}*\n\n`;
    markdown += `## Overview\n\n${studyGuide.summary}\n\n`;

    markdown += `---\n\n## Study Sections\n\n`;
    studyGuide.sections.forEach(section => {
      markdown += `### ${section.title}\n\n`;
      markdown += `${section.content}\n\n`;
      markdown += `**Key Points:**\n`;
      section.keyPoints.forEach(point => {
        markdown += `- ${point}\n`;
      });
      markdown += `\n`;
    });

    markdown += `---\n\n## Practice Questions\n\n`;
    studyGuide.questions.forEach((q, i) => {
      markdown += `**${i + 1}. ${q.question}** *(${q.difficulty})*\n\n`;
      if (q.type === 'multiple-choice' && q.options) {
        q.options.forEach((opt, j) => {
          markdown += `   ${String.fromCharCode(65 + j)}. ${opt}\n`;
        });
      }
      markdown += `\n   *Answer: ${q.answer}*\n\n`;
    });

    markdown += `---\n\n## Flashcards\n\n`;
    studyGuide.flashcards.forEach((card, i) => {
      markdown += `**Card ${i + 1}**\n`;
      markdown += `- Front: ${card.front}\n`;
      markdown += `- Back: ${card.back}\n\n`;
    });

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `study-guide-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Study guide exported!');
  }, [studyGuide]);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-emerald-400 bg-emerald-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20';
      case 'hard': return 'text-red-400 bg-red-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="war-room-modal w-full max-w-4xl mx-4 rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <i className="fa fa-book-open text-emerald-400"></i>
            </div>
            <div>
              <h3 className="text-lg font-bold">Study Guide Generator</h3>
              <p className="text-xs war-room-text-secondary">
                {docsToUse.length} document{docsToUse.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          </div>
          <button onClick={onClose} className="war-room-btn war-room-btn-icon-sm">
            <i className="fa fa-times"></i>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 war-room-scrollbar">
          {!studyGuide ? (
            <div className="text-center py-8">
              {isGenerating ? (
                <div>
                  <i className="fa fa-spinner fa-spin text-4xl text-emerald-400 mb-4"></i>
                  <p className="text-sm war-room-text-secondary mb-4">
                    Generating study guide...
                  </p>
                  <div className="w-48 mx-auto war-room-progress">
                    <div
                      className="war-room-progress-bar bg-gradient-to-r from-emerald-500 to-teal-500"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs war-room-text-muted mt-2">
                    {progress < 30 && 'Analyzing documents...'}
                    {progress >= 30 && progress < 80 && 'Creating study materials...'}
                    {progress >= 80 && 'Finalizing...'}
                  </p>
                </div>
              ) : (
                <div>
                  <i className="fa fa-book-open text-4xl text-emerald-400 mb-4"></i>
                  <p className="text-lg font-medium mb-2">Generate Study Guide</p>
                  <p className="text-sm war-room-text-secondary mb-6 max-w-md mx-auto">
                    Create a comprehensive study guide with key topics, practice questions, and flashcards from your documents.
                  </p>
                  <div className="mb-6">
                    <p className="text-xs war-room-text-secondary mb-2">Documents to include:</p>
                    <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
                      {docsToUse.slice(0, 5).map(doc => (
                        <span key={doc.id} className="war-room-badge text-xs">
                          {doc.title}
                        </span>
                      ))}
                      {docsToUse.length > 5 && (
                        <span className="war-room-badge text-xs">
                          +{docsToUse.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={generateStudyGuide}
                    disabled={docsToUse.length === 0}
                    className="war-room-btn war-room-btn-primary"
                  >
                    <i className="fa fa-sparkles mr-2"></i>
                    Generate Study Guide
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* Tabs */}
              <div className="flex gap-2 mb-4 border-b border-white/10 pb-2">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-4 py-2 rounded-lg text-sm transition-all ${
                    activeTab === 'overview'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'war-room-text-secondary hover:text-emerald-400'
                  }`}
                >
                  <i className="fa fa-list mr-2"></i>
                  Overview ({studyGuide.sections.length})
                </button>
                <button
                  onClick={() => setActiveTab('questions')}
                  className={`px-4 py-2 rounded-lg text-sm transition-all ${
                    activeTab === 'questions'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'war-room-text-secondary hover:text-emerald-400'
                  }`}
                >
                  <i className="fa fa-question-circle mr-2"></i>
                  Questions ({studyGuide.questions.length})
                </button>
                <button
                  onClick={() => setActiveTab('flashcards')}
                  className={`px-4 py-2 rounded-lg text-sm transition-all ${
                    activeTab === 'flashcards'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'war-room-text-secondary hover:text-emerald-400'
                  }`}
                >
                  <i className="fa fa-clone mr-2"></i>
                  Flashcards ({studyGuide.flashcards.length})
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <div className="war-room-panel p-4">
                    <h4 className="font-bold text-lg mb-2">{studyGuide.title}</h4>
                    <p className="text-sm war-room-text-secondary">{studyGuide.summary}</p>
                  </div>

                  {studyGuide.sections.map((section, i) => (
                    <div key={i} className="war-room-panel-inset p-4">
                      <h5 className="font-semibold text-emerald-400 mb-2">
                        {i + 1}. {section.title}
                      </h5>
                      <p className="text-sm war-room-text-secondary mb-3">{section.content}</p>
                      <div>
                        <p className="text-xs font-semibold war-room-text-primary mb-1">Key Points:</p>
                        <ul className="space-y-1">
                          {section.keyPoints.map((point, j) => (
                            <li key={j} className="text-xs war-room-text-secondary flex items-start gap-2">
                              <i className="fa fa-check text-emerald-400 mt-0.5"></i>
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'questions' && (
                <div className="space-y-3">
                  {studyGuide.questions.map((q, i) => (
                    <div key={i} className="war-room-panel-inset p-4">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <p className="text-sm font-medium">
                          {i + 1}. {q.question}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded ${getDifficultyColor(q.difficulty)}`}>
                          {q.difficulty}
                        </span>
                      </div>
                      {q.type === 'multiple-choice' && q.options && (
                        <div className="ml-4 space-y-1 mb-3">
                          {q.options.map((opt, j) => (
                            <p key={j} className="text-xs war-room-text-secondary">
                              {String.fromCharCode(65 + j)}. {opt}
                            </p>
                          ))}
                        </div>
                      )}
                      <details className="mt-2">
                        <summary className="text-xs text-emerald-400 cursor-pointer hover:text-emerald-300">
                          Show Answer
                        </summary>
                        <p className="text-sm mt-2 p-2 bg-emerald-500/10 rounded border border-emerald-500/20">
                          {q.answer}
                        </p>
                      </details>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'flashcards' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {studyGuide.flashcards.map((card, i) => (
                    <div
                      key={i}
                      onClick={() => toggleCard(i)}
                      className="war-room-panel-inset p-4 cursor-pointer hover:border-emerald-500/50 transition-all min-h-[120px] flex items-center justify-center"
                    >
                      <div className="text-center">
                        {flippedCards.has(i) ? (
                          <>
                            <p className="text-xs text-emerald-400 mb-1">Answer</p>
                            <p className="text-sm">{card.back}</p>
                          </>
                        ) : (
                          <>
                            <p className="text-xs war-room-text-secondary mb-1">Question</p>
                            <p className="text-sm font-medium">{card.front}</p>
                          </>
                        )}
                        <p className="text-xs war-room-text-muted mt-3">
                          <i className="fa fa-sync-alt mr-1"></i>
                          Click to flip
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex items-center justify-between shrink-0">
          <div className="text-xs war-room-text-secondary">
            {studyGuide && (
              <span>Generated {studyGuide.generatedAt.toLocaleTimeString()}</span>
            )}
          </div>
          <div className="flex gap-2">
            {studyGuide && (
              <>
                <button
                  onClick={() => setStudyGuide(null)}
                  className="war-room-btn text-sm"
                >
                  <i className="fa fa-refresh mr-2"></i>
                  Regenerate
                </button>
                <button
                  onClick={exportStudyGuide}
                  className="war-room-btn war-room-btn-primary text-sm"
                >
                  <i className="fa fa-download mr-2"></i>
                  Export
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudyGuideGenerator;
