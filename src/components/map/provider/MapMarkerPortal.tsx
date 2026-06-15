// ─────────────────────────────────────────────────────────────────────────────
// MapMarkerPortal — the MapLibre analog of Google's OverlayView (P2 anchor
// proof). Projects a geographic point to screen pixels and mounts arbitrary
// React children there, repositioning on every map move.
//
// Uses only map.project() (no maplibre-gl runtime import → no bundle cost), and
// appends a positioned container into the map's canvas container. The container
// sits at the projected point (top-left); the child's OWN transform does the
// anchoring + offset — e.g. MapContactMarkerBody's translate(-50%,-100%) puts
// its pin tip on the point exactly as it did under OverlayView. So the same
// marker body renders identically under either renderer.
//
// Perf note: like OverlayView, this attaches a per-marker move/zoom listener.
// Fine at the visible-marker counts the map filters to; the full anchor port
// can batch into one render listener if a denser view needs it.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Map as MaplibreMap } from 'maplibre-gl';

export interface MapMarkerPortalProps {
  map: MaplibreMap | null;
  lat: number;
  lng: number;
  children: React.ReactNode;
}

export function MapMarkerPortal({ map, lat, lng, children }: MapMarkerPortalProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  if (elRef.current == null && typeof document !== 'undefined') {
    const el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.top = '0';
    el.style.left = '0';
    el.style.willChange = 'transform';
    elRef.current = el;
  }

  // Latest coords reachable from the listener without re-subscribing on move.
  const latRef = useRef(lat);
  const lngRef = useRef(lng);
  latRef.current = lat;
  lngRef.current = lng;

  // Mount the container + reposition on every map move. Re-runs only when the
  // map instance changes.
  useEffect(() => {
    const el = elRef.current;
    if (!map || !el) return;
    map.getCanvasContainer().appendChild(el);
    const update = () => {
      const p = map.project([lngRef.current, latRef.current]);
      el.style.transform = `translate(${p.x}px, ${p.y}px)`;
    };
    update();
    map.on('move', update);
    map.on('zoom', update);
    return () => {
      map.off('move', update);
      map.off('zoom', update);
      if (el.parentNode) el.parentNode.removeChild(el);
    };
  }, [map]);

  // Reposition when the point itself moves (e.g. live location) without
  // re-subscribing the listeners above.
  useEffect(() => {
    const el = elRef.current;
    if (!map || !el) return;
    const p = map.project([lng, lat]);
    el.style.transform = `translate(${p.x}px, ${p.y}px)`;
  }, [map, lat, lng]);

  if (!elRef.current) return null;
  return createPortal(children, elRef.current);
}
