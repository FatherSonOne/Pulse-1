// LaneRow — compact row inside a LaneSection.
// Same click-anywhere-to-toggle behavior as SignalRow: tap the row to open,
// tap anywhere not-a-button to collapse. Shares expandedSignalRowId with
// the Signal section so only one row is open at a time.
import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { EmailRow } from '../data/emailRow';
import { Avatar } from '../primitives';
import { InlineReader } from './InlineReader';

interface LaneRowProps {
  email: EmailRow;
  expanded: boolean;
  onToggle: () => void;
  showTopBorder?: boolean;
}

function isInsideInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('button, a, input, textarea, select, label'));
}

export const LaneRow: React.FC<LaneRowProps> = ({ email, expanded, onToggle, showTopBorder }) => {
  const handleRowClick = (e: React.MouseEvent) => {
    if (isInsideInteractive(e.target)) return;
    onToggle();
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle();
  };

  return (
    <div
      className={`cursor-pointer ${showTopBorder ? 'border-t pulse-border-color' : ''}`}
      role="button"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      aria-expanded={expanded}
      aria-label={expanded
        ? `Email from ${email.from}, expanded. Click to collapse.`
        : `Open email from ${email.from}: ${email.subject}`}
    >
      <div className="selectable-row flex items-center gap-3 px-4 py-2.5">
        <Avatar name={email.from} size={26} />
        <span className="text-[12.5px] pulse-ink-color truncate min-w-[140px]">{email.from}</span>
        <span className="text-[12.5px] pulse-ink-2-color truncate flex-1">{email.subject}</span>
        <button
          type="button"
          onClick={handleChevronClick}
          className="p-1 rounded hover:pulse-surface-raised pulse-ink-3-color"
          aria-label={expanded ? `Collapse email from ${email.from}` : `Expand email from ${email.from}`}
          title={expanded ? 'Collapse (Esc)' : 'Expand'}
        >
          {expanded
            ? <ChevronUp className="w-3.5 h-3.5" />
            : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        <span className="text-[11px] font-mono-pulse pulse-ink-3-color tnum shrink-0 w-10 text-right">{email.when}</span>
      </div>

      {expanded && <InlineReader email={email} />}
    </div>
  );
};

export default LaneRow;
