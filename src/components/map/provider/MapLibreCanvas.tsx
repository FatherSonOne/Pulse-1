// ─────────────────────────────────────────────────────────────────────────────
// MapLibreCanvas — bare maplibre-gl map (P1c spike).
//
// Lazy-loaded by PulseMapView only when the mapLibreRenderer flag is ON, so
// maplibre-gl never enters the default Google-path bundle. This is intentionally
// minimal: a single OpenFreeMap vector style, no markers/overlays (those are P2),
// no Coral Cockpit styling (P3). Its only job is to prove the renderer mounts
// and that the MapProviderApi camera adapter can drive it via useFitBounds.
//
// Mount-once: initial center/zoom are seed values; useFitBounds owns the camera
// thereafter (same contract as the Google path).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react';
import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { LatLng } from './types';

// OpenFreeMap public instance — free, no API key, no signup. Self-hosted
// Protomaps PMTiles on R2 + the Coral style JSON replace this in P3.
const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

// Attribution. The OSM data credit is LEGALLY required (ODbL); OpenMapTiles +
// OpenFreeMap are courtesy. "MapLibre" (BSD-licensed, NOT required) is dropped.
// The credit comes from the openmaptiles source's TileJSON, so the only way to
// edit it is to patch the source's `attribution` in the style object — hence we
// fetch the style and override it before mounting; any failure falls back to
// the plain URL (which keeps the full default credit, so we never under-attribute).
const ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> ' +
  '© <a href="https://openmaptiles.org" target="_blank" rel="noopener">OpenMapTiles</a> ' +
  'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

async function buildStyle(): Promise<string | StyleSpecification> {
  try {
    const res = await fetch(OPENFREEMAP_STYLE);
    if (!res.ok) return OPENFREEMAP_STYLE;
    const style = await res.json();
    if (style?.sources?.openmaptiles) {
      style.sources.openmaptiles.attribution = ATTRIBUTION;
    }
    return style as StyleSpecification;
  } catch {
    return OPENFREEMAP_STYLE; // network/parse failure → safe full-credit fallback
  }
}

export interface MapLibreCanvasProps {
  center: LatLng;
  zoom: number;
  className?: string;
  /** Fires once the style has loaded and the map is ready for camera ops. */
  onReady?: (map: maplibregl.Map) => void;
  onZoomChanged?: (zoom: number) => void;
  onClick?: () => void;
}

export function MapLibreCanvas({
  center,
  zoom,
  className,
  onReady,
  onZoomChanged,
  onClick,
}: MapLibreCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  // Keep the latest callbacks reachable from the mount-once effect without
  // re-creating the map on every render.
  const cbRef = useRef({ onReady, onZoomChanged, onClick });
  cbRef.current = { onReady, onZoomChanged, onClick };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const container = containerRef.current;
    let cancelled = false;
    (async () => {
      const style = await buildStyle();
      if (cancelled || mapRef.current || !container) return;
      const map = new maplibregl.Map({
        container,
        style,
        center: [center.lng, center.lat],
        zoom,
        // Collapse attribution into a small "ⓘ" so it doesn't clutter the
        // corner (it expands on click). The required OSM credit still ships —
        // just compact, and de-"MapLibre"'d via buildStyle.
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.on('load', () => cbRef.current.onReady?.(map));
      map.on('zoomend', () => cbRef.current.onZoomChanged?.(map.getZoom()));
      map.on('click', () => cbRef.current.onClick?.());
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Mount-once on purpose — center/zoom are seeds; useFitBounds drives the
    // camera afterwards. Callbacks are read live via cbRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className={className} />;
}
