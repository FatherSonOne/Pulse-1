import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AIMessage, ThinkingStep } from '../../../services/ragService';
import { SessionExport } from '../shared';

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

interface DebriefModeProps {
  messages: AIMessage[];
  isLoading: boolean;
  thinkingLogs: Map<string, ThinkingStep[]>;
  onSendMessage: (message: string) => void;
  sessionId?: string;
  sessionTitle?: string;
  documents?: { title: string; summary?: string }[];
}

// Brand palette: black, red/rose, white
const INSIGHT_CATEGORIES = [
  { id: 'win', label: 'Wins', icon: 'fa-trophy', color: 'text-rose-500 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-500/20', border: 'border-rose-200 dark:border-rose-500/40' },
  { id: 'learning', label: 'Learnings', icon: 'fa-graduation-cap', color: 'text-gray-700 dark:text-gray-300', bg: 'bg-gray-100 dark:bg-gray-500/20', border: 'border-gray-300 dark:border-gray-500/40' },
  { id: 'concern', label: 'Concerns', icon: 'fa-triangle-exclamation', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/20', border: 'border-red-200 dark:border-red-500/40' },
  { id: 'opportunity', label: 'Opportunities', icon: 'fa-rocket', color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-500/20', border: 'border-pink-200 dark:border-pink-500/40' },
];

const PRIORITY_STYLES = {
  high: { label: 'High', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/20' },
  medium: { label: 'Medium', color: 'text-gray-700 dark:text-gray-300', bg: 'bg-gray-100 dark:bg-gray-500/20' },
  low: { label: 'Low', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-500/20' },
};

export const DebriefMode: React.FC<DebriefModeProps> = ({
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
  const [activeTab, setActiveTab] = useState<'summary' | 'insights' | 'actions'>('summary');
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
    'What should we do differently next time?',
    'Summarize the key decisions made',
    'Extract action items from our discussion'
  ];

  const sortedActions = [...actionItems].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // Context setup screen
  if (!isContextSet) {
    return (
      <div className="h-full w-full flex items-center justify-center war-room-container">
        <div className="max-w-lg w-full p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-rose-500/20 to-pink-500/20 flex items-center justify-center">
              <i className="fa fa-clipboard-check text-3xl text-rose-500 dark:text-rose-400"></i>
            </div>
            <h2 className="text-2xl font-bold war-room-text-primary mb-2">Debrief Mode</h2>
            <p className="war-room-text-secondary">
              Extract insights, capture learnings, and define action items
            </p>
          </div>

          <div className="war-room-panel p-6">
            <label className="block text-sm font-medium war-room-text-primary mb-2">
              What are you debriefing?
            </label>
            <textarea
              value={sessionContext}
              onChange={(e) => setSessionContext(e.target.value)}
              placeholder="e.g., Sprint review, project launch, team meeting, incident response..."
              className="w-full px-4 py-3 bg-black/30 border border-white/20 rounded-lg text-white placeholder-white/40 focus:border-rose-500/50 focus:outline-none resize-none h-24"
              autoFocus
            />

            <button
              onClick={handleSetContext}
              disabled={!sessionContext.trim()}
              className="w-full mt-4 war-room-btn war-room-btn-primary py-3"
            >
              <i className="fa fa-play mr-2"></i>
              Start Debrief
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs war-room-text-secondary mb-3">Common debrief types:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {['Sprint retrospective', 'Project post-mortem', 'Meeting recap', 'Incident review'].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => setSessionContext(suggestion)}
                  className="war-room-btn text-xs px-3 py-1.5"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex war-room-container overflow-hidden">
      {/* Left Panel - Insights & Actions */}
      <div className="w-80 shrink-0 border-r border-white/10 flex flex-col bg-black/20">
        {/* Context Header */}
        <div className="p-4 border-b border-white/10 bg-gradient-to-r from-rose-500/10 to-red-500/10">
          <div className="flex items-center gap-2 mb-1">
            <i className="fa fa-clipboard-check text-rose-500 dark:text-rose-400"></i>
            <h3 className="text-sm font-semibold war-room-text-primary truncate">{sessionContext}</h3>
          </div>
          <div className="flex items-center gap-2 text-xs war-room-text-secondary">
            <span>{insights.length} insights</span>
            <span>•</span>
            <span>{actionItems.length} actions</span>
            <span>•</span>
            <span>{actionItems.filter(a => a.completed).length} done</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {[
            { id: 'insights', label: 'Insights', icon: 'fa-lightbulb' },
            { id: 'actions', label: 'Actions', icon: 'fa-list-check' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === tab.id
                  ? 'bg-rose-500/20 text-rose-500 dark:text-rose-400 border-b-2 border-rose-500'
                  : 'war-room-text-secondary hover:bg-white/5'
              }`}
            >
              <i className={`fa ${tab.icon}`}></i>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content based on tab */}
        <div className="flex-1 overflow-y-auto war-room-scrollbar">
          {activeTab === 'insights' ? (
            <div className="p-3 space-y-3">
              {/* Add Insight */}
              <div className="war-room-panel p-3">
                <div className="flex gap-2 mb-2">
                  {INSIGHT_CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setNewInsightCategory(cat.id as any)}
                      className={`flex-1 p-1.5 rounded text-xs transition-all ${
                        newInsightCategory === cat.id
                          ? `${cat.bg} ${cat.color} ${cat.border} border`
                          : 'war-room-btn'
                      }`}
                      title={cat.label}
                    >
                      <i className={`fa ${cat.icon}`}></i>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newInsightText}
                    onChange={(e) => setNewInsightText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddInsight()}
                    placeholder="Add insight..."
                    className="flex-1 px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:border-rose-500/50 focus:outline-none"
                  />
                  <button
                    onClick={handleAddInsight}
                    disabled={!newInsightText.trim()}
                    className="war-room-btn war-room-btn-icon-sm war-room-btn-primary"
                  >
                    <i className="fa fa-plus text-xs"></i>
                  </button>
                </div>
              </div>

              {/* Insights by Category */}
              {INSIGHT_CATEGORIES.map(cat => {
                const categoryInsights = insights.filter(i => i.category === cat.id);
                if (categoryInsights.length === 0) return null;
                return (
                  <div key={cat.id}>
                    <h4 className={`text-xs font-semibold ${cat.color} mb-2 flex items-center gap-1.5`}>
                      <i className={`fa ${cat.icon}`}></i>
                      {cat.label} ({categoryInsights.length})
                    </h4>
                    <div className="space-y-2">
                      {categoryInsights.map(insight => (
                        <div
                          key={insight.id}
                          className={`p-3 rounded-lg ${cat.bg} ${cat.border} border group`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm war-room-text-primary flex-1">{insight.text}</p>
                            <button
                              onClick={() => handleDeleteInsight(insight.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"
                            >
                              <i className="fa fa-times text-xs"></i>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {insights.length === 0 && (
                <div className="text-center py-8 war-room-text-secondary">
                  <i className="fa fa-lightbulb text-2xl opacity-30 mb-2"></i>
                  <p className="text-sm">No insights yet</p>
                  <p className="text-xs opacity-70">Capture key learnings as you debrief</p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 space-y-3">
              {/* Add Action */}
              <div className="war-room-panel p-3">
                <div className="flex gap-2 mb-2">
                  {(['high', 'medium', 'low'] as const).map(priority => {
                    const style = PRIORITY_STYLES[priority];
                    return (
                      <button
                        key={priority}
                        onClick={() => setNewActionPriority(priority)}
                        className={`flex-1 p-1.5 rounded text-xs transition-all ${
                          newActionPriority === priority
                            ? `${style.bg} ${style.color}`
                            : 'war-room-btn'
                        }`}
                      >
                        {style.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newActionText}
                    onChange={(e) => setNewActionText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddAction()}
                    placeholder="Add action item..."
                    className="flex-1 px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:border-rose-500/50 focus:outline-none"
                  />
                  <button
                    onClick={handleAddAction}
                    disabled={!newActionText.trim()}
                    className="war-room-btn war-room-btn-icon-sm war-room-btn-primary"
                  >
                    <i className="fa fa-plus text-xs"></i>
                  </button>
                </div>
              </div>

              {/* Action Items */}
              <div className="space-y-2">
                {sortedActions.map(action => {
                  const style = PRIORITY_STYLES[action.priority];
                  return (
                    <div
                      key={action.id}
                      className={`p-3 war-room-panel group ${action.completed ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => handleToggleAction(action.id)}
                          className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            action.completed
                              ? 'bg-emerald-500 border-emerald-500'
                              : 'border-white/30 hover:border-emerald-500'
                          }`}
                        >
                          {action.completed && <i className="fa fa-check text-white text-xs"></i>}
                        </button>
                        <div className="flex-1">
                          <p className={`text-sm war-room-text-primary ${action.completed ? 'line-through' : ''}`}>
                            {action.text}
                          </p>
                          <span className={`text-xs ${style.color}`}>{style.label} priority</span>
                        </div>
                        <button
                          onClick={() => handleDeleteAction(action.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"
                        >
                          <i className="fa fa-times text-xs"></i>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {actionItems.length === 0 && (
                <div className="text-center py-8 war-room-text-secondary">
                  <i className="fa fa-list-check text-2xl opacity-30 mb-2"></i>
                  <p className="text-sm">No action items yet</p>
                  <p className="text-xs opacity-70">Capture next steps and follow-ups</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Generate Summary Button */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={generateSummary}
            disabled={isLoading}
            className="w-full war-room-btn war-room-btn-primary py-2"
          >
            <i className="fa fa-wand-magic-sparkles mr-2"></i>
            Generate Summary
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="shrink-0 p-3 border-b border-white/10 flex items-center justify-between bg-black/20">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold war-room-text-primary">
              <i className="fa fa-comments mr-2 text-rose-500 dark:text-rose-400"></i>
              Debrief Discussion
            </h3>
          </div>

          <button
            onClick={() => setShowExport(true)}
            className="war-room-btn war-room-btn-icon-sm"
            title="Export debrief"
          >
            <i className="fa fa-share-nodes text-xs"></i>
          </button>
        </div>

        {/* Quick Prompts */}
        <div className="shrink-0 px-4 py-2 border-b border-white/10 bg-gradient-to-r from-indigo-500/5 to-purple-500/5">
          <div className="flex gap-2 overflow-x-auto pb-1 war-room-scrollbar">
            {quickPrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleAskAI(prompt)}
                className="war-room-btn text-xs px-3 py-1.5 whitespace-nowrap shrink-0"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto war-room-scrollbar p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-rose-500/20 to-pink-500/20 flex items-center justify-center">
                  <i className="fa fa-comments text-2xl text-rose-500 dark:text-rose-400"></i>
                </div>
                <h3 className="text-lg font-semibold war-room-text-primary mb-2">
                  Ready to Debrief
                </h3>
                <p className="text-sm war-room-text-secondary">
                  Share what happened and I'll help extract insights and action items
                </p>
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
                      ? 'war-room-message-user'
                      : 'war-room-message-ai'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                      <i className="fa fa-clipboard-check text-rose-500 dark:text-rose-400 text-xs"></i>
                      <span className="text-xs text-rose-500 dark:text-rose-400 font-medium">Debrief AI</span>
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex justify-start">
              <div className="war-room-message-ai">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-rose-500/30 flex items-center justify-center">
                    <i className="fa fa-clipboard-check text-rose-500 dark:text-rose-400 text-xs animate-pulse"></i>
                  </div>
                  <span className="text-sm war-room-text-secondary">Processing debrief...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="shrink-0 p-4 war-room-input-area">
          <div className="flex items-center gap-2">
            <div className="flex-1 war-room-panel-inset flex items-center gap-2 px-4 py-3">
              <i className="fa fa-pen text-rose-500 dark:text-rose-400 text-sm"></i>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Share details, ask questions, or request analysis..."
                className="flex-1 bg-transparent border-none outline-none text-sm"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className={`war-room-btn war-room-btn-icon-sm ${
                  input.trim() ? 'war-room-btn-primary' : ''
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
          topic={sessionContext}
          mode="Debrief Mode"
          documents={documents}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
};
