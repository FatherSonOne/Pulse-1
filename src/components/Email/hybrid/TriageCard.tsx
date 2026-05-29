// TriageCard — focal-card view of one email in Triage mode.
// Per handoff §6 step 5: subject + AI briefing strip + body + action bar
// (Archive E / Snooze H / → Task T / Reply R or Send draft ⌘↵).
// Phase 3 takes its email as an EmailRow (works with mock + live data alike).
import React, { useMemo } from 'react';
import { Clock, Archive, MoonStar, CheckSquare, Reply, Send, Maximize2 } from 'lucide-react';
import toast from 'react-hot-toast';
import DOMPurify from 'isomorphic-dompurify';
import type { EmailRow } from './data/emailRow';
import { useEmailUIStore } from '../../../store/emailUIStore';
import { Avatar, AiChip, ToneChip, Keycap } from './primitives';

export type TriageAction = 'Archive' | 'Snooze' | '→ Task' | 'Reply' | 'Send draft';

interface TriageCardProps {
  email: EmailRow;
  onAction: (label: TriageAction) => void;
  compact?: boolean;
}

export const TriageCard: React.FC<TriageCardProps> = ({ email, onAction, compact = false }) => {
  const hasDraft = Boolean(email.draft);
  const openReaderPanel = useEmailUIStore((s) => s.openReaderPanel);

  // Same body-rendering logic as InlineReader (Phase 12.11 + 12.13):
  //   prefer body_html → fall through to HTML-shaped body_text → fall
  //   through to plain text with pre-wrap. Keeps Triage focal cards from
  //   showing raw HTML markup for senders like Pines Cottages.
  const rawHtml = email._raw?.body_html?.trim();
  const rawText = email.body || email._raw?.snippet || '';
  const looksLikeHtml = (s: string) => {
    const trimmed = s.trim();
    if (!trimmed.startsWith('<')) return false;
    return /<[a-z][^>]*>/i.test(trimmed) && /<\/[a-z]+>|\/>/i.test(trimmed);
  };
  const htmlSource = rawHtml || (looksLikeHtml(rawText) ? rawText : '');
  const sanitizedHtml = useMemo(() => {
    if (!htmlSource) return '';
    return DOMPurify.sanitize(htmlSource, {
      FORBID_TAGS: ['script', 'style', 'form', 'iframe', 'object', 'embed'],
      FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus'],
    });
  }, [htmlSource]);

  // Phase 12.10 — escape hatch from the bounded Triage stage into the
  // full-page reader. Triage idx stays put so the user comes back to the
  // same card when they close the reader panel.
  const handleOpenFullPage = () => {
    if (!email._raw) {
      toast('Mock card — full-page reader is a no-op here.');
      return;
    }
    openReaderPanel(email._raw.id, { maximized: true });
  };

  return (
    <div
      className="triage-stage relative h-full flex flex-col overflow-hidden card-in"
      key={email.id}
      role="region"
      aria-label={`Triage card: email from ${email.from} — ${email.subject}`}
    >
      {/* Header */}
      <div className={`${compact ? 'px-5 pt-4 pb-3' : 'px-7 pt-6 pb-4'} border-b pulse-border-color`}>
        <div className="flex items-start gap-4">
          <Avatar name={email.from} size={compact ? 40 : 48} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`${compact ? 'text-[14px]' : 'text-[15px]'} font-semibold pulse-ink-color`}>
                {email.from}
              </span>
              {email.org && (
                <span className="text-[12px] pulse-ink-3-color truncate">· {email.org}</span>
              )}
              <ToneChip tone={email.tone} />
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono-pulse pulse-ink-3-color tracking-wide-mono flex-wrap">
              <Clock className="w-3 h-3" />
              <span>{email.whenLong}</span>
              {email.threadCount > 1 && (
                <>
                  <span>·</span>
                  <span>{email.threadCount} IN THREAD</span>
                </>
              )}
              <span>·</span>
              <span className="lowercase tracking-normal">{email.fromEmail}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleOpenFullPage}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] uppercase tracking-wide-mono pulse-ink-3-color hover:pulse-rose-color hover:pulse-rose-bg-soft-color border pulse-border-color transition shrink-0"
            title="Open full page"
            aria-label="Open this email in the full-page reader"
          >
            <Maximize2 className="w-3 h-3" />
            FULL PAGE
          </button>
        </div>
        <h3
          className={`mt-4 ${compact ? 'text-xl' : 'text-2xl'} pulse-ink-color tracking-tight`}
          style={{ fontFamily: 'var(--pulse-font-serif)', fontWeight: 500 }}
        >
          {email.subject}
        </h3>
      </div>

      {/* AI briefing strip (coral background — reserved for AI provenance per CLAUDE.md §4) */}
      {email.aiSummary && (
        <div
          className={`${compact ? 'px-5 py-3' : 'px-7 py-4'} pulse-coral-bg-08-color border-b pulse-border-color`}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <AiChip>Claude · briefing</AiChip>
            </div>
            <p
              className={`${compact ? 'text-[13px]' : 'text-[13.5px]'} leading-relaxed pulse-ink-2-color flex-1`}
            >
              {email.aiSummary}
            </p>
          </div>
        </div>
      )}

      {/* Body — focusable scroll region. tabIndex=-1 keeps it out of the Tab
          cycle but lets focus management land here on Triage entry, so
          accidental Space/Enter scrolls instead of firing Archive. */}
      <div
        className={`triage-body flex-1 overflow-y-auto ${compact ? 'px-5 py-4' : 'px-7 py-5'}`}
        tabIndex={-1}
        role="article"
        aria-label={`Email body from ${email.from}`}
      >
        {sanitizedHtml ? (
          <div
            className="email-body-html max-w-[760px]"
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
          />
        ) : (
          <div className="email-body-text max-w-[760px]">{rawText}</div>
        )}
      </div>

      {/* Action bar */}
      <div
        className={`border-t pulse-border-color ${compact ? 'px-5 py-3' : 'px-7 py-4'} flex items-center gap-2 shrink-0 flex-wrap`}
        style={{ background: 'var(--pulse-canvas-soft)' }}
      >
        <button
          type="button"
          onClick={() => onAction('Archive')}
          className="flex items-center gap-2 px-3 py-2 rounded-lg pulse-surface text-[13px] font-medium pulse-ink-color border pulse-border-color hover:pulse-surface-raised"
        >
          <Archive className="w-4 h-4" />
          <span>Archive</span>
          <Keycap>E</Keycap>
        </button>
        <button
          type="button"
          onClick={() => onAction('Snooze')}
          className="flex items-center gap-2 px-3 py-2 rounded-lg pulse-surface text-[13px] font-medium pulse-ink-color border pulse-border-color hover:pulse-surface-raised"
        >
          <MoonStar className="w-4 h-4" />
          <span>Snooze</span>
          <Keycap>H</Keycap>
        </button>
        {!compact && (
          <button
            type="button"
            onClick={() => onAction('→ Task')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg pulse-surface text-[13px] font-medium pulse-ink-color border pulse-border-color hover:pulse-surface-raised"
          >
            <CheckSquare className="w-4 h-4" />
            <span>→ Task</span>
            <Keycap>T</Keycap>
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {hasDraft ? (
            <div className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg pulse-rose-bg-soft-color border pulse-rose-border">
              <AiChip>Draft ready</AiChip>
              <button
                type="button"
                onClick={() => onAction('Send draft')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md pulse-rose-bg-color text-white text-[13px] font-medium"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
                <span className="opacity-75">
                  <Keycap>⌘↵</Keycap>
                </span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onAction('Reply')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg pulse-rose-bg-color text-white text-[13px] font-medium"
            >
              <Reply className="w-4 h-4" />
              <span>Reply</span>
              <Keycap>R</Keycap>
            </button>
          )}
        </div>
      </div>

      {/* Drafted-reply teaser (full preview lives in the action bar above) */}
      {hasDraft && !compact && (
        <div
          className="border-t pulse-border-color px-7 py-3 shrink-0"
          style={{ background: 'var(--pulse-surface)' }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <AiChip variant="muted">Claude drafted</AiChip>
            <span className="text-[11px] pulse-ink-3-color">tap to edit before sending</span>
          </div>
          <p className="text-[13px] pulse-ink-2-color leading-relaxed italic">"{email.draft}"</p>
        </div>
      )}
    </div>
  );
};

export default TriageCard;
