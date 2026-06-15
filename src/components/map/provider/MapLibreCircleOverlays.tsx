// ─────────────────────────────────────────────────────────────────────────────
// MapLibreCircleOverlays — Atlas per-circle expanded-hull territory + centroid
// label, on MapLibre (P2 hybrid). MapLibre equivalent of the Google
// MapCircleOverlay (<Polygon> + OverlayView label), one per circle.
//
// NOTE: the polygon overlaps AtlasTerritories (both draw circle territories on
// the Atlas lens) — this redundancy is inherited from the Google path, ported
// faithfully for parity. The unique value here is the circle-name centroid
// LABEL, which AtlasTerritories lacks.
//
// Hybrid split: the expanded-hull polygons → one GeoJSON fill + line source
// (data-driven per-circle colour + focus); the centroid labels → projected
// portals. Type-only maplibre import → no runtime dep, no bundle cost.
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
import { MapMarkerPortal } from './MapMarkerPortal';

const SOURCE_ID = 'pulse-circle-overlays';
const FILL_ID = 'pulse-circle-overlays-fill';
const LINE_ID = 'pulse-circle-overlays-line';

type Pt = { lat: number; lng: number };

// Mirrors MapCircleOverlay.expandHull — pushes each hull point outward from the
// centroid so the territory reads as a soft cloud around its members.
function expandHull(pts: Pt[], factor = 0.0005): Pt[] {
  if (pts.length === 0) return pts;
  const cx = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
  return pts.map(p => ({
    lat: p.lat + (p.lat - cx) * 0.3 + (p.lat > cx ? factor : -factor),
    lng: p.lng + (p.lng - cy) * 0.3 + (p.lng > cy ? factor : -factor),
  }));
}

interface LabelData {
  circleId: string;
  color: string;
  name: string;
  icon?: string;
  centroid: Pt;
}

function compute(circles: ContactCircle[], contacts: Contact[], selectedCircleId: string | null) {
  const features: Array<{
    type: 'Feature';
    geometry: { type: 'Polygon'; coordinates: number[][][] };
    properties: { circleId: string; color: string; focused: boolean };
  }> = [];
  const labels: LabelData[] = [];

  for (const circle of circles) {
    const points: Pt[] = [];
    for (const c of contacts) {
      if (!circle.memberContactIds.includes(c.id)) continue;
      if (c.homeLat != null && c.homeLng != null) points.push({ lat: c.homeLat, lng: c.homeLng });
      if (c.workLat != null && c.workLng != null) points.push({ lat: c.workLat, lng: c.workLng });
    }
    // Need a valid polygon — the Google overlay also renders nothing for a
    // single point (the marker handles it); <3 can't form a closed ring.
    if (points.length < 3) continue;
    const hull = expandHull(convexHull(points));
    if (hull.length < 3) continue;
    const ring = hull.map(p => [p.lng, p.lat]);
    ring.push(ring[0]); // close the ring
    const centroid = {
      lat: hull.reduce((s, p) => s + p.lat, 0) / hull.length,
      lng: hull.reduce((s, p) => s + p.lng, 0) / hull.length,
    };
    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [ring] },
      properties: { circleId: circle.id, color: circle.color, focused: selectedCircleId === circle.id },
    });
    labels.push({ circleId: circle.id, color: circle.color, name: circle.name, icon: circle.icon, centroid });
  }
  return { data: { type: 'FeatureCollection' as const, features }, labels };
}

export interface MapLibreCircleOverlaysProps {
  map: MaplibreMap | null;
  circles: ContactCircle[];
  contacts: Contact[];
  selectedCircleId: string | null;
  onSelectCircle: (id: string | null) => void;
  isDarkMode: boolean;
}

export function MapLibreCircleOverlays({
  map,
  circles,
  contacts,
  selectedCircleId,
  onSelectCircle,
  isDarkMode,
}: MapLibreCircleOverlaysProps) {
  const { data, labels } = useMemo(
    () => compute(circles, contacts, selectedCircleId),
    [circles, contacts, selectedCircleId],
  );

  useEffect(() => {
    if (!map) return;
    const fillLayer: LayerSpecification = {
      id: FILL_ID,
      type: 'fill',
      source: SOURCE_ID,
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': ['case', ['get', 'focused'], 0.12, 0.06],
      },
    };
    const lineLayer: LayerSpecification = {
      id: LINE_ID,
      type: 'line',
      source: SOURCE_ID,
      paint: {
        'line-color': ['get', 'color'],
        'line-opacity': ['case', ['get', 'focused'], 0.9, 0.5],
        'line-width': ['case', ['get', 'focused'], 2, 1.5],
      },
    };
    try {
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      }
      if (!map.getLayer(FILL_ID)) map.addLayer(fillLayer);
      if (!map.getLayer(LINE_ID)) map.addLayer(lineLayer);
    } catch {
      // Style not ready / torn down.
    }
    return () => {
      try {
        if (map.getLayer(LINE_ID)) map.removeLayer(LINE_ID);
        if (map.getLayer(FILL_ID)) map.removeLayer(FILL_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        // Map already removed.
      }
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    try {
      const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (src) src.setData(data);
    } catch {
      // Source not ready yet.
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
    map.on('click', FILL_ID, onClick);
    map.on('mouseenter', FILL_ID, onEnter);
    map.on('mouseleave', FILL_ID, onLeave);
    return () => {
      try {
        map.off('click', FILL_ID, onClick);
        map.off('mouseenter', FILL_ID, onEnter);
        map.off('mouseleave', FILL_ID, onLeave);
      } catch {
        // Map torn down.
      }
    };
  }, [map, onSelectCircle, selectedCircleId]);

  // Centroid labels via projected portals (circle name + icon).
  return (
    <>
      {labels.map(l => (
        <MapMarkerPortal key={l.circleId} map={map} lat={l.centroid.lat} lng={l.centroid.lng}>
          <div
            className="pointer-events-none select-none px-2 py-0.5 rounded-full text-xs font-semibold shadow"
            style={{
              color: l.color,
              backgroundColor: isDarkMode ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.85)',
              border: `1px solid ${l.color}66`,
              transform: 'translate(-50%, -50%)',
              whiteSpace: 'nowrap',
            }}
          >
            {l.icon && <span className="mr-1">{l.icon}</span>}
            {l.name}
          </div>
        </MapMarkerPortal>
      ))}
    </>
  );
}
