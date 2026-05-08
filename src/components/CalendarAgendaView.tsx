import React, { useMemo, useEffect, useState } from 'react';
import { CalendarEvent } from '../types';
import { getEventTypeMeta } from '../services/customEventTypesService';
import { getTravelBuffersForEvents, type TravelBuffer } from '../services/travelBufferService';

import { Calendar, Car, ChevronRight, MapPin, Plus, Users } from 'lucide-react';

interface AgendaViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];

const getEventTypeColor = (type?: string): string => getEventTypeMeta(type).color;
const getEventTypeIcon  = (type?: string): string => getEventTypeMeta(type).icon;
const getEventTypeLabel = (type?: string): string => getEventTypeMeta(type).label;

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const isSameDay = (date1: Date, date2: Date): boolean => {
  return date1.getDate() === date2.getDate() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getFullYear() === date2.getFullYear();
};

export const AgendaView: React.FC<AgendaViewProps> = ({
  currentDate,
  events,
  onEventClick,
  onDateClick
}) => {
  const today = new Date();

  // Group events by date for the next 30 days
  const groupedEvents = useMemo(() => {
    const groups: Map<string, CalendarEvent[]> = new Map();
    const startDate = new Date(currentDate);
    startDate.setHours(0, 0, 0, 0);

    // Get events for next 30 days
    for (let i = 0; i < 30; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateKey = date.toDateString();

      const dayEvents = events.filter(event => {
        const eventStart = new Date(event.start);
        return isSameDay(eventStart, date);
      }).sort((a, b) => {
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        return a.start.getTime() - b.start.getTime();
      });

      if (dayEvents.length > 0 || i < 7) {
        groups.set(dateKey, dayEvents);
      }
    }

    return groups;
  }, [currentDate, events]);

  // B4: travel buffers between consecutive events with locations.
  // Computes for the first 7 days only — agenda spans 30 days but
  // distance-matrix calls are billed; the cache hits subsequent days
  // anyway once they get visited and re-rendered.
  const [buffersByDay, setBuffersByDay] = useState<Map<string, Map<string, TravelBuffer>>>(new Map());
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = new Map<string, Map<string, TravelBuffer>>();
      const dayKeys = Array.from(groupedEvents.keys()).slice(0, 7);
      for (const dateKey of dayKeys) {
        const dayEvents = groupedEvents.get(dateKey) ?? [];
        const buffers = await getTravelBuffersForEvents(dayEvents);
        if (cancelled) return;
        if (buffers.length > 0) {
          const m = new Map<string, TravelBuffer>();
          for (const b of buffers) m.set(b.fromEventId, b);
          next.set(dateKey, m);
        }
      }
      if (!cancelled) setBuffersByDay(next);
    })();
    return () => { cancelled = true; };
  }, [groupedEvents]);

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-zinc-950">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">
          {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        <p className="font-mono text-[10px] tracking-[0.1em] uppercase text-zinc-500 dark:text-zinc-400 mt-0.5" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {groupedEvents.size} days · with events
        </p>
      </div>

      {/* Agenda List */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {Array.from(groupedEvents.entries()).map(([dateKey, dayEvents]) => {
          const date = new Date(dateKey);
          const isToday = isSameDay(date, today);
          const isPast = date < today && !isToday;

          return (
            <div key={dateKey} className={isToday ? 'bg-rose-500/[0.04] dark:bg-rose-500/[0.06]' : ''}>
              {/* Date Header — today is signaled by the rose pill on the date number, not a side-stripe. */}
              <div
                className="sticky top-[57px] z-[9] px-4 py-3 bg-zinc-50 dark:bg-zinc-900/95 border-b border-zinc-200 dark:border-zinc-800 backdrop-blur-sm cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                onClick={() => onDateClick?.(date)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`text-center ${isPast ? 'text-zinc-400' : 'text-zinc-900 dark:text-white'}`}>
                      <div className={`font-mono text-[10px] tracking-[0.1em] uppercase font-semibold ${isToday ? 'text-rose-600 dark:text-rose-400' : ''}`}>
                        {WEEKDAYS[date.getDay()].slice(0, 3)}
                      </div>
                      <div
                        className={isToday
                          ? 'text-2xl font-semibold bg-rose-500 text-white rounded-full w-10 h-10 flex items-center justify-center mt-0.5'
                          : 'text-2xl font-semibold mt-0.5'}
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {date.getDate()}
                      </div>
                    </div>
                    <div>
                      <div className={`text-sm font-semibold ${isToday ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-900 dark:text-white'}`}>
                        {isToday ? 'Today' : WEEKDAYS[date.getDay()]}
                      </div>
                      <div className="font-mono text-[10px] tracking-[0.05em] uppercase text-zinc-500 dark:text-zinc-400" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </div>
              </div>

              {/* Events for this day */}
              {dayEvents.length > 0 ? (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {dayEvents.map(event => {
                    const buffer = buffersByDay.get(dateKey)?.get(event.id);
                    return (
                      <React.Fragment key={event.id}>
                        <div
                          className="px-4 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors cursor-pointer active:bg-zinc-100 dark:active:bg-zinc-800"
                          onClick={() => onEventClick?.(event)}
                        >
                          <div className="flex items-start gap-3">
                            {/* Time */}
                            <div className="flex-shrink-0 w-16 text-right">
                              {event.allDay ? (
                                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                  All day
                                </span>
                              ) : (
                                <div className="text-xs font-medium text-zinc-900 dark:text-white">
                                  {formatTime(event.start)}
                                </div>
                              )}
                            </div>

                            {/* Color Bar (type-aware) */}
                            <div
                              className="flex-shrink-0 w-1 rounded-full self-stretch"
                              style={{ backgroundColor: getEventTypeColor(event.type) }}
                            />

                            {/* Event Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <i
                                  className={`fa-solid ${getEventTypeIcon(event.type)} text-[10px] flex-shrink-0`}
                                  style={{ color: getEventTypeColor(event.type) }}
                                />
                                <span
                                  className="font-mono text-[10px] font-semibold tracking-[0.1em] uppercase"
                                  style={{ color: getEventTypeColor(event.type) }}
                                >
                                  {getEventTypeLabel(event.type)}
                                </span>
                              </div>
                              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                                {event.title}
                              </h3>

                              {event.location && (
                                <div className="flex items-center gap-1 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                  <MapPin className="text-[10px]" />
                                  <span className="truncate">{event.location}</span>
                                </div>
                              )}

                              {event.attendees && event.attendees.length > 0 && (
                                <div className="flex items-center gap-1 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                  <Users className="text-[10px]" />
                                  <span>{event.attendees.length} attendees</span>
                                </div>
                              )}

                              {!event.allDay && (
                                <div className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                                  {Math.round((event.end.getTime() - event.start.getTime()) / (1000 * 60))} min
                                </div>
                              )}
                            </div>

                            {/* Chevron */}
                            <ChevronRight className="text-xs text-zinc-300 dark:text-zinc-700 flex-shrink-0 mt-1" />
                          </div>
                        </div>

                        {/* B4: travel buffer to the next event (when both have a non-virtual location) */}
                        {buffer && (
                          <div
                            className={`px-4 py-2 flex items-center gap-2 text-xs ${
                              buffer.isTight
                                ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                : 'bg-zinc-50 dark:bg-zinc-900/40 text-zinc-500 dark:text-zinc-400'
                            }`}
                          >
                            <Car size={12} className="flex-shrink-0" />
                            <span className="font-medium">
                              Travel: {buffer.travelLabel} to next event
                            </span>
                            {buffer.isTight && (
                              <span className="ml-auto font-semibold">
                                Only {buffer.gapMinutes} min gap
                              </span>
                            )}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              ) : (
                <button
                  onClick={() => onDateClick?.(date)}
                  className="w-full px-4 py-5 flex items-center gap-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition group"
                >
                  <div className="w-8 h-8 rounded-full border-2 border-dashed border-zinc-200 dark:border-zinc-700 flex items-center justify-center group-hover:border-rose-400 dark:group-hover:border-rose-400/60 transition">
                    <Plus className="w-3 h-3 text-zinc-300 dark:text-zinc-600 group-hover:text-rose-500 transition" />
                  </div>
                  <span className="text-sm text-zinc-400 dark:text-zinc-600 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition">
                    No events. Tap to add one.
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Global empty state — no events in the next 30 days */}
      {groupedEvents.size === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center select-none">
          {/* Illustration — neutral tinted surface, no gradient. */}
          <div className="w-24 h-24 rounded-3xl bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] flex items-center justify-center mb-6">
            <Calendar className="w-9 h-9 text-zinc-400 dark:text-zinc-500" strokeWidth={1.5} />
          </div>

          <h3 className="text-xl font-light tracking-tight text-zinc-900 dark:text-white mb-2">
            All clear ahead
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs leading-relaxed mb-6">
            No events in the next 30 days. A great time to plan something, or enjoy the calm.
          </p>

          {/* Primary CTA — coral, the only solid signal at rest */}
          <button
            onClick={() => onDateClick?.(new Date())}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-mono text-[11px] tracking-[0.1em] uppercase font-semibold rounded-xl shadow-[0_2px_12px_rgba(244,63,94,0.25)] transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            Add first event
          </button>

          {/* Tip */}
          <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-600">
            Tip: type naturally. Try &ldquo;Lunch with Sarah tomorrow at noon.&rdquo;
          </p>
        </div>
      )}
    </div>
  );
};

export default AgendaView;
