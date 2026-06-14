// ─────────────────────────────────────────────────────────────────────────────
// MapLibreAtlasHalos — Atlas density halos as a MapLibre GeoJSON fill layer
// (P2 geometry). MapLibre equivalent of the Google AtlasHalos
// (@react-google-maps/api <Circle> per pinned point).
//
// Critical difference vs Google: MapLibre's `circle` layer radius is in SCREEN
// PIXELS, not metres, so it can't reproduce Google's geographic ~1km halos that
// scale with zoom. We instead approximate each halo as a small circle POLYGON
// (equirectangular ring) so the radius stays geographic — overlapping rings sum
// optically into the same soft heat-map feel.
//
// Mirrors AtlasHalos: pulse-linked / team members get a stronger 1.2km / 0.09
// halo; everyone else 1km / 0.06. Per-feature opacity is data-driven.
//
// Null-rendering layer manager; type-only maplibre import → no runtime dep.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo } from 'react';
import type { Map as MaplibreMap, GeoJSONSource, LayerSpecification } from 'maplibre-gl';
import type { Contact } from '../../../types';

const SOURCE_ID = 'pulse-atlas-halos';
const FILL_LAYER_ID = 'pulse-atlas-halos-fill';

const HALO_COLOR = '#f43f5e';
// Vertex count per halo ring — enough for a soft round blob, cheap enough for
// hundreds of pins.
const RING_STEPS = 40;
const EARTH_RADIUS_M = 6378137;

// Equirectangular circle ring around a lat/lng at a metre radius. Good enough
// for soft halos at city scale (no geodesic precision needed).
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

function buildData(contacts: Contact[]) {
  const features = contacts.flatMap(c => {
    const strong = Boolean(c.pulseUserId || c.isTeamMember);
    const opacity = strong ? 0.09 : 0.06;
    const radiusM = strong ? 1200 : 1000;
    const out: Array<{
      type: 'Feature';
      geometry: { type: 'Polygon'; coordinates: number[][][] };
      properties: { opacity: number };
    }> = [];
    if (c.homeLat != null && c.homeLng != null) {
      out.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [circleRing(c.homeLat, c.homeLng, radiusM)] },
        properties: { opacity },
      });
    }
    if (c.workLat != null && c.workLng != null) {
      out.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [circleRing(c.workLat, c.workLng, radiusM)] },
        properties: { opacity },
      });
    }
    return out;
  });
  return { type: 'FeatureCollection' as const, features };
}

export interface MapLibreAtlasHalosProps {
  map: MaplibreMap | null;
  contacts: Contact[];
}

export function MapLibreAtlasHalos({ map, contacts }: MapLibreAtlasHalosProps) {
  const data = useMemo(() => buildData(contacts), [contacts]);

  useEffect(() => {
    if (!map) return;
    const fillLayer: LayerSpecification = {
      id: FILL_LAYER_ID,
      type: 'fill',
      source: SOURCE_ID,
      paint: {
        'fill-color': HALO_COLOR,
        'fill-opacity': ['get', 'opacity'],
      },
    };
    try {
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      }
      if (!map.getLayer(FILL_LAYER_ID)) {
        // Insert below the territory layers if they exist, so territory strokes
        // still read over the halos; falls back to top when absent.
        const below = map.getLayer('pulse-atlas-territories-fill') ? 'pulse-atlas-territories-fill' : undefined;
        map.addLayer(fillLayer, below);
      }
    } catch {
      // Style not ready / map torn down.
    }
    return () => {
      try {
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
