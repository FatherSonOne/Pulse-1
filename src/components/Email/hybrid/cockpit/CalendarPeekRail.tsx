// CalendarPeekRail — right-rail today's events + Inbox Health insight tile.
// Phase 2 will wire calendar data through the existing Calendar service.
// Inbox Health is shown here per handoff §4.5; v1 keeps it static, v1.1
// computes it from emailStore counts.
import React from 'react';
import { Calendar } from 'lucide-react';
import { AiChip } from '../primitives';
import { MOCK_CALENDAR } from '../data/mockEmails';

export const CalendarPeekRail: React.FC = () => {
  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-mono-pulse tracking-wide-mono pulse-ink-3-color">CALENDAR · TODAY</h3>
          <Calendar className="w-3.5 h-3.5 pulse-ink-3-color" />
        </div>
        <div className="space-y-1.5">
          {MOCK_CALENDAR.map((event) => (
            <div key={event.title} className="flex items-center gap-2 py-1">
              <span className="text-[11px] font-mono-pulse pulse-ink-3-color tnum shrink-0 w-14">{event.time}</span>
              <span className="text-[12px] pulse-ink-color truncate flex-1">{event.title}</span>
              {event.linked && <AiChip variant="muted">linked</AiChip>}
            </div>
          ))}
        </div>
      </div>

      <div className="editorial-rule" />

      <div className="p-3 rounded-xl pulse-coral-bg-08-color border pulse-border-color">
        <div className="flex items-center gap-2 mb-2">
          <AiChip variant="muted">Inbox health</AiChip>
        </div>
        <div className="text-[13px] pulse-ink-color leading-snug mb-2">
          You replied to <strong>92%</strong> of warm threads this week, down from <strong>96%</strong> last week.
        </div>
        <div className="text-[12px] pulse-ink-2-color leading-relaxed">
          Theo and Lina are the two cooling threads — both &gt;7 days. Use Triage to clear in ~3 min.
        </div>
      </div>
    </>
  );
};

export default CalendarPeekRail;
