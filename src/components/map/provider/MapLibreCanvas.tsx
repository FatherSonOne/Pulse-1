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
import type { MapBaseStyle, MapDensity } from '../sub/mapLens';

export interface MapLibreCanvasProps {
  center: LatLng;
  zoom: number;
  /** Drives the Coral Cockpit light/dark style; swaps in place when it changes. */
  isDarkMode: boolean;
  /** Direction D (P3) base-style override. When set (mapHorizon ON) it selects the
   *  palette explicitly (light/dark/contrast), overriding isDarkMode; when omitted,
   *  the palette follows isDarkMode — the original two-state behavior. */
  baseStyle?: MapBaseStyle;
  /** Direction D (P3) label density. 'high' (default) = full labels; 'low' = minor
   *  labels hidden + road labels thinned. Omitted ⇒ 'high' (today's behavior). */
  density?: MapDensity;
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
  baseStyle,
  density,
  className,
  onReady,
  onZoomChanged,
  onClick,
  onStyleSwapped,
}: MapLibreCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  // Effective style inputs. variant follows isDarkMode unless explicitly set
  // (mapHorizon base-style switch); density defaults to the full label set.
  const variant: MapBaseStyle = baseStyle ?? (isDarkMode ? 'dark' : 'light');
  const labelDensity: MapDensity = density ?? 'high';
  // Signature the mounted style was built for — guards the swap effect so its
  // first run (right after mount) is a no-op rather than a redundant re-build.
  // Generalizes the old theme-only guard to cover variant + density.
  const appliedSigRef = useRef(`${variant}:${labelDensity}`);

  // Keep the latest callbacks reachable from the mount-once effect without
  // re-creating the map on every render.
  const cbRef = useRef({ onReady, onZoomChanged, onClick, onStyleSwapped });
  cbRef.current = { onReady, onZoomChanged, onClick, onStyleSwapped };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const container = containerRef.current;
    let cancelled = false;
    (async () => {
      // Build for the variant + density at mount time; appliedSigRef tracks it.
      const style = await buildCoralStyle(isDarkMode, { variant, density: labelDensity });
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

  // Style swap — rebuild the Coral style for the new variant/density (theme flip,
  // or the mapHorizon base-style switch) and apply it in place. setStyle preserves
  // the camera; once the new style loads we ping onStyleSwapped so PulseMapView
  // re-mounts the overlay layer-managers onto it. Reuses the exact theme-swap path
  // that already shipped — only the trigger widened from isDarkMode to the
  // variant+density signature.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const sig = `${variant}:${labelDensity}`;
    if (appliedSigRef.current === sig) return; // first run / no change
    appliedSigRef.current = sig;
    let cancelled = false;
    (async () => {
      const style = await buildCoralStyle(isDarkMode, { variant, density: labelDensity });
      if (cancelled || !mapRef.current) return;
      map.once('style.load', () => {
        if (!cancelled) cbRef.current.onStyleSwapped?.();
      });
      map.setStyle(style as Parameters<typeof map.setStyle>[0]);
    })();
    return () => { cancelled = true; };
  }, [variant, labelDensity, isDarkMode]);

  return <div ref={containerRef} className={className} />;
}
