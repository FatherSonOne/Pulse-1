/**
 * PulseStudio — Unified AI workspace replacing the 7 War Room modes.
 *
 * One interface. Context-aware. The AI adapts its behavior based on what you
 * ask, not which "mode" you selected.
 *
 * Features:
 *  - Clean conversation canvas with message list
 *  - Inline citations from RAG sources
 *  - Agent selector (General, Skeptic, Scribe, Deep Diver)
 *  - Voice, deep-thinking, and file-upload toggles
 *  - Smart suggestions
 *  - Welcome state with quick-start actions
 */

import React, { useRef, useEffect, useMemo, useState, useCallback, Suspense, lazy } from 'react';
import './PulseStudio.css';
import { AIMessage, KnowledgeDoc, PromptSuggestion, ThinkingStep } from '../../services/ragService';
import { settingsService } from '../../services/settingsService';
import { AgentType, AGENTS } from './AgentSelector';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { parseMessageContent, hasLikelyArtifacts, MessageSegment } from './artifactParser';
import { InlineArtifact } from './ArtifactRenderers';
import { useStudioCommands, StudioCommand, AgentMention } from './useStudioCommands';
import { FocusTimer } from './FocusTimer';
import { MarkdownContent } from './MarkdownContent';
import type { NoteType } from './useBoardNotes';

import {
  BookOpen, Brain, Check, ChevronDown, Copy, FileText, Layers,
  Loader2, Mic, MicOff, Paperclip, Pin, Send, Sparkles, Timer,
  Wand2, X, Search, BarChart3, Lightbulb, ListChecks,
  MessageSquare, Zap,
} from 'lucide-react';

const VoiceControl = lazy(() => import('./VoiceControl').then(m => ({ default: m.VoiceControl })));

// ── Quick-start actions for the welcome screen ────────────────────────────

const QUICK_ACTIONS = [
  { icon: Search, label: 'Research a topic', prompt: '/analyze ', sendNow: false },
  { icon: BarChart3, label: 'Analyze data', prompt: '/analyze ', sendNow: false },
  { icon: Lightbulb, label: 'Brainstorm ideas', prompt: '/brainstorm ', sendNow: false },
  { icon: ListChecks, label: 'Make a decision', prompt: '/decide ', sendNow: false },
  { icon: MessageSquare, label: 'Summarize sources', prompt: '/summarize Summarize the key points from my sources', sendNow: true },
  { icon: Zap, label: 'Quick question', prompt: '', sendNow: false },
];

// ── Props ─────────────────────────────────────────────────────────────────

export interface PulseStudioProps {
  // Session
  selectedSessionId: string | null;
  messages: AIMessage[];
  isLoading: boolean;
  thinkingLogs: Map<string, ThinkingStep[]>;

  // Input
  input: string;
  setInput: (v: string) => void;
  onSendMessage: () => void;
  onSendDirect: (text: string) => void;

  // Agent
  activeAgent: AgentType;
  setActiveAgent: (v: AgentType) => void;

  // Documents
  documents: KnowledgeDoc[];
  activeContextDocs: Set<string>;

  // Voice
  voiceEnabled: boolean;
  setVoiceEnabled: (v: boolean) => void;
  voiceMode: 'push-to-talk' | 'always-on' | 'wake-word';

  // Thinking
  enableExtendedThinking: boolean;
  setEnableExtendedThinking: (v: boolean) => void;
  expandedThinking: Set<string>;
  toggleThinking: (id: string) => void;

  // Suggestions
  suggestions: PromptSuggestion[];
  showSuggestions: boolean;
  setShowSuggestions: (v: boolean) => void;
  handleUseSuggestion: (s: PromptSuggestion) => void;

  // Panel toggles (passed up to parent layout)
  onToggleSources?: () => void;
  onToggleArtifacts?: () => void;
  sourcesOpen?: boolean;
  artifactsOpen?: boolean;

  // File upload
  onUploadClick?: () => void;

  // Pin to artifacts (TheBoard)
  onPinArtifact?: (content: string, type: NoteType) => void;

  // Mobile
  isMobile: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────

export const PulseStudio: React.FC<PulseStudioProps> = ({
  selectedSessionId,
  messages,
  isLoading,
  thinkingLogs,
  input,
  setInput,
  onSendMessage,
  onSendDirect,
  activeAgent,
  setActiveAgent,
  documents,
  activeContextDocs,
  voiceEnabled,
  setVoiceEnabled,
  voiceMode,
  enableExtendedThinking,
  setEnableExtendedThinking,
  expandedThinking,
  toggleThinking,
  suggestions,
  showSuggestions,
  setShowSuggestions,
  handleUseSuggestion,
  onToggleSources,
  onToggleArtifacts,
  sourcesOpen,
  artifactsOpen,
  onUploadClick,
  onPinArtifact,
  isMobile,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const agentMenuRef = useRef<HTMLDivElement>(null);
  const agentBtnRef = useRef<HTMLButtonElement>(null);
  const safeMessages = Array.isArray(messages) ? messages : [];

  // ── Focus timer ─────────────────────────────────────────────────────────
  const [showFocusTimer, setShowFocusTimer] = useState(false);

  // ── Command system ─────────────────────────────────────────────────────
  const { parseInput, getAutocompleteSuggestions, applyAutocomplete } = useStudioCommands();
  const [autocompleteItems, setAutocompleteItems] = useState<(StudioCommand | AgentMention)[]>([]);
  const [autocompleteIdx, setAutocompleteIdx] = useState(0);
  const showAutocomplete = autocompleteItems.length > 0;

  // Update autocomplete suggestions as user types
  useEffect(() => {
    const items = getAutocompleteSuggestions(input);
    setAutocompleteItems(items);
    setAutocompleteIdx(0);
  }, [input, getAutocompleteSuggestions]);

  // Enhanced send that processes commands
  const handleCommandSend = useCallback(() => {
    if (!input.trim() || isLoading) return;

    const parsed = parseInput(input);

    // Switch agent if command or @mention requests it
    if (parsed.agentOverride && parsed.agentOverride !== activeAgent) {
      setActiveAgent(parsed.agentOverride);
      settingsService.set('liveBoardSelectedAgent', parsed.agentOverride);
    }

    // If there's a command prefix, send the full prompt directly
    if (parsed.command) {
      setInput('');
      onSendDirect(parsed.fullPrompt);
    } else {
      // No command — normal send
      onSendMessage();
    }
  }, [input, isLoading, parseInput, activeAgent, setActiveAgent, setInput, onSendDirect, onSendMessage]);

  // Handle keyboard in input for autocomplete navigation
  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showAutocomplete) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAutocompleteIdx(i => Math.min(i + 1, autocompleteItems.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAutocompleteIdx(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && autocompleteItems.length > 0)) {
        // Only consume Enter for autocomplete if user hasn't typed anything after the /command
        const item = autocompleteItems[autocompleteIdx];
        if (item) {
          const isPartialCommand = /^\/\w*$/.test(input.trim()) || /\s@\w*$/.test(input) || /^@\w*$/.test(input.trim());
          if (e.key === 'Tab' || isPartialCommand) {
            e.preventDefault();
            const newInput = applyAutocomplete(input, item);
            setInput(newInput);
            setAutocompleteItems([]);
            return;
          }
        }
      }
      if (e.key === 'Escape') {
        setAutocompleteItems([]);
        return;
      }
    }

    // Normal Enter to send
    if (e.key === 'Enter' && !e.shiftKey) {
      handleCommandSend();
    }
  }, [showAutocomplete, autocompleteItems, autocompleteIdx, input, applyAutocomplete, setInput, handleCommandSend]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [safeMessages, isLoading]);

  // Close agent menu on outside click
  useEffect(() => {
    if (!showAgentMenu) return;
    const handler = (e: MouseEvent) => {
      if (
        agentMenuRef.current && !agentMenuRef.current.contains(e.target as Node) &&
        agentBtnRef.current && !agentBtnRef.current.contains(e.target as Node)
      ) {
        setShowAgentMenu(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showAgentMenu]);

  const selectedAgent = AGENTS.find(a => a.id === activeAgent) || AGENTS[0];
  const hasMessages = safeMessages.length > 0;
  const hasDocuments = documents.length > 0;
  const activeDocCount = activeContextDocs.size;

  // ── Welcome Screen ───────────────────────────────────────────────────────

  const renderWelcome = () => (
    <div className="ps-welcome">
      <div className="ps-welcome-logo">
        <BookOpen size={28} />
      </div>
      <h2>War Room</h2>
      <p>
        {hasDocuments
          ? `You have ${documents.length} source${documents.length !== 1 ? 's' : ''} loaded${activeDocCount > 0 ? ` (${activeDocCount} active)` : ''}. Ask anything about your documents or start a new conversation.`
          : 'Upload sources to get AI-powered insights, or start a conversation on any topic.'
        }
      </p>
      <div className="ps-welcome-actions">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            className="ps-welcome-chip"
            onClick={() => {
              if (action.sendNow && action.prompt) {
                onSendDirect(action.prompt);
              } else {
                setInput(action.prompt);
                setTimeout(() => inputRef.current?.focus(), 50);
              }
            }}
          >
            <action.icon size={14} />
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );

  // ── Artifact parsing cache (memoized per message content) ────────────────

  const parsedMessages = useMemo(() => {
    const cache = new Map<string, MessageSegment[]>();
    for (const msg of safeMessages) {
      if (msg.role === 'assistant' && hasLikelyArtifacts(msg.content)) {
        cache.set(msg.id, parseMessageContent(msg.content));
      }
    }
    return cache;
  }, [safeMessages]);

  // ── Copy message to clipboard ──────────────────────────────────────────

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content).catch(() => {});
  };

  // ── Message Renderer ─────────────────────────────────────────────────────

  const renderMessage = (msg: AIMessage, idx: number) => {
    const isUser = msg.role === 'user';
    const thinking = thinkingLogs.get(msg.id);
    const isThinkingExpanded = expandedThinking.has(msg.id);
    const segments = parsedMessages.get(msg.id);
    const hasArtifacts = segments && segments.some(s => s.kind === 'artifact');

    return (
      <div key={msg.id || idx} className={`ps-message ps-message--${msg.role}`}>
        <div className="ps-message-avatar">
          {isUser ? (
            <i className="fa fa-user" style={{ fontSize: 13 }} />
          ) : (
            <Sparkles size={15} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ps-message-content">
            {/* Thinking toggle */}
            {thinking && thinking.length > 0 && (
              <button
                onClick={() => toggleThinking(msg.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  color: 'var(--ps-text-muted)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px 0',
                  marginBottom: 6,
                }}
              >
                <Brain size={12} />
                {isThinkingExpanded ? 'Hide' : 'Show'} thinking ({thinking.length} steps)
              </button>
            )}

            {/* Thinking steps */}
            {thinking && isThinkingExpanded && (
              <div style={{
                padding: '8px 10px',
                marginBottom: 8,
                borderRadius: 'var(--ps-radius-sm)',
                background: 'var(--ps-bg-surface)',
                border: '1px solid var(--ps-border)',
                fontSize: 12,
                color: 'var(--ps-text-secondary)',
                lineHeight: 1.5,
              }}>
                {thinking.map((step, i) => (
                  <div key={i} style={{ marginBottom: i < thinking.length - 1 ? 6 : 0 }}>
                    <span style={{ color: 'var(--ps-text-muted)', marginRight: 6, fontFamily: 'var(--ps-font-mono)', fontSize: 10 }}>
                      [{step.duration_ms}ms]
                    </span>
                    {step.thought}
                  </div>
                ))}
              </div>
            )}

            {/* Message content — with inline artifacts for AI messages */}
            {hasArtifacts ? (
              // Render parsed segments: text + artifacts interleaved
              segments!.map((seg, si) =>
                seg.kind === 'text' ? (
                  <MarkdownContent key={si} content={seg.content} />
                ) : (
                  <InlineArtifact
                    key={si}
                    artifact={seg.artifact}
                    onPin={onPinArtifact}
                  />
                )
              )
            ) : isUser ? (
              // User messages — plain text
              <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
            ) : (
              // AI messages — formatted markdown
              <MarkdownContent content={msg.content} />
            )}

            {/* Citations */}
            {msg.citations && msg.citations.length > 0 && (
              <div className="ps-message-citations">
                {msg.citations.map((c: any, i: number) => (
                  <span key={i} className="ps-citation">
                    <FileText size={10} />
                    {c.title || c}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Message action buttons (pin, copy) — shown on hover */}
          {!isUser && (
            <div className="ps-message-actions">
              {onPinArtifact && (
                <button
                  className="ps-message-action-btn"
                  onClick={() => onPinArtifact(msg.content.substring(0, 500), 'finding')}
                  title="Pin to Artifacts"
                >
                  <Pin size={12} />
                </button>
              )}
              <button
                className="ps-message-action-btn"
                onClick={() => handleCopyMessage(msg.content)}
                title="Copy message"
              >
                <Copy size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Main Render ──────────────────────────────────────────────────────────

  return (
    <>
      {/* Messages Area or Welcome */}
      {!hasMessages && !isLoading ? (
        renderWelcome()
      ) : (
        <div className="ps-messages">
          {safeMessages.map((msg, i) => renderMessage(msg, i))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="ps-message ps-message--assistant">
              <div className="ps-message-avatar">
                <Sparkles size={15} />
              </div>
              <div className="ps-message-content">
                <div className="ps-typing">
                  <div className="ps-typing-dot" />
                  <div className="ps-typing-dot" />
                  <div className="ps-typing-dot" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input Area */}
      {selectedSessionId && (
        <div className="ps-input-area">
          {/* Suggestions */}
          {suggestions.length > 0 && showSuggestions && (
            <div className="ps-suggestions">
              {suggestions.slice(0, 4).map((s) => (
                <button
                  key={s.id}
                  className="ps-suggestion"
                  onClick={() => handleUseSuggestion(s)}
                >
                  <Wand2 size={11} style={{ marginRight: 4 }} />
                  {s.suggestion_text.length > 50
                    ? s.suggestion_text.substring(0, 50) + '...'
                    : s.suggestion_text}
                </button>
              ))}
              <button
                className="ps-icon-btn"
                onClick={() => setShowSuggestions(false)}
                title="Hide suggestions"
                style={{ width: 24, height: 24 }}
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Main input with command autocomplete */}
          <div className="ps-input-row" style={{ position: 'relative' }}>
            {/* Autocomplete dropdown */}
            {showAutocomplete && (
              <div className="ps-autocomplete">
                {autocompleteItems.map((item, i) => {
                  const isCmd = 'promptPrefix' in item;
                  return (
                    <button
                      key={item.id}
                      className={`ps-autocomplete-item ${i === autocompleteIdx ? 'ps-autocomplete-item--active' : ''}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const newInput = applyAutocomplete(input, item);
                        setInput(newInput);
                        setAutocompleteItems([]);
                        inputRef.current?.focus();
                      }}
                      onMouseEnter={() => setAutocompleteIdx(i)}
                    >
                      <i
                        className={`fa ${item.icon}`}
                        style={{ color: item.accent, width: 16, textAlign: 'center', fontSize: 12 }}
                      />
                      <span className="ps-autocomplete-label">{item.label}</span>
                      <span className="ps-autocomplete-desc">{item.description}</span>
                    </button>
                  );
                })}
                <div className="ps-autocomplete-hint">
                  <kbd>Tab</kbd> to select &middot; <kbd>Esc</kbd> to dismiss
                </div>
              </div>
            )}

            <input
              ref={inputRef}
              type="text"
              className="ps-input-field"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={
                activeDocCount > 0
                  ? `Ask about your ${activeDocCount} source${activeDocCount !== 1 ? 's' : ''}... (try /brainstorm, /analyze)`
                  : hasDocuments
                    ? 'Ask about your documents... (try /summarize, /compare)'
                    : 'Ask anything... (type / for commands)'
              }
              disabled={isLoading}
            />
            <button
              className="ps-send-btn"
              onClick={handleCommandSend}
              disabled={isLoading || !input.trim()}
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </div>

          {/* Tool row */}
          <div className="ps-input-tools">
            {/* Agent selector */}
            <div style={{ position: 'relative' }}>
              <button
                ref={agentBtnRef}
                className={`ps-icon-btn ${showAgentMenu ? 'ps-icon-btn--active' : ''}`}
                onClick={() => setShowAgentMenu(v => !v)}
                title={`Agent: ${selectedAgent.name}`}
                style={{ display: 'flex', alignItems: 'center', gap: 4, width: 'auto', padding: '4px 8px', fontSize: 12 }}
              >
                <i className={`fa ${selectedAgent.icon}`} style={{ color: 'var(--ps-accent)', fontSize: 12 }} />
                <span style={{ color: 'var(--ps-text-secondary)' }} className="hidden sm:inline">
                  {selectedAgent.name}
                </span>
                <ChevronDown size={10} style={{ opacity: 0.5 }} />
              </button>

              {showAgentMenu && (
                <div
                  ref={agentMenuRef}
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    marginBottom: 4,
                    width: 200,
                    background: 'var(--ps-bg-elevated)',
                    border: '1px solid var(--ps-border-active)',
                    borderRadius: 'var(--ps-radius-md)',
                    boxShadow: 'var(--ps-shadow-lg)',
                    zIndex: 50,
                    padding: 4,
                  }}
                >
                  {AGENTS.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => {
                        setActiveAgent(agent.id);
                        settingsService.set('liveBoardSelectedAgent', agent.id);
                        setShowAgentMenu(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        width: '100%',
                        padding: '8px 10px',
                        border: 'none',
                        borderRadius: 'var(--ps-radius-sm)',
                        background: activeAgent === agent.id ? 'var(--ps-accent-soft)' : 'transparent',
                        color: activeAgent === agent.id ? 'var(--ps-accent)' : 'var(--ps-text-secondary)',
                        cursor: 'pointer',
                        fontSize: 13,
                        textAlign: 'left',
                        transition: 'background 150ms',
                      }}
                      onMouseEnter={(e) => {
                        if (activeAgent !== agent.id) e.currentTarget.style.background = 'var(--ps-bg-hover)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = activeAgent === agent.id ? 'var(--ps-accent-soft)' : 'transparent';
                      }}
                    >
                      <i className={`fa ${agent.icon}`} style={{ width: 16, textAlign: 'center' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500 }}>{agent.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--ps-text-muted)', marginTop: 1 }}>{agent.description}</div>
                      </div>
                      {activeAgent === agent.id && <Check size={14} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ width: 1, height: 20, background: 'var(--ps-border)', margin: '0 4px' }} />

            {/* Upload */}
            {onUploadClick && (
              <button
                className="ps-icon-btn"
                onClick={onUploadClick}
                title="Upload file"
              >
                <Paperclip size={14} />
              </button>
            )}

            {/* Voice toggle */}
            <button
              className={`ps-icon-btn ${voiceEnabled ? 'ps-icon-btn--active' : ''}`}
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              title={voiceEnabled ? 'Disable voice' : 'Enable voice'}
            >
              {voiceEnabled ? <Mic size={14} /> : <MicOff size={14} />}
            </button>

            {/* Deep think toggle */}
            <button
              className={`ps-icon-btn ${enableExtendedThinking ? 'ps-icon-btn--active' : ''}`}
              onClick={() => setEnableExtendedThinking(!enableExtendedThinking)}
              title={enableExtendedThinking ? 'Deep thinking on' : 'Enable deep thinking'}
            >
              <Brain size={14} />
            </button>

            {/* Focus timer toggle */}
            <button
              className={`ps-icon-btn ${showFocusTimer ? 'ps-icon-btn--active' : ''}`}
              onClick={() => setShowFocusTimer(v => !v)}
              title={showFocusTimer ? 'Hide focus timer' : 'Focus timer'}
            >
              <Timer size={14} />
            </button>

            {/* Panel toggles */}
            {onToggleSources && (
              <button
                className={`ps-icon-btn ${sourcesOpen ? 'ps-icon-btn--active' : ''}`}
                onClick={onToggleSources}
                title={sourcesOpen ? 'Hide sources' : 'Show sources'}
              >
                <FileText size={14} />
              </button>
            )}

            {onToggleArtifacts && (
              <button
                className={`ps-icon-btn ${artifactsOpen ? 'ps-icon-btn--active' : ''}`}
                onClick={onToggleArtifacts}
                title={artifactsOpen ? 'Hide artifacts' : 'Show artifacts'}
              >
                <Pin size={14} />
              </button>
            )}

            {/* Context indicator */}
            {activeDocCount > 0 && (
              <div style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                color: 'var(--ps-text-muted)',
                padding: '2px 8px',
                borderRadius: 'var(--ps-radius-full)',
                background: 'var(--ps-accent-soft)',
              }}>
                <Layers size={11} style={{ color: 'var(--ps-accent)' }} />
                <span style={{ color: 'var(--ps-accent)' }}>{activeDocCount}</span>
                <span>source{activeDocCount !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          {/* Voice Control */}
          {voiceEnabled && (
            <div style={{ marginTop: 8 }}>
              <ErrorBoundary componentName="Voice Control" fallback={
                <div style={{ textAlign: 'center', padding: 8, color: '#f59e0b', fontSize: 13 }}>
                  <MicOff size={14} style={{ marginRight: 4 }} />
                  Voice input unavailable
                </div>
              }>
                <Suspense fallback={<div style={{ height: 40 }} />}>
                  <VoiceControl
                    enabled={voiceEnabled}
                    mode={voiceMode}
                    wakeWord="hey pulse"
                    onTranscript={(text, isFinal) => {
                      if (isFinal) {
                        setInput(text);
                        onSendMessage();
                      } else {
                        setInput(text);
                      }
                    }}
                    onCommand={() => {}}
                    onListeningChange={() => {}}
                  />
                </Suspense>
              </ErrorBoundary>
            </div>
          )}
        </div>
      )}

      {/* Focus Timer Widget */}
      {showFocusTimer && (
        <FocusTimer onClose={() => setShowFocusTimer(false)} />
      )}
    </>
  );
};

export default PulseStudio;
