/**
 * War Room Redesigned - Tactical Operations Center
 *
 * A bold, mission-control aesthetic for strategic work.
 * Features: Mission briefing, tactical console, intel panel, real-time status
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { AIMessage, ThinkingStep, KnowledgeDoc } from '../../services/ragService';
import './WarRoomRedesigned.css';

// ============= TYPES =============

interface WarRoomRedesignedProps {
  messages: AIMessage[];
  isLoading: boolean;
  thinkingLogs: Map<string, ThinkingStep[]>;
  documents: KnowledgeDoc[];
  onSendMessage: (message: string) => void;
  onGenerateAudio?: () => void;
  onExport?: () => void;
  currentMode?: string;
  sessionName?: string;
  onModeChange?: (mode: string) => void;
}

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  prompt: string;
  color: string;
}

interface StatusIndicator {
  label: string;
  status: 'online' | 'processing' | 'warning' | 'offline';
  detail?: string;
}

// ============= CONSTANTS =============

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'analyze', label: 'Analyze', icon: 'fa-microscope', prompt: 'Analyze the current context and provide key insights', color: 'cyan' },
  { id: 'summarize', label: 'Summarize', icon: 'fa-compress-alt', prompt: 'Summarize our discussion so far', color: 'emerald' },
  { id: 'strategize', label: 'Strategize', icon: 'fa-chess', prompt: 'What strategic options should we consider?', color: 'amber' },
  { id: 'risks', label: 'Risks', icon: 'fa-exclamation-triangle', prompt: 'What are the potential risks and how can we mitigate them?', color: 'rose' },
  { id: 'actions', label: 'Actions', icon: 'fa-tasks', prompt: 'List the action items from our discussion', color: 'violet' },
  { id: 'deep-dive', label: 'Deep Dive', icon: 'fa-search-plus', prompt: 'Let\'s explore this topic in more depth', color: 'blue' },
];

const TACTICAL_MODES = [
  { id: 'focus', label: 'FOCUS', icon: 'fa-crosshairs', desc: 'Deep work mode' },
  { id: 'analyst', label: 'ANALYST', icon: 'fa-chart-line', desc: 'Data-driven analysis' },
  { id: 'strategist', label: 'STRATEGIST', icon: 'fa-chess-knight', desc: 'Decision frameworks' },
  { id: 'brainstorm', label: 'BRAINSTORM', icon: 'fa-lightbulb', desc: 'Creative ideation' },
];

// ============= SUBCOMPONENTS =============

const ScanLine: React.FC = () => (
  <div className="wr-scan-line" />
);

const StatusBeacon: React.FC<{ status: 'online' | 'processing' | 'warning' | 'offline' }> = ({ status }) => {
  const colors = {
    online: 'bg-emerald-500',
    processing: 'bg-cyan-500 animate-pulse',
    warning: 'bg-amber-500',
    offline: 'bg-gray-500',
  };
  return <div className={`wr-beacon ${colors[status]}`} />;
};

const DataPulse: React.FC<{ active: boolean }> = ({ active }) => (
  <div className={`wr-data-pulse ${active ? 'active' : ''}`}>
    <div className="wr-pulse-ring" />
    <div className="wr-pulse-ring delay-1" />
    <div className="wr-pulse-ring delay-2" />
  </div>
);

const MiniChart: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
  const max = Math.max(...data, 1);
  return (
    <div className="wr-mini-chart">
      {data.slice(-20).map((val, i) => (
        <div
          key={i}
          className={`wr-chart-bar bg-${color}-500`}
          style={{ height: `${(val / max) * 100}%`, opacity: 0.3 + (i / 20) * 0.7 }}
        />
      ))}
    </div>
  );
};

const GlowingBorder: React.FC<{ children: React.ReactNode; color?: string; className?: string }> = ({
  children,
  color = 'cyan',
  className = ''
}) => (
  <div className={`wr-glow-border wr-glow-${color} ${className}`}>
    {children}
  </div>
);

// Mission Briefing Panel (Left Sidebar)
const MissionBriefing: React.FC<{
  documents: KnowledgeDoc[];
  sessionName: string;
  messageCount: number;
  currentMode: string;
  onModeChange: (mode: string) => void;
}> = ({ documents, sessionName, messageCount, currentMode, onModeChange }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const processedDocs = documents.filter(d => d.processing_status === 'completed');

  return (
    <div className={`wr-mission-panel ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Panel Header */}
      <div className="wr-panel-header">
        <div className="wr-panel-title">
          <i className="fa fa-satellite-dish wr-icon-glow" />
          <span>MISSION BRIEF</span>
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="wr-collapse-btn"
        >
          <i className={`fa fa-chevron-${isCollapsed ? 'right' : 'left'}`} />
        </button>
      </div>

      {!isCollapsed && (
        <>
          {/* Session Info */}
          <div className="wr-session-card">
            <div className="wr-session-label">ACTIVE SESSION</div>
            <div className="wr-session-name">{sessionName || 'Untitled Operation'}</div>
            <div className="wr-session-meta">
              <span><i className="fa fa-comments" /> {messageCount} msgs</span>
              <span><i className="fa fa-file-alt" /> {documents.length} docs</span>
            </div>
          </div>

          {/* Tactical Mode Selector */}
          <div className="wr-mode-section">
            <div className="wr-section-label">TACTICAL MODE</div>
            <div className="wr-mode-grid">
              {TACTICAL_MODES.map(mode => (
                <button
                  key={mode.id}
                  onClick={() => onModeChange(mode.id)}
                  className={`wr-mode-btn ${currentMode === mode.id ? 'active' : ''}`}
                  title={mode.desc}
                >
                  <i className={`fa ${mode.icon}`} />
                  <span>{mode.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Intel Assets */}
          <div className="wr-intel-section">
            <div className="wr-section-label">
              <span>INTEL ASSETS</span>
              <span className="wr-count-badge">{processedDocs.length}</span>
            </div>
            <div className="wr-intel-list">
              {documents.length === 0 ? (
                <div className="wr-empty-state">
                  <i className="fa fa-folder-open" />
                  <span>No assets loaded</span>
                </div>
              ) : (
                documents.slice(0, 6).map(doc => (
                  <div key={doc.id} className="wr-intel-item">
                    <div className="wr-intel-icon">
                      <i className={`fa fa-${doc.file_type === 'pdf' ? 'file-pdf' : 'file-alt'}`} />
                    </div>
                    <div className="wr-intel-info">
                      <div className="wr-intel-name">{doc.title || 'Untitled'}</div>
                      <div className="wr-intel-meta">
                        <StatusBeacon status={doc.processing_status === 'completed' ? 'online' : 'processing'} />
                        <span>{doc.processing_status}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            {documents.length > 6 && (
              <button className="wr-view-all-btn">
                +{documents.length - 6} more assets
              </button>
            )}
          </div>

          {/* System Status */}
          <div className="wr-status-section">
            <div className="wr-section-label">SYSTEM STATUS</div>
            <div className="wr-status-grid">
              <div className="wr-status-item">
                <StatusBeacon status="online" />
                <span>AI Core</span>
              </div>
              <div className="wr-status-item">
                <StatusBeacon status="online" />
                <span>Vector DB</span>
              </div>
              <div className="wr-status-item">
                <StatusBeacon status="online" />
                <span>Knowledge</span>
              </div>
              <div className="wr-status-item">
                <StatusBeacon status="online" />
                <span>Realtime</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Tactical Console (Main Chat Area)
const TacticalConsole: React.FC<{
  messages: AIMessage[];
  isLoading: boolean;
  thinkingLogs: Map<string, ThinkingStep[]>;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onQuickAction: (prompt: string) => void;
}> = ({ messages, isLoading, thinkingLogs, input, onInputChange, onSend, onQuickAction }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="wr-console">
      {/* Console Header */}
      <div className="wr-console-header">
        <div className="wr-console-title">
          <i className="fa fa-terminal" />
          <span>TACTICAL CONSOLE</span>
          <DataPulse active={isLoading} />
        </div>
        <div className="wr-console-status">
          <span className="wr-timestamp">{new Date().toLocaleTimeString()}</span>
          <span className="wr-msg-count">{messages.length} transmissions</span>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="wr-quick-actions">
        {QUICK_ACTIONS.map(action => (
          <button
            key={action.id}
            onClick={() => onQuickAction(action.prompt)}
            className={`wr-quick-btn wr-quick-${action.color}`}
            disabled={isLoading}
          >
            <i className={`fa ${action.icon}`} />
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      {/* Messages Area */}
      <div className="wr-messages">
        <ScanLine />

        {messages.length === 0 ? (
          <div className="wr-welcome">
            <div className="wr-welcome-icon">
              <i className="fa fa-shield-alt" />
              <div className="wr-welcome-rings">
                <div className="wr-ring" />
                <div className="wr-ring delay-1" />
                <div className="wr-ring delay-2" />
              </div>
            </div>
            <h2>TACTICAL OPERATIONS CENTER</h2>
            <p>Your strategic AI command interface is ready. Upload intel assets, engage tactical modes, and begin your mission.</p>
            <div className="wr-welcome-grid">
              <div className="wr-welcome-feature">
                <i className="fa fa-brain" />
                <span>AI Analysis</span>
              </div>
              <div className="wr-welcome-feature">
                <i className="fa fa-search" />
                <span>Deep Research</span>
              </div>
              <div className="wr-welcome-feature">
                <i className="fa fa-project-diagram" />
                <span>Strategy Maps</span>
              </div>
              <div className="wr-welcome-feature">
                <i className="fa fa-microphone" />
                <span>Voice Command</span>
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const thinking = thinkingLogs.get(msg.id);
            return (
              <div
                key={msg.id}
                className={`wr-message wr-message-${msg.role}`}
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                {msg.role === 'user' ? (
                  <div className="wr-msg-user">
                    <div className="wr-msg-header">
                      <i className="fa fa-user-astronaut" />
                      <span>OPERATOR</span>
                      <span className="wr-msg-time">
                        {new Date(msg.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="wr-msg-content">{msg.content}</div>
                  </div>
                ) : (
                  <div className="wr-msg-ai">
                    <div className="wr-msg-header">
                      <div className="wr-ai-avatar">
                        <i className="fa fa-robot" />
                        <div className="wr-ai-pulse" />
                      </div>
                      <span>PULSE AI</span>
                      <span className="wr-msg-time">
                        {new Date(msg.created_at).toLocaleTimeString()}
                      </span>
                    </div>

                    {/* Thinking Steps */}
                    {thinking && thinking.length > 0 && (
                      <div className="wr-thinking">
                        <div className="wr-thinking-header">
                          <i className="fa fa-cogs" />
                          <span>Processing Chain</span>
                        </div>
                        <div className="wr-thinking-steps">
                          {thinking.map((step, i) => (
                            <div key={i} className="wr-thinking-step">
                              <span className="wr-step-num">{i + 1}</span>
                              <span className="wr-step-text">{step.thought}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="wr-msg-content">{msg.content}</div>

                    {/* Citations */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="wr-citations">
                        <div className="wr-citations-label">
                          <i className="fa fa-bookmark" />
                          INTEL SOURCES
                        </div>
                        <div className="wr-citations-list">
                          {msg.citations.map((cite, i) => (
                            <span key={i} className="wr-citation-tag">
                              {cite}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="wr-message wr-message-loading">
            <div className="wr-loading-indicator">
              <div className="wr-loading-dots">
                <span /><span /><span />
              </div>
              <span>Processing tactical data...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="wr-input-area">
        <div className="wr-input-container">
          <div className="wr-input-prefix">
            <i className="fa fa-chevron-right" />
          </div>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter command or query..."
            className="wr-input"
            rows={1}
          />
          <div className="wr-input-actions">
            <button className="wr-input-btn" title="Voice Input">
              <i className="fa fa-microphone" />
            </button>
            <button className="wr-input-btn" title="Attach File">
              <i className="fa fa-paperclip" />
            </button>
            <button
              onClick={onSend}
              disabled={!input.trim() || isLoading}
              className="wr-send-btn"
            >
              <i className="fa fa-paper-plane" />
              <span>TRANSMIT</span>
            </button>
          </div>
        </div>
        <div className="wr-input-hints">
          <span><kbd>Enter</kbd> to send</span>
          <span><kbd>Shift+Enter</kbd> for new line</span>
        </div>
      </div>
    </div>
  );
};

// Intel Panel (Right Sidebar)
const IntelPanel: React.FC<{
  messages: AIMessage[];
  thinkingLogs: Map<string, ThinkingStep[]>;
  latencyData: number[];
  onExport: () => void;
  onGenerateAudio: () => void;
}> = ({ messages, thinkingLogs, latencyData, onExport, onGenerateAudio }) => {
  const [activeTab, setActiveTab] = useState<'metrics' | 'timeline' | 'export'>('metrics');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const totalTokens = useMemo(() =>
    messages.reduce((sum, msg) => sum + msg.content.length, 0),
    [messages]
  );

  const avgLatency = useMemo(() =>
    latencyData.length > 0
      ? Math.round(latencyData.reduce((a, b) => a + b, 0) / latencyData.length)
      : 0,
    [latencyData]
  );

  const thinkingStepCount = useMemo(() =>
    Array.from(thinkingLogs.values()).reduce((sum, steps) => sum + steps.length, 0),
    [thinkingLogs]
  );

  return (
    <div className={`wr-intel-panel ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Panel Header */}
      <div className="wr-panel-header">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="wr-collapse-btn"
        >
          <i className={`fa fa-chevron-${isCollapsed ? 'left' : 'right'}`} />
        </button>
        <div className="wr-panel-title">
          <i className="fa fa-chart-area wr-icon-glow" />
          <span>INTEL FEED</span>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Tab Navigation */}
          <div className="wr-intel-tabs">
            <button
              onClick={() => setActiveTab('metrics')}
              className={`wr-tab ${activeTab === 'metrics' ? 'active' : ''}`}
            >
              <i className="fa fa-tachometer-alt" />
              <span>Metrics</span>
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`wr-tab ${activeTab === 'timeline' ? 'active' : ''}`}
            >
              <i className="fa fa-stream" />
              <span>Timeline</span>
            </button>
            <button
              onClick={() => setActiveTab('export')}
              className={`wr-tab ${activeTab === 'export' ? 'active' : ''}`}
            >
              <i className="fa fa-download" />
              <span>Export</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="wr-intel-content">
            {activeTab === 'metrics' && (
              <div className="wr-metrics">
                {/* Key Stats */}
                <div className="wr-stat-grid">
                  <div className="wr-stat-card">
                    <div className="wr-stat-value">{messages.length}</div>
                    <div className="wr-stat-label">Messages</div>
                  </div>
                  <div className="wr-stat-card">
                    <div className="wr-stat-value">{avgLatency}<span className="wr-stat-unit">ms</span></div>
                    <div className="wr-stat-label">Avg Latency</div>
                  </div>
                  <div className="wr-stat-card">
                    <div className="wr-stat-value">{thinkingStepCount}</div>
                    <div className="wr-stat-label">Think Steps</div>
                  </div>
                  <div className="wr-stat-card">
                    <div className="wr-stat-value">~{Math.round(totalTokens / 4)}</div>
                    <div className="wr-stat-label">Tokens</div>
                  </div>
                </div>

                {/* Latency Chart */}
                <div className="wr-chart-section">
                  <div className="wr-chart-header">
                    <span>Response Latency</span>
                    <span className="wr-chart-live">LIVE</span>
                  </div>
                  <MiniChart data={latencyData} color="cyan" />
                </div>

                {/* Performance Gauge */}
                <div className="wr-gauge-section">
                  <div className="wr-gauge">
                    <svg viewBox="0 0 100 50" className="wr-gauge-svg">
                      <path
                        d="M 10 45 A 35 35 0 0 1 90 45"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        strokeLinecap="round"
                        className="wr-gauge-bg"
                      />
                      <path
                        d="M 10 45 A 35 35 0 0 1 90 45"
                        fill="none"
                        stroke="url(#gaugeGradient)"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray="140"
                        strokeDashoffset={140 - (avgLatency < 500 ? 140 * 0.9 : 140 * 0.5)}
                        className="wr-gauge-fill"
                      />
                      <defs>
                        <linearGradient id="gaugeGradient">
                          <stop offset="0%" stopColor="#06b6d4" />
                          <stop offset="100%" stopColor="#10b981" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="wr-gauge-label">
                      <span className="wr-gauge-value">{avgLatency < 500 ? 'OPTIMAL' : 'NORMAL'}</span>
                      <span className="wr-gauge-sub">System Performance</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'timeline' && (
              <div className="wr-timeline">
                {messages.slice(-10).reverse().map((msg, idx) => (
                  <div key={msg.id} className="wr-timeline-item">
                    <div className="wr-timeline-marker">
                      <div className={`wr-marker-dot ${msg.role}`} />
                      {idx < messages.slice(-10).length - 1 && <div className="wr-marker-line" />}
                    </div>
                    <div className="wr-timeline-content">
                      <div className="wr-timeline-header">
                        <span className={`wr-timeline-role ${msg.role}`}>
                          {msg.role === 'user' ? 'Operator' : 'AI'}
                        </span>
                        <span className="wr-timeline-time">
                          {new Date(msg.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="wr-timeline-text">
                        {msg.content.slice(0, 100)}{msg.content.length > 100 ? '...' : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'export' && (
              <div className="wr-export">
                <div className="wr-export-header">
                  <i className="fa fa-file-export" />
                  <span>Export Options</span>
                </div>
                <div className="wr-export-options">
                  <button onClick={onExport} className="wr-export-btn">
                    <i className="fa fa-file-alt" />
                    <div>
                      <span className="wr-export-title">Full Transcript</span>
                      <span className="wr-export-desc">Export all messages as text</span>
                    </div>
                  </button>
                  <button onClick={onGenerateAudio} className="wr-export-btn">
                    <i className="fa fa-volume-up" />
                    <div>
                      <span className="wr-export-title">Audio Summary</span>
                      <span className="wr-export-desc">Generate spoken overview</span>
                    </div>
                  </button>
                  <button className="wr-export-btn">
                    <i className="fa fa-file-pdf" />
                    <div>
                      <span className="wr-export-title">PDF Report</span>
                      <span className="wr-export-desc">Formatted briefing document</span>
                    </div>
                  </button>
                  <button className="wr-export-btn">
                    <i className="fa fa-code" />
                    <div>
                      <span className="wr-export-title">JSON Data</span>
                      <span className="wr-export-desc">Raw session data export</span>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ============= MAIN COMPONENT =============

export const WarRoomRedesigned: React.FC<WarRoomRedesignedProps> = ({
  messages,
  isLoading,
  thinkingLogs,
  documents,
  onSendMessage,
  onGenerateAudio,
  onExport,
  currentMode = 'focus',
  sessionName = 'New Operation',
  onModeChange,
}) => {
  const [input, setInput] = useState('');
  const [latencyData, setLatencyData] = useState<number[]>([]);

  // Simulate latency data
  useEffect(() => {
    const interval = setInterval(() => {
      setLatencyData(prev => [...prev.slice(-29), Math.random() * 400 + 100]);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSend = useCallback(() => {
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
  }, [input, onSendMessage]);

  const handleQuickAction = useCallback((prompt: string) => {
    onSendMessage(prompt);
  }, [onSendMessage]);

  const handleModeChange = useCallback((mode: string) => {
    onModeChange?.(mode);
  }, [onModeChange]);

  return (
    <div className="wr-container">
      {/* Ambient Background Effects */}
      <div className="wr-ambient">
        <div className="wr-grid-overlay" />
        <div className="wr-glow-orb wr-orb-1" />
        <div className="wr-glow-orb wr-orb-2" />
        <div className="wr-corner-accent wr-corner-tl" />
        <div className="wr-corner-accent wr-corner-tr" />
        <div className="wr-corner-accent wr-corner-bl" />
        <div className="wr-corner-accent wr-corner-br" />
      </div>

      {/* Main Layout */}
      <div className="wr-layout">
        {/* Left Panel - Mission Briefing */}
        <MissionBriefing
          documents={documents}
          sessionName={sessionName}
          messageCount={messages.length}
          currentMode={currentMode}
          onModeChange={handleModeChange}
        />

        {/* Center - Tactical Console */}
        <TacticalConsole
          messages={messages}
          isLoading={isLoading}
          thinkingLogs={thinkingLogs}
          input={input}
          onInputChange={setInput}
          onSend={handleSend}
          onQuickAction={handleQuickAction}
        />

        {/* Right Panel - Intel Feed */}
        <IntelPanel
          messages={messages}
          thinkingLogs={thinkingLogs}
          latencyData={latencyData}
          onExport={onExport || (() => {})}
          onGenerateAudio={onGenerateAudio || (() => {})}
        />
      </div>
    </div>
  );
};

export default WarRoomRedesigned;
