/**
 * Data Analyst Mode Redesigned - The Data Observatory
 *
 * A sophisticated command center for data-driven analysis with an
 * astronomical/scientific visualization aesthetic. Features live data
 * indicators, citation tracking, and intelligent analysis workflows.
 *
 * Design Direction: Scientific precision meets futuristic elegance
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { AIMessage, ThinkingStep } from '../../../services/ragService';
import { MarkdownRenderer } from '../../shared/MarkdownRenderer';
import { ModeSwitcher, WarRoomMode, MissionType, RoomType } from '../ModeSwitcher';
import { SessionExport } from '../shared';
import './DataAnalystModeRedesigned.css';

// ============= TYPES =============

interface DataSource {
  id: string;
  name: string;
  type: 'document' | 'data' | 'url' | 'api';
  status: 'indexed' | 'processing' | 'error';
  summary?: string;
  keyMetrics?: string[];
  lastAccessed?: Date;
  relevanceScore?: number;
}

interface Citation {
  id: string;
  source: string;
  excerpt: string;
  relevance: number;
  documentId?: string;
  pageNumber?: number;
}

interface AnalysisQuery {
  id: string;
  type: 'summarize' | 'compare' | 'extract' | 'verify' | 'correlate' | 'trend';
  query: string;
  timestamp: Date;
  status: 'pending' | 'complete' | 'error';
}

type AnalysisType = 'summarize' | 'compare' | 'extract' | 'verify' | 'correlate' | 'trend';

interface DataAnalystModeRedesignedProps {
  messages: AIMessage[];
  isLoading: boolean;
  thinkingLogs: Map<string, ThinkingStep[]>;
  onSendMessage: (message: string) => void;
  sessionId?: string;
  sessionTitle?: string;
  documents?: { id?: string; title: string; summary?: string; file_type?: string }[];
  // War Room mode switching
  currentMode?: WarRoomMode;
  currentMission?: MissionType;
  currentRoom?: RoomType;
  onModeChange?: (mode: WarRoomMode) => void;
  onMissionChange?: (mission: MissionType) => void;
  onRoomChange?: (room: RoomType) => void;
}

// ============= CONSTANTS =============

const ANALYSIS_TYPES: {
  id: AnalysisType;
  name: string;
  icon: string;
  description: string;
  color: string;
  prefix: string;
}[] = [
  {
    id: 'summarize',
    name: 'Summarize',
    icon: 'fa-compress-alt',
    description: 'Distill key insights',
    color: 'teal',
    prefix: '[SUMMARIZE] Provide a comprehensive, data-driven summary with citations: '
  },
  {
    id: 'compare',
    name: 'Compare',
    icon: 'fa-code-compare',
    description: 'Cross-reference sources',
    color: 'blue',
    prefix: '[COMPARE ANALYSIS] Compare and contrast across all available sources: '
  },
  {
    id: 'extract',
    name: 'Extract',
    icon: 'fa-filter',
    description: 'Pull specific data',
    color: 'emerald',
    prefix: '[EXTRACT FACTS] Extract key facts, figures, statistics, and data points: '
  },
  {
    id: 'verify',
    name: 'Verify',
    icon: 'fa-shield-check',
    description: 'Fact-check claims',
    color: 'amber',
    prefix: '[FACT CHECK] Verify the following claims against available sources: '
  },
  {
    id: 'correlate',
    name: 'Correlate',
    icon: 'fa-diagram-project',
    description: 'Find connections',
    color: 'violet',
    prefix: '[CORRELATION ANALYSIS] Identify correlations and relationships in the data: '
  },
  {
    id: 'trend',
    name: 'Trend',
    icon: 'fa-chart-line',
    description: 'Analyze patterns',
    color: 'rose',
    prefix: '[TREND ANALYSIS] Analyze patterns and trends over time: '
  }
];

const QUICK_QUERIES: Record<AnalysisType, string[]> = {
  summarize: [
    'Summarize the key findings with supporting data',
    'What are the main conclusions from these sources?',
    'Provide an executive summary with citations'
  ],
  compare: [
    'What are the key differences between sources?',
    'Where do these documents agree or conflict?',
    'Compare the methodologies used'
  ],
  extract: [
    'Extract all statistics and numerical data',
    'List the key facts and figures mentioned',
    'What metrics and KPIs are discussed?'
  ],
  verify: [
    'Are these claims supported by the evidence?',
    'Identify any inconsistencies in the data',
    'What evidence supports the main arguments?'
  ],
  correlate: [
    'What relationships exist between these variables?',
    'Identify cause and effect patterns',
    'How are these concepts interconnected?'
  ],
  trend: [
    'What patterns emerge over time?',
    'Identify any anomalies or outliers',
    'What trajectory does the data suggest?'
  ]
};

// ============= SUBCOMPONENTS =============

// Data Source Card
const DataSourceCard: React.FC<{
  source: DataSource;
  isActive: boolean;
  onClick: () => void;
}> = ({ source, isActive, onClick }) => {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'document': return 'fa-file-lines';
      case 'data': return 'fa-database';
      case 'url': return 'fa-globe';
      case 'api': return 'fa-plug';
      default: return 'fa-file';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'indexed': return 'da-status-indexed';
      case 'processing': return 'da-status-processing';
      case 'error': return 'da-status-error';
      default: return '';
    }
  };

  return (
    <button
      onClick={onClick}
      className={`da-source-card ${isActive ? 'active' : ''}`}
    >
      <div className="da-source-icon">
        <i className={`fa ${getTypeIcon(source.type)}`} />
        <span className={`da-source-status ${getStatusColor(source.status)}`} />
      </div>
      <div className="da-source-info">
        <span className="da-source-name">{source.name}</span>
        {source.summary && (
          <span className="da-source-summary">{source.summary}</span>
        )}
      </div>
      {source.relevanceScore !== undefined && (
        <div className="da-source-relevance">
          <span className="da-relevance-value">{Math.round(source.relevanceScore * 100)}%</span>
          <span className="da-relevance-label">match</span>
        </div>
      )}
    </button>
  );
};

// Analysis Type Card
const AnalysisTypeCard: React.FC<{
  type: typeof ANALYSIS_TYPES[number];
  isActive: boolean;
  onClick: () => void;
}> = ({ type, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`da-analysis-card da-analysis-${type.color} ${isActive ? 'active' : ''}`}
  >
    <div className="da-analysis-icon">
      <i className={`fa ${type.icon}`} />
    </div>
    <div className="da-analysis-content">
      <span className="da-analysis-name">{type.name}</span>
      <span className="da-analysis-desc">{type.description}</span>
    </div>
    {isActive && (
      <div className="da-analysis-active-indicator">
        <i className="fa fa-check-circle" />
      </div>
    )}
  </button>
);

// Citation Tag
const CitationTag: React.FC<{
  citation: Citation;
  index: number;
  onClick?: () => void;
}> = ({ citation, index, onClick }) => (
  <button className="da-citation-tag" onClick={onClick}>
    <span className="da-citation-number">[{index + 1}]</span>
    <span className="da-citation-source">{citation.source}</span>
    <span className="da-citation-relevance">{Math.round(citation.relevance * 100)}%</span>
  </button>
);

// Evidence Panel
const EvidencePanel: React.FC<{
  citations: Citation[];
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ citations, isExpanded, onToggle }) => (
  <div className={`da-evidence-panel ${isExpanded ? 'expanded' : ''}`}>
    <button className="da-evidence-header" onClick={onToggle}>
      <div className="da-evidence-title">
        <i className="fa fa-bookmark" />
        <span>Evidence Trail</span>
        <span className="da-evidence-count">{citations.length}</span>
      </div>
      <i className={`fa fa-chevron-${isExpanded ? 'down' : 'up'}`} />
    </button>
    {isExpanded && citations.length > 0 && (
      <div className="da-evidence-list">
        {citations.map((citation, idx) => (
          <div key={citation.id} className="da-evidence-item">
            <div className="da-evidence-marker">
              <span className="da-evidence-num">{idx + 1}</span>
            </div>
            <div className="da-evidence-content">
              <p className="da-evidence-excerpt">"{citation.excerpt}"</p>
              <div className="da-evidence-meta">
                <span className="da-evidence-source">
                  <i className="fa fa-file-lines" />
                  {citation.source}
                </span>
                <span className="da-evidence-relevance">
                  {Math.round(citation.relevance * 100)}% relevant
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// Data Visualization Placeholder
const DataViz: React.FC<{ isActive: boolean }> = ({ isActive }) => (
  <div className={`da-viz-container ${isActive ? 'active' : ''}`}>
    <div className="da-viz-grid">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="da-viz-bar"
          style={{
            height: `${20 + Math.random() * 60}%`,
            animationDelay: `${i * 50}ms`
          }}
        />
      ))}
    </div>
    <div className="da-viz-pulse" />
  </div>
);

// Message Component
const AnalystMessage: React.FC<{
  message: AIMessage;
  thinkingSteps?: ThinkingStep[];
  citations: Citation[];
}> = ({ message, thinkingSteps, citations }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`da-message ${isUser ? 'da-message-user' : 'da-message-ai'}`}>
      {!isUser && (
        <div className="da-message-header">
          <div className="da-ai-badge">
            <i className="fa fa-chart-network" />
            <span>Data Analysis</span>
          </div>
          <span className="da-message-time">
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>
      )}

      {/* Thinking Steps */}
      {thinkingSteps && thinkingSteps.length > 0 && (
        <div className="da-thinking">
          <div className="da-thinking-header">
            <i className="fa fa-brain" />
            <span>Analysis Process</span>
          </div>
          <div className="da-thinking-steps">
            {thinkingSteps.slice(0, 3).map((step, idx) => (
              <div key={idx} className="da-thinking-step">
                <span className="da-step-num">{idx + 1}</span>
                <span className="da-step-text">{step.thinking}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="da-message-content">
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <MarkdownRenderer
            content={message.content}
            className="da-markdown"
          />
        )}
      </div>

      {/* Inline Citations */}
      {!isUser && citations.length > 0 && (
        <div className="da-message-citations">
          <div className="da-citations-label">
            <i className="fa fa-quote-left" />
            <span>Sources cited</span>
          </div>
          <div className="da-citations-list">
            {citations.map((c, idx) => (
              <CitationTag key={c.id} citation={c} index={idx} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Loading State
const AnalysisLoadingState: React.FC = () => (
  <div className="da-loading">
    <div className="da-loading-orb">
      <div className="da-loading-ring" />
      <div className="da-loading-ring delay-1" />
      <div className="da-loading-ring delay-2" />
      <i className="fa fa-microscope" />
    </div>
    <div className="da-loading-text">
      <span className="da-loading-primary">Analyzing data...</span>
      <span className="da-loading-secondary">Cross-referencing sources</span>
    </div>
  </div>
);

// Empty State
const EmptyState: React.FC<{
  hasDocuments: boolean;
  analysisType: AnalysisType;
}> = ({ hasDocuments, analysisType }) => {
  const typeInfo = ANALYSIS_TYPES.find(t => t.id === analysisType);

  return (
    <div className="da-empty">
      <div className="da-empty-icon">
        <div className="da-empty-rings">
          <div className="da-empty-ring" />
          <div className="da-empty-ring delay-1" />
        </div>
        <i className={`fa ${typeInfo?.icon || 'fa-chart-network'}`} />
      </div>
      <h3 className="da-empty-title">Data Observatory</h3>
      <p className="da-empty-desc">
        {hasDocuments
          ? `Ready for ${typeInfo?.name.toLowerCase()} analysis. Ask questions about your data to begin.`
          : 'Upload documents to your knowledge base to enable citation-backed analysis.'}
      </p>
      {!hasDocuments && (
        <div className="da-empty-hint">
          <i className="fa fa-lightbulb" />
          <span>Tip: Add PDFs, documents, or URLs to analyze</span>
        </div>
      )}
    </div>
  );
};

// ============= MAIN COMPONENT =============

export const DataAnalystModeRedesigned: React.FC<DataAnalystModeRedesignedProps> = ({
  messages,
  isLoading,
  thinkingLogs,
  onSendMessage,
  sessionId = '',
  sessionTitle = 'Analysis Session',
  documents = [],
  currentMode = 'analyst',
  currentMission = 'research',
  currentRoom = 'war-room',
  onModeChange,
  onMissionChange,
  onRoomChange
}) => {
  // State
  const [input, setInput] = useState('');
  const [analysisType, setAnalysisType] = useState<AnalysisType>('summarize');
  const [showSources, setShowSources] = useState(true);
  const [showEvidence, setShowEvidence] = useState(true);
  const [showExport, setShowExport] = useState(false);
  const [activeSourceIds, setActiveSourceIds] = useState<Set<string>>(new Set());
  const [citations, setCitations] = useState<Citation[]>([]);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Derived state
  const dataSources: DataSource[] = useMemo(() =>
    documents.map((doc, idx) => ({
      id: doc.id || `doc-${idx}`,
      name: doc.title,
      type: (doc.file_type?.includes('pdf') ? 'document' :
             doc.file_type?.includes('url') ? 'url' : 'document') as DataSource['type'],
      status: 'indexed' as const,
      summary: doc.summary,
      relevanceScore: 0.8 + Math.random() * 0.2
    })),
    [documents]
  );

  const hasDocuments = dataSources.length > 0;

  // Extract citations from messages
  useEffect(() => {
    const lastAssistant = messages.filter(m => m.role === 'assistant').slice(-1)[0];
    if (lastAssistant?.citations) {
      setCitations(lastAssistant.citations.map((c: any, i: number) => ({
        id: `citation-${i}`,
        source: c.title || c.documentName || 'Source',
        excerpt: c.excerpt || c.content || '',
        relevance: c.similarity || 0.8,
        documentId: c.documentId
      })));
    }
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize active sources
  useEffect(() => {
    if (dataSources.length > 0 && activeSourceIds.size === 0) {
      setActiveSourceIds(new Set(dataSources.map(s => s.id)));
    }
  }, [dataSources, activeSourceIds.size]);

  // Handlers
  const handleSend = useCallback(() => {
    const message = input.trim();
    if (!message || isLoading) return;

    const typeConfig = ANALYSIS_TYPES.find(t => t.id === analysisType);
    const fullMessage = typeConfig ? typeConfig.prefix + message : message;

    onSendMessage(fullMessage);
    setInput('');
  }, [input, isLoading, analysisType, onSendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickQuery = (query: string) => {
    setInput(query);
    inputRef.current?.focus();
  };

  const toggleSource = (sourceId: string) => {
    setActiveSourceIds(prev => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  };

  const lastAssistant = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i];
    }
    return null;
  }, [messages]);

  const activeTypeConfig = ANALYSIS_TYPES.find(t => t.id === analysisType);

  return (
    <div className="da-container">
      {/* Ambient Background */}
      <div className="da-ambient">
        <div className="da-grid-overlay" />
        <div className="da-glow-orb da-orb-1" />
        <div className="da-glow-orb da-orb-2" />
        <div className="da-constellation" />
      </div>

      {/* Main Layout */}
      <div className="da-layout">
        {/* Left Panel - Data Sources */}
        {showSources && (
          <aside className="da-sources-panel">
            <div className="da-panel-header">
              <div className="da-panel-title">
                <i className="fa fa-database" />
                <span>Data Sources</span>
              </div>
              <button
                onClick={() => setShowSources(false)}
                className="da-panel-close"
              >
                <i className="fa fa-chevron-left" />
              </button>
            </div>

            <div className="da-sources-list">
              {dataSources.length > 0 ? (
                <>
                  <div className="da-sources-header">
                    <span>{dataSources.length} source{dataSources.length !== 1 ? 's' : ''} indexed</span>
                    <button
                      onClick={() => {
                        if (activeSourceIds.size === dataSources.length) {
                          setActiveSourceIds(new Set());
                        } else {
                          setActiveSourceIds(new Set(dataSources.map(s => s.id)));
                        }
                      }}
                      className="da-select-all"
                    >
                      {activeSourceIds.size === dataSources.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  {dataSources.map(source => (
                    <DataSourceCard
                      key={source.id}
                      source={source}
                      isActive={activeSourceIds.has(source.id)}
                      onClick={() => toggleSource(source.id)}
                    />
                  ))}
                </>
              ) : (
                <div className="da-sources-empty">
                  <i className="fa fa-folder-open" />
                  <span>No data sources</span>
                  <p>Upload documents to begin analysis</p>
                </div>
              )}
            </div>

            {/* Data Visualization */}
            <div className="da-viz-section">
              <div className="da-viz-header">
                <i className="fa fa-wave-square" />
                <span>Activity</span>
              </div>
              <DataViz isActive={isLoading} />
            </div>
          </aside>
        )}

        {/* Center - Main Console */}
        <main className="da-console">
          {/* Header with Mode Switcher */}
          <header className="da-console-header">
            <div className="da-header-left">
              {!showSources && (
                <button
                  onClick={() => setShowSources(true)}
                  className="da-toggle-sources"
                >
                  <i className="fa fa-database" />
                  <span>{dataSources.length}</span>
                </button>
              )}
              <ModeSwitcher
                currentMode={currentMode}
                currentMission={currentMission}
                currentRoom={currentRoom}
                onChange={onModeChange || (() => {})}
                onMissionChange={onMissionChange}
                onRoomChange={onRoomChange}
              />
            </div>
            <div className="da-header-right">
              <button
                onClick={() => setShowEvidence(!showEvidence)}
                className={`da-header-btn ${showEvidence ? 'active' : ''}`}
                title="Toggle Evidence Panel"
              >
                <i className="fa fa-bookmark" />
              </button>
              <button
                onClick={() => setShowExport(true)}
                className="da-header-btn"
                title="Export Analysis"
              >
                <i className="fa fa-download" />
              </button>
            </div>
          </header>

          {/* Analysis Type Selector */}
          <div className="da-analysis-selector">
            <div className="da-selector-label">
              <i className="fa fa-sliders" />
              <span>Analysis Mode</span>
            </div>
            <div className="da-analysis-grid">
              {ANALYSIS_TYPES.map(type => (
                <AnalysisTypeCard
                  key={type.id}
                  type={type}
                  isActive={analysisType === type.id}
                  onClick={() => setAnalysisType(type.id)}
                />
              ))}
            </div>
          </div>

          {/* Quick Queries */}
          <div className="da-quick-queries">
            {QUICK_QUERIES[analysisType].map((query, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickQuery(query)}
                className="da-quick-btn"
              >
                <i className="fa fa-bolt" />
                {query}
              </button>
            ))}
          </div>

          {/* Messages Area */}
          <div className="da-messages">
            {messages.length === 0 ? (
              <EmptyState hasDocuments={hasDocuments} analysisType={analysisType} />
            ) : (
              messages.map((msg, idx) => (
                <AnalystMessage
                  key={idx}
                  message={msg}
                  thinkingSteps={thinkingLogs.get(msg.id)}
                  citations={msg.role === 'assistant' && idx === messages.length - 1 ? citations : []}
                />
              ))
            )}

            {isLoading && <AnalysisLoadingState />}

            <div ref={messagesEndRef} />
          </div>

          {/* Evidence Panel */}
          {showEvidence && citations.length > 0 && (
            <EvidencePanel
              citations={citations}
              isExpanded={true}
              onToggle={() => setShowEvidence(!showEvidence)}
            />
          )}

          {/* Input Area */}
          <div className="da-input-area">
            <div className="da-input-container">
              <div className="da-input-prefix">
                <i className={`fa ${activeTypeConfig?.icon || 'fa-search'}`} />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Ask a ${activeTypeConfig?.name.toLowerCase()} question...`}
                className="da-input"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="da-send-btn"
              >
                <i className="fa fa-paper-plane" />
                <span>Analyze</span>
              </button>
            </div>
            <div className="da-input-hints">
              <span><kbd>Enter</kbd> to send</span>
              <span><kbd>Shift+Enter</kbd> for new line</span>
              <span>{activeSourceIds.size} source{activeSourceIds.size !== 1 ? 's' : ''} active</span>
            </div>
          </div>
        </main>
      </div>

      {/* Export Modal */}
      {showExport && (
        <SessionExport
          sessionId={sessionId}
          sessionTitle={sessionTitle}
          messages={messages}
          mode="Data Analyst Mode"
          documents={documents}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
};

export default DataAnalystModeRedesigned;
