// LaneSection — collapsible category lane.
// Phase 12.4: rows open the slide-out EmailReaderPanel instead of expanding
// inline, so LaneSection no longer manages an expanded id per row.
import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { EmailRow } from '../data/emailRow';
import type { MockLane } from '../data/mockEmails';
import { LaneRow } from './LaneRow';

interface LaneSectionProps {
  lane: MockLane;
  emails: EmailRow[];
  defaultOpen?: boolean;
}

export const LaneSection: React.FC<LaneSectionProps> = ({ lane, emails, defaultOpen }) => {
  const [open, setOpen] = useState<boolean>(defaultOpen ?? lane.id === 'work');

  return (
    <div className="border pulse-border-color rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="lane-card w-full flex items-center justify-between px-4 py-3 text-left"
        type="button"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <div className="cockpit-headline text-[15px] pulse-ink-color">{lane.label}</div>
          <span className="text-[11px] pulse-ink-3-color">{lane.desc}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono-pulse pulse-ink-3-color tnum">{emails.length}</span>
          {open ? <ChevronUp className="w-4 h-4 pulse-ink-3-color" /> : <ChevronDown className="w-4 h-4 pulse-ink-3-color" />}
        </div>
      </button>

      {open && emails.length > 0 && (
        <div className="border-t pulse-border-color">
          {emails.map((it, idx) => (
            <LaneRow key={it.id} email={it} showTopBorder={idx > 0} />
          ))}
        </div>
      )}

      {open && emails.length === 0 && (
        <div className="border-t pulse-border-color px-4 py-6 text-center text-[12px] pulse-ink-3-color italic">
          Nothing in this lane right now.
        </div>
      )}
    </div>
  );
};

export default LaneSection;
