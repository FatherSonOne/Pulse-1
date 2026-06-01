// CalendarPeekRail — right-rail today's events.
// Wired to googleCalendarService.getTodayEvents() (WI-4, email repair plan).
// Renders real events for a connected Google account; when the account is
// not connected or the fetch fails, renders nothing rather than fabricated
// rows (it previously shipped hardcoded MOCK_CALENDAR data to every user).
import React, { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import { AiChip } from '../primitives';
import { googleCalendarService } from '../../../../services/googleCalendarService';
import type { CalendarEvent } from '../../../../types';

const formatTime = (e: CalendarEvent): string =>
  e.allDay
    ? 'All day'
    : new Date(e.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const CalendarPeekRail: React.FC = () => {
  // null = not connected / failed (render nothing); [] = connected, no events.
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!(await googleCalendarService.isConnected())) {
          if (!cancelled) setEvents(null);
          return;
        }
        const today = await googleCalendarService.getTodayEvents();
        if (cancelled) return;
        setEvents(
          [...today].sort(
            (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
          ),
        );
      } catch (err) {
        console.warn('[CalendarPeekRail] today events fetch failed:', err);
        if (!cancelled) setEvents(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Not connected (or fetch failed): show nothing instead of fake events.
  if (events === null) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-mono-pulse tracking-wide-mono pulse-ink-3-color">CALENDAR · TODAY</h3>
        <Calendar className="w-3.5 h-3.5 pulse-ink-3-color" />
      </div>
      {events.length === 0 ? (
        <p className="text-[12px] pulse-ink-3-color py-1">Nothing scheduled today.</p>
      ) : (
        <div className="space-y-1.5">
          {events.map((event) => (
            <div key={event.id} className="flex items-center gap-2 py-1">
              <span className="text-[11px] font-mono-pulse pulse-ink-3-color tnum shrink-0 w-14">{formatTime(event)}</span>
              <span className="text-[12px] pulse-ink-color truncate flex-1">{event.title}</span>
              {event.meetLink && <AiChip variant="muted">linked</AiChip>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CalendarPeekRail;
