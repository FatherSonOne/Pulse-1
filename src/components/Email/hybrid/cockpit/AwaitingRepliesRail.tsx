// AwaitingRepliesRail — right-rail follow-ups list.
// Replaces FollowUpRemindersDropdown per handoff §4.5. Phase 2 powered by
// useCockpitData.awaitingReplies (sent emails in last 14d with no reply).
// WI-8: folded in the retired FollowUpNudge's value-adds — day-based urgency
// tiers (firm at 7d, urgent at 10d) + a hover "Follow up" compose action —
// without its N+1 queries or legacy styling.
import React from 'react';
import { Reply } from 'lucide-react';
import { Avatar } from '../primitives';
import type { AwaitingReplyRow } from '../data/useCockpitData';

interface AwaitingRepliesRailProps {
  rows: AwaitingReplyRow[];
  /** Open a follow-up composer for the given awaiting-reply email. */
  onFollowUp?: (emailId: string) => void;
}

// Urgency tier → day-badge color. Neutral < 7d, warning 7-9d, overdue >= 10d.
const tierColor = (days: number): string | undefined =>
  days >= 10 ? 'var(--pulse-tone-overdue)' : days >= 7 ? 'var(--pulse-tone-warning)' : undefined;

export const AwaitingRepliesRail: React.FC<AwaitingRepliesRailProps> = ({ rows, onFollowUp }) => {
  if (rows.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-mono-pulse tracking-wide-mono pulse-ink-3-color">AWAITING REPLIES</h3>
        <span className="text-[11px] font-mono-pulse pulse-ink-3-color tnum">{rows.length}</span>
      </div>

      <div className="space-y-2">
        {rows.map((row) => {
          const color = tierColor(row.days);
          return (
            <div key={row.emailId} className="group flex items-center gap-2 py-1.5">
              <Avatar name={row.name} size={22} />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] pulse-ink-color truncate">{row.name}</div>
                <div className="text-[11px] pulse-ink-3-color truncate">{row.subject}</div>
              </div>
              {onFollowUp && (
                <button
                  type="button"
                  onClick={() => onFollowUp(row.emailId)}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0 inline-flex items-center justify-center w-6 h-6 rounded pulse-surface-raised pulse-ink-2-color hover:pulse-ink-color"
                  title={`Follow up with ${row.name}`}
                  aria-label={`Follow up with ${row.name}`}
                >
                  <Reply className="w-3 h-3" />
                </button>
              )}
              <span
                className="text-[10px] font-mono-pulse tracking-tight-mono tnum shrink-0 pulse-ink-3-color"
                style={color ? { color } : undefined}
              >
                {row.days}D
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AwaitingRepliesRail;
