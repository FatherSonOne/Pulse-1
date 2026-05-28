// SignalRow — single expandable row in the Cockpit Signal section.
// Header click ONLY opens the row (never closes it) — closing is reserved
// for explicit user actions: the chevron button on the right, the Esc key
// (orchestrator-owned), or any of the InlineReader's archive/reply/etc.
// actions which navigate away from the row.
import React from 'react';
import {
  ChevronUp, ChevronDown, Layers,
  Send, CheckSquare, MoonStar, ArrowRight, Calendar,
} from 'lucide-react';
import { useEmailStore } from '../../../../store/emailStore';
import type { EmailRow, AiActionKind } from '../data/emailRow';
import { Avatar, ToneChip } from '../primitives';
import { InlineReader } from './InlineReader';

interface SignalRowProps {
  email: EmailRow;
  expanded: boolean;
  focused: boolean;
  onToggle: () => void;
  onFocus: () => void;
  onTriage?: () => void;
  queuePos: number | null;
  queueTotal: number;
  queueCleared: boolean;
}

const ActionIcon: React.FC<{ kind: AiActionKind }> = ({ kind }) => {
  switch (kind) {
    case 'reply':  return <Send className="w-3 h-3" />;
    case 'task':   return <CheckSquare className="w-3 h-3" />;
    case 'snooze': return <MoonStar className="w-3 h-3" />;
    case 'meet':   return <Calendar className="w-3 h-3" />;
    case 'link':
    case 'rsvp':
    default:       return <ArrowRight className="w-3 h-3" />;
  }
};

export const SignalRow: React.FC<SignalRowProps> = ({
  email, expanded, focused, onToggle, onFocus, onTriage, queuePos, queueTotal, queueCleared,
}) => {
  const handleEmailSelect = useEmailStore((s) => s.handleEmailSelect);

  // Header interaction: only open; never close from a click on the body.
  const handleHeaderOpen = () => {
    if (expanded) return;
    onToggle();
    if (email._raw && !email._raw.is_read) {
      void handleEmailSelect(email._raw);
    }
  };

  // Chevron: explicit toggle. When expanded → close; when collapsed → open.
  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle();
    if (!expanded && email._raw && !email._raw.is_read) {
      void handleEmailSelect(email._raw);
    }
  };

  return (
    <div
      className="signal-row border pulse-border-color overflow-hidden"
      data-expanded={expanded}
      data-focused={focused}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={handleHeaderOpen}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !expanded) {
            e.preventDefault();
            handleHeaderOpen();
          }
        }}
        onMouseEnter={onFocus}
        className={`w-full text-left flex items-start gap-4 px-4 py-3.5 ${expanded ? '' : 'cursor-pointer'}`}
        aria-expanded={expanded}
        aria-label={expanded ? `Email from ${email.from}, expanded` : `Open email from ${email.from}: ${email.subject}`}
      >
        <Avatar name={email.from} size={36} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[13px] font-semibold pulse-ink-color">{email.from}</span>
            {email.org && <>
              <span className="text-[11px] pulse-ink-3-color">·</span>
              <span className="text-[11px] pulse-ink-3-color">{email.org}</span>
            </>}
            <ToneChip tone={email.tone} />
            {queueCleared ? (
              <span className="queue-pip cleared" title="Cleared in this triage session">CLEARED</span>
            ) : queuePos != null && (
              <span className="queue-pip" title={`Position ${queuePos} of ${queueTotal} in triage queue`}>
                <span className="tnum">#{queuePos}</span>
                <span className="opacity-60">/ {queueTotal}</span>
              </span>
            )}
            <span className="ml-auto text-[11px] font-mono-pulse pulse-ink-3-color tnum">{email.when}</span>
          </div>

          <div className="cockpit-headline text-[17px] pulse-ink-color leading-snug mb-1.5">
            {email.subject}
          </div>

          {email.aiSummary && (
            <div className="flex items-start gap-2">
              <span className="mt-1 pulse-rose-color shrink-0">→</span>
              <p className="text-[13px] pulse-ink-2-color leading-relaxed">{email.aiSummary}</p>
            </div>
          )}

          <div className="mt-2.5 flex items-center gap-2 flex-wrap">
            {email.aiActions.slice(0, 2).map((a) => (
              <button
                key={a.id}
                onClick={(e) => e.stopPropagation()}
                type="button"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md pulse-surface-raised text-[12px] pulse-ink-color hover:pulse-rose-bg-soft-color"
              >
                <ActionIcon kind={a.kind} />
                <span>{a.label}</span>
              </button>
            ))}

            <div className="ml-auto row-actions flex items-center gap-1">
              {onTriage && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onTriage(); }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border pulse-border-color text-[11px] font-mono-pulse tracking-wide-mono pulse-ink-2-color hover:pulse-rose-color hover:pulse-rose-border"
                  aria-label={`Triage email from ${email.from}`}
                >
                  <Layers className="w-3 h-3" />TRIAGE
                </button>
              )}
              <button
                type="button"
                onClick={handleChevronClick}
                className="p-1 rounded hover:pulse-surface-raised pulse-ink-3-color"
                aria-label={expanded ? `Collapse email from ${email.from}` : `Expand email from ${email.from}`}
                title={expanded ? 'Collapse (Esc)' : 'Expand'}
              >
                {expanded
                  ? <ChevronUp className="w-4 h-4" />
                  : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {expanded && <InlineReader email={email} />}
    </div>
  );
};

export default SignalRow;
