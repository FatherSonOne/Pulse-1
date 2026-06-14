// ─────────────────────────────────────────────────────────────────────────────
// MapLibreAcceptedRoute — the accepted-route polyline as a MapLibre GeoJSON
// line layer (P2 geometry slice). MapLibre equivalent of the Google
// AcceptedRoutePolyline (@react-google-maps/api <Polyline>).
//
// Renders nothing in React — it imperatively manages a GeoJSON source + line
// layer on the maplibre-gl map and tears them down on unmount. Uses only the
// map instance's methods + plain objects (no maplibre-gl constructors), so the
// import stays TYPE-ONLY and this module adds nothing to the bundle.
//
// Only mounted (by PulseMapView) when the MapLibre renderer is active AND its
// map has loaded, so addSource/addLayer always run against a ready style.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import type { Map as MaplibreMap, GeoJSONSource, MapMouseEvent } from 'maplibre-gl';

const SOURCE_ID = 'pulse-accepted-route';
const LAYER_ID = 'pulse-accepted-route-line';

// Matches AcceptedRoutePolyline's coral stroke (weight 5, opacity 0.95).
const ROUTE_COLOR = '#f43f5e';
const ROUTE_WIDTH = 5;
const ROUTE_OPACITY = 0.95;

export interface MapLibreAcceptedRouteProps {
  map: MaplibreMap | null;
  path: Array<{ lat: number; lng: number }>;
  onClick?: () => void;
}

function toFeature(path: Array<{ lat: number; lng: number }>) {
  return {
    type: 'Feature' as const,
    geometry: {
      type: 'LineString' as const,
      coordinates: path.map(p => [p.lng, p.lat]),
    },
    properties: {},
  };
}

export function MapLibreAcceptedRoute({ map, path, onClick }: MapLibreAcceptedRouteProps) {
  // Add the source + layer once per map; remove on unmount. Guarded so a
  // toggle-off (where MapLibreCanvas may remove() the map first) can't throw.
  useEffect(() => {
    if (!map) return;
    try {
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, { type: 'geojson', data: toFeature([]) });
      }
      if (!map.getLayer(LAYER_ID)) {
        map.addLayer({
          id: LAYER_ID,
          type: 'line',
          source: SOURCE_ID,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': ROUTE_COLOR,
            'line-width': ROUTE_WIDTH,
            'line-opacity': ROUTE_OPACITY,
          },
        });
      }
    } catch {
      // Style not ready / map torn down — nothing to draw.
    }
    return () => {
      try {
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        // Map already removed on toggle-off — layers went with it.
      }
    };
  }, [map]);

  // Push the latest path into the source whenever it changes.
  useEffect(() => {
    if (!map) return;
    try {
      const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (src) src.setData(toFeature(path));
    } catch {
      // Source not ready yet — the add effect seeds it on mount.
    }
  }, [map, path]);

  // Click → relay to the parent (open-in-system-maps), plus a pointer cursor
  // on hover for affordance parity with the Google polyline.
  useEffect(() => {
    if (!map || !onClick) return;
    const onLayerClick = (_e: MapMouseEvent) => onClick();
    const onEnter = () => { map.getCanvas().style.cursor = 'pointer'; };
    const onLeave = () => { map.getCanvas().style.cursor = ''; };
    map.on('click', LAYER_ID, onLayerClick);
    map.on('mouseenter', LAYER_ID, onEnter);
    map.on('mouseleave', LAYER_ID, onLeave);
    return () => {
      try {
        map.off('click', LAYER_ID, onLayerClick);
        map.off('mouseenter', LAYER_ID, onEnter);
        map.off('mouseleave', LAYER_ID, onLeave);
      } catch {
        // Map torn down — listeners went with it.
      }
    };
  }, [map, onClick]);

  return null;
}
