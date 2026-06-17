import { describe, it, expect } from 'vitest';
import {
  parseRRule,
  computeNextDate,
  nextRecurringTask,
  recurrenceLabel,
} from '../../services/taskRecurrence';

// Local-date formatter (avoids toISOString UTC shifts so assertions are
// deterministic regardless of the test runner's timezone).
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// Local-parsed anchor (the trailing time keeps it local, not UTC date-only).
const at = (s: string) => `${s}T00:00:00`;

describe('taskRecurrence — computeNextDate', () => {
  it('DAILY → next day', () => {
    const r = nextRecurringTask('FREQ=DAILY', at('2026-06-16'))!;
    expect(ymd(r.dueDate)).toBe('2026-06-17');
  });

  it('DAILY;INTERVAL=3 → +3 days', () => {
    const r = nextRecurringTask('FREQ=DAILY;INTERVAL=3', at('2026-06-16'))!;
    expect(ymd(r.dueDate)).toBe('2026-06-19');
  });

  it('WEEKLY (no BYDAY) → +7 days', () => {
    const r = nextRecurringTask('FREQ=WEEKLY', at('2026-06-16'))!;
    expect(ymd(r.dueDate)).toBe('2026-06-23');
  });

  it('WEEKLY;INTERVAL=2 → +14 days', () => {
    const r = nextRecurringTask('FREQ=WEEKLY;INTERVAL=2', at('2026-06-16'))!;
    expect(ymd(r.dueDate)).toBe('2026-06-30');
  });

  it('WEEKLY;BYDAY=MO,WE,FR → soonest matching weekday after `after`', () => {
    const p = parseRRule('FREQ=WEEKLY;BYDAY=MO,WE,FR')!;
    const after = new Date(2026, 5, 16, 0, 0, 0); // local
    const next = computeNextDate(p, after)!;
    expect(next.getTime()).toBeGreaterThan(after.getTime());
    expect([1, 3, 5]).toContain(next.getDay());
    // No earlier matching weekday between `after` and `next`.
    for (let d = new Date(after.getTime() + 86400000); d < next; d = new Date(d.getTime() + 86400000)) {
      expect([1, 3, 5]).not.toContain(d.getDay());
    }
  });

  it('MONTHLY → same day-of-month next month', () => {
    const r = nextRecurringTask('FREQ=MONTHLY', at('2026-06-16'))!;
    expect(ymd(r.dueDate)).toBe('2026-07-16');
  });

  it('MONTHLY;BYMONTHDAY=1 → next 1st', () => {
    const r = nextRecurringTask('FREQ=MONTHLY;BYMONTHDAY=1', at('2026-06-16'))!;
    expect(ymd(r.dueDate)).toBe('2026-07-01');
  });

  it('YEARLY → same date next year', () => {
    const r = nextRecurringTask('FREQ=YEARLY', at('2026-06-16'))!;
    expect(ymd(r.dueDate)).toBe('2027-06-16');
  });
});

describe('taskRecurrence — end conditions', () => {
  it('UNTIL ends the series once the next occurrence passes it', () => {
    expect(nextRecurringTask('FREQ=DAILY;UNTIL=20260616', at('2026-06-16'))).toBeNull();
    const r = nextRecurringTask('FREQ=DAILY;UNTIL=20260620', at('2026-06-16'))!;
    expect(ymd(r.dueDate)).toBe('2026-06-17');
  });

  it('COUNT decrements on spawn and ends at the last instance', () => {
    const r = nextRecurringTask('FREQ=DAILY;COUNT=3', at('2026-06-16'))!;
    expect(r.nextRule).toContain('COUNT=2');
    expect(nextRecurringTask('FREQ=DAILY;COUNT=1', at('2026-06-16'))).toBeNull();
  });

  it('invalid / empty rules → null', () => {
    expect(nextRecurringTask('FREQ=NONSENSE', at('2026-06-16'))).toBeNull();
    expect(parseRRule('')).toBeNull();
    expect(parseRRule('INTERVAL=2')).toBeNull(); // no FREQ
  });
});

describe('taskRecurrence — recurrenceLabel', () => {
  it('formats common rules', () => {
    expect(recurrenceLabel('FREQ=DAILY')).toBe('Repeats daily');
    expect(recurrenceLabel('FREQ=WEEKLY')).toBe('Repeats weekly');
    expect(recurrenceLabel('FREQ=WEEKLY;INTERVAL=2')).toBe('Repeats every 2 weeks');
    expect(recurrenceLabel(null)).toBeNull();
  });
});
