import React, { useState, useCallback } from 'react';
import { KnowledgeDoc } from '../../../services/ragService';
import { processWithModel } from '../../../services/geminiService';
import { ProvenanceTag } from '../ProvenanceTag';
import toast from 'react-hot-toast';

import { ChevronRight, Copy, Download, FileText, HelpCircle, Loader2, Maximize2, Minimize2, RefreshCw, Search, Sparkles, X } from 'lucide-react';

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

// Coral Cockpit tokens. WB-2 of docs/WAR_ROOM_STUDIO_RESKIN_HANDOFF_2026-06-02.md.
const monoLabel: React.CSSProperties = {
  fontFamily: 'var(--pulse-font-mono)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
};

const fieldStyle: React.CSSProperties = {
  background: 'var(--pulse-surface-raised)',
  color: 'var(--pulse-ink)',
  border: '1px solid var(--pulse-border)',
};

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

      const response = await processWithModel(prompt);
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

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div
        className="w-full max-w-4xl mx-4 rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ background: 'var(--pulse-surface)', border: '1px solid var(--pulse-border)' }}
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--pulse-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--pulse-coral-bg-12)', color: 'var(--pulse-coral-fg)' }}>
              <HelpCircle size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold" style={{ color: 'var(--pulse-ink)' }}>FAQ Generator</h3>
                {faq && <ProvenanceTag model="GEMINI" kind="FAQ" />}
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
          {!faq ? (
            <div className="text-center py-8">
              {isGenerating ? (
                <div>
                  <Loader2 size={36} className="animate-spin mb-4 mx-auto" style={{ color: 'var(--pulse-coral-fg)' }} />
                  <p className="text-sm mb-4" style={{ color: 'var(--pulse-ink-3)' }}>
                    Generating FAQ...
                  </p>
                  <div className="w-48 h-1.5 mx-auto rounded-full overflow-hidden" style={{ background: 'var(--pulse-surface-raised)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: 'var(--pulse-rose)' }} />
                  </div>
                  <p className="text-xs mt-2" style={{ color: 'var(--pulse-ink-3)' }}>
                    {progress < 30 && 'Analyzing documents...'}
                    {progress >= 30 && progress < 80 && 'Extracting questions and answers...'}
                    {progress >= 80 && 'Finalizing...'}
                  </p>
                </div>
              ) : (
                <div>
                  <HelpCircle size={36} className="mb-4 mx-auto" style={{ color: 'var(--pulse-coral-fg)' }} />
                  <p className="text-lg font-medium mb-2" style={{ color: 'var(--pulse-ink)' }}>Generate FAQ</p>
                  <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: 'var(--pulse-ink-3)' }}>
                    Automatically extract frequently asked questions and answers from your documents.
                  </p>
                  <div className="mb-6">
                    <p className="text-xs mb-2" style={{ ...monoLabel, color: 'var(--pulse-ink-3)' }}>Documents to analyze</p>
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
                    onClick={generateFAQ}
                    disabled={docsToUse.length === 0}
                    className="war-room-btn-primary px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center"
                  >
                    <Sparkles size={14} className="mr-2" />
                    Generate FAQ
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* Header info */}
              <div className="p-4 mb-4 rounded-lg" style={{ background: 'var(--pulse-surface-raised)', border: '1px solid var(--pulse-border)' }}>
                <h4 className="font-bold text-lg mb-1" style={{ color: 'var(--pulse-ink)' }}>{faq.title}</h4>
                <p className="text-sm" style={{ color: 'var(--pulse-ink-2)' }}>{faq.description}</p>
                <p className="text-xs mt-2" style={{ color: 'var(--pulse-ink-3)' }}>
                  {faq.items.length} questions across {faq.categories.length} categories
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={14} style={{ color: 'var(--pulse-ink-3)', position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search questions..."
                    className="w-full pl-10 pr-4 py-2 rounded-lg text-sm focus:outline-none"
                    style={fieldStyle}
                  />
                </div>

                {/* Category filter */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={fieldStyle}
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
                    className="p-2 rounded-lg transition-colors"
                    style={{ background: 'var(--pulse-surface-raised)', color: 'var(--pulse-ink-3)' }}
                    title="Expand all"
                  >
                    <Maximize2 size={14} />
                  </button>
                  <button
                    onClick={collapseAll}
                    className="p-2 rounded-lg transition-colors"
                    style={{ background: 'var(--pulse-surface-raised)', color: 'var(--pulse-ink-3)' }}
                    title="Collapse all"
                  >
                    <Minimize2 size={14} />
                  </button>
                </div>
              </div>

              {/* FAQ Items */}
              <div className="space-y-2">
                {filteredItems.length === 0 ? (
                  <div className="text-center py-8" style={{ color: 'var(--pulse-ink-3)' }}>
                    <Search size={22} className="mb-2 mx-auto" />
                    <p>No questions match your search</p>
                  </div>
                ) : (
                  filteredItems.map((item, i) => {
                    const originalIndex = faq.items.indexOf(item);
                    const isExpanded = expandedItems.has(originalIndex);

                    return (
                      <div
                        key={originalIndex}
                        className="overflow-hidden rounded-lg"
                        style={{ background: 'var(--pulse-surface-raised)', border: '1px solid var(--pulse-border)' }}
                      >
                        <button
                          onClick={() => toggleItem(originalIndex)}
                          className="w-full p-4 text-left flex items-start gap-3 transition-colors"
                        >
                          <ChevronRight
                            size={14}
                            className="mt-1 transition-transform"
                            style={{ color: 'var(--pulse-ink-3)', transform: isExpanded ? 'rotate(90deg)' : 'none' }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium pr-4" style={{ color: 'var(--pulse-ink)' }}>{item.question}</p>
                            <span className="inline-block text-xs px-2 py-0.5 rounded mt-2" style={{ background: 'var(--pulse-surface)', color: 'var(--pulse-ink-3)', border: '1px solid var(--pulse-border)' }}>
                              {item.category}
                            </span>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4 pl-11">
                            <p className="text-sm mb-2" style={{ color: 'var(--pulse-ink-2)' }}>
                              {item.answer}
                            </p>
                            {item.sources.length > 0 && (
                              <p className="text-xs inline-flex items-center" style={{ color: 'var(--pulse-ink-3)' }}>
                                <FileText size={11} className="mr-1" />
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
        <div className="p-4 flex items-center justify-between shrink-0" style={{ borderTop: '1px solid var(--pulse-border)' }}>
          <div className="text-xs" style={{ color: 'var(--pulse-ink-3)' }}>
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
                  className="px-3 py-2 rounded-lg text-sm inline-flex items-center transition-colors"
                  style={{ background: 'var(--pulse-surface-raised)', color: 'var(--pulse-ink)' }}
                >
                  <RefreshCw size={14} className="mr-2" />
                  Regenerate
                </button>
                <button
                  onClick={copyToClipboard}
                  className="px-3 py-2 rounded-lg text-sm inline-flex items-center transition-colors"
                  style={{ background: 'var(--pulse-surface-raised)', color: 'var(--pulse-ink)' }}
                >
                  <Copy size={14} className="mr-2" />
                  Copy
                </button>
                <button
                  onClick={exportFAQ}
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

export default FAQGenerator;
