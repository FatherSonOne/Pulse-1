import React, { useMemo } from 'react';
import { CalendarEvent } from '../types';
import { getEventTypeMeta } from '../services/customEventTypesService';

interface AgendaViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];

const getEventColorClass = (color: string): string => {
  if (color.includes('red') || color.includes('rose')) return 'bg-red-600';
  if (color.includes('amber') || color.includes('yellow') || color.includes('orange')) return 'bg-amber-600';
  if (color.includes('emerald') || color.includes('green')) return 'bg-emerald-600';
  if (color.includes('sky') || color.includes('cyan') || color.includes('blue')) return 'bg-blue-600';
  if (color.includes('violet') || color.includes('purple')) return 'bg-purple-600';
  if (color.includes('pink') || color.includes('fuchsia')) return 'bg-pink-600';
  if (color.includes('indigo')) return 'bg-indigo-600';
  return 'bg-zinc-600';
};

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

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-zinc-950">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
          {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {groupedEvents.size} days with events
        </p>
      </div>

      {/* Agenda List */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {Array.from(groupedEvents.entries()).map(([dateKey, dayEvents]) => {
          const date = new Date(dateKey);
          const isToday = isSameDay(date, today);
          const isPast = date < today && !isToday;

          return (
            <div key={dateKey} className={`${isToday ? 'bg-red-50 dark:bg-red-950/20' : ''}`}>
              {/* Date Header */}
              <div
                className={`sticky top-[57px] z-[9] px-4 py-3 bg-zinc-50 dark:bg-zinc-900/95 border-b border-zinc-200 dark:border-zinc-800 backdrop-blur-sm cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${isToday ? 'border-l-4 border-l-red-600' : ''}`}
                onClick={() => onDateClick?.(date)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`text-center ${isToday ? 'text-red-600' : isPast ? 'text-zinc-400' : 'text-zinc-900 dark:text-white'}`}>
                      <div className="text-xs font-semibold uppercase tracking-wide">
                        {WEEKDAYS[date.getDay()].slice(0, 3)}
                      </div>
                      <div className={`text-2xl font-bold ${isToday ? 'bg-red-600 text-white rounded-full w-10 h-10 flex items-center justify-center' : ''}`}>
                        {date.getDate()}
                      </div>
                    </div>
                    <div>
                      <div className={`text-sm font-medium ${isToday ? 'text-red-600' : 'text-zinc-900 dark:text-white'}`}>
                        {isToday ? 'Today' : WEEKDAYS[date.getDay()]}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
                      </div>
                    </div>
                  </div>
                  <i className="fa-solid fa-chevron-right text-xs text-zinc-400" />
                </div>
              </div>

              {/* Events for this day */}
              {dayEvents.length > 0 ? (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {dayEvents.map(event => (
                    <div
                      key={event.id}
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
                              className="text-[10px] font-semibold uppercase tracking-wide"
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
                              <i className="fa-solid fa-location-dot text-[10px]" />
                              <span className="truncate">{event.location}</span>
                            </div>
                          )}

                          {event.attendees && event.attendees.length > 0 && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                              <i className="fa-solid fa-users text-[10px]" />
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
                        <i className="fa-solid fa-chevron-right text-xs text-zinc-300 dark:text-zinc-700 flex-shrink-0 mt-1" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  onClick={() => onDateClick?.(date)}
                  className="w-full px-4 py-5 flex items-center gap-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition group"
                >
                  <div className="w-8 h-8 rounded-full border-2 border-dashed border-zinc-200 dark:border-zinc-700 flex items-center justify-center group-hover:border-indigo-300 dark:group-hover:border-indigo-600 transition">
                    <i className="fa-solid fa-plus text-[10px] text-zinc-300 dark:text-zinc-600 group-hover:text-indigo-400 transition" aria-hidden="true" />
                  </div>
                  <span className="text-sm text-zinc-400 dark:text-zinc-600 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition">
                    No events — tap to add one
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
          {/* Illustration */}
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-100 to-blue-50 dark:from-indigo-900/40 dark:to-blue-900/20 flex items-center justify-center shadow-inner">
              <i className="fa-regular fa-calendar text-4xl text-indigo-400 dark:text-indigo-500" aria-hidden="true" />
            </div>
            {/* Floating sparkle */}
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center shadow-md">
              <i className="fa-solid fa-star text-[9px] text-white" aria-hidden="true" />
            </div>
          </div>

          <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
            All clear ahead
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs leading-relaxed mb-6">
            No events in the next 30 days. A great time to plan something — or enjoy the calm.
          </p>

          {/* Quick-add CTA */}
          <button
            onClick={() => onDateClick?.(new Date())}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition active:scale-95"
          >
            <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
            Add first event
          </button>

          {/* Tip */}
          <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-600">
            Tip: type naturally — "Lunch with Sarah tomorrow at noon"
          </p>
        </div>
      )}
    </div>
  );
};

export default AgendaView;
