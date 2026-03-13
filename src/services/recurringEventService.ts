/**
 * recurringEventService.ts
 *
 * Expands recurring calendar events (stored as a single DB row with an RRULE string)
 * into virtual instances for a given date range.  Virtual instances are never persisted —
 * they are generated on the client each time the calendar fetches events.
 *
 * RRULE subset supported (RFC 5545):
 *   FREQ=DAILY | WEEKLY | MONTHLY | YEARLY
 *   INTERVAL=N
 *   COUNT=N
 *   UNTIL=YYYYMMDD
 *   BYDAY=MO,TU,WE,TH,FR,SA,SU   (WEEKLY only)
 *   BYMONTHDAY=N                  (MONTHLY only)
 */

import { supabase } from './supabase';
import { CalendarEvent } from '../types';

// ── RRULE parsing ────────────────────────────────────────────────────────────

const DAY_INDEX: Record<string, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
};

interface ParsedRRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  count?: number;
  until?: Date;
  byDay?: number[];      // 0 = Sunday … 6 = Saturday
  byMonthDay?: number;   // day-of-month for MONTHLY
}

function parseRRule(rule: string): ParsedRRule | null {
  const parts: Record<string, string> = {};
  rule.split(';').forEach(segment => {
    const [k, v] = segment.split('=');
    if (k && v !== undefined) parts[k.toUpperCase()] = v.toUpperCase();
  });

  const freq = parts['FREQ'] as ParsedRRule['freq'];
  if (!freq || !['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return null;

  const parsed: ParsedRRule = {
    freq,
    interval: parts['INTERVAL'] ? parseInt(parts['INTERVAL'], 10) : 1,
  };

  if (parts['COUNT']) parsed.count = parseInt(parts['COUNT'], 10);
  if (parts['UNTIL']) {
    const u = parts['UNTIL'];
    // Support both YYYYMMDD and YYYYMMDDTHHMMSSZ
    parsed.until = new Date(`${u.slice(0, 4)}-${u.slice(4, 6)}-${u.slice(6, 8)}`);
  }
  if (parts['BYDAY']) {
    parsed.byDay = parts['BYDAY'].split(',').map(d => DAY_INDEX[d.replace(/[+-\d]/g, '')] ?? -1).filter(d => d >= 0);
  }
  if (parts['BYMONTHDAY']) {
    parsed.byMonthDay = parseInt(parts['BYMONTHDAY'], 10);
  }

  return parsed;
}

// ── Date helpers ─────────────────────────────────────────────────────────────

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

function addYears(d: Date, n: number): Date {
  const r = new Date(d);
  r.setFullYear(r.getFullYear() + n);
  return r;
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

// ── Virtual instance factory ─────────────────────────────────────────────────

function makeInstance(parent: CalendarEvent, date: Date): CalendarEvent {
  const parentStart = new Date(parent.start_time ?? parent.date ?? '');
  const parentEnd   = new Date(parent.end_time   ?? parentStart);
  const durationMs  = parentEnd.getTime() - parentStart.getTime();

  const instanceStart = new Date(date);
  instanceStart.setHours(parentStart.getHours(), parentStart.getMinutes(), 0, 0);
  const instanceEnd   = new Date(instanceStart.getTime() + durationMs);

  return {
    ...parent,
    id: `${parent.id}-${isoDate(date)}`,
    date: isoDate(date),
    start_time: instanceStart.toISOString(),
    end_time:   instanceEnd.toISOString(),
    recurrence_parent_id: parent.id,
    is_recurring_exception: false,
  } as CalendarEvent;
}

// ── Core expansion function ──────────────────────────────────────────────────

/**
 * Expands a single recurring event into concrete instances within [rangeStart, rangeEnd].
 * Skips dates that have an exception row (is_recurring_exception = true) for this parent.
 *
 * @param event       The parent recurring event (must have recurrence_rule set)
 * @param rangeStart  Start of the display window (inclusive)
 * @param rangeEnd    End of the display window (inclusive)
 * @param exceptions  Array of exception dates (ISO strings) to skip
 */
export function expandRecurringEvent(
  event: CalendarEvent,
  rangeStart: Date,
  rangeEnd: Date,
  exceptions: Set<string> = new Set(),
): CalendarEvent[] {
  if (!event.recurrence_rule) return [event];

  const parsed = parseRRule(event.recurrence_rule);
  if (!parsed) return [event];

  const eventStart = new Date(event.start_time ?? event.date ?? '');
  if (isNaN(eventStart.getTime())) return [event];

  const results: CalendarEvent[] = [];
  let occurrenceCount = 0;
  const maxOccurrences = parsed.count ?? 500; // safety cap
  const hardEnd = parsed.until ?? rangeEnd;

  // Cursor starts at the event's original date (may be before rangeStart)
  let cursor = new Date(eventStart);
  cursor.setHours(0, 0, 0, 0);

  const windowEnd = hardEnd < rangeEnd ? hardEnd : rangeEnd;

  while (cursor <= windowEnd && occurrenceCount < maxOccurrences) {
    const cursorKey = isoDate(cursor);

    // Check if cursor falls within display window
    if (cursor >= rangeStart && !exceptions.has(cursorKey)) {
      // For WEEKLY with BYDAY, only emit matching days
      if (parsed.freq === 'WEEKLY' && parsed.byDay && parsed.byDay.length > 0) {
        if (parsed.byDay.includes(cursor.getDay())) {
          results.push(makeInstance(event, cursor));
          occurrenceCount++;
        }
      } else {
        results.push(makeInstance(event, cursor));
        occurrenceCount++;
      }
    } else if (parsed.freq === 'WEEKLY' && parsed.byDay && parsed.byDay.length > 0) {
      // Still need to count toward BYDAY matches even if out of display window
      if (parsed.byDay.includes(cursor.getDay())) {
        occurrenceCount++;
      }
    } else if (cursor < rangeStart) {
      // Count occurrences before the window so COUNT is accurate
      occurrenceCount++;
    }

    // Advance cursor
    switch (parsed.freq) {
      case 'DAILY':
        cursor = addDays(cursor, parsed.interval);
        break;
      case 'WEEKLY':
        cursor = addDays(cursor, parsed.byDay && parsed.byDay.length > 1 ? 1 : 7 * parsed.interval);
        break;
      case 'MONTHLY':
        cursor = addMonths(cursor, parsed.interval);
        break;
      case 'YEARLY':
        cursor = addYears(cursor, parsed.interval);
        break;
    }
  }

  return results;
}

// ── Exception management ─────────────────────────────────────────────────────

/**
 * Creates or updates an exception row for a specific occurrence of a recurring event.
 * Used when the user edits "just this event".
 */
export async function createRecurringException(
  parentId: string,
  date: Date,
  changes: Partial<CalendarEvent>,
): Promise<void> {
  const parent = await getEventById(parentId);
  if (!parent) throw new Error(`Parent event ${parentId} not found`);

  const instanceStart = new Date(date);
  const parentStart   = new Date(parent.start_time ?? parent.date ?? '');
  instanceStart.setHours(parentStart.getHours(), parentStart.getMinutes(), 0, 0);

  const parentEnd  = new Date(parent.end_time ?? instanceStart);
  const durationMs = parentEnd.getTime() - new Date(parent.start_time ?? '').getTime();
  const instanceEnd = new Date(instanceStart.getTime() + durationMs);

  const { error } = await supabase
    .from('calendar_events')
    .upsert({
      ...parent,
      ...changes,
      id: `${parentId}-exc-${isoDate(date)}`,
      date:                 isoDate(date),
      start_time:           instanceStart.toISOString(),
      end_time:             instanceEnd.toISOString(),
      recurrence_parent_id: parentId,
      is_recurring_exception: true,
      recurrence_rule:      null, // exceptions are single occurrences
    } as CalendarEvent, { onConflict: 'id' });

  if (error) throw error;
}

/**
 * Deletes a recurring instance or range of instances.
 *
 * scope:
 *   'this'              — soft-delete this one occurrence (create a blank exception)
 *   'this_and_following' — shorten the parent UNTIL to the day before + delete forward exceptions
 *   'all'              — delete the parent (CASCADE removes all exceptions too)
 */
export async function deleteRecurringInstance(
  parentId: string,
  date: Date,
  scope: 'this' | 'this_and_following' | 'all',
): Promise<void> {
  if (scope === 'all') {
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', parentId);
    if (error) throw error;
    return;
  }

  if (scope === 'this_and_following') {
    const dayBefore = addDays(date, -1);
    const untilStr  = isoDate(dayBefore).replace(/-/g, '');

    // Shorten the parent series
    const parent = await getEventById(parentId);
    if (!parent) throw new Error(`Parent event ${parentId} not found`);

    const existingRule = parent.recurrence_rule ?? '';
    const newRule = existingRule.includes('UNTIL=')
      ? existingRule.replace(/UNTIL=[^;]+/, `UNTIL=${untilStr}`)
      : `${existingRule};UNTIL=${untilStr}`;

    const { error: updateError } = await supabase
      .from('calendar_events')
      .update({ recurrence_rule: newRule, recurrence_end: isoDate(dayBefore) })
      .eq('id', parentId);
    if (updateError) throw updateError;

    // Delete any forward exceptions
    const { error: delError } = await supabase
      .from('calendar_events')
      .delete()
      .eq('recurrence_parent_id', parentId)
      .gte('date', isoDate(date));
    if (delError) throw delError;
    return;
  }

  // scope === 'this': create a blank exception (marks this date as deleted)
  await createRecurringException(parentId, date, { deleted_at: new Date().toISOString() } as Partial<CalendarEvent>);
}

// ── Helper ───────────────────────────────────────────────────────────────────

async function getEventById(id: string): Promise<CalendarEvent | null> {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as CalendarEvent;
}

/**
 * Fetches exception dates for a given parent event.
 * Returns a Set<string> of ISO date strings (YYYY-MM-DD).
 */
export async function getExceptionDates(parentId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('calendar_events')
    .select('date')
    .eq('recurrence_parent_id', parentId)
    .eq('is_recurring_exception', true);

  return new Set((data ?? []).map((r: { date: string }) => r.date));
}
