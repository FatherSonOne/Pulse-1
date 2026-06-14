// ─────────────────────────────────────────────────────────────────────────────
// MapLibreAtlasTerritories — Atlas circle-territory polygons as MapLibre fill +
// line layers (P2 geometry). MapLibre equivalent of the Google AtlasTerritories
// (@react-google-maps/api <Polygon> per circle).
//
// One GeoJSON source holds every circle's convex hull (mirrors the Google
// component's member-point gathering + convexHull). Per-circle colour and the
// focused/unfocused styling are data-driven via paint expressions, so a single
// fill + single line layer covers all territories. Click toggles selection.
//
// Renders nothing in React; null-rendering layer manager (same pattern as
// MapLibreAcceptedRoute). Type-only maplibre import → no runtime dep.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo } from 'react';
import type {
  Map as MaplibreMap,
  GeoJSONSource,
  MapLayerMouseEvent,
  LayerSpecification,
} from 'maplibre-gl';
import type { Contact } from '../../../types';
import type { ContactCircle } from '../../../types/contactCircleTypes';
import { convexHull } from '../../../services/mapService';

const SOURCE_ID = 'pulse-atlas-territories';
const FILL_LAYER_ID = 'pulse-atlas-territories-fill';
const LINE_LAYER_ID = 'pulse-atlas-territories-line';

export interface MapLibreAtlasTerritoriesProps {
  map: MaplibreMap | null;
  circles: ContactCircle[];
  contacts: Contact[];
  selectedCircleId: string | null;
  onSelectCircle: (id: string | null) => void;
}

// Mirrors AtlasTerritories: members with pinned points → convex hull (≥3
// points). Each hull becomes a closed-ring Polygon feature carrying its
// circle's colour + focused flag for data-driven paint.
function buildData(
  circles: ContactCircle[],
  contacts: Contact[],
  selectedCircleId: string | null,
) {
  const features = circles.flatMap(circle => {
    const points: Array<{ lat: number; lng: number }> = [];
    for (const c of contacts) {
      if (!circle.memberContactIds.includes(c.id)) continue;
      if (c.homeLat != null && c.homeLng != null) points.push({ lat: c.homeLat, lng: c.homeLng });
      if (c.workLat != null && c.workLng != null) points.push({ lat: c.workLat, lng: c.workLng });
    }
    if (points.length < 3) return [];
    const ring = convexHull(points).map(p => [p.lng, p.lat]);
    if (ring.length > 0) ring.push(ring[0]); // GeoJSON rings must close.
    return [{
      type: 'Feature' as const,
      geometry: { type: 'Polygon' as const, coordinates: [ring] },
      properties: {
        circleId: circle.id,
        color: circle.color,
        focused: selectedCircleId === circle.id,
      },
    }];
  });
  return { type: 'FeatureCollection' as const, features };
}

export function MapLibreAtlasTerritories({
  map,
  circles,
  contacts,
  selectedCircleId,
  onSelectCircle,
}: MapLibreAtlasTerritoriesProps) {
  const data = useMemo(
    () => buildData(circles, contacts, selectedCircleId),
    [circles, contacts, selectedCircleId],
  );

  useEffect(() => {
    if (!map) return;
    const fillLayer: LayerSpecification = {
      id: FILL_LAYER_ID,
      type: 'fill',
      source: SOURCE_ID,
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': ['case', ['get', 'focused'], 0.18, 0.08],
      },
    };
    const lineLayer: LayerSpecification = {
      id: LINE_LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      paint: {
        'line-color': ['get', 'color'],
        'line-opacity': ['case', ['get', 'focused'], 0.9, 0.4],
        'line-width': ['case', ['get', 'focused'], 2, 1],
      },
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

  useEffect(() => {
    if (!map) return;
    const onClick = (e: MapLayerMouseEvent) => {
      const cid = e.features?.[0]?.properties?.circleId as string | undefined;
      if (!cid) return;
      onSelectCircle(selectedCircleId === cid ? null : cid);
    };
    const onEnter = () => { map.getCanvas().style.cursor = 'pointer'; };
    const onLeave = () => { map.getCanvas().style.cursor = ''; };
    map.on('click', FILL_LAYER_ID, onClick);
    map.on('mouseenter', FILL_LAYER_ID, onEnter);
    map.on('mouseleave', FILL_LAYER_ID, onLeave);
    return () => {
      try {
        map.off('click', FILL_LAYER_ID, onClick);
        map.off('mouseenter', FILL_LAYER_ID, onEnter);
        map.off('mouseleave', FILL_LAYER_ID, onLeave);
      } catch {
        // Map torn down.
      }
    };
  }, [map, onSelectCircle, selectedCircleId]);

  return null;
}
