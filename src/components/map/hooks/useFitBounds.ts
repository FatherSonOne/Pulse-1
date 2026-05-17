// ─────────────────────────────────────────────────────────────────────────────
// useFitBounds — refits the Google Map's viewport whenever the marker set,
// meeting set, or operator position changes.
//
// Empty point set: pan to userPosition (or no-op) — refusing to fitBounds
// with one synthetic point avoids the degenerate maxZoom snap. Single point
// pans + sets zoom 13. Two or more points fitBounds with 80px padding.
//
// Side-effect only; no return value. The caller passes the mapRef (already
// owned by the host since onMapLoad sets it).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, RefObject } from 'react';
import { computeBounds } from '../../../services/mapService';

interface LatLng { lat: number; lng: number }

export function useFitBounds(
  mapRef: RefObject<google.maps.Map | null>,
  isLoaded: boolean,
  visibleMarkers: Array<{ lat: number; lng: number }>,
  meetingMarkers: Array<{ lat: number; lng: number }>,
  userPosition: LatLng | null,
): void {
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;
    const points: Array<LatLng> = [
      ...visibleMarkers.map(m => ({ lat: m.lat, lng: m.lng })),
      ...meetingMarkers.map(m => ({ lat: m.lat, lng: m.lng })),
    ];
    if (points.length === 0) {
      if (userPosition) mapRef.current.panTo(userPosition);
      return;
    }
    if (userPosition) points.push(userPosition);
    const bounds = computeBounds(points);
    if (!bounds) return;
    if (points.length === 1) {
      mapRef.current.panTo(points[0]);
      mapRef.current.setZoom(13);
      return;
    }
    mapRef.current.fitBounds(bounds, 80);
  }, [isLoaded, visibleMarkers, meetingMarkers, userPosition, mapRef]);
}
