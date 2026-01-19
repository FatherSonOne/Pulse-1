// Enhanced Proactive Insights with AI-Powered Analysis
import React, { useState, useMemo } from 'react';

interface Insight {
  id: string;
  type: 'opportunity' | 'risk' | 'reminder' | 'suggestion' | 'pattern' | 'milestone';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  reasoning: string;
  suggestedActions: Array<{
    label: string;
    action: string;
    type: 'quick' | 'detailed';
  }>;
  context: {
    relatedMessages?: number;
    timeframe?: string;
    confidence: number;
  };
  dismissable: boolean;
}

interface ProactiveInsightsEnhancedProps {
  messages: Array<{
    id: string;
    text: string;
    sender: 'user' | 'other';
    timestamp: string;
  }>;
  contactName: string;
  onActionClick?: (action: string) => void;
  onDismiss?: (insightId: string) => void;
  compact?: boolean;
}

export const ProactiveInsightsEnhanced: React.FC<ProactiveInsightsEnhancedProps> = ({
  messages,
  contactName,
  onActionClick,
  onDismiss,
  compact = false
}) => {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Generate insights based on message analysis
  const insights = useMemo((): Insight[] => {
    if (!messages || messages.length < 3) return [];

    const insights: Insight[] = [];
    const now = new Date();
    const lastMessage = messages[messages.length - 1];
    const lastMessageDate = new Date(lastMessage.timestamp);
    const daysSinceLastMessage = Math.floor((now.getTime() - lastMessageDate.getTime()) / (1000 * 60 * 60 * 24));

    // Check for stale conversation
    if (daysSinceLastMessage > 3 && lastMessage.sender === 'other') {
      insights.push({
        id: 'stale-conversation',
        type: 'reminder',
        priority: 'medium',
        title: 'Conversation needs attention',
        description: `${contactName} sent the last message ${daysSinceLastMessage} days ago. Consider responding.`,
        reasoning: 'Long gaps in communication can reduce engagement and relationship quality.',
        suggestedActions: [
          { label: 'Quick check-in', action: `Hey ${contactName}, just wanted to follow up on our conversation!`, type: 'quick' },
          { label: 'Schedule reminder', action: 'schedule-reminder', type: 'detailed' }
        ],
        context: { timeframe: `${daysSinceLastMessage} days`, confidence: 0.9 },
        dismissable: true
      });
    }

    // Check for unanswered questions
    const recentMessages = messages.slice(-10);
    const unansweredQuestions = recentMessages.filter((msg, idx) => {
      if (msg.sender !== 'other') return false;
      if (!msg.text.includes('?')) return false;
      // Check if user responded after this question
      const laterMessages = recentMessages.slice(idx + 1);
      return !laterMessages.some(m => m.sender === 'user');
    });

    if (unansweredQuestions.length > 0) {
      insights.push({
        id: 'unanswered-question',
        type: 'opportunity',
        priority: 'high',
        title: 'Pending question',
        description: `${contactName} asked a question that hasn't been answered yet.`,
        reasoning: 'Unanswered questions can block decisions and slow down progress.',
        suggestedActions: [
          { label: 'View question', action: 'scroll-to-question', type: 'quick' },
          { label: 'Draft response', action: 'open-composer', type: 'detailed' }
        ],
        context: { relatedMessages: unansweredQuestions.length, confidence: 0.95 },
        dismissable: false
      });
    }

    // Detect potential action items
    const actionPhrases = ['need to', 'should', 'have to', 'will do', 'let me', "i'll", 'todo', 'action'];
    const potentialActions = messages.slice(-15).filter(msg =>
      actionPhrases.some(phrase => msg.text.toLowerCase().includes(phrase))
    );

    if (potentialActions.length >= 2) {
      insights.push({
        id: 'potential-tasks',
        type: 'suggestion',
        priority: 'medium',
        title: 'Potential action items detected',
        description: `Found ${potentialActions.length} messages that might contain tasks or commitments.`,
        reasoning: 'Tracking action items improves accountability and task completion rates.',
        suggestedActions: [
          { label: 'Extract tasks', action: 'extract-tasks', type: 'detailed' },
          { label: 'Create decision', action: 'create-decision', type: 'detailed' }
        ],
        context: { relatedMessages: potentialActions.length, confidence: 0.75 },
        dismissable: true
      });
    }

    // Detect conversation patterns
    const userMessages = messages.filter(m => m.sender === 'user');
    const otherMessages = messages.filter(m => m.sender === 'other');
    const ratio = userMessages.length / Math.max(otherMessages.length, 1);

    if (ratio < 0.5) {
      insights.push({
        id: 'low-participation',
        type: 'pattern',
        priority: 'low',
        title: 'Low participation detected',
        description: `You've sent fewer messages than ${contactName} in this conversation.`,
        reasoning: 'Balanced conversations tend to have better outcomes and stronger relationships.',
        suggestedActions: [
          { label: 'See suggestions', action: 'show-templates', type: 'quick' }
        ],
        context: { confidence: 0.7 },
        dismissable: true
      });
    } else if (ratio > 2) {
      insights.push({
        id: 'high-participation',
        type: 'pattern',
        priority: 'low',
        title: 'Consider waiting for response',
        description: `You've sent more messages than ${contactName}. They might need time to respond.`,
        reasoning: 'Giving others time to respond can lead to more thoughtful conversations.',
        suggestedActions: [
          { label: 'Set reminder', action: 'set-reminder', type: 'detailed' }
        ],
        context: { confidence: 0.65 },
        dismissable: true
      });
    }

    // Check for milestones
    if (messages.length === 100 || messages.length === 500 || messages.length === 1000) {
      insights.push({
        id: `milestone-${messages.length}`,
        type: 'milestone',
        priority: 'low',
        title: `${messages.length} messages milestone!`,
        description: `You've exchanged ${messages.length} messages with ${contactName}.`,
        reasoning: 'Celebrating milestones strengthens relationships.',
        suggestedActions: [
          { label: 'View conversation stats', action: 'show-stats', type: 'quick' }
        ],
        context: { confidence: 1 },
        dismissable: true
      });
    }

    // Detect potential deadlines
    const datePatterns = /\b(by|before|until|due|deadline|on)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week|end of week|eow|eod)\b/i;
    const messagesWithDates = messages.slice(-20).filter(msg =>
      datePatterns.test(msg.text.toLowerCase())
    );

    if (messagesWithDates.length > 0) {
      insights.push({
        id: 'deadline-detected',
        type: 'risk',
        priority: 'high',
        title: 'Deadline mentioned',
        description: 'Recent messages mention time-sensitive items.',
        reasoning: 'Tracking deadlines helps prevent missed commitments.',
        suggestedActions: [
          { label: 'Create reminder', action: 'create-reminder', type: 'detailed' },
          { label: 'Add to calendar', action: 'add-to-calendar', type: 'detailed' }
        ],
        context: { relatedMessages: messagesWithDates.length, confidence: 0.8 },
        dismissable: true
      });
    }

    return insights.filter(i => !dismissedIds.has(i.id));
  }, [messages, contactName, dismissedIds]);

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
    onDismiss?.(id);
  };

  const getTypeIcon = (type: Insight['type']) => {
    switch (type) {
      case 'opportunity': return 'fa-lightbulb';
      case 'risk': return 'fa-exclamation-triangle';
      case 'reminder': return 'fa-bell';
      case 'suggestion': return 'fa-wand-magic-sparkles';
      case 'pattern': return 'fa-chart-line';
      case 'milestone': return 'fa-trophy';
      default: return 'fa-info-circle';
    }
  };

  const getTypeColor = (type: Insight['type']) => {
    switch (type) {
      case 'opportunity': return 'text-amber-500 bg-amber-100 dark:bg-amber-900/40';
      case 'risk': return 'text-red-500 bg-red-100 dark:bg-red-900/40';
      case 'reminder': return 'text-blue-500 bg-blue-100 dark:bg-blue-900/40';
      case 'suggestion': return 'text-purple-500 bg-purple-100 dark:bg-purple-900/40';
      case 'pattern': return 'text-cyan-500 bg-cyan-100 dark:bg-cyan-900/40';
      case 'milestone': return 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/40';
      default: return 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800';
    }
  };

  const getPriorityIndicator = (priority: Insight['priority']) => {
    switch (priority) {
      case 'high': return 'border-l-red-500';
      case 'medium': return 'border-l-amber-500';
      case 'low': return 'border-l-blue-500';
    }
  };

  if (insights.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
          <i className="fa-solid fa-lightbulb text-xs" />
          <span className="text-xs font-medium">{insights.length} insights</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
              <i className="fa-solid fa-brain text-purple-500 text-sm" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-800 dark:text-white">AI Insights</h3>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{insights.length} proactive suggestions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Insights List */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-700">
        {insights.slice(0, 5).map(insight => (
          <div
            key={insight.id}
            className={`p-3 border-l-4 ${getPriorityIndicator(insight.priority)} transition-all hover:bg-zinc-50 dark:hover:bg-zinc-700/50`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${getTypeColor(insight.type)}`}>
                <i className={`fa-solid ${getTypeIcon(insight.type)} text-sm`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-zinc-800 dark:text-white">
                      {insight.title}
                    </h4>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                      {insight.description}
                    </p>
                  </div>
                  {insight.dismissable && (
                    <button
                      onClick={() => handleDismiss(insight.id)}
                      className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    >
                      <i className="fa-solid fa-times text-xs" />
                    </button>
                  )}
                </div>

                {/* Expanded reasoning */}
                {expandedId === insight.id && (
                  <div className="mt-2 p-2 bg-zinc-50 dark:bg-zinc-900 rounded text-[10px] text-zinc-600 dark:text-zinc-400">
                    <i className="fa-solid fa-info-circle mr-1" />
                    {insight.reasoning}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {insight.suggestedActions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => onActionClick?.(action.action)}
                      className={`px-2 py-1 rounded text-xs font-medium transition ${
                        action.type === 'quick'
                          ? 'bg-indigo-500 text-white hover:bg-indigo-600'
                          : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600'
                      }`}
                    >
                      {action.label}
                    </button>
                  ))}
                  <button
                    onClick={() => setExpandedId(expandedId === insight.id ? null : insight.id)}
                    className="text-[10px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    {expandedId === insight.id ? 'Less' : 'Why?'}
                  </button>
                </div>

                {/* Context */}
                <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-400 dark:text-zinc-500">
                  {insight.context.relatedMessages && (
                    <span>{insight.context.relatedMessages} related messages</span>
                  )}
                  {insight.context.timeframe && (
                    <span>{insight.context.timeframe}</span>
                  )}
                  <span className="flex items-center gap-1">
                    <div className="w-8 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${insight.context.confidence * 100}%` }}
                      />
                    </div>
                    {Math.round(insight.context.confidence * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Compact insight indicator for headers
export const InsightIndicator: React.FC<{
  count: number;
  hasHighPriority: boolean;
  onClick?: () => void;
}> = ({ count, hasHighPriority, onClick }) => {
  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition ${
        hasHighPriority
          ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 animate-pulse'
          : 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400'
      }`}
    >
      <i className="fa-solid fa-lightbulb" />
      <span>{count}</span>
    </button>
  );
};

export default ProactiveInsightsEnhanced;
