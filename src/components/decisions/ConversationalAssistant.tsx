import React, { useState, useRef, useEffect, memo } from 'react';
import { conversationalAIService, QueryContext } from '../../services/conversationalAIService';
import { DecisionWithVotes } from '../../services/decisionService';
import { Task } from '../../services/taskService';
import { DecisionMetrics } from '../../services/decisionAnalyticsService';
import { User } from '../../types';
import {
  MessageSquare,
  Send,
  X,
  Loader,
  Sparkles,
  Bot,
  User as UserIcon,
  CheckCircle,
  AlertCircle,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Users,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import './ConversationalAssistant.css';

interface ConversationalAssistantProps {
  user: User;
  decisions: DecisionWithVotes[];
  tasks: Task[];
  metrics?: DecisionMetrics | null;
  onClose: () => void;
  onActionExecute?: (action: AssistantAction) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AssistantAction {
  type: 'create_decision' | 'update_task' | 'send_reminder';
  data: any;
}

interface QuickAction {
  id: string;
  label: string;
  query: string;
  icon: React.ReactNode;
  category: 'insight' | 'action' | 'summary';
}

// Custom comparison function to prevent unnecessary re-renders
const arePropsEqual = (
  prevProps: ConversationalAssistantProps,
  nextProps: ConversationalAssistantProps
): boolean => {
  // Check if user ID changed
  if (prevProps.user.id !== nextProps.user.id) return false;

  // Check if decisions array length changed
  if (prevProps.decisions.length !== nextProps.decisions.length) return false;

  // Check if any decision's updated_at changed
  for (let i = 0; i < prevProps.decisions.length; i++) {
    if (prevProps.decisions[i].id !== nextProps.decisions[i].id) return false;
    if (prevProps.decisions[i].updated_at !== nextProps.decisions[i].updated_at) return false;
  }

  // Check if tasks array length changed
  if (prevProps.tasks.length !== nextProps.tasks.length) return false;

  // Check if any task's updated_at changed
  for (let i = 0; i < prevProps.tasks.length; i++) {
    if (prevProps.tasks[i].id !== nextProps.tasks[i].id) return false;
    if (prevProps.tasks[i].updated_at !== nextProps.tasks[i].updated_at) return false;
  }

  // Props are equal, skip re-render
  return true;
};

// Phase 3: Mini Sparkline Chart Component - Compact version
const Sparkline: React.FC<{ data: number[]; width?: number; height?: number; color?: string }> = ({
  data,
  width = 32,
  height = 14,
  color = '#22c55e'
}) => {
  if (!data || data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="sparkline" viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// Phase 3: Helper to render trend indicator with sparkline
const TrendIndicator: React.FC<{
  trend?: 'up' | 'down' | 'stable';
  change?: number;
  inverted?: boolean;
  sparklineData?: number[];
}> = ({
  trend,
  change,
  inverted = false,
  sparklineData
}) => {
  if (!trend || !change) return null;

  const isPositive = inverted ? trend === 'down' : trend === 'up';
  const isNegative = inverted ? trend === 'up' : trend === 'down';
  const trendColor = isPositive ? '#22c55e' : isNegative ? '#ef4444' : '#94a3b8';

  if (trend === 'stable') {
    return (
      <div className="metric-trend-container">
        {sparklineData && <Sparkline data={sparklineData} color={trendColor} />}
        <div className="metric-trend stable">
          <Minus size={12} />
          <span className="trend-value">0%</span>
        </div>
      </div>
    );
  }

  return (
    <div className="metric-trend-container">
      {sparklineData && <Sparkline data={sparklineData} color={trendColor} />}
      <div className={`metric-trend ${isPositive ? 'positive' : isNegative ? 'negative' : 'stable'}`}>
        {trend === 'up' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
        <span className="trend-value">{Math.abs(change)}%</span>
      </div>
    </div>
  );
};

const ConversationalAssistantComponent: React.FC<ConversationalAssistantProps> = ({
  user,
  decisions,
  tasks,
  metrics,
  onClose,
  onActionExecute,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Quick action templates
  const quickActions: QuickAction[] = [
    {
      id: 'attention',
      label: 'What needs my attention?',
      query: 'What decisions and tasks need my attention right now?',
      icon: <AlertCircle size={16} />,
      category: 'insight',
    },
    {
      id: 'blockers',
      label: "What's blocking me?",
      query: 'Identify all blockers in my workflow',
      icon: <AlertCircle size={16} />,
      category: 'insight',
    },
    {
      id: 'summary',
      label: 'Summarize pending items',
      query: 'Give me a summary of all pending decisions and tasks',
      icon: <Lightbulb size={16} />,
      category: 'summary',
    },
    {
      id: 'follow-up',
      label: 'Who should I follow up with?',
      query: 'Who should I follow up with and why?',
      icon: <UserIcon size={16} />,
      category: 'action',
    },
    {
      id: 'risk',
      label: "What's at risk?",
      query: 'What decisions or tasks are at risk of missing deadlines or stalling?',
      icon: <AlertCircle size={16} />,
      category: 'insight',
    },
    {
      id: 'next-actions',
      label: 'What should I work on next?',
      query: 'Based on my tasks and decisions, what should I prioritize next?',
      icon: <CheckCircle size={16} />,
      category: 'action',
    },
  ];

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus input on mount - use preventScroll to avoid viewport jump
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const scrollToBottom = () => {
    // Use scrollTop instead of scrollIntoView to avoid affecting viewport scroll
    const messagesContainer = messagesEndRef.current?.parentElement;
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  };

  const handleSendMessage = async (message?: string) => {
    const messageToSend = message || inputValue.trim();
    if (!messageToSend || isLoading) return;

    // Get API key
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      setError('Please add your Gemini API key in settings to use the AI Assistant.');
      return;
    }

    // Clear input
    setInputValue('');
    setError(null);

    // Add user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: messageToSend,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Prepare context
      const context: QueryContext = {
        decisions,
        tasks,
        user,
      };

      // Get AI response
      const response = await conversationalAIService.answerQuery(
        messageToSend,
        context,
        apiKey
      );

      // Check for action commands in response
      const actionMatch = response.match(/\[(CREATE_DECISION|CREATE_TASK|UPDATE_TASK)\](.*)/s);
      if (actionMatch && onActionExecute) {
        const actionType = actionMatch[1];
        const actionData = actionMatch[2];

        // Parse action data and execute
        try {
          const parsedData = JSON.parse(actionData);
          onActionExecute({
            type: actionType.toLowerCase() as any,
            data: parsedData,
          });
        } catch (e) {
          console.error('Failed to parse action data:', e);
        }
      }

      // Add AI response
      const aiMessage: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      console.error('Failed to get AI response:', err);
      setError('Failed to get response from AI. Please try again.');

      // Add error message
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (action: QuickAction) => {
    handleSendMessage(action.query);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Group quick actions by category
  const insightActions = quickActions.filter((a) => a.category === 'insight');
  const actionActions = quickActions.filter((a) => a.category === 'action');
  const summaryActions = quickActions.filter((a) => a.category === 'summary');

  return (
    <div className="conversational-assistant" role="complementary" aria-label="AI Assistant">
      {/* Header */}
      <div className="assistant-header">
        <div className="assistant-header-left">
          <div className="assistant-icon" aria-hidden="true">
            <Sparkles size={20} />
          </div>
          <div className="assistant-title-group">
            <h3>AI Assistant</h3>
            <p>Ask me anything about your decisions and tasks</p>
          </div>
        </div>
        <button
          type="button"
          className="assistant-close-button"
          onClick={onClose}
          aria-label="Close AI Assistant"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Messages */}
      <div className="assistant-messages" role="log" aria-live="polite" aria-atomic="false">
        {messages.length === 0 && (
          <div className="assistant-welcome">
            <div className="welcome-icon">
              <Bot size={48} />
            </div>
            <h4>Welcome to your AI Assistant!</h4>
            <p>
              I can help you understand your workflow, identify blockers, and suggest next actions.
              Try one of the quick actions below or ask me anything.
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
          >
            <div className="message-icon">
              {message.role === 'user' ? (
                <UserIcon size={16} />
              ) : (
                <Bot size={16} />
              )}
            </div>
            <div className="message-content">
              <div className="message-text">{message.content}</div>
              <div className="message-time">
                {message.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="message assistant-message">
            <div className="message-icon">
              <Bot size={16} />
            </div>
            <div className="message-content">
              <div className="message-loading">
                <Loader className="spinner-icon" size={16} />
                <span>Thinking...</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="assistant-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Phase 2: Metrics Dashboard */}
      {messages.length === 0 && metrics && (
        <div className="assistant-metrics-dashboard">
          <div className="metrics-dashboard-header">
            <TrendingUp size={18} />
            <span>Key Metrics</span>
          </div>
          <div className="metrics-grid-compact">
            <div className="metric-card-compact">
              <div className="metric-icon">
                <TrendingUp size={16} />
              </div>
              <div className="metric-content">
                <div className="metric-value-row">
                  <div className="metric-value">{metrics.velocityPerWeek}/week</div>
                  <TrendIndicator
                    trend={metrics.velocityTrend}
                    change={metrics.velocityChange}
                    sparklineData={[2, 3, 2, 5, 4, metrics.velocityPerWeek]}
                  />
                </div>
                <div className="metric-label">Velocity</div>
              </div>
            </div>
            <div className="metric-card-compact">
              <div className="metric-icon">
                <Clock size={16} />
              </div>
              <div className="metric-content">
                <div className="metric-value-row">
                  <div className="metric-value">{metrics.avgTimeToResolution}h</div>
                  <TrendIndicator
                    trend={metrics.resolutionTrend}
                    change={metrics.resolutionChange}
                    inverted
                    sparklineData={[100, 95, 105, 90, 85, metrics.avgTimeToResolution]}
                  />
                </div>
                <div className="metric-label">Avg Resolution</div>
              </div>
            </div>
            <div className="metric-card-compact">
              <div className="metric-icon">
                <Users size={16} />
              </div>
              <div className="metric-content">
                <div className="metric-value-row">
                  <div className="metric-value">{metrics.participationRate}%</div>
                  <TrendIndicator
                    trend={metrics.participationTrend}
                    change={metrics.participationChange}
                    sparklineData={[45, 48, 50, 52, 50, metrics.participationRate]}
                  />
                </div>
                <div className="metric-label">Participation</div>
              </div>
            </div>
            {metrics.staleCount > 0 && (
              <div className="metric-card-compact warning">
                <div className="metric-icon">
                  <AlertTriangle size={16} />
                </div>
                <div className="metric-content">
                  <div className="metric-value-row">
                    <div className="metric-value">{metrics.staleCount}</div>
                    <TrendIndicator
                      trend={metrics.staleTrend}
                      change={metrics.staleChange}
                      inverted
                      sparklineData={[5, 8, 6, 7, 9, metrics.staleCount]}
                    />
                  </div>
                  <div className="metric-label">Need Attention</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {messages.length === 0 && (
        <div className="assistant-quick-actions">
          <div className="quick-actions-header">Quick Actions</div>

          {/* Insights */}
          <div className="quick-action-group">
            <div className="quick-action-group-label">Insights</div>
            <div className="quick-action-chips">
              {insightActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className="quick-action-chip"
                  onClick={() => handleQuickAction(action)}
                  disabled={isLoading}
                  aria-label={action.label}
                >
                  {action.icon}
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="quick-action-group">
            <div className="quick-action-group-label">Next Actions</div>
            <div className="quick-action-chips">
              {actionActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className="quick-action-chip"
                  onClick={() => handleQuickAction(action)}
                  disabled={isLoading}
                  aria-label={action.label}
                >
                  {action.icon}
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="quick-action-group">
            <div className="quick-action-group-label">Summaries</div>
            <div className="quick-action-chips">
              {summaryActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className="quick-action-chip"
                  onClick={() => handleQuickAction(action)}
                  disabled={isLoading}
                  aria-label={action.label}
                >
                  {action.icon}
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="assistant-input-container">
        <div className="assistant-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            className="assistant-input"
            placeholder="Ask me anything..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            aria-label="Message input for AI Assistant"
          />
          <button
            type="button"
            className="assistant-send-button"
            onClick={() => handleSendMessage()}
            disabled={!inputValue.trim() || isLoading}
            aria-label="Send message to AI Assistant"
          >
            {isLoading ? (
              <Loader className="spinner-icon" size={18} aria-hidden="true" />
            ) : (
              <Send size={18} aria-hidden="true" />
            )}
          </button>
        </div>
        <div className="assistant-input-hint">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
};

// Export memoized component with custom comparison
export const ConversationalAssistant = memo(ConversationalAssistantComponent, arePropsEqual);
