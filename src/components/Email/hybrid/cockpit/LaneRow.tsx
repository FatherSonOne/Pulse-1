// LaneRow — compact row inside a LaneSection.
// Click opens an inline reader beneath the row (shares expandedSignalRowId
// with the Signal section so only one row is open at a time across the
// whole Cockpit). The mark-as-read side effect is deliberately omitted so
// the row doesn't disappear from any underlying filters mid-click.
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

export const LaneRow: React.FC<LaneRowProps> = ({ email, expanded, onToggle, showTopBorder }) => {
  const handleOpen = () => {
    if (expanded) return;
    onToggle();
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle();
  };

  return (
    <div className={showTopBorder ? 'border-t pulse-border-color' : undefined}>
      <div
        role="button"
        tabIndex={0}
        onClick={handleOpen}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !expanded) {
            e.preventDefault();
            handleOpen();
          }
        }}
        className={`selectable-row flex items-center gap-3 px-4 py-2.5 ${expanded ? '' : 'cursor-pointer'}`}
        aria-expanded={expanded}
        aria-label={expanded ? `Email from ${email.from}, expanded` : `Open email from ${email.from}: ${email.subject}`}
      >
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
