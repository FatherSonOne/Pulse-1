import React, { useMemo } from 'react';
import { CalendarEvent } from '../types';

// ============================================
// SHARED TYPES & UTILITIES
// ============================================

interface ViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onViewChange?: (view: 'year' | 'month' | 'week' | 'day', date?: Date) => void;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_MINI = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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

const isSameDay = (d1: Date, d2: Date): boolean => {
  return d1.getDate() === d2.getDate() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getFullYear() === d2.getFullYear();
};

const isToday = (date: Date): boolean => isSameDay(date, new Date());

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const formatTimeRange = (start: Date, end: Date): string => {
  return `${formatTime(start)} - ${formatTime(end)}`;
};

// ============================================
// YEAR VIEW COMPONENT
// ============================================

export const YearView: React.FC<ViewProps> = ({
  currentDate,
  events,
  onDateClick,
  onEventClick,
  onViewChange
}) => {
  const year = currentDate.getFullYear();
  const today = new Date();

  const getEventsForDay = (month: number, day: number) => {
    return events.filter(e =>
      e.start.getFullYear() === year &&
      e.start.getMonth() === month &&
      e.start.getDate() === day
    );
  };

  const renderMiniMonth = (monthIndex: number) => {
    const firstDay = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIndex;

    return (
      <div
        key={monthIndex}
        className={`cal-mini-month cal-animate-scale ${isCurrentMonth ? 'current-month' : ''}`}
        onClick={() => onViewChange?.('month', new Date(year, monthIndex, 1))}
      >
        <div className="cal-mini-month-name">{MONTH_NAMES[monthIndex]}</div>

        <div className="cal-mini-days-header">
          {WEEKDAYS_MINI.map((d, i) => (
            <div key={i} className="cal-mini-day-header">{d}</div>
          ))}
        </div>

        <div className="cal-mini-days-grid">
          {/* Empty cells for padding */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="cal-mini-day" />
          ))}

          {/* Days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayDate = new Date(year, monthIndex, day);
            const dayIsToday = isCurrentMonth && today.getDate() === day;
            const dayEvents = getEventsForDay(monthIndex, day);
            const hasEvents = dayEvents.length > 0;

            return (
              <div
                key={day}
                className={`cal-mini-day ${dayIsToday ? 'today' : ''} ${hasEvents ? 'has-events' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDateClick?.(dayDate);
                }}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="cal-year-grid">
      {Array.from({ length: 12 }).map((_, i) => renderMiniMonth(i))}
    </div>
  );
};

// ============================================
// MONTH VIEW COMPONENT
// ============================================

export const MonthView: React.FC<ViewProps> = ({
  currentDate,
  events,
  onDateClick,
  onEventClick
}) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const getEventsForDay = (date: Date) => {
    return events.filter(e => isSameDay(e.start, date));
  };

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Previous month days
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, daysInPrevMonth - i),
        isCurrentMonth: false
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }

    // Next month days to fill the grid
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }

    return days;
  }, [year, month, daysInMonth, firstDayOfMonth, daysInPrevMonth]);

  return (
    <div className="cal-month-container">
      {/* Weekday Header */}
      <div className="cal-weekday-header">
        {WEEKDAYS_SHORT.map((day, i) => (
          <div
            key={day}
            className={`cal-weekday-cell ${i === 0 || i === 6 ? 'weekend' : ''}`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="cal-month-grid">
        {calendarDays.map(({ date, isCurrentMonth }, index) => {
          const dayEvents = getEventsForDay(date);
          const allDayEvents = dayEvents.filter(e => e.allDay);
          const timedEvents = dayEvents.filter(e => !e.allDay);
          const dayIsToday = isToday(date);
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;

          return (
            <div
              key={index}
              className={`cal-day-cell ${!isCurrentMonth ? 'other-month' : ''} ${dayIsToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''}`}
              onClick={() => onDateClick?.(date)}
            >
              <div className="cal-day-number">{date.getDate()}</div>

              <div className="cal-day-events">
                {/* All-day events first */}
                {allDayEvents.slice(0, 2).map(ev => (
                  <div
                    key={ev.id}
                    className={`cal-event-pill all-day ${getEventColorClass(ev.color)}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(ev);
                    }}
                    title={ev.title}
                  >
                    {ev.title}
                  </div>
                ))}

                {/* Timed events */}
                {timedEvents.slice(0, 2 - Math.min(allDayEvents.length, 2)).map(ev => (
                  <div
                    key={ev.id}
                    className={`cal-event-pill ${getEventColorClass(ev.color)}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(ev);
                    }}
                    title={`${formatTime(ev.start)} ${ev.title}`}
                  >
                    {ev.title}
                  </div>
                ))}

                {/* More indicator */}
                {dayEvents.length > 2 && (
                  <div className="cal-more-events">
                    +{dayEvents.length - 2} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================
// WEEK VIEW COMPONENT
// ============================================

export const WeekView: React.FC<ViewProps> = ({
  currentDate,
  events,
  onDateClick,
  onEventClick
}) => {
  const today = new Date();
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Get week days
  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [currentDate]);

  const getEventsForDay = (date: Date) => {
    return events.filter(e => isSameDay(e.start, date));
  };

  // Current time position
  const currentTimePosition = useMemo(() => {
    const now = new Date();
    return (now.getHours() + now.getMinutes() / 60) * 48; // 48px per hour
  }, []);

  const formatHour = (hour: number): string => {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  };

  return (
    <div className="cal-week-container">
      {/* Header */}
      <div className="cal-week-header">
        <div className="cal-week-time-gutter" />
        <div className="cal-week-days-header">
          {weekDays.map((date, i) => {
            const dayIsToday = isToday(date);
            return (
              <div
                key={i}
                className={`cal-week-day-header ${dayIsToday ? 'today' : ''}`}
                onClick={() => onDateClick?.(date)}
              >
                <div className="cal-week-day-name">{WEEKDAYS_SHORT[date.getDay()]}</div>
                <div className="cal-week-day-number">{date.getDate()}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* All-Day Events Row */}
      {weekDays.some(d => getEventsForDay(d).some(e => e.allDay)) && (
        <div className="cal-week-allday-row">
          <div className="cal-week-allday-gutter">All Day</div>
          <div className="cal-week-allday-cells">
            {weekDays.map((date, i) => {
              const allDayEvents = getEventsForDay(date).filter(e => e.allDay);
              return (
                <div key={i} className="cal-week-allday-cell">
                  {allDayEvents.map(ev => (
                    <div
                      key={ev.id}
                      className={`cal-event-pill ${getEventColorClass(ev.color)}`}
                      onClick={() => onEventClick?.(ev)}
                    >
                      {ev.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Time Grid */}
      <div className="cal-week-body">
        <div className="cal-week-time-column">
          {hours.map(hour => (
            <div key={hour} className="cal-week-time-slot">
              <span className="cal-week-time-label">{formatHour(hour)}</span>
            </div>
          ))}
        </div>

        <div className="cal-week-days-grid">
          {weekDays.map((date, dayIndex) => {
            const dayEvents = getEventsForDay(date).filter(e => !e.allDay);
            const dayIsToday = isToday(date);

            return (
              <div key={dayIndex} className="cal-week-day-column">
                {/* Hour cells */}
                {hours.map(hour => (
                  <div
                    key={hour}
                    className="cal-week-hour-cell"
                    onClick={() => {
                      const clickDate = new Date(date);
                      clickDate.setHours(hour, 0, 0, 0);
                      onDateClick?.(clickDate);
                    }}
                  />
                ))}

                {/* Events */}
                {dayEvents.map(ev => {
                  const startHour = ev.start.getHours() + ev.start.getMinutes() / 60;
                  const duration = (ev.end.getTime() - ev.start.getTime()) / (1000 * 60 * 60);
                  const top = startHour * 48;
                  const height = Math.max(duration * 48, 24);

                  return (
                    <div
                      key={ev.id}
                      className={`cal-week-event ${getEventColorClass(ev.color)}`}
                      style={{ top: `${top}px`, height: `${height}px` }}
                      onClick={() => onEventClick?.(ev)}
                    >
                      <div className="cal-week-event-title">{ev.title}</div>
                      {duration >= 0.75 && (
                        <div className="cal-week-event-time">{formatTime(ev.start)}</div>
                      )}
                    </div>
                  );
                })}

                {/* Current time indicator */}
                {dayIsToday && (
                  <div
                    className="cal-current-time-line"
                    style={{ top: `${currentTimePosition}px` }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============================================
// DAY VIEW COMPONENT
// ============================================

export const DayView: React.FC<ViewProps> = ({
  currentDate,
  events,
  onDateClick,
  onEventClick
}) => {
  const today = new Date();
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const dayIsToday = isToday(currentDate);

  const dayEvents = useMemo(() => {
    return events.filter(e => isSameDay(e.start, currentDate));
  }, [events, currentDate]);

  const allDayEvents = dayEvents.filter(e => e.allDay);
  const timedEvents = dayEvents.filter(e => !e.allDay);

  // Current time position
  const currentTimePosition = useMemo(() => {
    const now = new Date();
    return (now.getHours() + now.getMinutes() / 60) * 60; // 60px per hour
  }, []);

  const formatHour = (hour: number): string => {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  };

  return (
    <div className="cal-day-container">
      {/* Header */}
      <div className={`cal-day-header ${dayIsToday ? 'today' : ''}`}>
        <div className="cal-day-header-weekday">
          {WEEKDAYS[currentDate.getDay()]}
        </div>
        <div className="cal-day-header-date">
          {currentDate.getDate()}
        </div>
        <div className="cal-day-header-month">
          {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
        </div>
      </div>

      {/* All-Day Events */}
      {allDayEvents.length > 0 && (
        <div className="cal-day-allday-section">
          <div className="cal-day-allday-label">
            <i className="fa-solid fa-sun" style={{ color: '#f59e0b' }} />
            All Day Events
          </div>
          <div className="cal-day-allday-events">
            {allDayEvents.map(ev => (
              <div
                key={ev.id}
                className={`cal-day-allday-event ${getEventColorClass(ev.color)}`}
                onClick={() => onEventClick?.(ev)}
              >
                <i className="fa-solid fa-calendar-day" style={{ fontSize: '0.75rem', opacity: 0.8 }} />
                {ev.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Time Grid */}
      <div className="cal-day-body">
        <div className="cal-day-time-column">
          {hours.map(hour => (
            <div key={hour} className="cal-day-time-slot">
              <span className="cal-day-time-label">{formatHour(hour)}</span>
            </div>
          ))}
        </div>

        <div className="cal-day-events-column">
          {/* Hour cells */}
          {hours.map(hour => (
            <div
              key={hour}
              className="cal-day-hour-cell"
              onClick={() => {
                const clickDate = new Date(currentDate);
                clickDate.setHours(hour, 0, 0, 0);
                onDateClick?.(clickDate);
              }}
            />
          ))}

          {/* Events */}
          {timedEvents.map(ev => {
            const startHour = ev.start.getHours() + ev.start.getMinutes() / 60;
            const duration = (ev.end.getTime() - ev.start.getTime()) / (1000 * 60 * 60);
            const top = startHour * 60;
            const height = Math.max(duration * 60, 36);

            return (
              <div
                key={ev.id}
                className={`cal-day-event ${getEventColorClass(ev.color)}`}
                style={{ top: `${top}px`, height: `${height}px` }}
                onClick={() => onEventClick?.(ev)}
              >
                <div className="cal-day-event-title">{ev.title}</div>
                <div className="cal-day-event-time">
                  {formatTimeRange(ev.start, ev.end)}
                </div>
                {ev.location && (
                  <div className="cal-day-event-location">
                    <i className="fa-solid fa-location-dot" />
                    {ev.location}
                  </div>
                )}
              </div>
            );
          })}

          {/* Current time indicator */}
          {dayIsToday && (
            <div
              className="cal-current-time-line"
              style={{ top: `${currentTimePosition}px` }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// CALENDAR HEADER COMPONENT
// ============================================

interface CalendarHeaderProps {
  currentDate: Date;
  viewMode: 'year' | 'month' | 'week' | 'day';
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: 'year' | 'month' | 'week' | 'day') => void;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDate,
  viewMode,
  onPrev,
  onNext,
  onToday,
  onViewChange
}) => {
  const getTitle = () => {
    switch (viewMode) {
      case 'year':
        return <span className="cal-title-year">{currentDate.getFullYear()}</span>;
      case 'month':
        return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
      case 'week': {
        const start = new Date(currentDate);
        start.setDate(start.getDate() - start.getDay());
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        if (start.getMonth() === end.getMonth()) {
          return `${MONTH_NAMES_SHORT[start.getMonth()]} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`;
        }
        return `${MONTH_NAMES_SHORT[start.getMonth()]} ${start.getDate()} - ${MONTH_NAMES_SHORT[end.getMonth()]} ${end.getDate()}, ${start.getFullYear()}`;
      }
      case 'day':
        return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getDate()}, ${currentDate.getFullYear()}`;
      default:
        return '';
    }
  };

  return (
    <div className="cal-header">
      <div className="cal-header-left">
        <h2 className="cal-title cal-font-display">{getTitle()}</h2>

        <div style={{ display: 'flex', gap: '4px' }}>
          <button className="cal-nav-btn" onClick={onPrev}>
            <i className="fa-solid fa-chevron-left" />
          </button>
          <button className="cal-nav-btn" onClick={onNext}>
            <i className="fa-solid fa-chevron-right" />
          </button>
        </div>

        <button className="cal-today-btn" onClick={onToday}>
          Today
        </button>
      </div>

      <div className="cal-view-switcher">
        {(['year', 'month', 'week', 'day'] as const).map(view => (
          <button
            key={view}
            className={`cal-view-btn ${viewMode === view ? 'active' : ''}`}
            onClick={() => onViewChange(view)}
          >
            {view}
          </button>
        ))}
      </div>
    </div>
  );
};

export default {
  YearView,
  MonthView,
  WeekView,
  DayView,
  CalendarHeader
};
