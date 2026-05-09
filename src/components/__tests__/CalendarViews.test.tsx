/**
 * CalendarViews.test.tsx
 * Comprehensive unit tests for MonthView, WeekView, DayView, YearView
 * and the shared useDragReschedule hook (tested via integration).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalendarEvent } from '../../types';
import { MonthView, WeekView, DayView, YearView } from '../CalendarViews';

// ─── Module mocks ─────────────────────────────────────────────────────────────

// Must use a plain factory (no vi.fn inside) so hoisting works correctly.
vi.mock('../../services/customEventTypesService', () => {
  const DEFAULT_META = { color: '#6b7280', icon: 'fa-calendar', label: 'Event' };
  const TYPE_MAP: Record<string, { color: string; icon: string; label: string }> = {
    event:    { color: '#6b7280', icon: 'fa-calendar',    label: 'Event' },
    meet:     { color: '#3b82f6', icon: 'fa-video',       label: 'Meeting' },
    call:     { color: '#10b981', icon: 'fa-phone',       label: 'Call' },
    focus:    { color: '#8b5cf6', icon: 'fa-brain',       label: 'Focus Time' },
    personal: { color: '#f59e0b', icon: 'fa-user',        label: 'Personal' },
    deadline: { color: '#ef4444', icon: 'fa-flag',        label: 'Deadline' },
    travel:   { color: '#06b6d4', icon: 'fa-plane',       label: 'Travel' },
    social:   { color: '#ec4899', icon: 'fa-users',       label: 'Social' },
    health:   { color: '#f97316', icon: 'fa-heart-pulse', label: 'Health' },
    reminder: { color: '#a3a3a3', icon: 'fa-bell',        label: 'Reminder' },
  };
  return {
    customEventTypesService: { getById: () => null, getAll: () => [] },
    getEventTypeMeta: (type?: string) => TYPE_MAP[type ?? ''] ?? DEFAULT_META,
    BUILT_IN_TYPE_META: TYPE_MAP,
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Stable "today" for all tests — Feb 18 2026 (Wednesday). Avoids flakiness. */
const TODAY = new Date(2026, 1, 18, 12, 0, 0, 0);
/** Today's date-of-month. */
const TODAY_DAY = TODAY.getDate(); // 18

/** Create a CalendarEvent with sensible defaults. */
const makeEvent = (
  overrides: Partial<CalendarEvent> & { start: Date; end: Date }
): CalendarEvent => ({
  id: `evt-${Math.random().toString(36).slice(2, 9)}`,
  title: 'Test Event',
  type: 'event',
  color: '#6b7280',
  allDay: false,
  calendarId: 'primary',
  ...overrides,
});

/** Date at year/month/day hour:minute (month is 1-based). */
const d = (year: number, month: number, day: number, hour = 9, min = 0) =>
  new Date(year, month - 1, day, hour, min, 0, 0);

/** Feb 17 2026 — used for DayView event tests (events are created on this date). */
const DAY_17 = new Date(2026, 1, 17, 12, 0, 0, 0);

// Shared default props — currentDate is pinned to our stable TODAY
const defaults = {
  currentDate: TODAY,
  events: [] as CalendarEvent[],
  onDateClick:        vi.fn(),
  onEventClick:       vi.fn(),
  onEventReschedule:  vi.fn(),
  onShowMoreEvents:   vi.fn(),
  onViewChange:       vi.fn(),
};

/** DayView defaults pinned to Feb 17 so events on d(2026,2,17,...) are visible. */
const dayDefaults = { ...defaults, currentDate: DAY_17 };

// Pin the wall clock to TODAY so production calls to `new Date()` (e.g. the
// "today" highlight in MonthView/YearView) resolve to the same date the tests
// pass in via `currentDate`. Restrict the fake-timer scope to Date only —
// faking setTimeout would break userEvent's async waits.
beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(TODAY);
});
afterAll(() => {
  vi.useRealTimers();
});

beforeEach(() => vi.clearAllMocks());

// ═════════════════════════════════════════════════════════════════════════════
// MONTH VIEW
// ═════════════════════════════════════════════════════════════════════════════

describe('MonthView', () => {

  describe('structure', () => {
    it('renders 7 weekday header labels', () => {
      render(<MonthView {...defaults} />);
      ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d =>
        expect(screen.getByText(d)).toBeInTheDocument()
      );
    });

    it('renders exactly 42 day cells (6-week grid)', () => {
      const { container } = render(<MonthView {...defaults} />);
      expect(container.querySelectorAll('.cal-day-cell')).toHaveLength(42);
    });

    it('marks the today cell with .today', () => {
      const { container } = render(<MonthView {...defaults} />);
      const todayCell = container.querySelector('.cal-day-cell.today');
      expect(todayCell).toBeInTheDocument();
      // Today's date number should be inside the today cell
      expect(within(todayCell as HTMLElement).getByText(String(TODAY_DAY))).toBeInTheDocument();
    });

    it('marks exactly 12 weekend cells', () => {
      const { container } = render(<MonthView {...defaults} />);
      // 6 rows × 2 weekend columns = 12
      expect(container.querySelectorAll('.cal-day-cell.weekend')).toHaveLength(12);
    });

    it('marks overflow (non-current-month) cells with .other-month', () => {
      const { container } = render(<MonthView {...defaults} />);
      // Feb 2026 starts on Sunday → 0 leading + 28 days + 14 trailing = 42
      const other = container.querySelectorAll('.cal-day-cell.other-month');
      expect(other.length).toBe(14);
    });
  });

  describe('events', () => {
    it('renders event pill for an event on its date', () => {
      const ev = makeEvent({ title: 'Sprint Review', start: d(2026,2,17,10), end: d(2026,2,17,11) });
      render(<MonthView {...defaults} events={[ev]} />);
      expect(screen.getByText('Sprint Review')).toBeInTheDocument();
    });

    it('renders at most 3 pills and a "+N more" badge when day has >3 events', () => {
      const events = Array.from({length: 5}, (_, i) =>
        makeEvent({ title: `Ev${i+1}`, start: d(2026,2,17, 9+i), end: d(2026,2,17, 10+i) })
      );
      render(<MonthView {...defaults} events={events} />);
      expect(screen.getByText('Ev1')).toBeInTheDocument();
      expect(screen.getByText('Ev3')).toBeInTheDocument();
      expect(screen.queryByText('Ev4')).not.toBeInTheDocument();
      expect(screen.getByText('+2 more')).toBeInTheDocument();
    });

    it('calls onShowMoreEvents when "+N more" is clicked', async () => {
      const onShowMore = vi.fn();
      const events = Array.from({length: 5}, (_, i) =>
        makeEvent({ title: `Ev${i+1}`, start: d(2026,2,17, 9+i), end: d(2026,2,17, 10+i) })
      );
      render(<MonthView {...defaults} events={events} onShowMoreEvents={onShowMore} />);
      await userEvent.click(screen.getByText('+2 more'));
      expect(onShowMore).toHaveBeenCalledOnce();
      expect(onShowMore.mock.calls[0][1]).toHaveLength(5);
    });

    it('calls onEventClick when a pill is clicked', async () => {
      const onEventClick = vi.fn();
      const ev = makeEvent({ title: 'Clickable Pill', start: d(2026,2,17,10), end: d(2026,2,17,11) });
      render(<MonthView {...defaults} events={[ev]} onEventClick={onEventClick} />);
      await userEvent.click(screen.getByText('Clickable Pill'));
      expect(onEventClick).toHaveBeenCalledWith(ev);
    });

    it('calls onDateClick when an empty day cell is clicked', async () => {
      const onDateClick = vi.fn();
      const { container } = render(<MonthView {...defaults} onDateClick={onDateClick} />);
      await userEvent.click(container.querySelectorAll('.cal-day-cell')[0] as HTMLElement);
      expect(onDateClick).toHaveBeenCalledOnce();
    });
  });

  describe('ARIA accessibility', () => {
    it('timed event pills have role="button" and aria-label containing the title', () => {
      const ev = makeEvent({ title: 'Board Meeting', start: d(2026,2,17,14), end: d(2026,2,17,15) });
      render(<MonthView {...defaults} events={[ev]} />);
      const btn = screen.getByRole('button', { name: /Board Meeting/ });
      expect(btn).toHaveAttribute('aria-label');
      expect(btn).toHaveAttribute('tabindex', '0');
    });

    it('all-day event pills include "all day" in aria-label', () => {
      const ev = makeEvent({ title: 'Company Holiday', allDay: true, start: d(2026,2,17), end: d(2026,2,17,23,59) });
      render(<MonthView {...defaults} events={[ev]} />);
      const btn = screen.getByRole('button', { name: /Company Holiday.*all day/i });
      expect(btn).toBeInTheDocument();
    });

    it('pills fire onEventClick on Enter keypress', async () => {
      const onEventClick = vi.fn();
      const ev = makeEvent({ title: 'Enter Pill', start: d(2026,2,17,10), end: d(2026,2,17,11) });
      render(<MonthView {...defaults} events={[ev]} onEventClick={onEventClick} />);
      const btn = screen.getByRole('button', { name: /Enter Pill/ });
      btn.focus();
      await userEvent.keyboard('{Enter}');
      expect(onEventClick).toHaveBeenCalledWith(ev);
    });
  });

  describe('drag-and-drop (HTML5)', () => {
    it('event pills have draggable="true"', () => {
      const ev = makeEvent({ title: 'Draggable', start: d(2026,2,17,10), end: d(2026,2,17,11) });
      render(<MonthView {...defaults} events={[ev]} />);
      const pill = screen.getByText('Draggable').closest('[draggable]');
      expect(pill).toHaveAttribute('draggable', 'true');
    });

    it('adds .cal-day-drop-target to a cell on dragOver', () => {
      const ev = makeEvent({ id: 'dnd-ev', title: 'Drag Me', start: d(2026,2,17,10), end: d(2026,2,17,11) });
      const { container } = render(<MonthView {...defaults} events={[ev]} />);
      const pill = screen.getByText('Drag Me').closest('[draggable]') as HTMLElement;

      const mockDT = { effectAllowed: '', setData: vi.fn(), getData: vi.fn(() => ev.id) };
      fireEvent.dragStart(pill, { dataTransfer: mockDT });

      // Feb 2026: no leading padding, cell[19] = day 20
      const targetCell = container.querySelectorAll('.cal-day-cell')[19] as HTMLElement;
      fireEvent.dragOver(targetCell, { dataTransfer: { dropEffect: '', getData: vi.fn() } });

      expect(targetCell).toHaveClass('cal-day-drop-target');
    });

    it('calls onEventReschedule on drop onto a different day — preserves time', () => {
      const onReschedule = vi.fn();
      const ev = makeEvent({ id: 'drop-ev', title: 'Drop Me', start: d(2026,2,17,10,30), end: d(2026,2,17,11,30) });
      const { container } = render(<MonthView {...defaults} events={[ev]} onEventReschedule={onReschedule} />);

      // cell[19] = Feb 20
      const targetCell = container.querySelectorAll('.cal-day-cell')[19] as HTMLElement;
      fireEvent.drop(targetCell, { dataTransfer: { getData: vi.fn(() => ev.id) } });

      expect(onReschedule).toHaveBeenCalledOnce();
      const [calledEvent, newStart, newEnd] = onReschedule.mock.calls[0];
      expect(calledEvent.id).toBe(ev.id);
      expect(newStart.getDate()).toBe(20);
      expect(newStart.getMonth()).toBe(1); // Feb
      expect(newStart.getHours()).toBe(10);   // time preserved
      expect(newStart.getMinutes()).toBe(30);
      // Duration preserved: 1 hour
      expect((newEnd.getTime() - newStart.getTime()) / 60000).toBe(60);
    });

    it('does NOT call onEventReschedule when dropped on the same day', () => {
      const onReschedule = vi.fn();
      // Event must be on TODAY so the today cell IS the same day
      const evStart = new Date(TODAY); evStart.setHours(10, 0, 0, 0);
      const evEnd   = new Date(TODAY); evEnd.setHours(11, 0, 0, 0);
      const ev = makeEvent({ id: 'same-ev', title: 'Same Day', start: evStart, end: evEnd });
      const { container } = render(<MonthView {...defaults} events={[ev]} onEventReschedule={onReschedule} />);

      const todayCell = container.querySelector('.cal-day-cell.today') as HTMLElement;
      fireEvent.drop(todayCell, { dataTransfer: { getData: vi.fn(() => ev.id) } });

      expect(onReschedule).not.toHaveBeenCalled();
    });

    it('removes .cal-day-drop-target on dragLeave', () => {
      const ev = makeEvent({ id: 'leave-ev', title: 'Leave', start: d(2026,2,17,10), end: d(2026,2,17,11) });
      const { container } = render(<MonthView {...defaults} events={[ev]} />);
      const pill = screen.getByText('Leave').closest('[draggable]') as HTMLElement;

      fireEvent.dragStart(pill, { dataTransfer: { effectAllowed: '', setData: vi.fn(), getData: vi.fn(() => ev.id) } });
      const targetCell = container.querySelectorAll('.cal-day-cell')[19] as HTMLElement;
      fireEvent.dragOver(targetCell, { dataTransfer: { dropEffect: '' } });
      expect(targetCell).toHaveClass('cal-day-drop-target');

      fireEvent.dragLeave(targetCell);
      expect(targetCell).not.toHaveClass('cal-day-drop-target');
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// WEEK VIEW
// ═════════════════════════════════════════════════════════════════════════════

describe('WeekView', () => {

  describe('structure', () => {
    it('renders 7 day column headers', () => {
      render(<WeekView {...defaults} />);
      ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(day =>
        expect(screen.getAllByText(day).length).toBeGreaterThanOrEqual(1)
      );
    });

    it('renders 24 hour time labels', () => {
      render(<WeekView {...defaults} />);
      expect(screen.getAllByText('12 AM').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('12 PM').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('11 PM').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('event rendering', () => {
    it('shows events that fall within the current week', () => {
      const ev = makeEvent({ title: 'Team Standup', start: d(2026,2,17,9), end: d(2026,2,17,9,30) });
      render(<WeekView {...defaults} events={[ev]} />);
      expect(screen.getByText('Team Standup')).toBeInTheDocument();
    });

    it('does NOT show events from a different week', () => {
      const ev = makeEvent({ title: 'Next Week', start: d(2026,2,25,10), end: d(2026,2,25,11) });
      render(<WeekView {...defaults} events={[ev]} />);
      expect(screen.queryByText('Next Week')).not.toBeInTheDocument();
    });

    it('positions event at correct top (9 AM = 9×48 = 432px)', () => {
      const ev = makeEvent({ title: 'AM Meeting', start: d(2026,2,17,9), end: d(2026,2,17,10) });
      const { container } = render(<WeekView {...defaults} events={[ev]} />);
      const block = container.querySelector('.cal-week-event') as HTMLElement;
      expect(block.style.top).toBe('432px');
    });

    it('sizes event by duration (90 min = 72px)', () => {
      const ev = makeEvent({ title: '90 Min', start: d(2026,2,17,10), end: d(2026,2,17,11,30) });
      const { container } = render(<WeekView {...defaults} events={[ev]} />);
      const block = container.querySelector('.cal-week-event') as HTMLElement;
      expect(block.style.height).toBe('72px');
    });

    it('enforces minimum height of 24px', () => {
      const ev = makeEvent({ title: 'Tiny', start: d(2026,2,17,10), end: d(2026,2,17,10,5) });
      const { container } = render(<WeekView {...defaults} events={[ev]} />);
      const block = container.querySelector('.cal-week-event') as HTMLElement;
      expect(parseInt(block.style.height)).toBeGreaterThanOrEqual(24);
    });

    it('renders all-day events in the all-day row, not the time grid', () => {
      const ev = makeEvent({ title: 'Holiday', allDay: true, start: d(2026,2,17,0), end: d(2026,2,17,23,59) });
      const { container } = render(<WeekView {...defaults} events={[ev]} />);
      const alldayRow = container.querySelector('.cal-week-allday-row');
      expect(alldayRow).toBeInTheDocument();
      expect(within(alldayRow as HTMLElement).getByText('Holiday')).toBeInTheDocument();
      const timeGrid = container.querySelector('.cal-week-days-grid') as HTMLElement;
      expect(within(timeGrid).queryByText('Holiday')).not.toBeInTheDocument();
    });
  });

  describe('ARIA accessibility', () => {
    it('event blocks have role="button", tabIndex=0, and aria-label', () => {
      const ev = makeEvent({ title: 'Weekly Sync', start: d(2026,2,17,14), end: d(2026,2,17,15) });
      render(<WeekView {...defaults} events={[ev]} />);
      const btn = screen.getByRole('button', { name: /Weekly Sync/ });
      expect(btn).toHaveAttribute('tabindex', '0');
      expect(btn).toHaveAttribute('aria-label');
    });

    it('includes location in aria-label when present', () => {
      const ev = makeEvent({ title: 'Offsite', location: 'Building B', start: d(2026,2,17,10), end: d(2026,2,17,11) });
      render(<WeekView {...defaults} events={[ev]} />);
      expect(screen.getByRole('button', { name: /Building B/ })).toBeInTheDocument();
    });

    it('fires onEventClick on mouse click', async () => {
      const onEventClick = vi.fn();
      const ev = makeEvent({ title: 'Click Week', start: d(2026,2,17,10), end: d(2026,2,17,11) });
      render(<WeekView {...defaults} events={[ev]} onEventClick={onEventClick} />);
      await userEvent.click(screen.getByText('Click Week'));
      expect(onEventClick).toHaveBeenCalledWith(ev);
    });

    it('fires onEventClick on Enter key', async () => {
      const onEventClick = vi.fn();
      const ev = makeEvent({ title: 'Enter Week', start: d(2026,2,17,10), end: d(2026,2,17,11) });
      render(<WeekView {...defaults} events={[ev]} onEventClick={onEventClick} />);
      const btn = screen.getByRole('button', { name: /Enter Week/ });
      btn.focus();
      await userEvent.keyboard('{Enter}');
      expect(onEventClick).toHaveBeenCalledWith(ev);
    });
  });

  describe('drag-to-reschedule (mouse)', () => {
    /** Mocks getBoundingClientRect + scrollTop on the day column element. */
    const mockColumn = (container: HTMLElement) => {
      const col = container.querySelector('.cal-week-day-column') as HTMLElement;
      vi.spyOn(col, 'getBoundingClientRect').mockReturnValue({
        top: 0, left: 0, bottom: 1152, right: 100,
        width: 100, height: 1152, x: 0, y: 0, toJSON: vi.fn(),
      });
      Object.defineProperty(col, 'scrollTop', { get: () => 0, configurable: true });
      return col;
    };

    it('adds .cal-event-dragging class after significant mouseMove', () => {
      const ev = makeEvent({ title: 'Drag Week', start: d(2026,2,17,10), end: d(2026,2,17,11) });
      const { container } = render(<WeekView {...defaults} events={[ev]} onEventReschedule={vi.fn()} />);
      mockColumn(container);
      const block = container.querySelector('.cal-week-event') as HTMLElement;

      // 10 AM = 480px; move +100px (≈2h) → >15 min threshold
      fireEvent.mouseDown(block, { button: 0, clientY: 480 });
      fireEvent.mouseMove(window, { clientY: 580 });

      expect(block).toHaveClass('cal-event-dragging');
    });

    it('shows ghost overlay with time label after move', () => {
      const ev = makeEvent({ title: 'Ghost Week', start: d(2026,2,17,10), end: d(2026,2,17,11) });
      const { container } = render(<WeekView {...defaults} events={[ev]} onEventReschedule={vi.fn()} />);
      mockColumn(container);
      const block = container.querySelector('.cal-week-event') as HTMLElement;

      fireEvent.mouseDown(block, { button: 0, clientY: 480 });
      fireEvent.mouseMove(window, { clientY: 580 });

      const ghost = container.querySelector('.cal-event-drag-ghost');
      expect(ghost).toBeInTheDocument();
      expect(container.querySelector('.cal-event-drag-label')?.textContent).toMatch(/\d+:\d+ (AM|PM)/);
    });

    it('calls onEventReschedule with +2h snapped time on mouseUp', () => {
      const onReschedule = vi.fn();
      const ev = makeEvent({ title: 'Reschedule', start: d(2026,2,17,10), end: d(2026,2,17,11) });
      const { container } = render(<WeekView {...defaults} events={[ev]} onEventReschedule={onReschedule} />);
      mockColumn(container);
      const block = container.querySelector('.cal-week-event') as HTMLElement;

      // 10 AM = 480; 12 PM = 576 → delta +96px = +2h at 48px/h
      fireEvent.mouseDown(block, { button: 0, clientY: 480 });
      fireEvent.mouseMove(window, { clientY: 576 });
      fireEvent.mouseUp(window, { clientY: 576 });

      expect(onReschedule).toHaveBeenCalledOnce();
      const [calledEv, newStart, newEnd] = onReschedule.mock.calls[0];
      expect(calledEv.id).toBe(ev.id);
      expect(newStart.getHours()).toBe(12);
      expect(newEnd.getHours()).toBe(13); // duration preserved
    });

    it('does NOT call onEventReschedule for drag < 15 min', () => {
      const onReschedule = vi.fn();
      const ev = makeEvent({ title: 'Tiny Drag', start: d(2026,2,17,10), end: d(2026,2,17,11) });
      const { container } = render(<WeekView {...defaults} events={[ev]} onEventReschedule={onReschedule} />);
      mockColumn(container);
      const block = container.querySelector('.cal-week-event') as HTMLElement;

      // 5px at 48px/h ≈ 6 min → below 15-min threshold
      fireEvent.mouseDown(block, { button: 0, clientY: 480 });
      fireEvent.mouseMove(window, { clientY: 485 });
      fireEvent.mouseUp(window, { clientY: 485 });

      expect(onReschedule).not.toHaveBeenCalled();
    });

    it('ghost is removed after mouseUp', () => {
      const ev = makeEvent({ title: 'Ghost Gone', start: d(2026,2,17,10), end: d(2026,2,17,11) });
      const { container } = render(<WeekView {...defaults} events={[ev]} onEventReschedule={vi.fn()} />);
      mockColumn(container);
      const block = container.querySelector('.cal-week-event') as HTMLElement;

      fireEvent.mouseDown(block, { button: 0, clientY: 480 });
      fireEvent.mouseMove(window, { clientY: 576 });
      expect(container.querySelector('.cal-event-drag-ghost')).toBeInTheDocument();

      fireEvent.mouseUp(window, { clientY: 576 });
      expect(container.querySelector('.cal-event-drag-ghost')).not.toBeInTheDocument();
    });

    it('does not start drag on right-click', () => {
      const onReschedule = vi.fn();
      const ev = makeEvent({ title: 'Right Click', start: d(2026,2,17,10), end: d(2026,2,17,11) });
      const { container } = render(<WeekView {...defaults} events={[ev]} onEventReschedule={onReschedule} />);
      mockColumn(container);
      const block = container.querySelector('.cal-week-event') as HTMLElement;

      fireEvent.mouseDown(block, { button: 2, clientY: 480 }); // right click
      fireEvent.mouseMove(window, { clientY: 576 });
      fireEvent.mouseUp(window, { clientY: 576 });

      expect(container.querySelector('.cal-event-drag-ghost')).not.toBeInTheDocument();
      expect(onReschedule).not.toHaveBeenCalled();
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DAY VIEW
// ═════════════════════════════════════════════════════════════════════════════

describe('DayView', () => {

  describe('structure', () => {
    it('renders the weekday name for currentDate', () => {
      render(<DayView {...defaults} currentDate={d(2026,2,17)} />);
      expect(screen.getByText('Tuesday')).toBeInTheDocument();
    });

    it('renders the day number', () => {
      render(<DayView {...defaults} currentDate={d(2026,2,17)} />);
      expect(screen.getByText('17')).toBeInTheDocument();
    });

    it('renders the month and year', () => {
      render(<DayView {...defaults} currentDate={d(2026,2,17)} />);
      expect(screen.getByText(/February 2026/)).toBeInTheDocument();
    });

    it('renders 24 hour time labels', () => {
      render(<DayView {...defaults} />);
      expect(screen.getByText('12 AM')).toBeInTheDocument();
      expect(screen.getByText('12 PM')).toBeInTheDocument();
      expect(screen.getByText('11 PM')).toBeInTheDocument();
    });
  });

  describe('event rendering', () => {
    it('shows events for the current day', () => {
      const ev = makeEvent({ title: 'Day Event', start: d(2026,2,17,14), end: d(2026,2,17,15) });
      render(<DayView {...dayDefaults} events={[ev]} />);
      expect(screen.getByText('Day Event')).toBeInTheDocument();
    });

    it('does NOT show events for other days', () => {
      // currentDate = Feb 17; event is Feb 18 → should not appear
      const ev = makeEvent({ title: 'Tomorrow', start: d(2026,2,18,10), end: d(2026,2,18,11) });
      render(<DayView {...dayDefaults} events={[ev]} />);
      expect(screen.queryByText('Tomorrow')).not.toBeInTheDocument();
    });

    it('positions event at correct top — 2 PM = 14×60 = 840px', () => {
      const ev = makeEvent({ title: 'Afternoon', start: d(2026,2,17,14), end: d(2026,2,17,15) });
      const { container } = render(<DayView {...dayDefaults} events={[ev]} />);
      const block = container.querySelector('.cal-day-event') as HTMLElement;
      expect(block.style.top).toBe('840px');
    });

    it('sizes event by duration — 2 hours = 120px', () => {
      const ev = makeEvent({ title: '2hr Event', start: d(2026,2,17,10), end: d(2026,2,17,12) });
      const { container } = render(<DayView {...dayDefaults} events={[ev]} />);
      const block = container.querySelector('.cal-day-event') as HTMLElement;
      expect(block.style.height).toBe('120px');
    });

    it('enforces minimum height of 36px for very short events', () => {
      const ev = makeEvent({ title: 'Micro', start: d(2026,2,17,10), end: d(2026,2,17,10,5) });
      const { container } = render(<DayView {...dayDefaults} events={[ev]} />);
      const block = container.querySelector('.cal-day-event') as HTMLElement;
      expect(parseInt(block.style.height)).toBeGreaterThanOrEqual(36);
    });

    it('shows time range text on the event block', () => {
      const ev = makeEvent({ title: 'Ranged', start: d(2026,2,17,10), end: d(2026,2,17,11,30) });
      render(<DayView {...dayDefaults} events={[ev]} />);
      // locale-dependent but always contains digits and AM/PM
      expect(screen.getByText(/10:00.*11:30|10:00 AM.*11:30 AM/i)).toBeInTheDocument();
    });

    it('shows event location when present', () => {
      const ev = makeEvent({ title: 'Located', location: 'Room 101', start: d(2026,2,17,10), end: d(2026,2,17,11) });
      render(<DayView {...dayDefaults} events={[ev]} />);
      expect(screen.getByText('Room 101')).toBeInTheDocument();
    });

    it('renders all-day events in the allday section, not the time grid', () => {
      const ev = makeEvent({ title: 'All Day', allDay: true, start: d(2026,2,17,0), end: d(2026,2,17,23,59) });
      const { container } = render(<DayView {...dayDefaults} events={[ev]} />);
      const section = container.querySelector('.cal-day-allday-section') as HTMLElement;
      expect(section).toBeInTheDocument();
      expect(within(section).getByText('All Day')).toBeInTheDocument();
      const grid = container.querySelector('.cal-day-events-column') as HTMLElement;
      expect(within(grid).queryByText('All Day')).not.toBeInTheDocument();
    });

    it('hides the allday section when there are no all-day events', () => {
      const { container } = render(<DayView {...dayDefaults} />);
      expect(container.querySelector('.cal-day-allday-section')).not.toBeInTheDocument();
    });
  });

  describe('ARIA accessibility', () => {
    it('event blocks have role="button", tabIndex=0, and aria-label', () => {
      const ev = makeEvent({ title: 'Accessible', start: d(2026,2,17,10), end: d(2026,2,17,11) });
      render(<DayView {...dayDefaults} events={[ev]} />);
      const btn = screen.getByRole('button', { name: /Accessible/ });
      expect(btn).toHaveAttribute('tabindex', '0');
      expect(btn).toHaveAttribute('aria-label');
    });

    it('fires onEventClick on click', async () => {
      const onEventClick = vi.fn();
      const ev = makeEvent({ title: 'Click Day', start: d(2026,2,17,10), end: d(2026,2,17,11) });
      render(<DayView {...dayDefaults} events={[ev]} onEventClick={onEventClick} />);
      await userEvent.click(screen.getByText('Click Day'));
      expect(onEventClick).toHaveBeenCalledWith(ev);
    });

    it('fires onEventClick on Enter key', async () => {
      const onEventClick = vi.fn();
      const ev = makeEvent({ title: 'Enter Day', start: d(2026,2,17,10), end: d(2026,2,17,11) });
      render(<DayView {...dayDefaults} events={[ev]} onEventClick={onEventClick} />);
      const btn = screen.getByRole('button', { name: /Enter Day/ });
      btn.focus();
      await userEvent.keyboard('{Enter}');
      expect(onEventClick).toHaveBeenCalledWith(ev);
    });
  });

  describe('onDateClick', () => {
    it('calls onDateClick with the clicked hour when an hour cell is clicked', async () => {
      const onDateClick = vi.fn();
      const { container } = render(<DayView {...dayDefaults} onDateClick={onDateClick} />);
      const hourCells = container.querySelectorAll('.cal-day-hour-cell');
      await userEvent.click(hourCells[14] as HTMLElement); // 2 PM
      expect(onDateClick).toHaveBeenCalledOnce();
      expect((onDateClick.mock.calls[0][0] as Date).getHours()).toBe(14);
    });
  });

  describe('drag-to-reschedule (mouse)', () => {
    const mockCol = (container: HTMLElement) => {
      const col = container.querySelector('.cal-day-events-column') as HTMLElement;
      vi.spyOn(col, 'getBoundingClientRect').mockReturnValue({
        top: 0, left: 0, bottom: 1440, right: 200,
        width: 200, height: 1440, x: 0, y: 0, toJSON: vi.fn(),
      });
      Object.defineProperty(col, 'scrollTop', { get: () => 0, configurable: true });
      return col;
    };

    it('calls onEventReschedule after +2h drag', () => {
      const onReschedule = vi.fn();
      const ev = makeEvent({ title: 'Day Drag', start: d(2026,2,17,10), end: d(2026,2,17,11) });
      const { container } = render(<DayView {...dayDefaults} events={[ev]} onEventReschedule={onReschedule} />);
      mockCol(container);
      const block = container.querySelector('.cal-day-event') as HTMLElement;

      // 10 AM = 600px; 12 PM = 720px (+120px = +2h at 60px/h)
      fireEvent.mouseDown(block, { button: 0, clientY: 600 });
      fireEvent.mouseMove(window, { clientY: 720 });
      fireEvent.mouseUp(window, { clientY: 720 });

      expect(onReschedule).toHaveBeenCalledOnce();
      expect(onReschedule.mock.calls[0][1].getHours()).toBe(12);
    });

    it('shows ghost overlay with time label during drag', () => {
      const ev = makeEvent({ title: 'Day Ghost', start: d(2026,2,17,10), end: d(2026,2,17,11) });
      const { container } = render(<DayView {...dayDefaults} events={[ev]} onEventReschedule={vi.fn()} />);
      mockCol(container);
      const block = container.querySelector('.cal-day-event') as HTMLElement;

      fireEvent.mouseDown(block, { button: 0, clientY: 600 });
      fireEvent.mouseMove(window, { clientY: 720 });

      expect(container.querySelector('.cal-event-drag-ghost')).toBeInTheDocument();
      expect(container.querySelector('.cal-event-drag-label')?.textContent).toMatch(/\d+:\d+ (AM|PM)/);
    });

    it('does NOT call onEventReschedule for < 15 min drag', () => {
      const onReschedule = vi.fn();
      const ev = makeEvent({ title: 'Tiny Day', start: d(2026,2,17,10), end: d(2026,2,17,11) });
      const { container } = render(<DayView {...dayDefaults} events={[ev]} onEventReschedule={onReschedule} />);
      mockCol(container);
      const block = container.querySelector('.cal-day-event') as HTMLElement;

      fireEvent.mouseDown(block, { button: 0, clientY: 600 });
      fireEvent.mouseMove(window, { clientY: 605 }); // ~5min
      fireEvent.mouseUp(window, { clientY: 605 });

      expect(onReschedule).not.toHaveBeenCalled();
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// YEAR VIEW
// ═════════════════════════════════════════════════════════════════════════════

describe('YearView', () => {

  it('renders 12 mini-month grids', () => {
    const { container } = render(<YearView {...defaults} />);
    expect(container.querySelectorAll('.cal-mini-month')).toHaveLength(12);
  });

  it('renders all 12 month names', () => {
    render(<YearView {...defaults} />);
    ['January','February','March','April','May','June',
     'July','August','September','October','November','December']
      .forEach(m => expect(screen.getByText(m)).toBeInTheDocument());
  });

  it('marks the current month with .current-month', () => {
    const { container } = render(<YearView {...defaults} currentDate={d(2026,2,17)} />);
    const cur = container.querySelector('.cal-mini-month.current-month');
    expect(cur).toBeInTheDocument();
    expect(within(cur as HTMLElement).getByText('February')).toBeInTheDocument();
  });

  it('marks today\'s day in the current-month mini-grid with .today', () => {
    const { container } = render(<YearView {...defaults} currentDate={TODAY} />);
    const todayDay = container.querySelector('.cal-mini-month.current-month .cal-mini-day.today');
    expect(todayDay).toBeInTheDocument();
    expect(todayDay?.textContent).toBe(String(TODAY_DAY));
  });

  it('marks days with events with .has-events', () => {
    const ev = makeEvent({ title: 'Year Ev', start: d(2026,2,17,10), end: d(2026,2,17,11) });
    const { container } = render(<YearView {...defaults} events={[ev]} />);
    expect(container.querySelector('.cal-mini-day.has-events')).toBeInTheDocument();
  });

  it('calls onViewChange("month", date) when mini-month header is clicked', async () => {
    const onViewChange = vi.fn();
    const { container } = render(<YearView {...defaults} onViewChange={onViewChange} />);
    const minis = container.querySelectorAll('.cal-mini-month');
    await userEvent.click(minis[5] as HTMLElement); // June (index 5)
    expect(onViewChange).toHaveBeenCalledOnce();
    expect(onViewChange.mock.calls[0][0]).toBe('month');
    expect((onViewChange.mock.calls[0][1] as Date).getMonth()).toBe(5);
  });

  it('calls onDateClick when a mini-day is clicked', async () => {
    const onDateClick = vi.fn();
    const { container } = render(<YearView {...defaults} onDateClick={onDateClick} />);
    const febMini = container.querySelectorAll('.cal-mini-month')[1]; // Feb
    const days = febMini.querySelectorAll('.cal-mini-day');
    // Feb 2026 starts on Sunday → no leading padding; day[0] = Feb 1
    await userEvent.click(days[9] as HTMLElement); // Feb 10
    expect(onDateClick).toHaveBeenCalledOnce();
    const clickedDate = onDateClick.mock.calls[0][0] as Date;
    expect(clickedDate.getDate()).toBe(10);
    expect(clickedDate.getMonth()).toBe(1); // Feb
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SNAPSHOT — guard against structural regressions
// ═════════════════════════════════════════════════════════════════════════════

describe('Snapshots', () => {
  it('MonthView structure matches snapshot', () => {
    const events = [
      makeEvent({ id: 'snap-a', title: 'Snap A', start: d(2026,2,17,9), end: d(2026,2,17,10) }),
      makeEvent({ id: 'snap-b', title: 'Snap B', allDay: true, start: d(2026,2,20,0), end: d(2026,2,20,23,59) }),
    ];
    const { container } = render(<MonthView {...defaults} events={events} />);
    expect(container.querySelector('.cal-month-container')).toMatchSnapshot();
  });

  it('DayView (empty) structure matches snapshot', () => {
    // Pin system time so the current-time line top is deterministic,
    // and use dayDefaults (Feb 17) so currentDate matches the fake "today"
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 17, 12, 0, 0, 0)); // noon
    const { container } = render(<DayView {...dayDefaults} />);
    expect(container.querySelector('.cal-day-container')).toMatchSnapshot();
    vi.useRealTimers();
  });
});
