// CalendarPeekRail — right-rail today's events.
// Phase 2: still static mock data — Calendar service integration is its own
// section and lives outside the email scope. Per handoff §4.5, the "Inbox
// health" insight tile is hidden in v1 (NEW FEATURE, defer to v1.1).
import React from 'react';
import { Calendar } from 'lucide-react';
import { AiChip } from '../primitives';
import { MOCK_CALENDAR } from '../data/mockEmails';

export const CalendarPeekRail: React.FC = () => {
  return (
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
  );
};

export default CalendarPeekRail;
