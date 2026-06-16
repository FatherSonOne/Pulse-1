// ─────────────────────────────────────────────────────────────────────────────
// MapLibreGeofenceRings — Direction D (Horizon, P9) all-geofences ring overlay.
//
// Draws one coral ring per geofenced place (places where geofence_radius_m IS
// NOT NULL) as a GeoJSON fill + line layer. MapLibre's `circle` layer radius is
// in SCREEN PIXELS, not metres, so — exactly like MapLibreAtlasHalos — each ring
// is an equirectangular circle POLYGON whose radius stays geographic (grows/
// shrinks with zoom, matching the true geofence radius).
//
// Coral stroke: geofence rings are a live/route SIGNAL surface, within the coral
// budget (CLAUDE.md §4) — unlike neutral chrome.
//
// Null-rendering layer manager; type-only maplibre import → no runtime dep.
// Mounted by PulseMapView keyed on styleEpoch so a theme setStyle() (which clears
// sources/layers) re-adds it onto the fresh style.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo } from 'react';
import type { Map as MaplibreMap, GeoJSONSource, LayerSpecification } from 'maplibre-gl';

const SOURCE_ID = 'pulse-geofence-rings';
const FILL_LAYER_ID = 'pulse-geofence-rings-fill';
const LINE_LAYER_ID = 'pulse-geofence-rings-line';

const RING_COLOR = '#f43f5e';
// Higher vertex count than halos (40) so true geofence boundaries read crisply
// at any zoom — still cheap for the handful of geofences a user sets.
const RING_STEPS = 64;
const EARTH_RADIUS_M = 6378137;

export interface GeofenceRingPlace {
  id: string;
  lat: number;
  lng: number;
  geofenceRadiusM: number;
  name?: string | null;
}

// Equirectangular circle ring around a lat/lng at a metre radius. Mirrors
// MapLibreAtlasHalos.circleRing — good enough at city scale (no geodesic
// precision needed for a few-hundred-metre-to-few-km geofence).
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

function buildData(places: GeofenceRingPlace[]) {
  const features = places
    .filter(p => p.geofenceRadiusM > 0 && Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map(p => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [circleRing(p.lat, p.lng, p.geofenceRadiusM)],
      },
      properties: { placeId: p.id },
    }));
  return { type: 'FeatureCollection' as const, features };
}

export interface MapLibreGeofenceRingsProps {
  map: MaplibreMap | null;
  places: GeofenceRingPlace[];
}

export function MapLibreGeofenceRings({ map, places }: MapLibreGeofenceRingsProps) {
  const data = useMemo(() => buildData(places), [places]);

  useEffect(() => {
    if (!map) return;
    const fillLayer: LayerSpecification = {
      id: FILL_LAYER_ID,
      type: 'fill',
      source: SOURCE_ID,
      paint: { 'fill-color': RING_COLOR, 'fill-opacity': 0.06 },
    };
    const lineLayer: LayerSpecification = {
      id: LINE_LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      paint: { 'line-color': RING_COLOR, 'line-opacity': 0.55, 'line-width': 1.5 },
    };
    try {
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      }
      if (!map.getLayer(FILL_LAYER_ID)) map.addLayer(fillLayer);
      if (!map.getLayer(LINE_LAYER_ID)) map.addLayer(lineLayer);
    } catch {
      // Style not ready / map torn down.
    }
    return () => {
      try {
        if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
        if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        // Map already removed on toggle-off.
      }
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    try {
      const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (src) src.setData(data);
    } catch {
      // Source not ready yet — the add effect seeds it.
    }
  }, [map, data]);

  return null;
}
