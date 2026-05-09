import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { CalendarEvent } from '../types';
import { getEventTypeMeta } from '../services/customEventTypesService';

import { ChevronLeft, ChevronRight, Ellipsis, MapPin, Sun } from 'lucide-react';

// ============================================
// SHARED TYPES & UTILITIES
// ============================================

/** A semi-transparent "ghost" block representing a team member's busy time. */
export interface OverlayEvent {
  id: string;
  memberId: string;
  memberName: string;
  /** Hex color for this member's overlay (e.g. "#3b82f6") */
  color: string;
  start: Date;
  end: Date;
  title?: string;
}

interface ViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  /** Team-member busy-time blocks rendered as translucent overlays */
  overlayEvents?: OverlayEvent[];
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onViewChange?: (view: 'year' | 'month' | 'week' | 'day', date?: Date) => void;
  onShowMoreEvents?: (date: Date, events: CalendarEvent[], origin?: { x: number; y: number }) => void;
  /** Called when user drags an event to a new time. Parent handles persistence. */
  onEventReschedule?: (event: CalendarEvent, newStart: Date, newEnd: Date) => void;
  /** Render shimmer skeletons in day cells during the initial fetch. */
  loading?: boolean;
}

// ─── Drag-to-reschedule hook ──────────────────────────────────────────────────
// Shared by WeekView and DayView. Returns drag handlers and ghost state.

interface DragState {
  event: CalendarEvent;
  startY: number;        // initial mouseY relative to column
  startTime: Date;       // original event start
  pxPerHour: number;
  columnEl: HTMLElement;
  dayDate?: Date;        // for week view: which day column was grabbed
}

interface GhostInfo {
  eventId: string;
  top: number;
  height: number;
  label: string;
}

function useDragReschedule(
  pxPerHour: number,
  onEventReschedule?: (event: CalendarEvent, newStart: Date, newEnd: Date) => void
) {
  const dragRef = useRef<DragState | null>(null);
  const [ghost, setGhost] = useState<GhostInfo | null>(null);

  const formatDragTime = (d: Date) => {
    const h = d.getHours(), m = d.getMinutes();
    const ampm = h < 12 ? 'AM' : 'PM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const onMouseDown = useCallback((
    e: React.MouseEvent,
    ev: CalendarEvent,
    columnEl: HTMLElement,
    dayDate?: Date
  ) => {
    // Only left-button drag; ignore if clicking a button inside
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = columnEl.getBoundingClientRect();
    dragRef.current = {
      event: ev,
      startY: e.clientY - rect.top + columnEl.scrollTop,
      startTime: new Date(ev.start),
      pxPerHour,
      columnEl,
      dayDate,
    };
  }, [pxPerHour]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;

      const rect = d.columnEl.getBoundingClientRect();
      const currentY = e.clientY - rect.top + d.columnEl.scrollTop;
      const deltaHours = (currentY - d.startY) / d.pxPerHour;

      // Snap to 15-minute increments
      const snappedDelta = Math.round(deltaHours * 4) / 4;
      const duration = (d.event.end.getTime() - d.event.start.getTime()) / (1000 * 60 * 60);

      const newStart = new Date(d.startTime);
      newStart.setMinutes(newStart.getMinutes() + Math.round(snappedDelta * 60));

      // Clamp to day bounds 00:00–23:45
      const dayStart = new Date(newStart); dayStart.setHours(0, 0, 0, 0);
      const dayEnd   = new Date(newStart); dayEnd.setHours(23, 45, 0, 0);
      if (newStart < dayStart) newStart.setTime(dayStart.getTime());
      if (newStart > dayEnd)   newStart.setTime(dayEnd.getTime());

      const newEnd = new Date(newStart.getTime() + duration * 60 * 60 * 1000);
      const top    = (newStart.getHours() + newStart.getMinutes() / 60) * d.pxPerHour;
      const height = Math.max(duration * d.pxPerHour, d.pxPerHour * 0.5);

      setGhost({
        eventId: d.event.id,
        top,
        height,
        label: `${formatDragTime(newStart)} – ${formatDragTime(newEnd)}`,
      });
    };

    const onMouseUp = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;

      const rect = d.columnEl.getBoundingClientRect();
      const currentY = e.clientY - rect.top + d.columnEl.scrollTop;
      const deltaHours = (currentY - d.startY) / d.pxPerHour;
      const snappedDelta = Math.round(deltaHours * 4) / 4;

      // Only reschedule if actually moved more than 1 slot
      if (Math.abs(snappedDelta) < 0.25) {
        setGhost(null);
        return;
      }

      const duration = (d.event.end.getTime() - d.event.start.getTime()) / (1000 * 60 * 60);
      const newStart = new Date(d.startTime);
      newStart.setMinutes(newStart.getMinutes() + Math.round(snappedDelta * 60));

      // If week view, also update the date
      if (d.dayDate) {
        newStart.setFullYear(d.dayDate.getFullYear(), d.dayDate.getMonth(), d.dayDate.getDate());
      }

      const dayStart = new Date(newStart); dayStart.setHours(0, 0, 0, 0);
      const dayEnd   = new Date(newStart); dayEnd.setHours(23, 45, 0, 0);
      if (newStart < dayStart) newStart.setTime(dayStart.getTime());
      if (newStart > dayEnd)   newStart.setTime(dayEnd.getTime());

      const newEnd = new Date(newStart.getTime() + duration * 60 * 60 * 1000);
      setGhost(null);
      onEventReschedule?.(d.event, newStart, newEnd);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onEventReschedule]);

  return { onMouseDown, ghost };
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_MINI = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// sRGB → relative luminance (WCAG 2.x formula).
const srgbLum = (r: number, g: number, b: number): number => {
  const f = (c: number) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const hue2rgb = (pp: number, qq: number, t: number): number => {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return pp + (qq - pp) * 6 * t;
  if (t < 1 / 2) return qq;
  if (t < 2 / 3) return pp + (qq - pp) * (2 / 3 - t) * 6;
  return pp;
};

// Per-hue iterative WCAG-correct darkening. The earlier fixed-floor approach
// (L=0.32) failed AA for high-luminance hues (amber, emerald, cyan) whose
// HSL lightness is a poor proxy for perceived brightness. This walks HSL
// lightness downward until the resulting text clears 4.5:1 against the
// composited rgba(hex, 0.15) over #f8f8f8 canvas, capped at L=0.10. Light
// mode only — dark mode keeps the saturated hex (canvas inverts the failure).
const darkenForLightMode = (hex: string): string => {
  const orig_r = parseInt(hex.slice(1, 3), 16);
  const orig_g = parseInt(hex.slice(3, 5), 16);
  const orig_b = parseInt(hex.slice(5, 7), 16);
  // Composited bg: 0.85 * canvas + 0.15 * fill, canvas = #f8f8f8 (248,248,248)
  const bg_r = 248 * 0.85 + orig_r * 0.15;
  const bg_g = 248 * 0.85 + orig_g * 0.15;
  const bg_b = 248 * 0.85 + orig_b * 0.15;
  const bg_lum = srgbLum(bg_r, bg_g, bg_b);

  // RGB → HSL once
  const r = orig_r / 255;
  const g = orig_g / 255;
  const b = orig_b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const origL = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = origL > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  const renderAt = (newL: number): { hex: string; ratio: number } => {
    const q = newL < 0.5 ? newL * (1 + s) : newL + s - newL * s;
    const p = 2 * newL - q;
    const nr = hue2rgb(p, q, h + 1 / 3) * 255;
    const ng = hue2rgb(p, q, h) * 255;
    const nb = hue2rgb(p, q, h - 1 / 3) * 255;
    const text_lum = srgbLum(nr, ng, nb);
    const ratio = (Math.max(bg_lum, text_lum) + 0.05) / (Math.min(bg_lum, text_lum) + 0.05);
    const toHex = (c: number) => Math.round(c).toString(16).padStart(2, '0');
    return { hex: `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`, ratio };
  };

  // Original passes? Return as-is.
  const original = renderAt(origL);
  if (original.ratio >= 4.5) return hex;

  // Walk L downward in 0.025 steps until contrast clears.
  let testL = Math.min(origL, 0.30);
  let last = original;
  while (testL >= 0.10) {
    last = renderAt(testL);
    if (last.ratio >= 4.5) return last.hex;
    testL -= 0.025;
  }
  // Best effort at floor — caller may still see <4.5 for edge cases.
  return last.hex;
};

const isDarkMode = (): boolean =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

// Single pill / block style used across Year, Month, Week, Day, and Agenda views.
// Translucent fill (15%) + full-perimeter hairline (40%) + colored text. Coral stays
// the only saturated solid in the calendar — the system's signal-vs-decoration rule.
// Text color is darkened in light mode via per-hue iterative WCAG targeting so each
// event hue clears 4.5:1 on the composited tint; dark mode keeps the saturated hex.
const getEventTypeStyle = (type?: string, _fallbackColor?: string): React.CSSProperties => {
  const meta = getEventTypeMeta(type);
  const hex = meta.color;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.15)`,
    boxShadow: `inset 0 0 0 1px rgba(${r}, ${g}, ${b}, 0.40)`,
    color: isDarkMode() ? hex : darkenForLightMode(hex),
  };
};

// Get icon class for event type
const getEventTypeIcon = (type?: string): string => {
  return getEventTypeMeta(type).icon;
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
        role="button"
        tabIndex={0}
        className={`cal-mini-month cal-animate-scale ${isCurrentMonth ? 'current-month' : ''}`}
        onClick={() => onViewChange?.('month', new Date(year, monthIndex, 1))}
        onKeyDown={(e) => e.key === 'Enter' && onViewChange?.('month', new Date(year, monthIndex, 1))}
        aria-label={`${MONTH_NAMES[monthIndex]} ${year}${isCurrentMonth ? ', current month' : ''}`}
      >
        <div className="cal-mini-month-name" aria-hidden="true">{MONTH_NAMES[monthIndex]}</div>

        <div className="cal-mini-days-header" role="row" aria-hidden="true">
          {WEEKDAYS_MINI.map((d, i) => (
            <div key={i} className="cal-mini-day-header">{d}</div>
          ))}
        </div>

        <div className="cal-mini-days-grid" role="grid" aria-label={`${MONTH_NAMES[monthIndex]} ${year}`}>
          {/* Empty cells for padding */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="cal-mini-day" role="gridcell" aria-hidden="true" />
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
                role="gridcell"
                className={`cal-mini-day ${dayIsToday ? 'today' : ''} ${hasEvents ? 'has-events' : ''}`}
                aria-label={`${MONTH_NAMES[monthIndex]} ${day}${dayIsToday ? ', today' : ''}${hasEvents ? `, ${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}` : ''}`}
                aria-current={dayIsToday ? 'date' : undefined}
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
  onEventClick,
  onShowMoreEvents,
  onEventReschedule,
  loading,
}) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();

  // ── Month-drag state (HTML5 DnD — date-to-date, preserves time) ──
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null);

  const handlePillDragStart = useCallback((e: React.DragEvent, ev: CalendarEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ev.id);
    setDraggingEventId(ev.id);
  }, []);

  const handleCellDragOver = useCallback((e: React.DragEvent, date: Date) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDate(date);
  }, []);

  const handleCellDragLeave = useCallback(() => {
    setDragOverDate(null);
  }, []);

  const handleCellDrop = useCallback((e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    const eventId = e.dataTransfer.getData('text/plain');
    const sourceEvent = events.find(ev => ev.id === eventId);
    if (!sourceEvent || isSameDay(sourceEvent.start, targetDate)) {
      setDraggingEventId(null);
      setDragOverDate(null);
      return;
    }

    // Shift both start and end to the target date, preserving time-of-day
    const newStart = new Date(targetDate);
    newStart.setHours(sourceEvent.start.getHours(), sourceEvent.start.getMinutes(), 0, 0);
    const duration = sourceEvent.end.getTime() - sourceEvent.start.getTime();
    const newEnd = new Date(newStart.getTime() + duration);

    setDraggingEventId(null);
    setDragOverDate(null);
    onEventReschedule?.(sourceEvent, newStart, newEnd);
  }, [events, onEventReschedule]);

  const handleDragEnd = useCallback(() => {
    setDraggingEventId(null);
    setDragOverDate(null);
  }, []);

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
    <div className="cal-month-container" role="grid" aria-label={`${MONTH_NAMES[month]} ${year}`}>
      {/* Weekday Header */}
      <div className="cal-weekday-header" role="row" aria-hidden="true">
        {WEEKDAYS_SHORT.map((day, i) => (
          <div
            key={day}
            role="columnheader"
            className={`cal-weekday-cell ${i === 0 || i === 6 ? 'weekend' : ''}`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="cal-month-grid" role="rowgroup">
        {calendarDays.map(({ date, isCurrentMonth }, index) => {
          const dayEvents = getEventsForDay(date);
          const allDayEvents = dayEvents.filter(e => e.allDay);
          const timedEvents = dayEvents.filter(e => !e.allDay);
          const dayIsToday = isToday(date);
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const isDragTarget = dragOverDate !== null && isSameDay(date, dragOverDate);

          return (
            <div
              key={index}
              role="gridcell"
              aria-label={`${MONTH_NAMES[date.getMonth()]} ${date.getDate()}${dayIsToday ? ', today' : ''}${dayEvents.length > 0 ? `, ${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}` : ''}`}
              aria-current={dayIsToday ? 'date' : undefined}
              className={`cal-day-cell ${!isCurrentMonth ? 'other-month' : ''} ${dayIsToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''} ${isDragTarget ? 'cal-day-drop-target' : ''}`}
              onClick={() => onDateClick?.(date)}
              onKeyDown={(e) => e.key === 'Enter' && onDateClick?.(date)}
              tabIndex={isCurrentMonth ? 0 : -1}
              onDragOver={(e) => handleCellDragOver(e, date)}
              onDragLeave={handleCellDragLeave}
              onDrop={(e) => handleCellDrop(e, date)}
            >
              <div className="cal-day-number" aria-hidden="true">{date.getDate()}</div>

              <div className="cal-day-events">
                {/* Skeleton bars during initial fetch — only fire when the cell has nothing
                    to show yet, on the deterministic third-of-cells subset to avoid every
                    cell shimmering identically. Falls away the moment events arrive. */}
                {loading && dayEvents.length === 0 && isCurrentMonth && index % 3 !== 1 && (
                  <>
                    <div className="cal-skeleton-bar" aria-hidden="true" />
                    {index % 5 === 0 && <div className="cal-skeleton-bar" aria-hidden="true" />}
                  </>
                )}

                {/* All-day events first — up to 3 total slots */}
                {allDayEvents.slice(0, 3).map(ev => (
                  <div
                    key={ev.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${ev.title}, all day`}
                    draggable
                    className={`cal-event-pill all-day cal-event-typed${draggingEventId === ev.id ? ' cal-event-dragging' : ''}`}
                    style={getEventTypeStyle(ev.type, ev.color)}
                    onDragStart={(e) => handlePillDragStart(e, ev)}
                    onDragEnd={handleDragEnd}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(ev);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && onEventClick?.(ev)}
                    title={ev.title}
                  >
                    <i className={`fa-solid ${getEventTypeIcon(ev.type)} cal-event-pill-icon`} aria-hidden="true" />
                    <span className="cal-event-pill-text">{ev.title}</span>
                  </div>
                ))}

                {/* Timed events — fill remaining slots up to 3 */}
                {timedEvents.slice(0, 3 - Math.min(allDayEvents.length, 3)).map(ev => (
                  <div
                    key={ev.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${ev.title}, ${formatTime(ev.start)}`}
                    draggable
                    className={`cal-event-pill cal-event-typed${draggingEventId === ev.id ? ' cal-event-dragging' : ''}`}
                    style={getEventTypeStyle(ev.type, ev.color)}
                    onDragStart={(e) => handlePillDragStart(e, ev)}
                    onDragEnd={handleDragEnd}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(ev);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && onEventClick?.(ev)}
                    title={`${formatTime(ev.start)} ${ev.title}`}
                  >
                    <i className={`fa-solid ${getEventTypeIcon(ev.type)} cal-event-pill-icon`} aria-hidden="true" />
                    <span className="cal-event-pill-text">{ev.title}</span>
                  </div>
                ))}

                {/* More indicator */}
                {dayEvents.length > 3 && (
                  <button
                    className="cal-more-events"
                    aria-label={`${dayEvents.length - 3} more event${dayEvents.length - 3 > 1 ? 's' : ''} on ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onShowMoreEvents?.(date, dayEvents, { x: e.clientX, y: e.clientY });
                    }}
                  >
                    +{dayEvents.length - 3} more
                  </button>
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
  overlayEvents = [],
  onDateClick,
  onEventClick,
  onEventReschedule,
}) => {
  const today = new Date();
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const bodyRef = useRef<HTMLDivElement>(null);
  const { onMouseDown: dragMouseDown, ghost } = useDragReschedule(48, onEventReschedule);

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

  const getOverlaysForDay = (date: Date) => {
    return overlayEvents.filter(o => isSameDay(o.start, date));
  };

  // Current time position (48px per hour)
  const currentTimePosition = useMemo(() => {
    const now = new Date();
    return (now.getHours() + now.getMinutes() / 60) * 48;
  }, []);

  // Auto-scroll to current time (offset by ~2 hours so context is visible above)
  useEffect(() => {
    if (bodyRef.current) {
      const scrollTo = Math.max(0, currentTimePosition - 96); // 2 hrs above
      bodyRef.current.scrollTop = scrollTo;
    }
  }, []); // only on mount

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
                role="button"
                tabIndex={0}
                aria-label={`${WEEKDAYS[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}${dayIsToday ? ', today' : ''}`}
                aria-current={dayIsToday ? 'date' : undefined}
                className={`cal-week-day-header ${dayIsToday ? 'today' : ''}`}
                onClick={() => onDateClick?.(date)}
                onKeyDown={(e) => e.key === 'Enter' && onDateClick?.(date)}
              >
                <div className="cal-week-day-name" aria-hidden="true">{WEEKDAYS_SHORT[date.getDay()]}</div>
                <div className="cal-week-day-number" aria-hidden="true">{date.getDate()}</div>
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
                      className="cal-event-pill cal-event-typed"
                      style={getEventTypeStyle(ev.type, ev.color)}
                      onClick={() => onEventClick?.(ev)}
                    >
                      <i className={`fa-solid ${getEventTypeIcon(ev.type)} cal-event-pill-icon`} />
                      <span className="cal-event-pill-text">{ev.title}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Time Grid */}
      <div className="cal-week-body" ref={bodyRef}>
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
            const dayOverlays = getOverlaysForDay(date);
            const dayIsToday = isToday(date);

            return (
              <div key={dayIndex} className="cal-week-day-column">
                {/* Hour cells */}
                {hours.map(hour => (
                  <div
                    key={hour}
                    role="button"
                    tabIndex={-1}
                    aria-label={`${WEEKDAYS[date.getDay()]} ${formatHour(hour)}`}
                    className="cal-week-hour-cell"
                    onClick={() => {
                      const clickDate = new Date(date);
                      clickDate.setHours(hour, 0, 0, 0);
                      onDateClick?.(clickDate);
                    }}
                  />
                ))}

                {/* Team member overlay blocks */}
                {dayOverlays.map(ov => {
                  const startHour = ov.start.getHours() + ov.start.getMinutes() / 60;
                  const duration = (ov.end.getTime() - ov.start.getTime()) / (1000 * 60 * 60);
                  const top = startHour * 48;
                  const height = Math.max(duration * 48, 16);
                  return (
                    <div
                      key={ov.id}
                      className="cal-overlay-block"
                      aria-hidden="true"
                      title={`${ov.memberName}: busy${ov.title ? ` (${ov.title})` : ''}`}
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        backgroundColor: ov.color,
                        opacity: 0.18,
                        boxShadow: `inset 0 0 0 1px ${ov.color}`,
                      }}
                    />
                  );
                })}

                {/* Events */}
                {dayEvents.map(ev => {
                  const startHour = ev.start.getHours() + ev.start.getMinutes() / 60;
                  const duration = (ev.end.getTime() - ev.start.getTime()) / (1000 * 60 * 60);
                  const top = startHour * 48;
                  const height = Math.max(duration * 48, 24);
                  const isDragging = ghost?.eventId === ev.id;

                  return (
                    <div
                      key={ev.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${ev.title}, ${formatTime(ev.start)}${ev.location ? `, ${ev.location}` : ''}`}
                      className={`cal-week-event cal-event-typed${isDragging ? ' cal-event-dragging' : ''}`}
                      style={{ top: `${top}px`, height: `${height}px`, ...getEventTypeStyle(ev.type, ev.color) }}
                      onMouseDown={(e) => dragMouseDown(e, ev, e.currentTarget.closest('.cal-week-day-column') as HTMLElement, date)}
                      onClick={() => onEventClick?.(ev)}
                      onKeyDown={(e) => e.key === 'Enter' && onEventClick?.(ev)}
                    >
                      <div className="cal-week-event-title">
                        <i className={`fa-solid ${getEventTypeIcon(ev.type)} cal-event-type-icon`} aria-hidden="true" />
                        {ev.title}
                      </div>
                      {duration >= 0.75 && (
                        <div className="cal-week-event-time">{formatTime(ev.start)}</div>
                      )}
                    </div>
                  );
                })}

                {/* Drag ghost for this day column */}
                {ghost && dayEvents.some(ev => ev.id === ghost.eventId) && (
                  <div
                    className="cal-event-drag-ghost"
                    style={{ top: `${ghost.top}px`, height: `${ghost.height}px` }}
                  >
                    <span className="cal-event-drag-label">{ghost.label}</span>
                  </div>
                )}

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
  overlayEvents = [],
  onDateClick,
  onEventClick,
  onEventReschedule,
}) => {
  const today = new Date();
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const dayIsToday = isToday(currentDate);
  const bodyRef = useRef<HTMLDivElement>(null);
  const { onMouseDown: dragMouseDown, ghost } = useDragReschedule(60, onEventReschedule);

  const dayEvents = useMemo(() => {
    return events.filter(e => isSameDay(e.start, currentDate));
  }, [events, currentDate]);

  const dayOverlays = useMemo(() => {
    return overlayEvents.filter(o => isSameDay(o.start, currentDate));
  }, [overlayEvents, currentDate]);

  const allDayEvents = dayEvents.filter(e => e.allDay);
  const timedEvents = dayEvents.filter(e => !e.allDay);

  // Current time position (60px per hour)
  const currentTimePosition = useMemo(() => {
    const now = new Date();
    return (now.getHours() + now.getMinutes() / 60) * 60;
  }, []);

  // Auto-scroll to current time on mount
  useEffect(() => {
    if (bodyRef.current) {
      const scrollTo = Math.max(0, currentTimePosition - 120); // 2 hrs above
      bodyRef.current.scrollTop = scrollTo;
    }
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
      <div
        className={`cal-day-header ${dayIsToday ? 'today' : ''}`}
        aria-label={`${WEEKDAYS[currentDate.getDay()]}, ${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getDate()}, ${currentDate.getFullYear()}${dayIsToday ? ', today' : ''}`}
        aria-current={dayIsToday ? 'date' : undefined}
      >
        <div className="cal-day-header-weekday" aria-hidden="true">
          {WEEKDAYS[currentDate.getDay()]}
        </div>
        <div className="cal-day-header-date" aria-hidden="true">
          {currentDate.getDate()}
        </div>
        <div className="cal-day-header-month" aria-hidden="true">
          {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
        </div>
      </div>

      {/* All-Day Events */}
      {allDayEvents.length > 0 && (
        <div className="cal-day-allday-section">
          <div className="cal-day-allday-label">
            <Sun />
            All Day Events
          </div>
          <div className="cal-day-allday-events">
            {allDayEvents.map(ev => (
              <div
                key={ev.id}
                role="button"
                tabIndex={0}
                aria-label={`${ev.title}, all day`}
                className="cal-day-allday-event cal-event-typed"
                style={getEventTypeStyle(ev.type, ev.color)}
                onClick={() => onEventClick?.(ev)}
                onKeyDown={(e) => e.key === 'Enter' && onEventClick?.(ev)}
              >
                <i className={`fa-solid ${getEventTypeIcon(ev.type)}`} aria-hidden="true" style={{ fontSize: '0.75rem', opacity: 0.9 }} />
                {ev.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Time Grid */}
      <div className="cal-day-body" ref={bodyRef}>
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
              role="button"
              tabIndex={-1}
              aria-label={`Create event at ${formatHour(hour)}`}
              className="cal-day-hour-cell"
              onClick={() => {
                const clickDate = new Date(currentDate);
                clickDate.setHours(hour, 0, 0, 0);
                onDateClick?.(clickDate);
              }}
            />
          ))}

          {/* Team member overlay blocks (DayView — 60px/hr) */}
          {dayOverlays.map(ov => {
            const startHour = ov.start.getHours() + ov.start.getMinutes() / 60;
            const duration = (ov.end.getTime() - ov.start.getTime()) / (1000 * 60 * 60);
            const top = startHour * 60;
            const height = Math.max(duration * 60, 20);
            return (
              <div
                key={ov.id}
                className="cal-overlay-block"
                aria-hidden="true"
                title={`${ov.memberName}: busy${ov.title ? ` (${ov.title})` : ''}`}
                style={{
                  top: `${top}px`,
                  height: `${height}px`,
                  backgroundColor: ov.color,
                  opacity: 0.18,
                  boxShadow: `inset 0 0 0 1px ${ov.color}`,
                }}
              />
            );
          })}

          {/* Events */}
          {timedEvents.map(ev => {
            const startHour = ev.start.getHours() + ev.start.getMinutes() / 60;
            const duration = (ev.end.getTime() - ev.start.getTime()) / (1000 * 60 * 60);
            const top = startHour * 60;
            const height = Math.max(duration * 60, 36);
            const typeStyle = getEventTypeStyle(ev.type, ev.color);
            const isDragging = ghost?.eventId === ev.id;

            return (
              <div
                key={ev.id}
                role="button"
                tabIndex={0}
                aria-label={`${ev.title}, ${formatTime(ev.start)}${ev.location ? `, ${ev.location}` : ''}`}
                className={`cal-day-event cal-event-typed${isDragging ? ' cal-event-dragging' : ''}`}
                style={{ top: `${top}px`, height: `${height}px`, ...typeStyle }}
                onMouseDown={(e) => dragMouseDown(e, ev, e.currentTarget.closest('.cal-day-events-column') as HTMLElement)}
                onClick={() => onEventClick?.(ev)}
                onKeyDown={(e) => e.key === 'Enter' && onEventClick?.(ev)}
              >
                <div className="cal-day-event-title">
                  <i className={`fa-solid ${getEventTypeIcon(ev.type)} cal-event-type-icon`} aria-hidden="true" />
                  {ev.title}
                </div>
                <div className="cal-day-event-time">
                  {formatTimeRange(ev.start, ev.end)}
                </div>
                {ev.location && (
                  <div className="cal-day-event-location">
                    <MapPin />
                    {ev.location}
                  </div>
                )}
              </div>
            );
          })}

          {/* Drag ghost */}
          {ghost && timedEvents.some(ev => ev.id === ghost.eventId) && (
            <div
              className="cal-event-drag-ghost"
              style={{ top: `${ghost.top}px`, height: `${ghost.height}px` }}
            >
              <span className="cal-event-drag-label">{ghost.label}</span>
            </div>
          )}

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
  viewMode: 'year' | 'month' | 'week' | 'day' | 'agenda' | 'timeline';
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: 'year' | 'month' | 'week' | 'day' | 'agenda' | 'timeline') => void;
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

  const prevLabel = viewMode === 'year' ? 'Previous year'
    : viewMode === 'month' ? 'Previous month'
    : viewMode === 'week'  ? 'Previous week'
    : 'Previous day';
  const nextLabel = viewMode === 'year' ? 'Next year'
    : viewMode === 'month' ? 'Next month'
    : viewMode === 'week'  ? 'Next week'
    : 'Next day';

  return (
    <div className="cal-header" role="toolbar" aria-label="Calendar controls">
      <div className="cal-header-left">
        <h2 className="cal-title cal-font-display" aria-live="polite" aria-atomic="true">
          {getTitle()}
        </h2>

        <div style={{ display: 'flex', gap: '4px' }}>
          <button className="cal-nav-btn" onClick={onPrev} aria-label={prevLabel}>
            <ChevronLeft />
          </button>
          <button className="cal-nav-btn" onClick={onNext} aria-label={nextLabel}>
            <ChevronRight />
          </button>
        </div>

        <button className="cal-today-btn" onClick={onToday} aria-label="Go to today">
          Today
        </button>
      </div>

      <CalendarViewSwitcher viewMode={viewMode} onViewChange={onViewChange} />
    </div>
  );
};

/** View switcher: primary buttons for Month + Day with an overflow popover
 *  exposing Year, Week, Agenda, and Timeline. Surfaces all six views without
 *  bloating the header — the keyboard shortcuts (Y/W/A/D/M) still work, and
 *  ⌘K continues to address them by name, but first-timers can discover the
 *  full vocabulary via the visible ⋯ button. */
const CalendarViewSwitcher: React.FC<{
  viewMode: 'year' | 'month' | 'week' | 'day' | 'agenda' | 'timeline';
  onViewChange: (view: 'year' | 'month' | 'week' | 'day' | 'agenda' | 'timeline') => void;
}> = ({ viewMode, onViewChange }) => {
  const [open, setOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const overflowViews = [
    { id: 'year' as const,     label: 'Year',     shortcut: 'Y' },
    { id: 'week' as const,     label: 'Week',     shortcut: 'W' },
    { id: 'agenda' as const,   label: 'Agenda',   shortcut: 'A' },
    { id: 'timeline' as const, label: 'Timeline', shortcut: 'L' },
  ];
  const overflowActive = overflowViews.some(v => v.id === viewMode);

  return (
    <div className="cal-view-switcher" role="group" aria-label="Calendar view">
      {(['month', 'day'] as const).map(view => (
        <button
          key={view}
          className={`cal-view-btn ${viewMode === view ? 'active' : ''}`}
          onClick={() => onViewChange(view)}
          aria-pressed={viewMode === view}
          aria-label={`${view} view`}
        >
          {view}
        </button>
      ))}
      <div ref={overflowRef} style={{ position: 'relative' }}>
        <button
          type="button"
          className={`cal-view-btn cal-view-btn-overflow ${overflowActive ? 'active' : ''}`}
          onClick={() => setOpen(o => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="More views"
          title="More views"
        >
          {overflowActive ? overflowViews.find(v => v.id === viewMode)!.label : <Ellipsis size={14} />}
        </button>
        {open && (
          <div
            className="cal-view-overflow-menu"
            role="menu"
            aria-label="More calendar views"
          >
            {overflowViews.map(v => (
              <button
                key={v.id}
                role="menuitem"
                className={`cal-view-overflow-item ${viewMode === v.id ? 'active' : ''}`}
                onClick={() => { onViewChange(v.id); setOpen(false); }}
              >
                <span>{v.label}</span>
                <kbd>{v.shortcut}</kbd>
              </button>
            ))}
          </div>
        )}
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

// Export Agenda View
export { AgendaView } from './CalendarAgendaView';
