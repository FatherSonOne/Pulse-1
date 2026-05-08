import React from 'react';
import { createPortal } from 'react-dom';
import { CalendarEvent } from '../types';

import { CalendarX, ChevronRight, MapPin, Plus, Users, X } from 'lucide-react';

interface DayDetailModalProps {
  show: boolean;
  date: Date | null;
  events: CalendarEvent[];
  /** Click coordinates from the +N more button — drives the entrance transform-origin
   *  so the modal scales out of the cell that opened it, not from a generic centre. */
  origin?: { x: number; y: number } | null;
  onClose: () => void;
  onEventClick: (event: CalendarEvent) => void;
  onCreateEvent?: () => void;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

export const DayDetailModal: React.FC<DayDetailModalProps> = ({
  show,
  date,
  events,
  origin,
  onClose,
  onEventClick,
  onCreateEvent
}) => {
  if (!show || !date) return null;

  const allDayEvents = events.filter(e => e.allDay);
  const timedEvents = events.filter(e => !e.allDay).sort((a, b) => a.start.getTime() - b.start.getTime());

  // Convert viewport-space click coordinates to a transform-origin for the dialog.
  // The dialog is centred via flex; transform-origin is relative to its own box. We map
  // click coords into "% of viewport" so the dialog appears to scale from that point.
  const transformOrigin = origin
    ? `${(origin.x / window.innerWidth) * 100}% ${(origin.y / window.innerHeight) * 100}%`
    : '50% 50%';

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-sm p-4 cal-day-detail-backdrop-enter"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Events for ${WEEKDAYS[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`}
        className="cal-day-detail-enter relative w-full max-w-2xl max-h-[90vh] overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl"
        style={{ transformOrigin }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] tracking-[0.1em] uppercase text-zinc-500 mb-1">
                {WEEKDAYS[date.getDay()]}
              </p>
              <h2 className="text-2xl font-light tracking-tight text-zinc-900 dark:text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {MONTH_NAMES[date.getMonth()]} {date.getDate()}
              </h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/5 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Event count + Add */}
          <div className="mt-3 flex items-center gap-2">
            <span className="font-mono text-[10px] tracking-[0.1em] uppercase font-semibold text-zinc-500" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {events.length} {events.length === 1 ? 'event' : 'events'}
            </span>
            {onCreateEvent && (
              <button
                onClick={onCreateEvent}
                className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white font-mono text-[11px] tracking-[0.1em] uppercase font-semibold rounded-lg transition"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)] px-6 py-4">
          {events.length === 0 ? (
            <div className="text-center py-12">
              <CalendarX className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">No events scheduled for this day.</p>
              {onCreateEvent && (
                <button
                  onClick={onCreateEvent}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-mono text-[11px] tracking-[0.1em] uppercase font-semibold rounded-lg transition"
                >
                  <Plus className="w-3 h-3" />
                  Create event
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {/* All-Day Events */}
              {allDayEvents.length > 0 && (
                <div>
                  <h3 className="font-mono text-[10px] font-semibold tracking-[0.1em] uppercase text-zinc-500 mb-2">
                    All Day
                  </h3>
                  <div className="space-y-2">
                    {allDayEvents.map(event => (
                      <button
                        type="button"
                        key={event.id}
                        onClick={() => onEventClick(event)}
                        className="w-full text-left p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] hover:bg-zinc-100 dark:hover:bg-white/[0.055] transition flex items-start gap-3"
                      >
                        <span
                          className="w-1 self-stretch rounded-full shrink-0"
                          style={{ backgroundColor: 'var(--cal-accent)' }}
                          aria-hidden="true"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{event.title}</h4>
                          {event.location && (
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1.5">
                              <MapPin className="w-3 h-3 shrink-0" />
                              {event.location}
                            </p>
                          )}
                          {event.attendees && event.attendees.length > 0 && (
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                              <Users className="w-3 h-3 shrink-0" />
                              {event.attendees.length} {event.attendees.length === 1 ? 'attendee' : 'attendees'}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Timed Events */}
              {timedEvents.length > 0 && (
                <div>
                  {allDayEvents.length > 0 && (
                    <h3 className="font-mono text-[10px] font-semibold tracking-[0.1em] uppercase text-zinc-500 mb-2">
                      Scheduled
                    </h3>
                  )}
                  <div className="space-y-2">
                    {timedEvents.map(event => (
                      <button
                        type="button"
                        key={event.id}
                        onClick={() => onEventClick(event)}
                        className="w-full text-left p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] hover:bg-zinc-100 dark:hover:bg-white/[0.055] transition flex items-start gap-3"
                      >
                        <div className="shrink-0 w-16 text-right">
                          <span className="font-mono text-[11px] tracking-wide text-zinc-700 dark:text-zinc-300" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {formatTime(event.start)}
                          </span>
                          <p className="font-mono text-[10px] tracking-wide text-zinc-400 mt-0.5" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {Math.round((event.end.getTime() - event.start.getTime()) / (1000 * 60))} min
                          </p>
                        </div>
                        <span
                          className="w-1 self-stretch rounded-full shrink-0"
                          style={{ backgroundColor: 'var(--cal-accent)' }}
                          aria-hidden="true"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{event.title}</h4>
                          {event.location && (
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1.5">
                              <MapPin className="w-3 h-3 shrink-0" />
                              {event.location}
                            </p>
                          )}
                          {event.attendees && event.attendees.length > 0 && (
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                              <Users className="w-3 h-3 shrink-0" />
                              {event.attendees.length} {event.attendees.length === 1 ? 'attendee' : 'attendees'}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DayDetailModal;
