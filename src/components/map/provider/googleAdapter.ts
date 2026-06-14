// ─────────────────────────────────────────────────────────────────────────────
// googleAdapter — MapProviderApi backed by a google.maps.Map (P1a).
//
// Wraps the existing imperative camera calls 1:1 so the Google render path is
// behaviorally unchanged; useFitBounds (and later consumers) talk to the
// MapProviderApi instead of touching google.maps.* directly.
//
// The adapter holds no map reference of its own — it reads it lazily via
// `getMap()` at call time, so a single stable adapter instance keeps working
// across the map's load lifecycle (the host's mapRef is set in onMapLoad after
// the adapter is created). Every method no-ops when the map isn't ready yet.
// ─────────────────────────────────────────────────────────────────────────────

import { computeBounds } from '../../../services/mapService';
import type { LatLng, MapPadding, MapProviderApi } from './types';

export function createGoogleMapAdapter(
  getMap: () => google.maps.Map | null,
): MapProviderApi {
  return {
    fitBounds(points: LatLng[], padding: MapPadding) {
      const map = getMap();
      if (!map) return;
      // computeBounds builds the google.maps.LatLngBounds; keeping that here
      // (not in the host) is exactly the Google-specific detail the boundary
      // exists to hide.
      const bounds = computeBounds(points);
      if (!bounds) return;
      map.fitBounds(bounds, padding);
    },

    panTo(point: LatLng) {
      getMap()?.panTo(point);
    },

    setZoom(zoom: number) {
      getMap()?.setZoom(zoom);
    },

    getZoom() {
      return getMap()?.getZoom();
    },

    onIdleOnce(cb: () => void) {
      const map = getMap();
      if (!map) return () => {};
      const listener = google.maps.event.addListenerOnce(map, 'idle', cb);
      return () => google.maps.event.removeListener(listener);
    },
  };
}
