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
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { LatLng } from './types';

// OpenFreeMap public instance — free, no API key, no signup. Self-hosted
// Protomaps PMTiles on R2 + the Coral style JSON replace this in P3.
const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

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
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OPENFREEMAP_STYLE,
      center: [center.lng, center.lat],
      zoom,
    });
    mapRef.current = map;
    map.on('load', () => cbRef.current.onReady?.(map));
    map.on('zoomend', () => cbRef.current.onZoomChanged?.(map.getZoom()));
    map.on('click', () => cbRef.current.onClick?.());
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Mount-once on purpose — center/zoom are seeds; useFitBounds drives the
    // camera afterwards. Callbacks are read live via cbRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className={className} />;
}
