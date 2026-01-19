import React, { useState, useCallback } from 'react';
import { KnowledgeDoc } from '../../../services/ragService';
import { processWithModel } from '../../../services/geminiService';
import toast from 'react-hot-toast';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
  sources: string[];
}

interface FAQ {
  title: string;
  description: string;
  categories: string[];
  items: FAQItem[];
  generatedAt: Date;
}

interface FAQGeneratorProps {
  documents: KnowledgeDoc[];
  activeContextIds: Set<string>;
  apiKey: string;
  onClose: () => void;
}

export const FAQGenerator: React.FC<FAQGeneratorProps> = ({
  documents,
  activeContextIds,
  apiKey,
  onClose
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [faq, setFaq] = useState<FAQ | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Get documents to use
  const docsToUse = activeContextIds.size > 0
    ? documents.filter(d => activeContextIds.has(d.id) && d.processing_status === 'completed')
    : documents.filter(d => d.processing_status === 'completed');

  const generateFAQ = useCallback(async () => {
    if (docsToUse.length === 0) {
      toast.error('No documents available to generate FAQ');
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    try {
      // Combine document content with source tracking
      const docContents = docsToUse.map(d => ({
        title: d.title,
        content: (d.text_content || d.ai_summary || '').substring(0, 15000)
      }));

      const combinedContent = docContents
        .map(d => `## Source: ${d.title}\n\n${d.content}`)
        .join('\n\n---\n\n');

      setProgress(10);

      const prompt = `You are an expert at creating comprehensive FAQ documents. Analyze the following documents and generate a FAQ that answers the most important questions a reader might have.

DOCUMENTS:
${combinedContent}

Generate a FAQ in the following JSON format (respond ONLY with valid JSON, no markdown):
{
  "title": "Frequently Asked Questions",
  "description": "A brief description of what this FAQ covers",
  "categories": ["Category 1", "Category 2", "Category 3"],
  "items": [
    {
      "question": "What is [topic]?",
      "answer": "A comprehensive answer that fully addresses the question (2-4 sentences)",
      "category": "Category 1",
      "sources": ["Document title that this answer came from"]
    }
  ]
}

Requirements:
- Generate 15-25 FAQ items
- Create 3-5 logical categories
- Questions should be what a reader would naturally ask
- Answers should be clear, accurate, and based on the source material
- Include the source document(s) for each answer
- Cover the most important topics from each document
- Mix basic and advanced questions
- Make questions specific, not generic`;

      setProgress(30);

      const response = await processWithModel(apiKey, prompt);
      setProgress(80);

      if (!response) {
        throw new Error('No response from AI');
      }

      // Parse the JSON response
      let parsed: FAQ;
      try {
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
        console.error('Failed to parse FAQ:', parseError);
        throw new Error('Failed to parse AI response');
      }

      setProgress(100);
      setFaq(parsed);
      toast.success('FAQ generated!');

    } catch (error) {
      console.error('FAQ generation failed:', error);
      toast.error('Failed to generate FAQ');
    } finally {
      setIsGenerating(false);
    }
  }, [docsToUse, apiKey]);

  const toggleItem = (index: number) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    if (faq) {
      setExpandedItems(new Set(faq.items.map((_, i) => i)));
    }
  };

  const collapseAll = () => {
    setExpandedItems(new Set());
  };

  const filteredItems = faq?.items.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = searchQuery.length === 0 ||
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  }) || [];

  const exportFAQ = useCallback(() => {
    if (!faq) return;

    let markdown = `# ${faq.title}\n\n`;
    markdown += `*Generated: ${faq.generatedAt.toLocaleString()}*\n\n`;
    markdown += `${faq.description}\n\n`;
    markdown += `---\n\n`;

    // Group by category
    faq.categories.forEach(category => {
      const categoryItems = faq.items.filter(item => item.category === category);
      if (categoryItems.length > 0) {
        markdown += `## ${category}\n\n`;
        categoryItems.forEach((item, i) => {
          markdown += `### Q: ${item.question}\n\n`;
          markdown += `**A:** ${item.answer}\n\n`;
          if (item.sources.length > 0) {
            markdown += `*Sources: ${item.sources.join(', ')}*\n\n`;
          }
        });
      }
    });

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `faq-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('FAQ exported!');
  }, [faq]);

  const copyToClipboard = useCallback(() => {
    if (!faq) return;

    let text = `${faq.title}\n\n`;
    faq.items.forEach((item, i) => {
      text += `Q: ${item.question}\nA: ${item.answer}\n\n`;
    });

    navigator.clipboard.writeText(text);
    toast.success('FAQ copied to clipboard!');
  }, [faq]);

  const getCategoryColor = (category: string) => {
    const colors = [
      'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'bg-amber-500/20 text-amber-400 border-amber-500/30',
      'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      'bg-rose-500/20 text-rose-400 border-rose-500/30',
    ];
    const index = faq?.categories.indexOf(category) || 0;
    return colors[index % colors.length];
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="war-room-modal w-full max-w-4xl mx-4 rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <i className="fa fa-circle-question text-blue-400"></i>
            </div>
            <div>
              <h3 className="text-lg font-bold">FAQ Generator</h3>
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
          {!faq ? (
            <div className="text-center py-8">
              {isGenerating ? (
                <div>
                  <i className="fa fa-spinner fa-spin text-4xl text-blue-400 mb-4"></i>
                  <p className="text-sm war-room-text-secondary mb-4">
                    Generating FAQ...
                  </p>
                  <div className="w-48 mx-auto war-room-progress">
                    <div
                      className="war-room-progress-bar bg-gradient-to-r from-blue-500 to-cyan-500"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs war-room-text-muted mt-2">
                    {progress < 30 && 'Analyzing documents...'}
                    {progress >= 30 && progress < 80 && 'Extracting questions and answers...'}
                    {progress >= 80 && 'Finalizing...'}
                  </p>
                </div>
              ) : (
                <div>
                  <i className="fa fa-circle-question text-4xl text-blue-400 mb-4"></i>
                  <p className="text-lg font-medium mb-2">Generate FAQ</p>
                  <p className="text-sm war-room-text-secondary mb-6 max-w-md mx-auto">
                    Automatically extract frequently asked questions and answers from your documents.
                  </p>
                  <div className="mb-6">
                    <p className="text-xs war-room-text-secondary mb-2">Documents to analyze:</p>
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
                    onClick={generateFAQ}
                    disabled={docsToUse.length === 0}
                    className="war-room-btn war-room-btn-primary"
                  >
                    <i className="fa fa-sparkles mr-2"></i>
                    Generate FAQ
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* Header info */}
              <div className="war-room-panel p-4 mb-4">
                <h4 className="font-bold text-lg mb-1">{faq.title}</h4>
                <p className="text-sm war-room-text-secondary">{faq.description}</p>
                <p className="text-xs war-room-text-muted mt-2">
                  {faq.items.length} questions across {faq.categories.length} categories
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <i className="fa fa-search absolute left-3 top-1/2 -translate-y-1/2 war-room-text-secondary text-sm"></i>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search questions..."
                    className="war-room-input pl-10 text-sm"
                  />
                </div>

                {/* Category filter */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="war-room-select text-sm"
                >
                  <option value="all">All Categories</option>
                  {faq.categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                {/* Expand/Collapse */}
                <div className="flex gap-1">
                  <button
                    onClick={expandAll}
                    className="war-room-btn war-room-btn-icon-sm"
                    title="Expand all"
                  >
                    <i className="fa fa-expand text-xs"></i>
                  </button>
                  <button
                    onClick={collapseAll}
                    className="war-room-btn war-room-btn-icon-sm"
                    title="Collapse all"
                  >
                    <i className="fa fa-compress text-xs"></i>
                  </button>
                </div>
              </div>

              {/* FAQ Items */}
              <div className="space-y-2">
                {filteredItems.length === 0 ? (
                  <div className="text-center py-8 war-room-text-secondary">
                    <i className="fa fa-search text-2xl mb-2"></i>
                    <p>No questions match your search</p>
                  </div>
                ) : (
                  filteredItems.map((item, i) => {
                    const originalIndex = faq.items.indexOf(item);
                    const isExpanded = expandedItems.has(originalIndex);

                    return (
                      <div
                        key={originalIndex}
                        className="war-room-panel-inset overflow-hidden"
                      >
                        <button
                          onClick={() => toggleItem(originalIndex)}
                          className="w-full p-4 text-left flex items-start gap-3 hover:bg-white/5 transition-colors"
                        >
                          <i className={`fa fa-chevron-right text-xs war-room-text-secondary mt-1 transition-transform ${isExpanded ? 'rotate-90' : ''}`}></i>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium pr-4">{item.question}</p>
                            <span className={`inline-block text-xs px-2 py-0.5 rounded border mt-2 ${getCategoryColor(item.category)}`}>
                              {item.category}
                            </span>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4 pl-11">
                            <p className="text-sm war-room-text-secondary mb-2">
                              {item.answer}
                            </p>
                            {item.sources.length > 0 && (
                              <p className="text-xs war-room-text-muted">
                                <i className="fa fa-file-lines mr-1"></i>
                                Sources: {item.sources.join(', ')}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex items-center justify-between shrink-0">
          <div className="text-xs war-room-text-secondary">
            {faq && (
              <span>
                Showing {filteredItems.length} of {faq.items.length} questions
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {faq && (
              <>
                <button
                  onClick={() => setFaq(null)}
                  className="war-room-btn text-sm"
                >
                  <i className="fa fa-refresh mr-2"></i>
                  Regenerate
                </button>
                <button
                  onClick={copyToClipboard}
                  className="war-room-btn text-sm"
                >
                  <i className="fa fa-copy mr-2"></i>
                  Copy
                </button>
                <button
                  onClick={exportFAQ}
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

export default FAQGenerator;
