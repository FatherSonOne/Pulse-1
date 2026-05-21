// ============================================================
// useCalendarTravelBuffers
//
// For a set of calendar events (typically one day), computes the
// driving travel time between each consecutive pair of events that
// both have a `location` and compares it to the gap in their times.
//
// Returns a Map keyed by the *later* event's id — that's the event
// where "you might be late" lives. The earlier event doesn't need a
// chip; it's the one you're departing from.
//
// Geocoding piggybacks on locationService's 30-day cache. Driving
// time comes from distanceMatrixService's DOW-7-day cache. Repeat
// renders for the same day cost zero API calls.
// ============================================================

import { useEffect, useState } from 'react';
import { CalendarEvent } from '../types';
import { geocodeAddress } from '../services/locationService';
import { getTravelTimesForPairs, MatrixCell } from '../services/distanceMatrixService';

/** Severity buckets used to choose the chip's color + copy. */
export type BufferSeverity = 'comfortable' | 'tight' | 'late';

export interface BufferInfo {
  /** Drive time between this event and the previous located event, in minutes. */
  driveMinutes: number;
  /** Wall-clock gap between previous event's end and this event's start, in minutes. */
  gapMinutes: number;
  severity: BufferSeverity;
  /** Title of the previous event (where you're coming from). */
  fromTitle: string;
}

function classify(driveMinutes: number, gapMinutes: number): BufferSeverity {
  if (driveMinutes > gapMinutes) return 'late';
  if (driveMinutes >= gapMinutes * 0.75) return 'tight';
  return 'comfortable';
}

/**
 * @returns Map<eventId, BufferInfo>. eventId is the id of the
 *   *arriving* event (the second event in each consecutive pair).
 *   Events without a preceding located event don't appear in the map.
 */
export function useCalendarTravelBuffers(
  events: CalendarEvent[],
): Map<string, BufferInfo> {
  const [buffers, setBuffers] = useState<Map<string, BufferInfo>>(new Map());

  // Build a stable key so we don't recompute on every parent render
  // when the events array is reference-new but content-equal.
  const fingerprint = events
    .filter(e => !e.allDay)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map(e => `${e.id}:${e.start.getTime()}:${e.location ?? ''}`)
    .join('|');

  useEffect(() => {
    let cancelled = false;

    const located = events
      .filter(e => !e.allDay && (e.location ?? '').trim().length > 0)
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    if (located.length < 2) {
      setBuffers(new Map());
      return;
    }

    (async () => {
      // Geocode every event's location (cached, so usually free).
      const coords = await Promise.all(
        located.map(e => geocodeAddress(e.location!).catch(() => null)),
      );
      if (cancelled) return;

      // Pair consecutive events that both have coords.
      const pairs: Array<{ from: { lat: number; lng: number }; to: { lat: number; lng: number }; day: Date; fromIdx: number; toIdx: number }> = [];
      for (let i = 0; i < located.length - 1; i++) {
        const from = coords[i];
        const to = coords[i + 1];
        if (!from || !to) continue;
        pairs.push({ from, to, day: located[i + 1].start, fromIdx: i, toIdx: i + 1 });
      }
      if (pairs.length === 0) {
        if (!cancelled) setBuffers(new Map());
        return;
      }

      const cells = await getTravelTimesForPairs(
        pairs.map(p => ({ from: p.from, to: p.to, day: p.day })),
      );
      if (cancelled) return;

      const next = new Map<string, BufferInfo>();
      pairs.forEach((p, k) => {
        const cell: MatrixCell | null = cells[k];
        if (!cell) return;
        const earlier = located[p.fromIdx];
        const arriving = located[p.toIdx];
        const gapMinutes = (arriving.start.getTime() - earlier.end.getTime()) / 60_000;
        if (gapMinutes < 0) return; // overlapping events — not our problem
        next.set(arriving.id, {
          driveMinutes: cell.minutes,
          gapMinutes: Math.round(gapMinutes),
          severity: classify(cell.minutes, gapMinutes),
          fromTitle: earlier.title,
        });
      });

      if (!cancelled) setBuffers(next);
    })();

    return () => { cancelled = true; };
    // fingerprint captures both identity and time/location changes —
    // safer than depending on the events array directly which produces
    // a new reference on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint]);

  return buffers;
}

/** Small formatter used by the chip renderer. */
export function bufferChipCopy(info: BufferInfo): string {
  if (info.severity === 'late') {
    const over = info.driveMinutes - info.gapMinutes;
    return `${info.driveMinutes} min drive · ${over} min late`;
  }
  if (info.severity === 'tight') return `${info.driveMinutes} min drive · tight`;
  return `${info.driveMinutes} min drive`;
}
