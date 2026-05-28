// LaneSection — collapsible category lane (Work / Admin / Tools / News / Personal).
import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { MockLane } from '../data/mockEmails';
import { MOCK_EMAILS } from '../data/mockEmails';
import { LaneRow } from './LaneRow';

interface LaneSectionProps {
  lane: MockLane;
  defaultOpen?: boolean;
}

export const LaneSection: React.FC<LaneSectionProps> = ({ lane, defaultOpen }) => {
  const items = MOCK_EMAILS.filter((e) => e.lane === lane.id);
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
          <span className="text-[11px] font-mono-pulse pulse-ink-3-color tnum">{items.length}</span>
          {open ? <ChevronUp className="w-4 h-4 pulse-ink-3-color" /> : <ChevronDown className="w-4 h-4 pulse-ink-3-color" />}
        </div>
      </button>

      {open && (
        <div className="border-t pulse-border-color">
          {items.map((it, idx) => (
            <LaneRow key={it.id} email={it} showTopBorder={idx > 0} />
          ))}
        </div>
      )}
    </div>
  );
};

export default LaneSection;
