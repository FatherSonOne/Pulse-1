/**
 * taskRecurrence.ts
 *
 * RFC-5545 RRULE engine for recurring TASKS. Unlike calendar events (which expand
 * a rule into many virtual instances across a window — see recurringEventService),
 * a recurring task regenerates ONE next occurrence when the current one is
 * completed. This module computes that next occurrence and carries the rule
 * forward (decrementing COUNT, honoring UNTIL).
 *
 * Supported RRULE subset (mirrors recurringEventService):
 *   FREQ=DAILY | WEEKLY | MONTHLY | YEARLY
 *   INTERVAL=N
 *   COUNT=N            (decremented per spawn; series ends when it would reach 0)
 *   UNTIL=YYYYMMDD     (series ends once the next occurrence passes this date)
 *   BYDAY=MO,TU,...    (WEEKLY)
 *   BYMONTHDAY=N       (MONTHLY)
 *
 * Pure functions only — no I/O — so the date math is exhaustively unit-tested.
 */

const DAY_INDEX: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

export interface ParsedRRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  count?: number;
  until?: Date;
  byDay?: number[]; // 0=Sun … 6=Sat
  byMonthDay?: number;
}

export function parseRRule(rule: string): ParsedRRule | null {
  if (!rule) return null;
  const parts: Record<string, string> = {};
  rule.split(';').forEach((seg) => {
    const [k, v] = seg.split('=');
    if (k && v !== undefined) parts[k.toUpperCase()] = v.toUpperCase();
  });

  const freq = parts['FREQ'] as ParsedRRule['freq'];
  if (!freq || !['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return null;

  const p: ParsedRRule = {
    freq,
    interval: parts['INTERVAL'] ? Math.max(1, parseInt(parts['INTERVAL'], 10)) : 1,
  };
  if (parts['COUNT']) p.count = parseInt(parts['COUNT'], 10);
  if (parts['UNTIL']) {
    const u = parts['UNTIL'];
    p.until = new Date(`${u.slice(0, 4)}-${u.slice(4, 6)}-${u.slice(6, 8)}T00:00:00`);
  }
  if (parts['BYDAY']) {
    p.byDay = parts['BYDAY']
      .split(',')
      .map((d) => DAY_INDEX[d.replace(/[+\-\d]/g, '')] ?? -1)
      .filter((d) => d >= 0);
  }
  if (parts['BYMONTHDAY']) p.byMonthDay = parseInt(parts['BYMONTHDAY'], 10);
  return p;
}

// ── date helpers (date-only, local) ──────────────────────────────────────────
function startOfDay(d: Date): Date { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; }
function addDays(d: Date, n: number): Date { const r = startOfDay(d); r.setDate(r.getDate() + n); return r; }
function startOfWeek(d: Date): Date { const r = startOfDay(d); r.setDate(r.getDate() - r.getDay()); return r; } // Sunday
function dayDiff(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}
function monthDiff(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function matches(p: ParsedRRule, d: Date, after: Date, anchorWeek: Date): boolean {
  switch (p.freq) {
    case 'DAILY':
      return dayDiff(after, d) % p.interval === 0;
    case 'WEEKLY':
      if (p.byDay && p.byDay.length) {
        if (!p.byDay.includes(d.getDay())) return false;
        const weekDiff = Math.floor(dayDiff(anchorWeek, startOfWeek(d)) / 7);
        return weekDiff % p.interval === 0;
      }
      return dayDiff(after, d) % (7 * p.interval) === 0;
    case 'MONTHLY':
      if (p.byMonthDay) {
        if (d.getDate() !== p.byMonthDay) return false;
        return monthDiff(after, d) % p.interval === 0;
      }
      return d.getDate() === after.getDate() && monthDiff(after, d) % p.interval === 0;
    case 'YEARLY':
      return (
        d.getDate() === after.getDate() &&
        d.getMonth() === after.getMonth() &&
        (d.getFullYear() - after.getFullYear()) % p.interval === 0
      );
  }
}

/**
 * The next occurrence strictly after `after`, per the pattern. Applies neither
 * COUNT nor UNTIL (the caller does). Returns null if nothing matches within a
 * 5-year safety horizon (e.g. an impossible BYMONTHDAY).
 */
export function computeNextDate(p: ParsedRRule, after: Date): Date | null {
  const anchorWeek = startOfWeek(after);
  const cap = addDays(after, 366 * 5);
  let cursor = addDays(after, 1);
  while (cursor <= cap) {
    if (matches(p, cursor, after, anchorWeek)) return cursor;
    cursor = addDays(cursor, 1);
  }
  return null;
}

function setCount(rule: string, n: number): string {
  return rule.replace(/COUNT=\d+/i, `COUNT=${n}`);
}

export interface NextTaskOccurrence {
  /** Due date for the regenerated task (date-only, local midnight). */
  dueDate: Date;
  /** Rule to store on the regenerated task (COUNT decremented if present). */
  nextRule: string;
}

/**
 * Given a recurring task's rule and the occurrence just completed (its deadline,
 * or now if it had none), returns the next occurrence to spawn — or null when the
 * series has ended (COUNT exhausted or next occurrence past UNTIL).
 */
export function nextRecurringTask(rule: string, afterISO: string | undefined | null): NextTaskOccurrence | null {
  const p = parseRRule(rule);
  if (!p) return null;
  const after = afterISO ? new Date(afterISO) : new Date();
  if (isNaN(after.getTime())) return null;

  // COUNT counts total occurrences; the current one is the last when count <= 1.
  if (p.count !== undefined && p.count <= 1) return null;

  const next = computeNextDate(p, after);
  if (!next) return null;
  if (p.until && startOfDay(next).getTime() > startOfDay(p.until).getTime()) return null;

  const nextRule = p.count !== undefined ? setCount(rule, p.count - 1) : rule;
  return { dueDate: next, nextRule };
}

/** Short human label for a rule, e.g. "Repeats weekly". For chips/indicators. */
export function recurrenceLabel(rule: string | null | undefined): string | null {
  if (!rule) return null;
  const p = parseRRule(rule);
  if (!p) return null;
  const unit = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', YEARLY: 'year' }[p.freq];
  if (p.interval === 1) return `Repeats ${({ DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', YEARLY: 'yearly' } as const)[p.freq]}`;
  return `Repeats every ${p.interval} ${unit}s`;
}
