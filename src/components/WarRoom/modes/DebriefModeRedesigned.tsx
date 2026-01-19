import React, { useState, useRef, useEffect } from 'react';
import { AIMessage, ThinkingStep } from '../../../services/ragService';
import { SessionExport } from '../shared';
import './DebriefModeRedesigned.css';

interface ActionItem {
  id: string;
  text: string;
  priority: 'high' | 'medium' | 'low';
  assignee?: string;
  dueDate?: string;
  completed: boolean;
}

interface KeyInsight {
  id: string;
  text: string;
  category: 'win' | 'learning' | 'concern' | 'opportunity';
}

interface DebriefModeRedesignedProps {
  messages: AIMessage[];
  isLoading: boolean;
  thinkingLogs: Map<string, ThinkingStep[]>;
  onSendMessage: (message: string) => void;
  sessionId?: string;
  sessionTitle?: string;
  documents?: { title: string; summary?: string }[];
}

// Category configurations
const INSIGHT_CATEGORIES = [
  { id: 'win', label: 'Wins', icon: 'fa-trophy' },
  { id: 'learning', label: 'Learnings', icon: 'fa-graduation-cap' },
  { id: 'concern', label: 'Concerns', icon: 'fa-triangle-exclamation' },
  { id: 'opportunity', label: 'Opportunities', icon: 'fa-rocket' },
] as const;

const PRIORITY_CONFIG = {
  high: { label: 'High Priority' },
  medium: { label: 'Medium Priority' },
  low: { label: 'Low Priority' },
};

export const DebriefModeRedesigned: React.FC<DebriefModeRedesignedProps> = ({
  messages,
  isLoading,
  thinkingLogs,
  onSendMessage,
  sessionId = '',
  sessionTitle = 'Debrief Session',
  documents = []
}) => {
  const [input, setInput] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [sessionContext, setSessionContext] = useState('');
  const [isContextSet, setIsContextSet] = useState(false);
  const [insights, setInsights] = useState<KeyInsight[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [newInsightText, setNewInsightText] = useState('');
  const [newInsightCategory, setNewInsightCategory] = useState<KeyInsight['category']>('learning');
  const [newActionText, setNewActionText] = useState('');
  const [newActionPriority, setNewActionPriority] = useState<ActionItem['priority']>('medium');
  const [activeTab, setActiveTab] = useState<'insights' | 'actions'>('insights');
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSetContext = () => {
    if (!sessionContext.trim()) return;
    setIsContextSet(true);
    onSendMessage(`[DEBRIEF SESSION] I want to debrief and extract key takeaways from: "${sessionContext}".

Help me:
1. Summarize the key points and outcomes
2. Identify wins, learnings, and concerns
3. Extract actionable next steps
4. Highlight any patterns or insights

Start by asking me to share details about what happened.`);
  };

  const handleAddInsight = () => {
    if (!newInsightText.trim()) return;
    const newInsight: KeyInsight = {
      id: `insight-${Date.now()}`,
      text: newInsightText.trim(),
      category: newInsightCategory
    };
    setInsights([...insights, newInsight]);
    setNewInsightText('');
  };

  const handleDeleteInsight = (id: string) => {
    setInsights(insights.filter(i => i.id !== id));
  };

  const handleAddAction = () => {
    if (!newActionText.trim()) return;
    const newAction: ActionItem = {
      id: `action-${Date.now()}`,
      text: newActionText.trim(),
      priority: newActionPriority,
      completed: false
    };
    setActionItems([...actionItems, newAction]);
    setNewActionText('');
  };

  const handleToggleAction = (id: string) => {
    setActionItems(actionItems.map(a =>
      a.id === id ? { ...a, completed: !a.completed } : a
    ));
  };

  const handleDeleteAction = (id: string) => {
    setActionItems(actionItems.filter(a => a.id !== id));
  };

  const handleAskAI = (prompt: string) => {
    const context = `
Current insights: ${insights.map(i => `[${i.category}] ${i.text}`).join('; ')}
Current action items: ${actionItems.map(a => `[${a.priority}] ${a.text}`).join('; ')}
`;
    onSendMessage(`[DEBRIEF] ${prompt}\n\nContext:${context}`);
  };

  const handleSend = () => {
    const message = input.trim();
    if (!message) return;
    handleAskAI(message);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const generateSummary = () => {
    const insightsList = insights.map(i => `- [${i.category.toUpperCase()}] ${i.text}`).join('\n');
    const actionsList = actionItems.map(a => `- [${a.priority.toUpperCase()}] ${a.text}${a.completed ? ' ✓' : ''}`).join('\n');

    handleAskAI(`Generate a comprehensive debrief summary including:
1. Executive summary (2-3 sentences)
2. Key takeaways organized by category
3. Recommended next steps prioritized by impact
4. Any patterns or meta-insights

Current captured insights:
${insightsList || 'None captured yet'}

Current action items:
${actionsList || 'None captured yet'}`);
  };

  const quickPrompts = [
    'What went well?',
    'What could have gone better?',
    'What should we do differently?',
    'Summarize key decisions',
    'Extract action items'
  ];

  const sortedActions = [...actionItems].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const completionPercent = actionItems.length > 0
    ? Math.round((actionItems.filter(a => a.completed).length / actionItems.length) * 100)
    : 0;

  // Context setup screen
  if (!isContextSet) {
    return (
      <div className="dbr-container dbr-setup">
        {/* Ambient Background */}
        <div className="dbr-ambient">
          <div className="dbr-gradient-wash" />
          <div className="dbr-texture" />
          <div className="dbr-particles">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="dbr-particle" />
            ))}
          </div>
        </div>

        <div className="dbr-setup-content">
          {/* Header with Archive Icon */}
          <div className="dbr-setup-header">
            <div className="dbr-archive-icon">
              <div className="dbr-icon-core">
                <i className="fa fa-clipboard-check" />
              </div>
              <div className="dbr-icon-rings">
                <div className="dbr-icon-ring" />
                <div className="dbr-icon-ring" />
                <div className="dbr-icon-ring" />
              </div>
            </div>
            <h1 className="dbr-setup-title">
              <span>Debrief</span> Mode
            </h1>
            <p className="dbr-setup-subtitle">
              Extract insights, capture learnings, and define action items from any session
            </p>
          </div>

          {/* Setup Form */}
          <div className="dbr-setup-form">
            <label className="dbr-form-label">What are you debriefing?</label>
            <textarea
              value={sessionContext}
              onChange={(e) => setSessionContext(e.target.value)}
              placeholder="e.g., Sprint review, project launch, team meeting, incident response..."
              className="dbr-textarea"
              autoFocus
            />

            {/* Quick Suggestions */}
            <div className="dbr-suggestions">
              <p className="dbr-suggestions-label">Common debrief types:</p>
              <div className="dbr-suggestion-chips">
                {['Sprint retrospective', 'Project post-mortem', 'Meeting recap', 'Incident review'].map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => setSessionContext(suggestion)}
                    className="dbr-suggestion-chip"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSetContext}
              disabled={!sessionContext.trim()}
              className="dbr-btn dbr-btn-primary dbr-btn-lg"
            >
              <i className="fa fa-play" />
              Start Debrief
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dbr-container">
      {/* Ambient Background */}
      <div className="dbr-ambient">
        <div className="dbr-gradient-wash" />
        <div className="dbr-texture" />
        <div className="dbr-particles">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="dbr-particle" />
          ))}
        </div>
      </div>

      {/* Main Layout */}
      <div className="dbr-layout">
        {/* Left Sidebar - Insights & Actions */}
        <aside className={`dbr-sidebar ${sidebarVisible ? 'visible' : ''}`}>
          {/* Context Header */}
          <div className="dbr-context-header">
            <div className="dbr-context-badge">
              <i className="fa fa-clipboard-check" />
              <span className="dbr-context-text">{sessionContext}</span>
            </div>
            <div className="dbr-context-stats">
              <span>
                <i className="fa fa-lightbulb" />
                {insights.length} insights
              </span>
              <span>
                <i className="fa fa-list-check" />
                {actionItems.length} actions
              </span>
              <span>
                <i className="fa fa-check-circle" />
                {actionItems.filter(a => a.completed).length} done
              </span>
            </div>
          </div>

          {/* Progress Section */}
          {actionItems.length > 0 && (
            <div className="dbr-progress-section">
              <div className="dbr-progress-header">
                <span className="dbr-progress-label">Completion</span>
                <span className="dbr-progress-value">{completionPercent}%</span>
              </div>
              <div className="dbr-progress-bar">
                <div
                  className="dbr-progress-fill"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="dbr-tabs">
            <button
              onClick={() => setActiveTab('insights')}
              className={`dbr-tab ${activeTab === 'insights' ? 'active' : ''}`}
            >
              <i className="fa fa-lightbulb" />
              Insights
              {insights.length > 0 && (
                <span className="dbr-tab-count">{insights.length}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('actions')}
              className={`dbr-tab ${activeTab === 'actions' ? 'active' : ''}`}
            >
              <i className="fa fa-list-check" />
              Actions
              {actionItems.length > 0 && (
                <span className="dbr-tab-count">{actionItems.length}</span>
              )}
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'insights' ? (
            <>
              {/* Add Insight */}
              <div className="dbr-add-section">
                <div className="dbr-category-selector">
                  {INSIGHT_CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setNewInsightCategory(cat.id)}
                      className={`dbr-category-btn ${cat.id} ${newInsightCategory === cat.id ? 'active' : ''}`}
                      title={cat.label}
                    >
                      <i className={`fa ${cat.icon}`} />
                    </button>
                  ))}
                </div>
                <div className="dbr-add-input-row">
                  <input
                    type="text"
                    value={newInsightText}
                    onChange={(e) => setNewInsightText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddInsight()}
                    placeholder="Add insight..."
                    className="dbr-add-input"
                  />
                  <button
                    onClick={handleAddInsight}
                    disabled={!newInsightText.trim()}
                    className="dbr-add-btn"
                  >
                    <i className="fa fa-plus" />
                  </button>
                </div>
              </div>

              {/* Insights List */}
              <div className="dbr-items-list">
                {INSIGHT_CATEGORIES.map(cat => {
                  const categoryInsights = insights.filter(i => i.category === cat.id);
                  if (categoryInsights.length === 0) return null;
                  return (
                    <div key={cat.id} className="dbr-category-section">
                      <h4 className={`dbr-category-header ${cat.id}`}>
                        <i className={`fa ${cat.icon}`} />
                        {cat.label} ({categoryInsights.length})
                      </h4>
                      {categoryInsights.map(insight => (
                        <div
                          key={insight.id}
                          className={`dbr-insight-card ${insight.category}`}
                        >
                          <div className="dbr-insight-content">
                            <p className="dbr-insight-text">{insight.text}</p>
                            <button
                              onClick={() => handleDeleteInsight(insight.id)}
                              className="dbr-insight-delete"
                            >
                              <i className="fa fa-times" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}

                {insights.length === 0 && (
                  <div className="dbr-empty-state">
                    <i className="fa fa-lightbulb" />
                    <p>No insights yet</p>
                    <span>Capture key learnings as you debrief</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Add Action */}
              <div className="dbr-add-section">
                <div className="dbr-category-selector">
                  {(['high', 'medium', 'low'] as const).map(priority => (
                    <button
                      key={priority}
                      onClick={() => setNewActionPriority(priority)}
                      className={`dbr-category-btn dbr-priority-btn ${priority} ${newActionPriority === priority ? 'active' : ''}`}
                    >
                      {priority.charAt(0).toUpperCase() + priority.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="dbr-add-input-row">
                  <input
                    type="text"
                    value={newActionText}
                    onChange={(e) => setNewActionText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddAction()}
                    placeholder="Add action item..."
                    className="dbr-add-input"
                  />
                  <button
                    onClick={handleAddAction}
                    disabled={!newActionText.trim()}
                    className="dbr-add-btn"
                  >
                    <i className="fa fa-plus" />
                  </button>
                </div>
              </div>

              {/* Actions List */}
              <div className="dbr-items-list">
                {sortedActions.map(action => (
                  <div
                    key={action.id}
                    className={`dbr-action-card ${action.completed ? 'completed' : ''}`}
                  >
                    <div className="dbr-action-content">
                      <button
                        onClick={() => handleToggleAction(action.id)}
                        className={`dbr-action-checkbox ${action.completed ? 'checked' : ''}`}
                      >
                        <i className="fa fa-check" />
                      </button>
                      <div className="dbr-action-details">
                        <p className="dbr-action-text">{action.text}</p>
                        <span className={`dbr-action-priority ${action.priority}`}>
                          {PRIORITY_CONFIG[action.priority].label}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteAction(action.id)}
                        className="dbr-action-delete"
                      >
                        <i className="fa fa-times" />
                      </button>
                    </div>
                  </div>
                ))}

                {actionItems.length === 0 && (
                  <div className="dbr-empty-state">
                    <i className="fa fa-list-check" />
                    <p>No action items yet</p>
                    <span>Capture next steps and follow-ups</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Generate Summary Button */}
          <div className="dbr-sidebar-footer">
            <button
              onClick={generateSummary}
              disabled={isLoading}
              className="dbr-generate-btn"
            >
              <i className="fa fa-wand-magic-sparkles" />
              Generate Summary
            </button>
          </div>
        </aside>

        {/* Main Console Area */}
        <main className="dbr-main">
          {/* Console Header */}
          <header className="dbr-console-header">
            <div className="dbr-header-left">
              <button
                onClick={() => setSidebarVisible(!sidebarVisible)}
                className="dbr-header-btn dbr-mobile-toggle"
                title="Toggle sidebar"
              >
                <i className="fa fa-bars" />
              </button>
              <h2 className="dbr-header-title">
                <i className="fa fa-comments" />
                Debrief Discussion
              </h2>
            </div>
            <div className="dbr-header-actions">
              <button
                onClick={() => setShowExport(true)}
                className="dbr-header-btn"
                title="Export debrief"
              >
                <i className="fa fa-share-nodes" />
              </button>
            </div>
          </header>

          {/* Quick Prompts */}
          <div className="dbr-quick-prompts">
            {quickPrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleAskAI(prompt)}
                disabled={isLoading}
                className="dbr-quick-btn"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Messages Area */}
          <div className="dbr-messages">
            {messages.length === 0 ? (
              <div className="dbr-empty-chat">
                <div className="dbr-empty-icon">
                  <i className="fa fa-comments" />
                  <div className="dbr-empty-icon-ring" />
                  <div className="dbr-empty-icon-ring delay-1" />
                  <div className="dbr-empty-icon-ring delay-2" />
                </div>
                <h3>Ready to Debrief</h3>
                <p>Share what happened and I'll help extract insights and action items</p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`dbr-message ${msg.role === 'user' ? 'dbr-message-user' : 'dbr-message-ai'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="dbr-message-header">
                      <div className="dbr-ai-badge">
                        <i className="fa fa-clipboard-check" />
                        <span>Debrief AI</span>
                      </div>
                    </div>
                  )}
                  <div className="dbr-message-content">
                    <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="dbr-message dbr-message-ai">
                <div className="dbr-loading">
                  <div className="dbr-loading-icon">
                    <i className="fa fa-clipboard-check" />
                  </div>
                  <span className="dbr-loading-text">Processing debrief...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="dbr-input-area">
            <div className="dbr-input-container">
              <i className="fa fa-pen dbr-input-icon" />
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Share details, ask questions, or request analysis..."
                className="dbr-input"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className={`dbr-send-btn ${input.trim() ? 'active' : ''}`}
              >
                <i className="fa fa-paper-plane" />
              </button>
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
          topic={sessionContext}
          mode="Debrief Mode"
          documents={documents}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
};

export default DebriefModeRedesigned;
