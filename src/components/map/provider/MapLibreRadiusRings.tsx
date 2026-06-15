// ─────────────────────────────────────────────────────────────────────────────
// MapLibreRadiusRings — the "you are here" overlay on MapLibre (P2 hybrid).
// MapLibre equivalent of the Google MapRadiusRings (<Circle> rings + OverlayView
// labels + OverlayView user dot).
//
// Hybrid split:
//  - the geographic proximity rings → GeoJSON fill + line layers (circle
//    polygons, since MapLibre's circle layer is pixel-sized, not metric);
//  - the user-position dot + the ring labels → projected portals (exact DOM
//    reuse, pixel-faithful), via MapMarkerPortal.
//
// Type-only maplibre import → no runtime dep, no bundle cost.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo } from 'react';
import type { Map as MaplibreMap, GeoJSONSource, LayerSpecification } from 'maplibre-gl';
import { RADIUS_RINGS, MILES_TO_METERS, LIVE_LOCATION_COLOR } from '../../../services/mapService';
import { MapMarkerPortal } from './MapMarkerPortal';

const RINGS_SOURCE = 'pulse-radius-rings';
const RINGS_FILL = 'pulse-radius-rings-fill';
const RINGS_LINE = 'pulse-radius-rings-line';

const RING_STEPS = 64;
const EARTH_RADIUS_M = 6378137;

// Equirectangular circle ring (same approach as the Atlas halos). Good enough
// at city scale; no geodesic precision needed for proximity rings.
function circleRing(lat: number, lng: number, radiusM: number): number[][] {
  const dLat = (radiusM / EARTH_RADIUS_M) * (180 / Math.PI);
  const dLng = (radiusM / (EARTH_RADIUS_M * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
  const ring: number[][] = [];
  for (let i = 0; i <= RING_STEPS; i++) {
    const theta = (i / RING_STEPS) * 2 * Math.PI;
    ring.push([lng + dLng * Math.cos(theta), lat + dLat * Math.sin(theta)]);
  }
  return ring;
}

export interface MapLibreRadiusRingsProps {
  map: MaplibreMap | null;
  center: { lat: number; lng: number };
  isDarkMode: boolean;
}

export function MapLibreRadiusRings({ map, center, isDarkMode }: MapLibreRadiusRingsProps) {
  const ringsData = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: RADIUS_RINGS.map(ring => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [circleRing(center.lat, center.lng, ring.radiusMiles * MILES_TO_METERS)],
        },
        properties: { strokeColor: ring.strokeColor, fillColor: ring.fillColor },
      })),
    }),
    [center],
  );

  // Ring fill + stroke layers. isDarkMode tunes the opacities (constant per
  // theme), so the layers are rebuilt on theme flip.
  useEffect(() => {
    if (!map) return;
    const fillLayer: LayerSpecification = {
      id: RINGS_FILL,
      type: 'fill',
      source: RINGS_SOURCE,
      paint: {
        'fill-color': ['get', 'fillColor'],
        'fill-opacity': isDarkMode ? 0.04 : 0.03,
      },
    };
    const lineLayer: LayerSpecification = {
      id: RINGS_LINE,
      type: 'line',
      source: RINGS_SOURCE,
      paint: {
        'line-color': ['get', 'strokeColor'],
        'line-opacity': isDarkMode ? 0.5 : 0.4,
        'line-width': 1.5,
      },
    };
    try {
      if (!map.getSource(RINGS_SOURCE)) {
        map.addSource(RINGS_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      }
      if (!map.getLayer(RINGS_FILL)) map.addLayer(fillLayer);
      if (!map.getLayer(RINGS_LINE)) map.addLayer(lineLayer);
    } catch {
      // Style not ready / map torn down.
    }
    return () => {
      try {
        if (map.getLayer(RINGS_LINE)) map.removeLayer(RINGS_LINE);
        if (map.getLayer(RINGS_FILL)) map.removeLayer(RINGS_FILL);
        if (map.getSource(RINGS_SOURCE)) map.removeSource(RINGS_SOURCE);
      } catch {
        // Map already removed on toggle-off.
      }
    };
  }, [map, isDarkMode]);

  useEffect(() => {
    if (!map) return;
    try {
      const src = map.getSource(RINGS_SOURCE) as GeoJSONSource | undefined;
      if (src) src.setData(ringsData);
    } catch {
      // Source not ready yet.
    }
  }, [map, ringsData]);

  // Dot + labels stay as projected portals — pixel-faithful DOM reuse.
  return (
    <>
      {/* User position dot — solid, no perpetual ping (motion is for state). */}
      <MapMarkerPortal map={map} lat={center.lat} lng={center.lng}>
        <div className="relative" style={{ transform: 'translate(-50%, -50%)' }}>
          <div
            className="rounded-full"
            style={{
              width: 14,
              height: 14,
              backgroundColor: LIVE_LOCATION_COLOR,
              boxShadow: '0 0 0 2px #fafafa, 0 2px 6px rgba(0,0,0,0.30)',
            }}
          />
        </div>
      </MapMarkerPortal>

      {RADIUS_RINGS.map(ring => (
        <MapMarkerPortal
          key={ring.radiusMiles}
          map={map}
          lat={center.lat}
          lng={center.lng + ring.radiusMiles / 55 /* rough offset east, matches Google */}
        >
          <div
            className="text-xs font-semibold pointer-events-none select-none px-1.5 py-0.5 rounded"
            style={{
              color: ring.strokeColor,
              background: isDarkMode ? 'rgba(15,23,42,0.7)' : 'rgba(255,255,255,0.8)',
              border: `1px solid ${ring.strokeColor}44`,
              transform: 'translateY(-50%)',
              whiteSpace: 'nowrap',
            }}
          >
            {ring.label}
          </div>
        </MapMarkerPortal>
      ))}
    </>
  );
}
