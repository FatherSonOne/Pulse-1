import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  Bot,
  Send,
  X,
  Loader,
  User as UserIcon,
  AlertCircle,
} from 'lucide-react';
import { AppView, User } from '../../types';
import { pulseAssistantService, SECTION_LABELS, SuggestedAction } from '../../services/pulseAssistantService';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useAssistantContext } from './useAssistantContext';
import './PulseAssistant.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PulseAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  activeView: AppView;
  user: User;
  isDarkMode: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestedActions?: SuggestedAction[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getApiKey(): string {
  return (
    localStorage.getItem('gemini_api_key') ||
    import.meta.env.VITE_GEMINI_API_KEY ||
    import.meta.env.VITE_API_KEY ||
    ''
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const PulseAssistant: React.FC<PulseAssistantProps> = ({
  isOpen,
  onClose,
  activeView,
  user,
  isDarkMode,
}) => {
  // Workspace context for workspaceId (PulseAssistant lives inside WorkspaceProvider)
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? '';

  // Context hook — lazy-loads section data when panel is open
  const { context, sectionSummary, isLoading: isContextLoading } = useAssistantContext(
    activeView,
    isOpen,
    user,
    workspaceId,
  );

  // ── sessionStorage history — survives section switches, cleared on tab close ──
  const SESSION_KEY = 'pulse-ai-history';

  const restoreMessages = (): ChatMessage[] => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Array<Omit<ChatMessage, 'timestamp'> & { timestamp: string }>;
      return parsed.map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
    } catch {
      return [];
    }
  };

  const [messages, setMessages] = useState<ChatMessage[]>(restoreMessages);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persist messages to sessionStorage whenever they change
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages));
    } catch {
      // sessionStorage unavailable — silent fail
    }
  }, [messages]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const sectionLabel = SECTION_LABELS[activeView] ?? activeView;
  const quickActions = pulseAssistantService.getQuickActions(activeView);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    const container = messagesEndRef.current?.parentElement;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [isOpen]);

  // Escape key closes the panel; also trap focus within the dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSend = async (overrideMessage?: string) => {
    const messageToSend = overrideMessage ?? inputValue.trim();
    if (!messageToSend || isLoading) return;

    const apiKey = getApiKey();
    if (!apiKey) {
      setError(
        'No Gemini API key found. Add VITE_GEMINI_API_KEY to your .env or set it in Settings → AI Lab.',
      );
      return;
    }

    setInputValue('');
    setError(null);

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: messageToSend,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const responseText = await pulseAssistantService.query(messageToSend, context, apiKey);

      const aiMsg: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
        suggestedActions: pulseAssistantService.getSuggestedActions(activeView),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error('[PulseAssistant] Query failed:', err);
      setError('Failed to get a response from Pulse AI. Please try again.');
      const errMsg: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: 'I encountered an error. Please check your API key and try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    setError(null);
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    inputRef.current?.focus({ preventScroll: true });
  };

  const handleSuggestedAction = (action: SuggestedAction) => {
    if (action.targetView) {
      window.dispatchEvent(
        new CustomEvent('pulse:navigate', { detail: { view: action.targetView } }),
      );
      onClose();
    } else if (action.event) {
      window.dispatchEvent(
        new CustomEvent(action.event.name, { detail: action.event.detail }),
      );
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const panel = (
    <div
      ref={panelRef}
      className="pulse-assistant"
      role="dialog"
      aria-label="Pulse AI Global Assistant"
      aria-modal="true"
    >
      {/* ── Header ── */}
      <div className="pa-header">
        <div className="pa-header-left">
          <div className="pa-icon" aria-hidden="true">
            <motion.svg
              viewBox="0 0 64 64"
              width="26"
              height="26"
              animate={{ scale: [1, 1.06, 1], opacity: [0.85, 1, 0.85] }}
              transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity }}
            >
              <defs>
                <linearGradient id="pa-hdr-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.75)" />
                </linearGradient>
                <filter id="pa-hdr-glow">
                  <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <motion.path
                d="M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32"
                stroke="url(#pa-hdr-grad)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                filter="url(#pa-hdr-glow)"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{
                  pathLength: { duration: 0.8, ease: 'easeInOut' },
                  opacity: { duration: 0.4 },
                }}
              />
            </motion.svg>
          </div>
          <div className="pa-title-group">
            <h3>Pulse AI</h3>
            <p>Ask me anything about Pulse</p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            className="pa-close-btn pa-clear-btn"
            onClick={handleClear}
            aria-label="Clear conversation"
            title="Clear conversation"
          >
            <span className="pa-clear-label">CLR</span>
          </button>
        )}

        <button
          type="button"
          className="pa-close-btn"
          onClick={onClose}
          aria-label="Close Pulse AI"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      {/* ── Context chip (current section + summary) ── */}
      <div className="pa-context-bar">
        <div className="pa-context-chip" aria-label={`Current section: ${sectionLabel}`}>
          {sectionLabel}
        </div>
        {isContextLoading ? (
          <span className="pa-context-loading">
            <Loader size={12} className="pa-spinner" aria-hidden="true" />
            Loading context…
          </span>
        ) : sectionSummary ? (
          <span className="pa-context-summary">{sectionSummary}</span>
        ) : null}
      </div>

      {/* ── Messages ── */}
      <div
        className="pa-messages"
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-label="Conversation with Pulse AI"
      >
        {messages.length === 0 && (
          <div className="pa-welcome">
            <div className="pa-welcome-icon" aria-hidden="true">
              <Bot size={36} />
            </div>
            <h4>Hi, I'm Pulse AI</h4>
            <p>
              I'm context-aware and know which section you're in. Ask me anything — or use a quick
              action below.
            </p>
          </div>
        )}

        {messages.map(message => (
          <div
            key={message.id}
            className={`pa-message ${message.role}`}
          >
            <div className="pa-msg-icon" aria-hidden="true">
              {message.role === 'user' ? <UserIcon size={16} /> : <Bot size={16} />}
            </div>
            <div className="pa-msg-content">
              {message.role === 'assistant' ? (
                <div className="pa-msg-text pa-msg-markdown">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              ) : (
                <div className="pa-msg-text">{message.content}</div>
              )}
              <div className="pa-msg-time" aria-hidden="true">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              {message.role === 'assistant' && message.suggestedActions && message.suggestedActions.length > 0 && (
                <div className="pa-suggested-actions" role="group" aria-label="Suggested actions">
                  {message.suggestedActions.map(action => (
                    <button
                      key={action.id}
                      type="button"
                      className="pa-suggested-chip"
                      onClick={() => handleSuggestedAction(action)}
                      aria-label={action.label}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="pa-message assistant">
            <div className="pa-msg-icon" aria-hidden="true">
              <Bot size={16} />
            </div>
            <div className="pa-msg-content">
              <div className="pa-msg-loading">
                <Loader className="pa-spinner" size={16} aria-hidden="true" />
                <span>Thinking…</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="pa-error" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Quick actions (only shown on welcome screen) ── */}
      {messages.length === 0 && (
        <div className="pa-quick-actions">
          <div className="pa-quick-actions-label">Quick Actions</div>
          <div className="pa-chips">
            {quickActions.map(action => (
              <button
                key={action.id}
                type="button"
                className="pa-chip"
                onClick={() => handleSend(action.query)}
                disabled={isLoading || isContextLoading}
                aria-label={action.label}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input ── */}
      <div className="pa-input-container">
        <div className={`pa-input-wrapper${isContextLoading ? ' pa-input-loading-ctx' : ''}`}>
          <input
            ref={inputRef}
            type="text"
            className="pa-input"
            placeholder={
              isContextLoading
                ? `Loading ${sectionLabel} data…`
                : 'Ask anything about your data…'
            }
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            aria-label="Message Pulse AI"
          />
          <button
            type="button"
            className="pa-send-btn"
            onClick={() => handleSend()}
            disabled={!inputValue.trim() || isLoading}
            aria-label="Send message"
          >
            {isLoading ? (
              <Loader className="pa-spinner" size={18} aria-hidden="true" />
            ) : (
              <Send size={18} aria-hidden="true" />
            )}
          </button>
        </div>
        <div className="pa-input-hint" aria-hidden="true">
          {isContextLoading
            ? `Fetching your ${sectionLabel} data for context…`
            : 'Enter to send · Esc to close'}
        </div>
      </div>
    </div>
  );

  // Render into a portal so it's always above everything regardless of stacking context
  return createPortal(panel, document.body);
};

export default PulseAssistant;
