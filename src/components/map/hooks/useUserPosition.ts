// ─────────────────────────────────────────────────────────────────────────────
// useUserPosition — one-shot geolocation fetch on mount.
//
// Returns the operator's `{ lat, lng }` once the browser resolves, and flips
// `geoBlocked` to true when the failure code is PERMISSION_DENIED (1). The
// component uses `geoBlocked` to decide whether to surface the dismissable
// "share your location" banner; everything else (radius rings, FAB, route
// origin) only cares about `userPosition`.
//
// Doesn't subscribe to updates — the operator's live position is broadcast
// via location-share and consumed elsewhere. This hook is the cheap one-time
// "where am I right now" read.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { getCurrentUserLocation } from '../../../services/locationService';

export interface UserPositionState {
  userPosition: { lat: number; lng: number } | null;
  geoBlocked: boolean;
}

export function useUserPosition(): UserPositionState {
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [geoBlocked, setGeoBlocked] = useState(false);
  useEffect(() => {
    getCurrentUserLocation()
      .then(pos => setUserPosition(pos))
      .catch((err: unknown) => {
        if (
          err && typeof err === 'object' && 'code' in err &&
          (err as GeolocationPositionError).code === 1
        ) {
          setGeoBlocked(true);
        }
      });
  }, []);
  return { userPosition, geoBlocked };
}
