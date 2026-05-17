// ─────────────────────────────────────────────────────────────────────────────
// useVisitedStops — Phase 6 visited-stops feed for the AI proposal.
//
// Pulls today's geofence enter events for the operator and maps each
// matching contact-entity row to its marker key (contact-home / contact-work).
// Fed to proposeRoute as visitedIds so the model doesn't re-propose stops
// the operator already arrived at.
//
// Re-fetches whenever the active lens changes, matching the prior in-line
// implementation's dependency. The real-time geofenceNotificationService
// stream is a future hookup — current rebroadcast cadence is "on lens swap"
// because the AI proposal effect already keys on lens.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { getTodayVisitedContactStops } from '../../../services/geofenceService';
import type { MapLens } from '../sub/mapLens';

export function useVisitedStops(lens: MapLens): Set<string> {
  const [visitedStopIds, setVisitedStopIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    getTodayVisitedContactStops().then(ids => {
      if (!cancelled) setVisitedStopIds(ids);
    });
    return () => { cancelled = true; };
  }, [lens]);
  return visitedStopIds;
}
