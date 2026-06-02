import React, { useState, useCallback } from 'react';
import { KnowledgeDoc } from '../../../services/ragService';
import { processWithModel } from '../../../services/geminiService';
import { ProvenanceTag } from '../ProvenanceTag';
import toast from 'react-hot-toast';

import { BookOpen, Check, Copy, Download, HelpCircle, List, Loader2, RefreshCcw, RefreshCw, Sparkles, X } from 'lucide-react';

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

// Coral Cockpit tokens (theme-aware via vars). WB-1 of
// docs/WAR_ROOM_STUDIO_RESKIN_HANDOFF_2026-06-02.md.
const monoLabel: React.CSSProperties = {
  fontFamily: 'var(--pulse-font-mono)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
};

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

      const response = await processWithModel(prompt);
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

  // Difficulty is a semantic scale (easy/medium/hard); keep status tints, tidy.
  const getDifficultyStyle = (difficulty: string): React.CSSProperties => {
    switch (difficulty) {
      case 'easy': return { color: '#10b981', background: 'rgba(16,185,129,0.15)' };
      case 'hard': return { color: '#ef4444', background: 'rgba(239,68,68,0.12)' };
      case 'medium':
      default: return { color: 'var(--pulse-ink-2)', background: 'var(--pulse-surface-raised)' };
    }
  };

  const tabStyle = (active: boolean): React.CSSProperties =>
    active
      ? { background: 'var(--pulse-coral-bg-12)', color: 'var(--pulse-coral-fg)' }
      : { color: 'var(--pulse-ink-3)' };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div
        className="w-full max-w-4xl mx-4 rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ background: 'var(--pulse-surface-modal)', border: '1px solid var(--pulse-border)' }}
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--pulse-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--pulse-coral-bg-12)', color: 'var(--pulse-coral-fg)' }}>
              <BookOpen size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold" style={{ color: 'var(--pulse-ink)' }}>Study Guide Generator</h3>
                {studyGuide && <ProvenanceTag model="GEMINI" kind="STUDY GUIDE" />}
              </div>
              <p className="text-xs" style={{ color: 'var(--pulse-ink-3)' }}>
                {docsToUse.length} document{docsToUse.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--pulse-ink-3)' }} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {!studyGuide ? (
            <div className="text-center py-8">
              {isGenerating ? (
                <div>
                  <Loader2 size={36} className="animate-spin mb-4 mx-auto" style={{ color: 'var(--pulse-coral-fg)' }} />
                  <p className="text-sm mb-4" style={{ color: 'var(--pulse-ink-3)' }}>
                    Generating study guide...
                  </p>
                  <div className="w-48 h-1.5 mx-auto rounded-full overflow-hidden" style={{ background: 'var(--pulse-surface-raised)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: 'var(--pulse-rose)' }} />
                  </div>
                  <p className="text-xs mt-2" style={{ color: 'var(--pulse-ink-3)' }}>
                    {progress < 30 && 'Analyzing documents...'}
                    {progress >= 30 && progress < 80 && 'Creating study materials...'}
                    {progress >= 80 && 'Finalizing...'}
                  </p>
                </div>
              ) : (
                <div>
                  <BookOpen size={36} className="mb-4 mx-auto" style={{ color: 'var(--pulse-coral-fg)' }} />
                  <p className="text-lg font-medium mb-2" style={{ color: 'var(--pulse-ink)' }}>Generate Study Guide</p>
                  <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: 'var(--pulse-ink-3)' }}>
                    Create a comprehensive study guide with key topics, practice questions, and flashcards from your documents.
                  </p>
                  <div className="mb-6">
                    <p className="text-xs mb-2" style={{ ...monoLabel, color: 'var(--pulse-ink-3)' }}>Documents to include</p>
                    <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
                      {docsToUse.slice(0, 5).map(doc => (
                        <span key={doc.id} className="text-xs px-2 py-1 rounded" style={{ background: 'var(--pulse-surface-raised)', color: 'var(--pulse-ink-2)' }}>
                          {doc.title}
                        </span>
                      ))}
                      {docsToUse.length > 5 && (
                        <span className="text-xs px-2 py-1 rounded" style={{ background: 'var(--pulse-surface-raised)', color: 'var(--pulse-ink-2)' }}>
                          +{docsToUse.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={generateStudyGuide}
                    disabled={docsToUse.length === 0}
                    className="war-room-btn-primary px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center"
                  >
                    <Sparkles size={14} className="mr-2" />
                    Generate Study Guide
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* Tabs */}
              <div className="flex gap-2 mb-4 pb-2" style={{ borderBottom: '1px solid var(--pulse-border)' }}>
                <button
                  onClick={() => setActiveTab('overview')}
                  className="px-4 py-2 rounded-lg text-sm transition-all inline-flex items-center"
                  style={tabStyle(activeTab === 'overview')}
                >
                  <List size={14} className="mr-2" />
                  Overview ({studyGuide.sections.length})
                </button>
                <button
                  onClick={() => setActiveTab('questions')}
                  className="px-4 py-2 rounded-lg text-sm transition-all inline-flex items-center"
                  style={tabStyle(activeTab === 'questions')}
                >
                  <HelpCircle size={14} className="mr-2" />
                  Questions ({studyGuide.questions.length})
                </button>
                <button
                  onClick={() => setActiveTab('flashcards')}
                  className="px-4 py-2 rounded-lg text-sm transition-all inline-flex items-center"
                  style={tabStyle(activeTab === 'flashcards')}
                >
                  <Copy size={14} className="mr-2" />
                  Flashcards ({studyGuide.flashcards.length})
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg" style={{ background: 'var(--pulse-surface-raised)', border: '1px solid var(--pulse-border)' }}>
                    <h4 className="font-bold text-lg mb-2" style={{ color: 'var(--pulse-ink)' }}>{studyGuide.title}</h4>
                    <p className="text-sm" style={{ color: 'var(--pulse-ink-2)' }}>{studyGuide.summary}</p>
                  </div>

                  {studyGuide.sections.map((section, i) => (
                    <div key={i} className="p-4 rounded-lg" style={{ background: 'var(--pulse-surface-raised)', border: '1px solid var(--pulse-border)' }}>
                      <h5 className="font-semibold mb-2" style={{ color: 'var(--pulse-coral-fg)' }}>
                        {i + 1}. {section.title}
                      </h5>
                      <p className="text-sm mb-3" style={{ color: 'var(--pulse-ink-2)' }}>{section.content}</p>
                      <div>
                        <p className="text-xs font-semibold mb-1" style={{ color: 'var(--pulse-ink)' }}>Key Points:</p>
                        <ul className="space-y-1">
                          {section.keyPoints.map((point, j) => (
                            <li key={j} className="text-xs flex items-start gap-2" style={{ color: 'var(--pulse-ink-2)' }}>
                              <Check size={12} style={{ color: 'var(--pulse-coral-fg)', marginTop: 2 }} />
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
                    <div key={i} className="p-4 rounded-lg" style={{ background: 'var(--pulse-surface-raised)', border: '1px solid var(--pulse-border)' }}>
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <p className="text-sm font-medium" style={{ color: 'var(--pulse-ink)' }}>
                          {i + 1}. {q.question}
                        </p>
                        <span className="text-xs px-2 py-0.5 rounded" style={getDifficultyStyle(q.difficulty)}>
                          {q.difficulty}
                        </span>
                      </div>
                      {q.type === 'multiple-choice' && q.options && (
                        <div className="ml-4 space-y-1 mb-3">
                          {q.options.map((opt, j) => (
                            <p key={j} className="text-xs" style={{ color: 'var(--pulse-ink-2)' }}>
                              {String.fromCharCode(65 + j)}. {opt}
                            </p>
                          ))}
                        </div>
                      )}
                      <details className="mt-2">
                        <summary className="text-xs cursor-pointer" style={{ color: 'var(--pulse-coral-fg)' }}>
                          Show Answer
                        </summary>
                        <p className="text-sm mt-2 p-2 rounded" style={{ background: 'var(--pulse-coral-bg-08)', color: 'var(--pulse-ink-2)' }}>
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
                      className="p-4 rounded-lg cursor-pointer transition-all min-h-[120px] flex items-center justify-center"
                      style={{ background: 'var(--pulse-surface-raised)', border: '1px solid var(--pulse-border)' }}
                    >
                      <div className="text-center">
                        {flippedCards.has(i) ? (
                          <>
                            <p className="text-xs mb-1" style={{ ...monoLabel, color: 'var(--pulse-coral-fg)' }}>Answer</p>
                            <p className="text-sm" style={{ color: 'var(--pulse-ink-2)' }}>{card.back}</p>
                          </>
                        ) : (
                          <>
                            <p className="text-xs mb-1" style={{ ...monoLabel, color: 'var(--pulse-ink-3)' }}>Question</p>
                            <p className="text-sm font-medium" style={{ color: 'var(--pulse-ink)' }}>{card.front}</p>
                          </>
                        )}
                        <p className="text-xs mt-3 inline-flex items-center" style={{ color: 'var(--pulse-ink-3)' }}>
                          <RefreshCcw size={11} className="mr-1" />
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
        <div className="p-4 flex items-center justify-between shrink-0" style={{ borderTop: '1px solid var(--pulse-border)' }}>
          <div className="text-xs" style={{ color: 'var(--pulse-ink-3)' }}>
            {studyGuide && (
              <span>Generated {studyGuide.generatedAt.toLocaleTimeString()}</span>
            )}
          </div>
          <div className="flex gap-2">
            {studyGuide && (
              <>
                <button
                  onClick={() => setStudyGuide(null)}
                  className="px-3 py-2 rounded-lg text-sm inline-flex items-center transition-colors"
                  style={{ background: 'var(--pulse-surface-raised)', color: 'var(--pulse-ink)' }}
                >
                  <RefreshCw size={14} className="mr-2" />
                  Regenerate
                </button>
                <button
                  onClick={exportStudyGuide}
                  className="war-room-btn-primary px-3 py-2 rounded-lg text-sm inline-flex items-center"
                >
                  <Download size={14} className="mr-2" />
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
