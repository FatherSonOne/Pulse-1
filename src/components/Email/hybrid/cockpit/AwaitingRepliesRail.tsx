// AwaitingRepliesRail — right-rail follow-ups list.
// Replaces FollowUpRemindersDropdown per handoff §4.5. Phase 2 wires to live
// follow-up data via the existing useFollowUps hook.
import React from 'react';
import { Avatar } from '../primitives';
import { MOCK_AWAITING } from '../data/mockEmails';

export const AwaitingRepliesRail: React.FC = () => {
  if (MOCK_AWAITING.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-mono-pulse tracking-wide-mono pulse-ink-3-color">AWAITING REPLIES</h3>
        <span className="text-[11px] font-mono-pulse pulse-ink-3-color tnum">{MOCK_AWAITING.length}</span>
      </div>

      <div className="space-y-2">
        {MOCK_AWAITING.map((row) => (
          <div key={row.name} className="flex items-center gap-2 py-1.5">
            <Avatar name={row.name} size={22} />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] pulse-ink-color truncate">{row.name}</div>
              <div className="text-[11px] pulse-ink-3-color truncate">{row.subject}</div>
            </div>
            <span
              className={`text-[10px] font-mono-pulse tracking-tight-mono tnum shrink-0 ${
                row.cold ? 'pulse-coral-fg-color' : 'pulse-ink-3-color'
              }`}
            >
              {row.days}D
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AwaitingRepliesRail;
