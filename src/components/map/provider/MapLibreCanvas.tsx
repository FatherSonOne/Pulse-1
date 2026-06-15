// ─────────────────────────────────────────────────────────────────────────────
// MapLibreCanvas — the maplibre-gl map (P1c spike → P3 Coral Cockpit styling).
//
// Lazy-loaded by PulseMapView only when the mapLibreRenderer flag is ON, so
// maplibre-gl never enters the default Google-path bundle. Renders the Pulse
// Coral Cockpit style (light + dark) via buildCoralStyle, themed by isDarkMode;
// markers/overlays are layered on top by PulseMapView. Its core job: mount the
// renderer + let the MapProviderApi camera adapter drive it via useFitBounds.
//
// Mount-once: initial center/zoom are seed values; useFitBounds owns the camera
// thereafter (same contract as the Google path). A theme flip swaps the style
// in place via map.setStyle() and signals onStyleSwapped so the overlay layer-
// managers can re-add their sources/layers (setStyle clears all of them).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './maplibre-overrides.css';
import type { LatLng } from './types';
import { buildCoralStyle } from './coralCockpitStyle';

export interface MapLibreCanvasProps {
  center: LatLng;
  zoom: number;
  /** Drives the Coral Cockpit light/dark style; swaps in place when it changes. */
  isDarkMode: boolean;
  className?: string;
  /** Fires once the style has loaded and the map is ready for camera ops. */
  onReady?: (map: maplibregl.Map) => void;
  onZoomChanged?: (zoom: number) => void;
  onClick?: () => void;
  /**
   * Fires after a theme-driven setStyle() reload completes. setStyle() clears
   * ALL sources + layers (including the overlay managers'), so PulseMapView uses
   * this to re-key those overlays and have them re-add onto the new style.
   */
  onStyleSwapped?: () => void;
}

export function MapLibreCanvas({
  center,
  zoom,
  isDarkMode,
  className,
  onReady,
  onZoomChanged,
  onClick,
  onStyleSwapped,
}: MapLibreCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  // Theme the mounted style was built for — guards the swap effect so its first
  // run (right after mount) is a no-op rather than a redundant re-build.
  const appliedThemeRef = useRef(isDarkMode);

  // Keep the latest callbacks reachable from the mount-once effect without
  // re-creating the map on every render.
  const cbRef = useRef({ onReady, onZoomChanged, onClick, onStyleSwapped });
  cbRef.current = { onReady, onZoomChanged, onClick, onStyleSwapped };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const container = containerRef.current;
    let cancelled = false;
    (async () => {
      // Build for the theme at mount time; appliedThemeRef already tracks it.
      const style = await buildCoralStyle(appliedThemeRef.current);
      if (cancelled || mapRef.current || !container) return;
      const map = new maplibregl.Map({
        container,
        style,
        center: [center.lng, center.lat],
        zoom,
        // Collapse attribution into a small "ⓘ" so it doesn't clutter the
        // corner (it expands on click). The required OSM credit still ships —
        // just compact, and de-"MapLibre"'d via buildCoralStyle.
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

  // Theme swap — rebuild the Coral style for the new theme and apply it in place.
  // setStyle preserves the camera; once the new style loads we ping onStyleSwapped
  // so PulseMapView re-mounts the overlay layer-managers onto it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (appliedThemeRef.current === isDarkMode) return; // first run / no change
    appliedThemeRef.current = isDarkMode;
    let cancelled = false;
    (async () => {
      const style = await buildCoralStyle(isDarkMode);
      if (cancelled || !mapRef.current) return;
      map.once('style.load', () => {
        if (!cancelled) cbRef.current.onStyleSwapped?.();
      });
      map.setStyle(style as Parameters<typeof map.setStyle>[0]);
    })();
    return () => { cancelled = true; };
  }, [isDarkMode]);

  return <div ref={containerRef} className={className} />;
}
