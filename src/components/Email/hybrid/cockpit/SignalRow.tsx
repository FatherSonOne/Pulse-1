// SignalRow — single expandable row in the Cockpit Signal section.
// Click ANYWHERE on the card (except a button/link/input) toggles expansion.
// Closing is therefore a natural gesture: open the card, read it, click
// anywhere on the body to collapse. Buttons (Reply/Archive/TRIAGE/AI
// actions/chevron) handle their own clicks because the row-level handler
// bails when the click target is inside an interactive element.
import React from 'react';
import {
  ChevronUp, ChevronDown, Layers,
  Send, CheckSquare, MoonStar, ArrowRight, Calendar,
} from 'lucide-react';
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

function isInsideInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('button, a, input, textarea, select, label'));
}

export const SignalRow: React.FC<SignalRowProps> = ({
  email, expanded, focused, onToggle, onFocus, onTriage, queuePos, queueTotal, queueCleared,
}) => {
  // Row-level click: toggle unless the click hit a real interactive child.
  const handleRowClick = (e: React.MouseEvent) => {
    if (isInsideInteractive(e.target)) return;
    onToggle();
  };

  // Chevron button: explicit toggle. Click bubbles up to the row but the
  // row's handler skips it because the chevron is itself a <button>.
  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle();
  };

  return (
    <div
      className="signal-row border pulse-border-color overflow-hidden cursor-pointer"
      data-expanded={expanded}
      data-focused={focused}
      role="button"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      onMouseEnter={onFocus}
      aria-expanded={expanded}
      aria-label={expanded
        ? `Email from ${email.from}, expanded. Click to collapse.`
        : `Open email from ${email.from}: ${email.subject}`}
    >
      <div className="w-full text-left flex items-start gap-4 px-4 py-3.5">
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
            <p className="text-[13px] pulse-ink-2-color leading-relaxed">{email.aiSummary}</p>
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
