// DraftedForYouRail — right-rail "Drafted for you" cards.
// Phase 2 disposition (handoff §4.5): NEW FEATURE — wire to AI in v1.1.
// For v1 we render NOTHING if no draft data is supplied; the component
// stays in the tree so v1.1 only has to change one prop.
import React from 'react';
import { Send, X } from 'lucide-react';
import { Avatar, AiChip } from '../primitives';
import type { EmailRow } from '../data/emailRow';

interface DraftedForYouRailProps {
  drafts?: EmailRow[];
}

export const DraftedForYouRail: React.FC<DraftedForYouRailProps> = ({ drafts = [] }) => {
  if (drafts.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-mono-pulse tracking-wide-mono pulse-rose-color">DRAFTED FOR YOU</h3>
        <span className="text-[11px] font-mono-pulse pulse-ink-3-color tnum">{drafts.length}</span>
      </div>

      <div className="space-y-2.5">
        {drafts.map((email) => (
          <div key={email.id} className="draft-card rounded-xl px-3 py-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Avatar name={email.from} size={22} />
              <span className="text-[12px] font-medium pulse-ink-color truncate">{email.from}</span>
              <AiChip variant="muted">draft</AiChip>
            </div>
            <p className="text-[12px] pulse-ink-2-color italic leading-relaxed line-clamp-2 mb-2.5">
              "{email.draft}"
            </p>
            <div className="flex items-center gap-1.5">
              <button type="button" className="flex-1 px-2 py-1 rounded-md pulse-rose-bg-color text-white text-[11px] font-medium flex items-center justify-center gap-1">
                <Send className="w-3 h-3" />Send
              </button>
              <button type="button" className="px-2 py-1 rounded-md border pulse-border-color text-[11px] pulse-ink-2-color">
                Edit
              </button>
              <button type="button" className="px-2 py-1 rounded-md border pulse-border-color text-[11px] pulse-ink-3-color">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DraftedForYouRail;
