/**
 * Composer — Notebook chat input.
 *
 * Faithful port of PulseStudio's input area (handoff Phase 2): suggestion
 * chips, slash/@ command autocomplete (useStudioCommands), the input row,
 * the tool row (agent selector, upload, voice/deep-think/focus toggles, panel
 * toggles, context indicator) and the inline VoiceControl. The command + send
 * machinery lives here so behavior — agent-override on /command, direct-send of
 * the expanded prompt, autocomplete keyboard nav — is preserved verbatim.
 *
 * Send paths are unchanged: `/command` input → onSendDirect(fullPrompt);
 * otherwise → onSendMessage() (which keeps the subscription-based real-time
 * path and its dedup; no full-list refetch — invariant 5).
 */

import React, { useRef, useEffect, useState, useCallback, Suspense, lazy } from 'react';
import { settingsService } from '../../../services/settingsService';
import { AgentType, AGENTS } from '../AgentSelector';
import { ErrorBoundary } from '../../shared/ErrorBoundary';
import { useStudioCommands, StudioCommand, AgentMention } from '../useStudioCommands';
import { PromptSuggestion } from '../../../services/ragService';

import {
  Brain, Check, ChevronDown, FileText, Mic, MicOff, Paperclip, Pin, Send,
  Timer, Wand2, X,
} from 'lucide-react';
import { FocusTimer } from '../FocusTimer';

const VoiceControl = lazy(() => import('../VoiceControl').then((m) => ({ default: m.VoiceControl })));

export interface ComposerProps {
  input: string;
  setInput: (v: string) => void;
  isLoading: boolean;
  onSendMessage: () => void;
  onSendDirect: (text: string) => void;

  activeAgent: AgentType;
  setActiveAgent: (v: AgentType) => void;

  voiceEnabled: boolean;
  setVoiceEnabled: (v: boolean) => void;
  voiceMode: 'push-to-talk' | 'always-on' | 'wake-word';

  enableExtendedThinking: boolean;
  setEnableExtendedThinking: (v: boolean) => void;

  suggestions: PromptSuggestion[];
  showSuggestions: boolean;
  setShowSuggestions: (v: boolean) => void;
  handleUseSuggestion: (s: PromptSuggestion) => void;

  onToggleSources?: () => void;
  onToggleArtifacts?: () => void;
  sourcesOpen?: boolean;
  artifactsOpen?: boolean;

  onUploadClick?: () => void;

  activeDocCount: number;
  hasDocuments: boolean;
}

export const Composer: React.FC<ComposerProps> = ({
  input,
  setInput,
  isLoading,
  onSendMessage,
  onSendDirect,
  activeAgent,
  setActiveAgent,
  voiceEnabled,
  setVoiceEnabled,
  voiceMode,
  enableExtendedThinking,
  setEnableExtendedThinking,
  suggestions,
  showSuggestions,
  setShowSuggestions,
  handleUseSuggestion,
  onToggleSources,
  onToggleArtifacts,
  sourcesOpen,
  artifactsOpen,
  onUploadClick,
  activeDocCount,
  hasDocuments,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const agentMenuRef = useRef<HTMLDivElement>(null);
  const agentBtnRef = useRef<HTMLButtonElement>(null);
  const [showFocusTimer, setShowFocusTimer] = useState(false);

  // ── Command system ──────────────────────────────────────────────────────
  const { parseInput, getAutocompleteSuggestions, applyAutocomplete } = useStudioCommands();
  const [autocompleteItems, setAutocompleteItems] = useState<(StudioCommand | AgentMention)[]>([]);
  const [autocompleteIdx, setAutocompleteIdx] = useState(0);
  const showAutocomplete = autocompleteItems.length > 0;

  useEffect(() => {
    const items = getAutocompleteSuggestions(input);
    setAutocompleteItems(items);
    setAutocompleteIdx(0);
  }, [input, getAutocompleteSuggestions]);

  const handleCommandSend = useCallback(() => {
    if (!input.trim() || isLoading) return;

    const parsed = parseInput(input);

    if (parsed.agentOverride && parsed.agentOverride !== activeAgent) {
      setActiveAgent(parsed.agentOverride);
      settingsService.set('liveBoardSelectedAgent', parsed.agentOverride);
    }

    if (parsed.command) {
      setInput('');
      onSendDirect(parsed.fullPrompt);
    } else {
      onSendMessage();
    }
  }, [input, isLoading, parseInput, activeAgent, setActiveAgent, setInput, onSendDirect, onSendMessage]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (showAutocomplete) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setAutocompleteIdx((i) => Math.min(i + 1, autocompleteItems.length - 1));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setAutocompleteIdx((i) => Math.max(i - 1, 0));
          return;
        }
        if (e.key === 'Tab' || (e.key === 'Enter' && autocompleteItems.length > 0)) {
          const item = autocompleteItems[autocompleteIdx];
          if (item) {
            const isPartialCommand =
              /^\/\w*$/.test(input.trim()) || /\s@\w*$/.test(input) || /^@\w*$/.test(input.trim());
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

      if (e.key === 'Enter' && !e.shiftKey) {
        handleCommandSend();
      }
    },
    [showAutocomplete, autocompleteItems, autocompleteIdx, input, applyAutocomplete, setInput, handleCommandSend],
  );

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

  const selectedAgent = AGENTS.find((a) => a.id === activeAgent) || AGENTS[0];

  return (
    <>
      <div className="ps-input-area">
        {/* Suggestions */}
        {suggestions.length > 0 && showSuggestions && (
          <div className="ps-suggestions">
            {suggestions.slice(0, 4).map((s) => (
              <button key={s.id} className="ps-suggestion" onClick={() => handleUseSuggestion(s)}>
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
          {showAutocomplete && (
            <div className="ps-autocomplete">
              {autocompleteItems.map((item, i) => (
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
              ))}
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
              onClick={() => setShowAgentMenu((v) => !v)}
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
                      e.currentTarget.style.background =
                        activeAgent === agent.id ? 'var(--ps-accent-soft)' : 'transparent';
                    }}
                  >
                    <i className={`fa ${agent.icon}`} style={{ width: 16, textAlign: 'center' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{agent.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--ps-text-muted)', marginTop: 1 }}>
                        {agent.description}
                      </div>
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
            <button className="ps-icon-btn" onClick={onUploadClick} title="Upload file">
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
            onClick={() => setShowFocusTimer((v) => !v)}
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
            <div
              style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                color: 'var(--ps-text-muted)',
                padding: '2px 8px',
                borderRadius: 'var(--ps-radius-full)',
                background: 'var(--ps-accent-soft)',
              }}
            >
              <Pin size={11} style={{ color: 'var(--ps-accent)' }} />
              <span style={{ color: 'var(--ps-accent)' }}>{activeDocCount}</span>
              <span>source{activeDocCount !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* Voice Control */}
        {voiceEnabled && (
          <div style={{ marginTop: 8 }}>
            <ErrorBoundary
              componentName="Voice Control"
              fallback={
                <div style={{ textAlign: 'center', padding: 8, color: '#f59e0b', fontSize: 13 }}>
                  <MicOff size={14} style={{ marginRight: 4 }} />
                  Voice input unavailable
                </div>
              }
            >
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

      {/* Focus Timer Widget */}
      {showFocusTimer && <FocusTimer onClose={() => setShowFocusTimer(false)} />}
    </>
  );
};

export default Composer;
