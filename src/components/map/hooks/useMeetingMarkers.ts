// ─────────────────────────────────────────────────────────────────────────────
// useMeetingMarkers — geocodes the location text on calendar events lazily.
//
// The geocode cache dedupes across runs so re-renders are cheap. Events
// without a location string are skipped (no marker, but they still count
// toward lensIncludesContact via attendees). Failed geocodes are recorded
// in a ref so we don't retry in a loop.
//
// Source events flip between today's and this-week's set based on the
// active lens. Atlas doesn't render meeting markers, but the hook still
// returns the most recent slice so a lens swap back doesn't have to
// refetch from scratch.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import type { CalendarEvent } from '../../../types';
import { geocodeAddress } from '../../../services/locationService';
import type { MapLens } from '../sub/mapLens';

export type MeetingMarkerData = { event: CalendarEvent; lat: number; lng: number };

export function useMeetingMarkers(
  lens: MapLens,
  todayEvents: CalendarEvent[],
  weekEvents: CalendarEvent[],
): MeetingMarkerData[] {
  const [meetingMarkers, setMeetingMarkers] = useState<MeetingMarkerData[]>([]);
  const geocodedEventsRef = useRef<Map<string, { lat: number; lng: number } | null>>(new Map());
  useEffect(() => {
    const sourceEvents = lens === 'today' ? todayEvents : weekEvents;
    const eventsToTry = sourceEvents.filter(e => !!e.location?.trim());
    if (eventsToTry.length === 0) {
      if (meetingMarkers.length > 0) setMeetingMarkers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const next: MeetingMarkerData[] = [];
      for (const e of eventsToTry) {
        const cached = geocodedEventsRef.current.get(e.id);
        if (cached === null) continue; // known-failed
        let coords = cached;
        if (!coords) {
          const result = await geocodeAddress(e.location!).catch(() => null);
          geocodedEventsRef.current.set(e.id, result);
          if (!result) continue;
          coords = result;
        }
        next.push({ event: e, lat: coords.lat, lng: coords.lng });
      }
      if (!cancelled) setMeetingMarkers(next);
    })();
    return () => { cancelled = true; };
    // meetingMarkers intentionally NOT in deps — setting it inside the effect
    // would loop. Re-evaluation triggers on real input changes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lens, todayEvents, weekEvents]);

  return meetingMarkers;
}
