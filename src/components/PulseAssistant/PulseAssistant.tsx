import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { createPortal } from 'react-dom';
import {
  Bot,
  Send,
  X,
  Loader,
  User as UserIcon,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Download,
  ChevronUp,
  Copy,
  Check,
  Mountain,
} from 'lucide-react';
import { AppView, User } from '../../types';
import { pulseAssistantService, SECTION_LABELS, SuggestedAction } from '../../services/pulseAssistantService';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { usePulseAI } from '../../contexts/PulseAIContext';
import { useAssistantContext } from './useAssistantContext';
import { useAIErrorHandler } from '../../hooks/useAIErrorHandler';
import './PulseAssistant.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PulseAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  activeView: AppView;
  user: User;
  proactiveMessage?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestedActions?: SuggestedAction[];
  feedback?: 'up' | 'down';
}

// ─── Component ────────────────────────────────────────────────────────────────

const PulseAssistant: React.FC<PulseAssistantProps> = ({
  isOpen,
  onClose,
  activeView,
  user,
  proactiveMessage,
}) => {
  // Workspace context for workspaceId (PulseAssistant lives inside WorkspaceProvider)
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? '';

  // Context hook — lazy-loads section data when panel is open
  const { context, sectionSummary, isLoading: isContextLoading, refreshSummary } = useAssistantContext(
    activeView,
    isOpen,
    user,
    workspaceId,
  );

  // ── Bridge to shared PulseAI context (for voice chat integration) ──
  const { setAssistantContext, setTextConversationSummary, setPendingHandoff } = usePulseAI();

  // ── AI error handler — shows the cap-exceeded / provider-down toasts ──
  const handleAIError = useAIErrorHandler();

  // Push loaded context to shared provider whenever it updates
  useEffect(() => {
    if (context.workspaceId) setAssistantContext(context);
  }, [context, setAssistantContext]);

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
  const [showQuickBar, setShowQuickBar] = useState(false);
  const [copiedExport, setCopiedExport] = useState(false);

  // Inject proactive message when panel opens with a proactive finding
  const proactiveInjectedRef = useRef(false);
  useEffect(() => {
    if (isOpen && proactiveMessage && messages.length === 0 && !proactiveInjectedRef.current) {
      proactiveInjectedRef.current = true;
      setMessages([{
        id: `msg-proactive-${Date.now()}`,
        role: 'assistant',
        content: proactiveMessage,
        timestamp: new Date(),
        suggestedActions: pulseAssistantService.getSuggestedActions(activeView),
      }]);
    }
    if (!isOpen) {
      proactiveInjectedRef.current = false;
    }
  }, [isOpen, proactiveMessage, messages.length, activeView]);

  // Persist messages to sessionStorage whenever they change
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages));
    } catch {
      // sessionStorage unavailable — silent fail
    }
    // Sync a brief conversation summary to shared context for voice AI
    if (messages.length > 0) {
      const last3 = messages.slice(-3).map(m => `${m.role}: ${m.content.slice(0, 100)}`).join(' | ');
      setTextConversationSummary(last3);
    }
  }, [messages, setTextConversationSummary]);

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
      // Build conversation history for multi-turn context
      const history = messages.map(m => ({ role: m.role, content: m.content }));

      // Create a placeholder AI message for streaming
      const aiMsgId = `msg-${Date.now()}-ai`;
      const aiMsg: ChatMessage = {
        id: aiMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMsg]);

      // Stream response — update the AI message as chunks arrive
      const finalText = await pulseAssistantService.query(
        messageToSend,
        context,
        '',
        history,
        (accumulated: string) => {
          setMessages(prev =>
            prev.map(m => m.id === aiMsgId ? { ...m, content: accumulated } : m),
          );
        },
      );

      // Final update with suggested actions
      setMessages(prev =>
        prev.map(m =>
          m.id === aiMsgId
            ? { ...m, content: finalText, suggestedActions: pulseAssistantService.getSuggestedActions(activeView) }
            : m,
        ),
      );
    } catch (err) {
      console.error('[PulseAssistant] Query failed:', err);
      // Let the global AI-error handler surface cap / trial / provider issues
      // with a proper toast + upgrade CTA before falling back to the generic
      // in-panel error message.
      const handled = handleAIError(err);
      if (handled) {
        // Drop the empty streaming placeholder so the UI doesn't leave a blank
        // assistant bubble — the toast already communicated what happened.
        setMessages(prev => prev.filter(m => m.content || m.role === 'user'));
      } else {
        setError('Failed to get a response from Pulse AI. Please try again.');
        const errMsg: ChatMessage = {
          id: `msg-${Date.now()}-err`,
          role: 'assistant',
          content: 'I encountered an error. Pulse AI is temporarily unavailable. Please try again.',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errMsg]);
      }
    } finally {
      setIsLoading(false);
      refreshSummary();
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

  // ── Time-based greeting ──
  const timeGreeting = React.useMemo(
    () => pulseAssistantService.getTimeBasedGreeting(user.name || 'there'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user.name],
  );

  // ── "Ask Pulse AI about this" global event handler (4B) ──
  useEffect(() => {
    const handleAskAbout = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.query) {
        setInputValue(detail.query);
        inputRef.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener('pulse:ask-ai', handleAskAbout);
    return () => window.removeEventListener('pulse:ask-ai', handleAskAbout);
  }, []);

  // ── Feedback handler (4C) ──
  const handleFeedback = (msgId: string, feedback: 'up' | 'down') => {
    setMessages(prev =>
      prev.map(m => m.id === msgId ? { ...m, feedback } : m),
    );
  };

  // ── Regenerate handler (4C) ──
  const handleRegenerate = (msgId: string) => {
    // Find the user message that preceded this AI response
    const idx = messages.findIndex(m => m.id === msgId);
    if (idx <= 0) return;
    // Walk backwards to find the user message
    let userQuery = '';
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userQuery = messages[i].content;
        break;
      }
    }
    if (!userQuery) return;
    // Remove the old AI response and re-send
    setMessages(prev => prev.filter(m => m.id !== msgId));
    handleSend(userQuery);
  };

  // ── Take to Summit (Phase 2 handoff) ──
  // Carries the entire visible thread up to and including the message the user
  // clicked from. Stages a handoff in PulseAIContext, navigates to AppView.LIVE,
  // and closes the sidebar. Summit consumes the handoff on mount.
  const handleTakeToSummit = (msgId: string) => {
    const idx = messages.findIndex(m => m.id === msgId);
    if (idx < 0) return;
    const thread = messages
      .slice(0, idx + 1)
      .filter(m => m.content && (m.role === 'user' || m.role === 'assistant'))
      .map(m => ({ role: m.role, content: m.content }));
    if (thread.length === 0) return;

    // Build a one-line "picking up from…" hint. Prefer the latest user query
    // since that's the most recent intent; fall back to a snippet of the AI
    // response so the user always sees something.
    const lastUser = [...thread].reverse().find(m => m.role === 'user');
    const lastAssistant = [...thread].reverse().find(m => m.role === 'assistant');
    const hintSource = lastUser?.content ?? lastAssistant?.content ?? '';
    const openingHint = hintSource.length > 120 ? hintSource.slice(0, 117) + '…' : hintSource;

    setPendingHandoff({
      source: 'sidebar',
      originSection: activeView,
      thread,
      openingHint,
      createdAt: Date.now(),
    });

    window.dispatchEvent(
      new CustomEvent('pulse:navigate', { detail: { view: AppView.LIVE } }),
    );
    onClose();
  };

  // ── Export conversation (4D) ──
  const handleExport = async (mode: 'clipboard' | 'download') => {
    const md = pulseAssistantService.exportConversation(messages, 'markdown');
    if (mode === 'clipboard') {
      await navigator.clipboard.writeText(md);
      setCopiedExport(true);
      setTimeout(() => setCopiedExport(false), 2000);
    } else {
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pulse-ai-chat-${new Date().toISOString().slice(0, 10)}.md`;
      a.click();
      URL.revokeObjectURL(url);
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
            <svg viewBox="0 0 64 64" width="22" height="22">
              <path
                d="M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </div>
          <div className="pa-title-group">
            <h3>Pulse AI</h3>
            {messages.length === 0 && <p>{sectionLabel} · context aware</p>}
          </div>
        </div>

        {messages.length > 0 && (
          <div className="pa-header-actions">
            <button
              type="button"
              className="pa-header-btn"
              onClick={() => handleExport('clipboard')}
              aria-label="Copy conversation"
              title="Copy conversation"
            >
              {copiedExport ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            </button>
            <button
              type="button"
              className="pa-header-btn"
              onClick={() => handleExport('download')}
              aria-label="Export conversation"
              title="Export as Markdown"
            >
              <Download size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="pa-close-btn pa-clear-btn"
              onClick={handleClear}
              aria-label="Clear conversation"
              title="Clear conversation"
            >
              <span className="pa-clear-label">Clear</span>
            </button>
          </div>
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

      {/* ── Context bar — Mono uppercase, no gradient pill ── */}
      <div className="pa-context-bar">
        <div className="pa-context-chip" aria-label={`Current section: ${sectionLabel}`}>
          {sectionLabel}
        </div>
        {isContextLoading ? (
          <span className="pa-context-loading">
            <Loader size={11} className="pa-spinner" aria-hidden="true" />
            Loading
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
              <svg viewBox="0 0 64 64" width="22" height="22">
                <path
                  d="M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </div>
            <h4>{timeGreeting.greeting}</h4>
            <p>
              I see your <strong>{sectionLabel}</strong> data. Ask anything, or pick a quick action.
            </p>
          </div>
        )}

        {(() => {
          const visible = messages.filter(m => m.content || m.role === 'user');
          return visible.map((message, idx) => {
            // Provenance chip on first AI bubble of a streak only — keeps long
            // threads quiet while still attributing each AI turn the user can scan.
            const prev = visible[idx - 1];
            const showProvenance = message.role === 'assistant' && (!prev || prev.role !== 'assistant');
            return (
          <div
            key={message.id}
            className={`pa-message ${message.role}`}
            aria-label={message.role === 'assistant' ? 'Pulse AI response' : 'Your message'}
          >
            <div className="pa-msg-icon" aria-hidden="true">
              {message.role === 'user' ? <UserIcon size={16} /> : <Bot size={16} />}
            </div>
            <div className="pa-msg-content">
              {showProvenance && (
                <div className="pa-provenance" aria-label="AI source">
                  PULSE AI · {message.id.startsWith('msg-proactive-') ? 'NUDGE' : 'REPLY'}
                </div>
              )}
              {message.role === 'assistant' ? (
                <div className={`pa-msg-text pa-msg-markdown${isLoading && message.id === messages[messages.length - 1]?.id ? ' pa-streaming-cursor' : ''}`}>
                  <ReactMarkdown
                    // react-markdown's default urlTransform drops non-http(s) schemes,
                    // which would strip our `pulse://section/...` hrefs before the
                    // custom anchor renderer ever sees them. Pass the URL through
                    // untouched — sanitization happens in the renderer below.
                    urlTransform={(url) => url}
                    components={{
                      a: ({ href, children, ...props }) => {
                        // pulse://section/<APPVIEW> — emitted by the AI when the
                        // user asks about data outside the current section.
                        // Intercept and route through the global pulse:navigate
                        // event so the user stays in the same window.
                        if (href?.startsWith('pulse://section/')) {
                          const view = href.replace('pulse://section/', '');
                          return (
                            <button
                              type="button"
                              className="pa-inline-nav-link"
                              onClick={(e) => {
                                e.preventDefault();
                                window.dispatchEvent(
                                  new CustomEvent('pulse:navigate', { detail: { view } }),
                                );
                              }}
                            >
                              {children}
                            </button>
                          );
                        }
                        // Only allow http(s) for external links — anything else
                        // (javascript:, data:, etc.) is rendered as plain text.
                        const safe = href && /^https?:\/\//i.test(href);
                        if (!safe) return <span>{children}</span>;
                        return (
                          <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                            {children}
                          </a>
                        );
                      },
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="pa-msg-text">{message.content}</div>
              )}
              <div className="pa-msg-time" aria-hidden="true">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              {/* Feedback + Regenerate (4C) */}
              {message.role === 'assistant' && message.content && !isLoading && (
                <div className="pa-msg-feedback">
                  <button
                    type="button"
                    className={`pa-feedback-btn${message.feedback === 'up' ? ' active' : ''}`}
                    onClick={() => handleFeedback(message.id, 'up')}
                    aria-label="Helpful"
                    title="Helpful"
                  >
                    <ThumbsUp size={12} />
                  </button>
                  <button
                    type="button"
                    className={`pa-feedback-btn${message.feedback === 'down' ? ' active' : ''}`}
                    onClick={() => handleFeedback(message.id, 'down')}
                    aria-label="Not helpful"
                    title="Not helpful"
                  >
                    <ThumbsDown size={12} />
                  </button>
                  <button
                    type="button"
                    className="pa-feedback-btn"
                    onClick={() => handleRegenerate(message.id)}
                    aria-label="Regenerate response"
                    title="Regenerate"
                  >
                    <RefreshCw size={12} />
                  </button>
                  {activeView !== AppView.LIVE && (
                    <button
                      type="button"
                      className="pa-feedback-btn pa-feedback-btn--summit"
                      onClick={() => handleTakeToSummit(message.id)}
                      aria-label="Take this thread to Summit"
                      title="Take to Summit"
                    >
                      <Mountain size={12} />
                      <span className="pa-feedback-btn-label">Summit</span>
                    </button>
                  )}
                </div>
              )}
              {/* Suggested actions */}
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
            );
          });
        })()}

        {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && messages[messages.length - 1].content === '' && (
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

      {/* ── Quick actions — full on welcome, collapsible after messages (4E) ── */}
      {messages.length === 0 ? (
        <div className="pa-quick-actions">
          <div className="pa-quick-actions-label">Quick Actions</div>
          <div className="pa-chips">
            {/* Time-based suggestion (4A) */}
            <button
              key={timeGreeting.suggestion.id}
              type="button"
              className="pa-chip pa-chip-highlight"
              onClick={() => handleSend(timeGreeting.suggestion.query)}
              disabled={isLoading || isContextLoading}
              aria-label={timeGreeting.suggestion.label}
            >
              {timeGreeting.suggestion.label}
            </button>
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
      ) : (
        <div className={`pa-quick-bar${showQuickBar ? ' pa-quick-bar-open' : ''}`}>
          <button
            type="button"
            className="pa-quick-bar-toggle"
            onClick={() => setShowQuickBar(prev => !prev)}
            aria-label={showQuickBar ? 'Hide quick actions' : 'Show quick actions'}
          >
            <ChevronUp size={14} className={`pa-chevron${showQuickBar ? ' pa-chevron-up' : ''}`} />
            <span>Quick Actions</span>
          </button>
          {showQuickBar && (
            <div className="pa-chips pa-chips-compact">
              {quickActions.slice(0, 3).map(action => (
                <button
                  key={action.id}
                  type="button"
                  className="pa-chip pa-chip-sm"
                  onClick={() => handleSend(action.query)}
                  disabled={isLoading || isContextLoading}
                  aria-label={action.label}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
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
                ? `Loading ${sectionLabel}…`
                : `Ask about ${sectionLabel}…`
            }
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
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
            : (() => {
                const usage = pulseAssistantService.getTokenUsage();
                const tokenStr = usage.queryCount > 0
                  ? ` · ${(usage.totalTokens / 1000).toFixed(1)}k tokens`
                  : '';
                return `Enter to send · Esc to close${tokenStr}`;
              })()}
        </div>
      </div>
    </div>
  );

  // Render into a portal so it's always above everything regardless of stacking context
  return createPortal(panel, document.body);
};

export default PulseAssistant;
