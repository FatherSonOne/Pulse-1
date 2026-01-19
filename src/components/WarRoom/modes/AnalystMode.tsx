import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AIMessage, ThinkingStep } from '../../../services/ragService';
import { SessionExport } from '../shared';

interface DataSource {
  id: string;
  name: string;
  type: 'document' | 'data' | 'url';
  summary?: string;
  keyMetrics?: string[];
}

interface Citation {
  id: string;
  source: string;
  excerpt: string;
  relevance: number;
}

interface AnalystModeProps {
  messages: AIMessage[];
  isLoading: boolean;
  thinkingLogs: Map<string, ThinkingStep[]>;
  onSendMessage: (message: string) => void;
  sessionId?: string;
  sessionTitle?: string;
  documents?: { title: string; summary?: string }[];
}

export const AnalystMode: React.FC<AnalystModeProps> = ({
  messages,
  isLoading,
  thinkingLogs,
  onSendMessage,
  sessionId = '',
  sessionTitle = 'Analysis Session',
  documents = []
}) => {
  const [input, setInput] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [showSources, setShowSources] = useState(true);
  const [analysisType, setAnalysisType] = useState<'compare' | 'summarize' | 'extract' | 'verify'>('summarize');
  const [citations, setCitations] = useState<Citation[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Extract citations from AI messages
  useEffect(() => {
    const lastAssistant = messages.filter(m => m.role === 'assistant').slice(-1)[0];
    if (lastAssistant?.citations) {
      setCitations(lastAssistant.citations.map((c: any, i: number) => ({
        id: `citation-${i}`,
        source: c.title || c.documentName || 'Source',
        excerpt: c.excerpt || c.content || '',
        relevance: c.similarity || 0.8
      })));
    }
  }, [messages]);

  const handleSend = () => {
    const message = input.trim();
    if (!message) return;

    // Add analysis context to the message
    const contextPrefix = {
      compare: '[COMPARE ANALYSIS] Compare and contrast the following across sources: ',
      summarize: '[SUMMARIZE] Provide a data-driven summary with citations: ',
      extract: '[EXTRACT FACTS] Extract key facts, figures, and data points: ',
      verify: '[FACT CHECK] Verify the following claims against available sources: '
    };

    const fullMessage = contextPrefix[analysisType] + message;
    onSendMessage(fullMessage);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickPrompts = {
    compare: [
      'What are the key differences between these sources?',
      'Where do these documents agree and disagree?',
      'Compare the main arguments presented'
    ],
    summarize: [
      'Summarize the key findings with data points',
      'What are the main conclusions?',
      'Give me an executive summary'
    ],
    extract: [
      'Extract all statistics and numbers',
      'List the key facts mentioned',
      'What metrics are discussed?'
    ],
    verify: [
      'Are these claims supported by the data?',
      'Check for any inconsistencies',
      'What evidence supports the main argument?'
    ]
  };

  const lastAssistant = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i];
    }
    return null;
  }, [messages]);

  return (
    <div className="h-full w-full flex war-room-container overflow-hidden">
      {/* Sources Panel */}
      {showSources && documents.length > 0 && (
        <div className="w-72 shrink-0 border-r analyst-sidebar flex flex-col">
          <div className="p-4 analyst-sidebar-header">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold analyst-header-text flex items-center gap-2">
                <i className="fa fa-database analyst-icon"></i>
                Data Sources
              </h3>
              <span className="analyst-badge text-xs">{documents.length}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto war-room-scrollbar p-3 space-y-2">
            {documents.map((doc, i) => (
              <div
                key={i}
                className="analyst-source-card p-3 transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-lg analyst-icon-bg flex items-center justify-center shrink-0">
                    <i className="fa fa-file-lines analyst-icon text-sm"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium analyst-text-primary truncate">
                      {doc.title}
                    </p>
                    {doc.summary && (
                      <p className="text-xs analyst-text-secondary line-clamp-2 mt-1">
                        {doc.summary}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Citations Panel */}
          {citations.length > 0 && (
            <div className="analyst-citations-panel p-3">
              <h4 className="text-xs font-semibold analyst-text-secondary uppercase tracking-wider mb-2">
                <i className="fa fa-quote-left mr-1"></i>
                Recent Citations
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto war-room-scrollbar">
                {citations.slice(0, 5).map(citation => (
                  <div
                    key={citation.id}
                    className="p-2 analyst-citation-card rounded-lg"
                  >
                    <p className="text-xs analyst-text-secondary line-clamp-2">
                      "{citation.excerpt}"
                    </p>
                    <p className="text-[10px] analyst-accent mt-1">
                      — {citation.source}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Analysis Type Selector */}
        <div className="shrink-0 p-4 analyst-toolbar">
          <div className="flex items-center gap-4">
            <span className="text-xs analyst-text-secondary uppercase tracking-wider">Analysis Type:</span>
            <div className="flex gap-2">
              {[
                { id: 'summarize', icon: 'fa-list-check', label: 'Summarize' },
                { id: 'compare', icon: 'fa-code-compare', label: 'Compare' },
                { id: 'extract', icon: 'fa-filter', label: 'Extract' },
                { id: 'verify', icon: 'fa-shield-check', label: 'Verify' }
              ].map(type => (
                <button
                  key={type.id}
                  onClick={() => setAnalysisType(type.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                    analysisType === type.id
                      ? 'analyst-btn-active'
                      : 'analyst-btn'
                  }`}
                >
                  <i className={`fa ${type.icon}`}></i>
                  {type.label}
                </button>
              ))}
            </div>

            <div className="flex-1" />

            <button
              onClick={() => setShowSources(!showSources)}
              className={`analyst-btn analyst-btn-icon ${showSources ? 'analyst-btn-active' : ''}`}
              title="Toggle sources panel"
            >
              <i className="fa fa-sidebar text-xs"></i>
            </button>

            <button
              onClick={() => setShowExport(true)}
              className="analyst-btn analyst-btn-icon"
              title="Export analysis"
            >
              <i className="fa fa-share-nodes text-xs"></i>
            </button>
          </div>
        </div>

        {/* Quick Prompts */}
        <div className="shrink-0 px-4 py-2 analyst-prompts-bar">
          <div className="flex gap-2 overflow-x-auto pb-1 war-room-scrollbar">
            {quickPrompts[analysisType].map((prompt, i) => (
              <button
                key={i}
                onClick={() => {
                  setInput(prompt);
                }}
                className="analyst-prompt-btn text-xs px-3 py-1.5 whitespace-nowrap shrink-0"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto war-room-scrollbar p-4 space-y-4 analyst-messages-area">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full analyst-empty-icon flex items-center justify-center">
                  <i className="fa fa-chart-line text-2xl analyst-icon"></i>
                </div>
                <h3 className="text-lg font-semibold analyst-text-primary mb-2">
                  Analyst Mode
                </h3>
                <p className="text-sm analyst-text-secondary mb-4">
                  Data-driven analysis with citations and fact-checking.
                  Upload documents to analyze or ask questions about your data.
                </p>
                {documents.length === 0 && (
                  <p className="text-xs analyst-hint">
                    <i className="fa fa-info-circle mr-1"></i>
                    Upload documents to enable citation-backed analysis
                  </p>
                )}
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] ${
                    msg.role === 'user'
                      ? 'analyst-message-user'
                      : 'analyst-message-ai'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-2 pb-2 analyst-message-header">
                      <i className="fa fa-chart-line analyst-icon text-xs"></i>
                      <span className="text-xs analyst-accent font-medium">Analysis</span>
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                  {/* Inline Citations */}
                  {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-3 analyst-citations-section">
                      <p className="text-xs analyst-text-secondary mb-2">
                        <i className="fa fa-bookmark mr-1"></i>
                        Sources cited:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {msg.citations.map((c: any, i: number) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-1 analyst-citation-tag rounded-full"
                          >
                            [{i + 1}] {c.title || c.documentName}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex justify-start">
              <div className="analyst-message-ai">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full analyst-loading-icon flex items-center justify-center">
                    <i className="fa fa-chart-line analyst-icon text-xs animate-pulse"></i>
                  </div>
                  <span className="text-sm analyst-text-secondary">Analyzing data...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="shrink-0 p-4 analyst-input-area">
          <div className="flex items-center gap-2">
            <div className="flex-1 analyst-input-container flex items-center gap-2 px-4 py-3">
              <i className={`fa ${
                analysisType === 'compare' ? 'fa-code-compare' :
                analysisType === 'extract' ? 'fa-filter' :
                analysisType === 'verify' ? 'fa-shield-check' :
                'fa-list-check'
              } analyst-icon text-sm`}></i>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`${analysisType.charAt(0).toUpperCase() + analysisType.slice(1)} analysis...`}
                className="flex-1 bg-transparent border-none outline-none text-sm analyst-input-text"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className={`analyst-send-btn ${
                  input.trim() ? 'analyst-send-btn-active' : ''
                }`}
              >
                <i className="fa fa-paper-plane text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExport && (
        <SessionExport
          sessionId={sessionId}
          sessionTitle={sessionTitle}
          messages={messages}
          mode="Analyst Mode"
          documents={documents}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
};
