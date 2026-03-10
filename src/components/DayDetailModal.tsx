import React from 'react';
import { createPortal } from 'react-dom';
import { CalendarEvent } from '../types';

import { CalendarX, ChevronRight, MapPin, Plus, Users, X } from 'lucide-react';

interface DayDetailModalProps {
  show: boolean;
  date: Date | null;
  events: CalendarEvent[];
  onClose: () => void;
  onEventClick: (event: CalendarEvent) => void;
  onCreateEvent?: () => void;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];

const getEventColorClass = (color: string): string => {
  if (color.includes('red') || color.includes('rose')) return 'cal-event-red';
  if (color.includes('amber') || color.includes('yellow') || color.includes('orange')) return 'cal-event-amber';
  if (color.includes('emerald') || color.includes('green')) return 'cal-event-emerald';
  if (color.includes('sky') || color.includes('cyan') || color.includes('blue')) return 'cal-event-sky';
  if (color.includes('violet') || color.includes('purple')) return 'cal-event-violet';
  if (color.includes('pink') || color.includes('fuchsia')) return 'cal-event-pink';
  if (color.includes('indigo')) return 'cal-event-indigo';
  return 'cal-event-zinc';
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const formatTimeRange = (start: Date, end: Date): string => {
  return `${formatTime(start)} - ${formatTime(end)}`;
};

export const DayDetailModal: React.FC<DayDetailModalProps> = ({
  show,
  date,
  events,
  onClose,
  onEventClick,
  onCreateEvent
}) => {
  if (!show || !date) return null;

  const allDayEvents = events.filter(e => e.allDay);
  const timedEvents = events.filter(e => !e.allDay).sort((a, b) => a.start.getTime() - b.start.getTime());

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden bg-white dark:bg-gray-800 rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {WEEKDAYS[date.getDay()]}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {MONTH_NAMES[date.getMonth()]} {date.getDate()}, {date.getFullYear()}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close"
            >
              <X className="text-xl text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Event count */}
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium">
              {events.length} {events.length === 1 ? 'event' : 'events'}
            </span>
            {onCreateEvent && (
              <button
                onClick={onCreateEvent}
                className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition-colors"
              >
                <Plus className="mr-1" />
                Add Event
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)] px-6 py-4">
          {events.length === 0 ? (
            <div className="text-center py-12">
              <CalendarX className="text-4xl text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No events scheduled for this day</p>
              {onCreateEvent && (
                <button
                  onClick={onCreateEvent}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Event
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* All-Day Events */}
              {allDayEvents.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                    All Day
                  </h3>
                  <div className="space-y-2">
                    {allDayEvents.map(event => (
                      <div
                        key={event.id}
                        className={`${getEventColorClass(event.color)} p-4 rounded-lg cursor-pointer hover:opacity-90 transition-opacity`}
                        onClick={() => onEventClick(event)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-white truncate">{event.title}</h4>
                            {event.location && (
                              <p className="text-sm text-white/80 mt-1 truncate">
                                <MapPin className="mr-1" />
                                {event.location}
                              </p>
                            )}
                            {event.attendees && event.attendees.length > 0 && (
                              <p className="text-sm text-white/80 mt-1">
                                <Users className="mr-1" />
                                {event.attendees.length} {event.attendees.length === 1 ? 'attendee' : 'attendees'}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="text-white/60 ml-2" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timed Events */}
              {timedEvents.length > 0 && (
                <div>
                  {allDayEvents.length > 0 && (
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 mt-6">
                      Scheduled
                    </h3>
                  )}
                  <div className="space-y-2">
                    {timedEvents.map(event => (
                      <div
                        key={event.id}
                        className={`${getEventColorClass(event.color)} p-4 rounded-lg cursor-pointer hover:opacity-90 transition-opacity`}
                        onClick={() => onEventClick(event)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-mono text-white/90">
                                {formatTime(event.start)}
                              </span>
                              <span className="text-white/60">•</span>
                              <span className="text-sm text-white/70">
                                {Math.round((event.end.getTime() - event.start.getTime()) / (1000 * 60))} min
                              </span>
                            </div>
                            <h4 className="font-semibold text-white truncate">{event.title}</h4>
                            {event.location && (
                              <p className="text-sm text-white/80 mt-1 truncate">
                                <MapPin className="mr-1" />
                                {event.location}
                              </p>
                            )}
                            {event.attendees && event.attendees.length > 0 && (
                              <p className="text-sm text-white/80 mt-1">
                                <Users className="mr-1" />
                                {event.attendees.length} {event.attendees.length === 1 ? 'attendee' : 'attendees'}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="text-white/60 ml-2" />
                        </div>
                      </div>
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
