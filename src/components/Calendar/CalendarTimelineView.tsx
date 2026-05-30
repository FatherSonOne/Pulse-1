/**
 * CalendarTimelineView.tsx
 *
 * Gantt-style timeline view showing events across a 2-week horizontal span.
 * Each event type gets its own swim-lane row. Events are rendered as horizontal
 * bars scaled to duration, with rose accent for today's column.
 */

import React, { useMemo } from 'react';
import { CalendarEvent } from '../../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const DAY_COUNT = 14; // 2 weeks

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_NAMES   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// ── Component ─────────────────────────────────────────────────────────────────

interface CalendarTimelineViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

export const CalendarTimelineView: React.FC<CalendarTimelineViewProps> = ({
  currentDate,
  events,
  onEventClick,
}) => {
  const today = startOfDay(new Date());

  // Build the 14-day window starting from Monday of currentDate's week
  const windowStart = useMemo(() => {
    const d = startOfDay(currentDate);
    const diff = d.getDay() === 0 ? -6 : 1 - d.getDay(); // Monday anchor
    d.setDate(d.getDate() + diff);
    return d;
  }, [currentDate]);

  const days = useMemo(() =>
    Array.from({ length: DAY_COUNT }, (_, i) => addDays(windowStart, i)),
    [windowStart],
  );

  // Group events by type for swim lanes
  const laneGroups = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    events.forEach(ev => {
      const evStart = ev.start instanceof Date ? ev.start : new Date(ev.start);
      const evEnd   = ev.end   instanceof Date ? ev.end   : new Date(ev.end);

      // Include only events that overlap the window
      const winEnd = addDays(windowStart, DAY_COUNT);
      if (evEnd < windowStart || evStart >= winEnd) return;

      const lane = ev.type ?? 'event';
      if (!map.has(lane)) map.set(lane, []);
      map.get(lane)!.push(ev);
    });

    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [events, windowStart]);

  const COL_W = 60; // px per day column
  const ROW_H = 44; // px per swim lane

  return (
    <div className="flex-1 overflow-auto bg-[var(--pulse-surface)] dark:bg-[var(--pulse-canvas)]">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-[var(--pulse-surface)] dark:bg-[var(--pulse-canvas)] border-b border-[var(--pulse-border)]">
        <div className="flex">
          {/* Lane label gutter */}
          <div className="w-28 flex-shrink-0 border-r border-[var(--pulse-border)]" />
          {/* Day columns */}
          {days.map((day, i) => {
            const isToday = isSameDay(day, today);
            return (
              <div
                key={i}
                style={{ width: COL_W, minWidth: COL_W }}
                className={`text-center py-2 border-r border-[var(--pulse-border)]/50 flex-shrink-0 ${
                  isToday
                    ? 'bg-[var(--pulse-rose-soft)]'
                    : day.getDay() === 0 || day.getDay() === 6
                      ? 'bg-[var(--pulse-canvas-soft)] dark:bg-[var(--pulse-surface)]/40'
                      : ''
                }`}
              >
                <div className={`text-[10px] font-medium ${isToday ? 'text-[var(--pulse-rose)]' : 'text-zinc-400'}`}>
                  {DAY_NAMES[day.getDay()]}
                </div>
                <div className={`text-sm font-bold ${isToday ? 'text-[var(--pulse-rose)]' : 'text-[var(--pulse-ink)]'}`}>
                  {day.getDate()}
                </div>
                {i === 0 || day.getDate() === 1 ? (
                  <div className="text-[9px] text-zinc-300 dark:text-zinc-600">
                    {MONTH_NAMES[day.getMonth()]}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Swim lanes */}
      {laneGroups.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-zinc-400 text-sm">
          No events in this 2-week window
        </div>
      ) : (
        laneGroups.map(([lane, laneEvents]) => (
          <div key={lane} className="flex border-b border-[var(--pulse-border)]/50" style={{ minHeight: ROW_H }}>
            {/* Lane label */}
            <div className="w-28 flex-shrink-0 border-r border-[var(--pulse-border)] px-2 py-1 flex items-center">
              <span className="text-[10px] font-semibold text-[var(--pulse-ink-3)] uppercase tracking-wider truncate">
                {lane}
              </span>
            </div>

            {/* Day cells + event bars */}
            <div className="flex-1 relative" style={{ height: ROW_H }}>
              {/* Grid lines */}
              <div className="absolute inset-0 flex pointer-events-none">
                {days.map((day, i) => (
                  <div
                    key={i}
                    style={{ width: COL_W, minWidth: COL_W }}
                    className={`flex-shrink-0 border-r border-[var(--pulse-border)]/40 h-full ${
                      isSameDay(day, today) ? 'bg-[var(--pulse-rose-softer)]' : ''
                    }`}
                  />
                ))}
              </div>

              {/* Event bars */}
              {laneEvents.map(ev => {
                const evStart = ev.start instanceof Date ? ev.start : new Date(ev.start);
                const evEnd   = ev.end   instanceof Date ? ev.end   : new Date(ev.end);

                // Clamp to window
                const clampedStart = evStart < windowStart ? windowStart : evStart;
                const winEnd = addDays(windowStart, DAY_COUNT);
                const clampedEnd = evEnd > winEnd ? winEnd : evEnd;

                const offsetDays = (clampedStart.getTime() - windowStart.getTime()) / 86400000;
                const durationDays = Math.max((clampedEnd.getTime() - clampedStart.getTime()) / 86400000, 0.2);

                const left = offsetDays * COL_W;
                const width = Math.max(durationDays * COL_W - 4, 20);

                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => onEventClick(ev)}
                    title={ev.title}
                    style={{
                      position: 'absolute',
                      left: left + 2,
                      width,
                      top: 6,
                      height: ROW_H - 12,
                      backgroundColor: getEventColor(ev),
                    }}
                    className="rounded-md px-1.5 text-[10px] font-semibold text-white truncate text-left hover:brightness-110 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pulse-rose)]"
                  >
                    {ev.title}
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

/** Extract a hex color from the event's color class or use rose as fallback. */
function getEventColor(ev: CalendarEvent): string {
  const colorMap: Record<string, string> = {
    'bg-blue-600':    '#2563eb',
    'bg-emerald-600': '#059669',
    'bg-red-600':     '#dc2626',
    'bg-purple-600':  '#9333ea',
    'bg-amber-600':   '#d97706',
    'bg-pink-600':    '#db2777',
    'bg-indigo-600':  '#4f46e5',
    'bg-rose-500':    '#f43f5e',
  };
  if (ev.color && colorMap[ev.color]) return colorMap[ev.color];
  return '#f43f5e';
}

export default CalendarTimelineView;
