// ============================================================
// travelBufferService — compute "Travel: 22 min to next event"
// buffers for a sequence of CalendarEvents (B4 / #35).
//
// Pipeline:
//   1. Sort events by start, drop all-day, drop events without
//      a non-virtual location (skip Zoom/Meet links).
//   2. Skip pairs with too large a gap (> 4 hr — operator presumably
//      handles those manually).
//   3. Geocode every kept location (free if cached from earlier).
//   4. Single batched Distance Matrix call for every consecutive pair.
//   5. Return one buffer entry per (from, to) pair with travel time
//      and the gap between the events.
//
// Padding settings: this codebase has no operator-configurable event
// padding setting yet (`grep eventPadding|paddingMinutes` returns
// zero). When one ships, this service should accept it and shift
// the "needsBuffer" / "tight" thresholds accordingly.
// ============================================================

import { CalendarEvent } from '../types';
import { geocodeAddress } from './locationService';
import {
  getTravelTimesForPairs,
  formatBufferTime,
  type MatrixCell,
} from './distanceMatrixService';

const MAX_PAIR_GAP_MS = 4 * 60 * 60 * 1000;
const VIRTUAL_PATTERNS = /\b(zoom\.us|meet\.google|teams\.microsoft|webex|gotomeeting|whereby|http)/i;

export interface TravelBuffer {
  fromEventId: string;
  toEventId: string;
  /** Driving travel duration. */
  travelMinutes: number;
  /** Free time between fromEvent.end and toEvent.start. Negative = overlapping. */
  gapMinutes: number;
  /** True when gapMinutes < travelMinutes — the operator can't physically make it. */
  isTight: boolean;
  /** Already-formatted "22 min" / "1 hr 5 min" — saves callers a function call. */
  travelLabel: string;
}

function isVirtualLocation(loc?: string): boolean {
  if (!loc) return true;
  return VIRTUAL_PATTERNS.test(loc);
}

/**
 * Compute travel buffers for the given events. The returned array
 * has one entry per consecutive (location, location) pair that
 * could be resolved; pairs with a virtual leg, no geocode, or a
 * matrix failure are silently dropped.
 *
 * The result is keyed for inline rendering: callers typically build
 * a `Map<fromEventId, TravelBuffer>` and look up while iterating.
 */
export async function getTravelBuffersForEvents(
  events: CalendarEvent[],
): Promise<TravelBuffer[]> {
  const candidates = [...events]
    .filter(e => !e.allDay)
    .filter(e => e.location && e.location.trim() && !isVirtualLocation(e.location))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  if (candidates.length < 2) return [];

  type Stop = { event: CalendarEvent; lat: number; lng: number };
  const stops: Stop[] = [];
  for (const ev of candidates) {
    const coords = await geocodeAddress(ev.location!);
    if (coords) stops.push({ event: ev, lat: coords.lat, lng: coords.lng });
  }

  if (stops.length < 2) return [];

  const pairs: Array<{ from: { lat: number; lng: number }; to: { lat: number; lng: number }; day: Date }> = [];
  const meta: Array<{ fromIdx: number; toIdx: number; gapMs: number }> = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const gapMs = stops[i + 1].event.start.getTime() - stops[i].event.end.getTime();
    if (gapMs > MAX_PAIR_GAP_MS) continue;
    pairs.push({
      from: { lat: stops[i].lat, lng: stops[i].lng },
      to: { lat: stops[i + 1].lat, lng: stops[i + 1].lng },
      day: stops[i + 1].event.start,
    });
    meta.push({ fromIdx: i, toIdx: i + 1, gapMs });
  }

  if (pairs.length === 0) return [];

  const cells: Array<MatrixCell | null> = await getTravelTimesForPairs(pairs);

  const buffers: TravelBuffer[] = [];
  for (let k = 0; k < cells.length; k++) {
    const cell = cells[k];
    if (!cell) continue;
    const m = meta[k];
    const gapMinutes = Math.round(m.gapMs / 60000);
    buffers.push({
      fromEventId: stops[m.fromIdx].event.id,
      toEventId: stops[m.toIdx].event.id,
      travelMinutes: cell.minutes,
      gapMinutes,
      isTight: gapMinutes < cell.minutes,
      travelLabel: formatBufferTime(cell),
    });
  }
  return buffers;
}
