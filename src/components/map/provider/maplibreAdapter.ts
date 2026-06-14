// ─────────────────────────────────────────────────────────────────────────────
// maplibreAdapter — MapProviderApi backed by a maplibre-gl Map (P1c spike).
//
// Implements the SAME camera surface as googleAdapter so useFitBounds can drive
// either renderer unchanged. This is the proof that the P1a boundary holds
// against a real second renderer.
//
// Deliberately uses a TYPE-ONLY maplibre-gl import + a hand-rolled bounding box
// (LngLatBoundsLike accepts a [[w,s],[e,n]] array) so this module carries NO
// runtime maplibre-gl dependency — it can be statically imported without
// pulling maplibre-gl into the Google-path bundle. The actual maplibre-gl
// runtime lives only in the lazy-loaded MapLibreCanvas.
// ─────────────────────────────────────────────────────────────────────────────

import type { Map as MaplibreMap } from 'maplibre-gl';
import type { LatLng, MapPadding, MapProviderApi } from './types';

export function createMapLibreAdapter(getMap: () => MaplibreMap | null): MapProviderApi {
  return {
    fitBounds(points: LatLng[], padding: MapPadding) {
      const map = getMap();
      if (!map || points.length === 0) return;
      let minLng = points[0].lng;
      let maxLng = points[0].lng;
      let minLat = points[0].lat;
      let maxLat = points[0].lat;
      for (const p of points) {
        if (p.lng < minLng) minLng = p.lng;
        if (p.lng > maxLng) maxLng = p.lng;
        if (p.lat < minLat) minLat = p.lat;
        if (p.lat > maxLat) maxLat = p.lat;
      }
      map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding, animate: true });
    },

    panTo(point: LatLng) {
      getMap()?.panTo([point.lng, point.lat]);
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
      map.once('idle', cb);
      return () => {
        map.off('idle', cb);
      };
    },
  };
}
