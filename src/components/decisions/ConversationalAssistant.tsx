import React, { useState, useRef, useEffect } from 'react';
import { conversationalAIService, QueryContext } from '../../services/conversationalAIService';
import { DecisionWithVotes } from '../../services/decisionService';
import { Task } from '../../services/taskService';
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
} from 'lucide-react';
import './ConversationalAssistant.css';

interface ConversationalAssistantProps {
  user: User;
  decisions: DecisionWithVotes[];
  tasks: Task[];
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

export const ConversationalAssistant: React.FC<ConversationalAssistantProps> = ({
  user,
  decisions,
  tasks,
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

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    <div className="conversational-assistant">
      {/* Header */}
      <div className="assistant-header">
        <div className="assistant-header-left">
          <div className="assistant-icon">
            <Sparkles size={20} />
          </div>
          <div className="assistant-title-group">
            <h3>AI Assistant</h3>
            <p>Ask me anything about your decisions and tasks</p>
          </div>
        </div>
        <button
          className="assistant-close-button"
          onClick={onClose}
          aria-label="Close AI Assistant"
        >
          <X size={20} />
        </button>
      </div>

      {/* Messages */}
      <div className="assistant-messages">
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
                  className="quick-action-chip"
                  onClick={() => handleQuickAction(action)}
                  disabled={isLoading}
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
                  className="quick-action-chip"
                  onClick={() => handleQuickAction(action)}
                  disabled={isLoading}
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
                  className="quick-action-chip"
                  onClick={() => handleQuickAction(action)}
                  disabled={isLoading}
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
          />
          <button
            className="assistant-send-button"
            onClick={() => handleSendMessage()}
            disabled={!inputValue.trim() || isLoading}
            aria-label="Send message"
          >
            {isLoading ? (
              <Loader className="spinner-icon" size={18} />
            ) : (
              <Send size={18} />
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
