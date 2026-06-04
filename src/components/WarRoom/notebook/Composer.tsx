/**
 * Composer — Notebook chat input, built to the mockup.
 *
 * Suggestion chips over a single input row: voice-dock toggle (mic) · upload ·
 * the text field · slash hints · send. The slash/@ command machinery
 * (useStudioCommands) and send paths are preserved verbatim:
 *   `/command` → onSendDirect(fullPrompt) (agent override applied);
 *   otherwise → onSendMessage() (subscription dedup, no full-list refetch).
 *
 * The agent selector + deep-think toggle moved to the ChatPane masthead, and
 * the realtime voice agent is the one voice affordance (mic toggles DockedVoice)
 * — so this row matches the mockup instead of the legacy PulseStudio tool bar.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { settingsService } from '../../../services/settingsService';
import { AgentType } from '../AgentSelector';
import { useStudioCommands, StudioCommand, AgentMention } from '../useStudioCommands';
import { PromptSuggestion } from '../../../services/ragService';

import { Mic, Paperclip, Send, Square, Wand2, X } from 'lucide-react';
import { useVoiceToText } from '../../../hooks/useVoiceToText';
import { useMicLevel } from '../../../hooks/useMicLevel';

/** Small waveform shown inline while dictating — reacts to the mic level
 *  (Comet-style), with a gentle idle shimmer when you're quiet. */
const MiniWaveform: React.FC<{ level: number }> = ({ level }) => {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => { setPhase((p) => p + 0.18); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 18 }} aria-hidden>
      {Array.from({ length: 9 }).map((_, i) => {
        const idle = 3 + Math.abs(Math.sin(phase + i * 0.7)) * 3;
        const reactive = level * 15 * (0.55 + 0.45 * Math.abs(Math.sin(i * 1.3 + phase * 0.5)));
        const h = Math.max(3, Math.min(18, idle + reactive));
        return <span key={i} style={{ width: 3, height: h, borderRadius: 2, background: 'var(--pulse-rose)' }} />;
      })}
    </div>
  );
};

export interface ComposerProps {
  input: string;
  setInput: (v: string) => void;
  isLoading: boolean;
  onSendMessage: () => void;
  onSendDirect: (text: string) => void;

  activeAgent: AgentType;
  setActiveAgent: (v: AgentType) => void;

  suggestions: PromptSuggestion[];
  showSuggestions: boolean;
  setShowSuggestions: (v: boolean) => void;
  handleUseSuggestion: (s: PromptSuggestion) => void;

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
  suggestions,
  showSuggestions,
  setShowSuggestions,
  handleUseSuggestion,
  onUploadClick,
  activeDocCount,
  hasDocuments,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const { parseInput, getAutocompleteSuggestions, applyAutocomplete } = useStudioCommands();

  // ── Inline voice dictation (Comet-style): the mic fills the composer with
  // your speech + shows a waveform in the bar. Does NOT open the Live voice
  // stage (that's reached via Live mode). Web Speech API, no key required.
  const voiceBaseRef = useRef('');
  const voice = useVoiceToText({
    continuous: true,
    onInterimResult: (t) => {
      setInput((voiceBaseRef.current ? voiceBaseRef.current + ' ' : '') + t);
    },
    onFinalResult: (t) => {
      voiceBaseRef.current = (voiceBaseRef.current ? voiceBaseRef.current + ' ' : '') + t.trim();
      setInput(voiceBaseRef.current);
    },
  });
  const micLevel = useMicLevel(voice.isListening);

  const toggleDictation = useCallback(() => {
    if (voice.isListening) {
      voice.stopListening();
    } else {
      voiceBaseRef.current = input.trim();
      voice.startListening();
      inputRef.current?.focus();
    }
  }, [voice, input, setInput]);
  const [autocompleteItems, setAutocompleteItems] = useState<(StudioCommand | AgentMention)[]>([]);
  const [autocompleteIdx, setAutocompleteIdx] = useState(0);
  const showAutocomplete = autocompleteItems.length > 0;

  useEffect(() => {
    const items = getAutocompleteSuggestions(input);
    setAutocompleteItems(items);
    setAutocompleteIdx(0);
  }, [input, getAutocompleteSuggestions]);

  const handleCommandSend = useCallback(() => {
    if (voice.isListening) voice.stopListening();
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
  }, [voice, input, isLoading, parseInput, activeAgent, setActiveAgent, setInput, onSendDirect, onSendMessage]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (showAutocomplete) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setAutocompleteIdx((i) => Math.min(i + 1, autocompleteItems.length - 1)); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); setAutocompleteIdx((i) => Math.max(i - 1, 0)); return; }
        if (e.key === 'Tab' || (e.key === 'Enter' && autocompleteItems.length > 0)) {
          const item = autocompleteItems[autocompleteIdx];
          if (item) {
            const isPartial = /^\/\w*$/.test(input.trim()) || /\s@\w*$/.test(input) || /^@\w*$/.test(input.trim());
            if (e.key === 'Tab' || isPartial) {
              e.preventDefault();
              setInput(applyAutocomplete(input, item));
              setAutocompleteItems([]);
              return;
            }
          }
        }
        if (e.key === 'Escape') { setAutocompleteItems([]); return; }
      }
      if (e.key === 'Enter' && !e.shiftKey) handleCommandSend();
    },
    [showAutocomplete, autocompleteItems, autocompleteIdx, input, applyAutocomplete, setInput, handleCommandSend],
  );

  return (
    <div style={{ borderTop: '1px solid var(--pulse-border)', padding: 12, flexShrink: 0 }}>
      {/* Suggestion chips */}
      {suggestions.length > 0 && showSuggestions && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {suggestions.slice(0, 4).map((s) => (
            <button
              key={s.id}
              onClick={() => handleUseSuggestion(s)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 999, fontSize: 11,
                color: 'var(--pulse-ink-2)', border: '1px solid var(--pulse-border)',
                background: 'transparent', cursor: 'pointer',
              }}
            >
              <Wand2 size={11} />
              {s.suggestion_text.length > 50 ? s.suggestion_text.slice(0, 50) + '…' : s.suggestion_text}
            </button>
          ))}
          <button
            onClick={() => setShowSuggestions(false)}
            title="Hide suggestions"
            style={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--pulse-ink-3)', cursor: 'pointer' }}
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Input row */}
      <div style={{ position: 'relative' }}>
        {showAutocomplete && (
          <div
            style={{
              position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 6,
              borderRadius: 10, border: '1px solid var(--pulse-border-strong)', background: 'var(--pulse-surface)',
              boxShadow: 'var(--pulse-shadow-modal, 0 8px 24px rgba(0,0,0,0.25))', overflow: 'hidden', zIndex: 30,
            }}
          >
            {autocompleteItems.map((item, i) => (
              <button
                key={item.id}
                onMouseDown={(e) => { e.preventDefault(); setInput(applyAutocomplete(input, item)); setAutocompleteItems([]); inputRef.current?.focus(); }}
                onMouseEnter={() => setAutocompleteIdx(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', border: 'none',
                  background: i === autocompleteIdx ? 'var(--pulse-surface-raised)' : 'transparent',
                  color: 'var(--pulse-ink)', cursor: 'pointer', textAlign: 'left', fontSize: 12.5,
                }}
              >
                <i className={`fa ${item.icon}`} style={{ color: item.accent, width: 16, textAlign: 'center', fontSize: 12 }} />
                <span style={{ fontWeight: 500 }}>{item.label}</span>
                <span style={{ color: 'var(--pulse-ink-3)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</span>
              </button>
            ))}
            <div style={{ padding: '6px 12px', fontSize: 10, color: 'var(--pulse-ink-3)', borderTop: '1px solid var(--pulse-border)' }}>
              Tab to select · Esc to dismiss
            </div>
          </div>
        )}

        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            borderRadius: 12, border: '1px solid var(--pulse-border-strong)', background: 'var(--pulse-surface)',
            padding: '8px 10px',
          }}
        >
          {/* Inline voice dictation (Comet-style) — fills the bar, no Live view */}
          <button
            onClick={toggleDictation}
            disabled={!voice.isSupported}
            title={voice.isListening ? 'Stop dictation' : voice.isSupported ? 'Dictate with your voice' : 'Voice input not supported in this browser'}
            aria-pressed={voice.isListening}
            style={{
              width: 32, height: 32, borderRadius: 9, flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', cursor: voice.isSupported ? 'pointer' : 'default',
              background: voice.isListening ? 'var(--pulse-rose)' : 'var(--pulse-surface-raised)',
              color: voice.isListening ? 'white' : 'var(--pulse-ink-2)',
              opacity: voice.isSupported ? 1 : 0.5,
            }}
          >
            {voice.isListening ? <Square size={14} /> : <Mic size={16} />}
          </button>

          {/* Upload */}
          {onUploadClick && (
            <button
              onClick={onUploadClick}
              title="Add a source"
              style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: 'var(--pulse-ink-3)', cursor: 'pointer' }}
            >
              <Paperclip size={16} />
            </button>
          )}

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={
              activeDocCount > 0
                ? `Ask about your ${activeDocCount} source${activeDocCount !== 1 ? 's' : ''}, or type / …`
                : hasDocuments
                  ? 'Ask about your sources, or type / …'
                  : 'Ask anything, or type / for a command…'
            }
            disabled={isLoading}
            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', fontSize: 13.5, color: 'var(--pulse-ink)' }}
          />

          {voice.isListening ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <MiniWaveform level={micLevel} />
              <span style={{ fontFamily: 'var(--pulse-font-mono)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--pulse-rose)' }}>LISTENING</span>
            </div>
          ) : (
            <div className="wr-nb-slash-hint" style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, fontFamily: 'var(--pulse-font-mono)', fontSize: 10, color: 'var(--pulse-ink-3)' }}>
              <span>/summarize</span>
              <span>/analyze</span>
            </div>
          )}

          <button
            onClick={handleCommandSend}
            disabled={isLoading || !input.trim()}
            aria-label="Send message"
            style={{
              width: 32, height: 32, borderRadius: 9, flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', cursor: input.trim() && !isLoading ? 'pointer' : 'default',
              background: 'var(--pulse-rose)', color: 'white', opacity: input.trim() && !isLoading ? 1 : 0.5,
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Composer;
