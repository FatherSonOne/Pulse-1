/**
 * EmptyState — teaching cold-start for the Notebook (handoff Phase 7, P0).
 *
 * The front door now teaches the engine instead of showing a lone "Summarize
 * this source". Covers both zero-doc and zero-message states:
 *   • a one-line "what this can do" + three capability lines (grounded chat,
 *     generators, voice);
 *   • a drop-first-source CTA (zero docs) or example prompt chips that fire
 *     real grounded queries (docs present);
 *   • the slash commands surfaced as affordances + the ⌘K hint.
 *
 * Supersedes the old PulseStudio welcome and the StudioOnboarding overlay where
 * redundant. Coral is reserved for the AI capability glyphs.
 */

import React from 'react';
import { KnowledgeDoc, PromptSuggestion } from '../../../services/ragService';
import { ArrowRight, BookOpen, Layers, MessageSquare, Mic, Wand2 } from 'lucide-react';

export interface EmptyStateProps {
  documents: KnowledgeDoc[];
  activeDocCount: number;
  onUploadClick?: () => void;
  onSendDirect: (text: string) => void;
  suggestions: PromptSuggestion[];
  handleUseSuggestion: (s: PromptSuggestion) => void;
}

const SLASH_COMMANDS = ['/summarize', '/analyze', '/brainstorm', '/decide', '/plan', '/risks', '/compare', '/debrief'];

const EXAMPLE_PROMPTS = [
  { label: 'Summarize the key points', send: '/summarize Summarize the key points from my sources' },
  { label: 'Analyze for insights', send: '/analyze Analyze my sources and surface the key findings' },
  { label: 'Identify the risks', send: '/risks Identify and assess the risks in my sources' },
  { label: 'Compare my sources', send: '/compare Compare my sources side by side' },
];

const CAPABILITIES = [
  { icon: <MessageSquare size={14} />, text: 'Ask grounded questions — answers cite your sources' },
  { icon: <Layers size={14} />, text: 'Generate study guides, FAQs, timelines & podcasts' },
  { icon: <Mic size={14} />, text: 'Talk it through with the realtime voice agent' },
];

export const EmptyState: React.FC<EmptyStateProps> = ({
  documents,
  activeDocCount,
  onUploadClick,
  onSendDirect,
  suggestions,
  handleUseSuggestion,
}) => {
  const hasDocuments = documents.length > 0;
  const previewNames = documents.slice(0, 3).map((d) => d.title);
  const overflow = documents.length - previewNames.length;

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '32px 24px',
        gap: 18,
      }}
    >
      {/* Logo + title */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--pulse-coral-bg-12)',
            color: 'var(--pulse-coral-fg)',
          }}
        >
          <BookOpen size={22} />
        </div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--pulse-ink)' }}>War Room</h2>
        <p style={{ margin: 0, maxWidth: 420, fontSize: 13, color: 'var(--pulse-ink-2)', lineHeight: 1.5 }}>
          Turn your sources into grounded answers — then generate study guides, timelines, FAQs and
          a podcast, or talk it through by voice.
        </p>
      </div>

      {/* Capability lines */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
        {CAPABILITIES.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--pulse-ink-2)' }}>
            <span style={{ color: 'var(--pulse-coral-fg)', display: 'inline-flex', flexShrink: 0 }}>{c.icon}</span>
            {c.text}
          </div>
        ))}
      </div>

      {/* Primary action — depends on whether sources exist */}
      {hasDocuments ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, maxWidth: 460, width: '100%' }}>
          <div style={{ fontSize: 11, color: 'var(--pulse-ink-3)', fontFamily: 'var(--pulse-font-mono)', letterSpacing: '0.04em' }}>
            {documents.length} source{documents.length !== 1 ? 's' : ''} ready
            {activeDocCount > 0 && ` · ${activeDocCount} active`} · {previewNames.join(' · ')}
            {overflow > 0 && ` · +${overflow} more`}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {EXAMPLE_PROMPTS.map((p) => (
              <button
                key={p.label}
                onClick={() => onSendDirect(p.send)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 12px',
                  borderRadius: 999,
                  border: '1px solid var(--pulse-border)',
                  background: 'var(--pulse-surface)',
                  color: 'var(--pulse-ink)',
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'border-color var(--pulse-duration) var(--pulse-ease)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--pulse-border-strong)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--pulse-border)')}
              >
                {p.label}
                <ArrowRight size={13} style={{ color: 'var(--pulse-ink-3)' }} />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          {onUploadClick && (
            <button
              onClick={onUploadClick}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 16px',
                borderRadius: 10,
                border: 'none',
                background: 'var(--pulse-rose)',
                color: 'white',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Add your first source
              <ArrowRight size={14} />
            </button>
          )}
          <div style={{ fontSize: 12, color: 'var(--pulse-ink-3)' }}>
            …or just ask anything to start a conversation.
          </div>
        </div>
      )}

      {/* AI-suggested prompts (when available) */}
      {suggestions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxWidth: 460 }}>
          {suggestions.slice(0, 3).map((s) => (
            <button
              key={s.id}
              onClick={() => handleUseSuggestion(s)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 10px',
                borderRadius: 999,
                border: '1px solid var(--pulse-rose-soft)',
                background: 'var(--pulse-coral-bg-08)',
                color: 'var(--pulse-coral-fg)',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              <Wand2 size={11} />
              {s.suggestion_text.length > 44 ? s.suggestion_text.slice(0, 44) + '…' : s.suggestion_text}
            </button>
          ))}
        </div>
      )}

      {/* Slash-command affordances */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'center', maxWidth: 420 }}>
          {SLASH_COMMANDS.map((cmd) => (
            <span
              key={cmd}
              style={{
                fontFamily: 'var(--pulse-font-mono)',
                fontSize: 10,
                padding: '2px 7px',
                borderRadius: 4,
                background: 'var(--pulse-surface)',
                border: '1px solid var(--pulse-border)',
                color: 'var(--pulse-ink-3)',
              }}
            >
              {cmd}
            </span>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--pulse-ink-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span>Type</span>
          <kbd style={{ fontFamily: 'var(--pulse-font-mono)', padding: '1px 5px', borderRadius: 4, border: '1px solid var(--pulse-border-strong)', background: 'var(--pulse-surface)' }}>/</kbd>
          <span>for commands ·</span>
          <kbd style={{ fontFamily: 'var(--pulse-font-mono)', padding: '1px 5px', borderRadius: 4, border: '1px solid var(--pulse-border-strong)', background: 'var(--pulse-surface)' }}>⌘K</kbd>
          <span>for the palette</span>
        </div>
      </div>
    </div>
  );
};

export default EmptyState;
