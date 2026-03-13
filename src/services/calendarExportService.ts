/**
 * calendarExportService.ts
 *
 * Generates RFC 5545 iCalendar (.ics) files from calendar events.
 * No external dependencies — pure string generation.
 */

import { CalendarEvent } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format a Date as iCal DTSTART/DTEND string (UTC). */
function toICalDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace('.000', '');
}

/** Fold long lines per RFC 5545 §3.1 (max 75 octets, continuation = CRLF + SPACE). */
function fold(line: string): string {
  const chunks: string[] = [];
  while (line.length > 75) {
    chunks.push(line.slice(0, 75));
    line = ' ' + line.slice(75);
  }
  chunks.push(line);
  return chunks.join('\r\n');
}

/** Escape special characters in TEXT values. */
function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// ── Core export ───────────────────────────────────────────────────────────────

function eventToVEvent(event: CalendarEvent): string {
  const lines: string[] = [];
  lines.push('BEGIN:VEVENT');
  lines.push(`UID:${event.id}@pulse`);

  const startDate = event.start instanceof Date ? event.start : new Date(event.start);
  const endDate   = event.end   instanceof Date ? event.end   : new Date(event.end);

  if (event.allDay) {
    const dateStr = startDate.toISOString().slice(0, 10).replace(/-/g, '');
    lines.push(`DTSTART;VALUE=DATE:${dateStr}`);
    lines.push(`DTEND;VALUE=DATE:${dateStr}`);
  } else {
    lines.push(`DTSTART:${toICalDate(startDate)}`);
    lines.push(`DTEND:${toICalDate(endDate)}`);
  }

  lines.push(fold(`SUMMARY:${escapeText(event.title)}`));

  if (event.description) {
    lines.push(fold(`DESCRIPTION:${escapeText(event.description)}`));
  }
  if (event.location) {
    lines.push(fold(`LOCATION:${escapeText(event.location)}`));
  }
  if (event.recurrence && event.recurrence.length > 0) {
    // Google-style recurrence array; first entry is usually the RRULE string
    lines.push(event.recurrence[0]);
  }

  lines.push(`DTSTAMP:${toICalDate(new Date())}`);
  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

export function exportToICS(events: CalendarEvent[]): string {
  const calLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pulse//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events.map(eventToVEvent),
    'END:VCALENDAR',
  ];
  return calLines.join('\r\n');
}

export function downloadICS(events: CalendarEvent[], filename = 'pulse-calendar.ics'): void {
  const content = exportToICS(events);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Export a single event as a .ics download. */
export function downloadSingleEventICS(event: CalendarEvent): void {
  const safe = event.title.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  downloadICS([event], `${safe}.ics`);
}
