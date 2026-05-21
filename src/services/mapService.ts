import { Libraries } from '@react-google-maps/api';
import { Contact } from '../types';

// Stable library reference — prevents useJsApiLoader from re-loading the script.
// 'geometry' is used by computeBounds and contact distance helpers. The
// 'visualization' library was added briefly for Google's HeatmapLayer; that
// API was deprecated in May 2025 and is being removed in May 2026, so the
// Atlas density rendering uses overlapping rose Circles instead.
export const GOOGLE_MAPS_LIBRARIES: Libraries = ['places', 'geometry'];

// ─────────────────────────────────────────────────────────────────────────────
// convexHull — Andrew's monotone-chain implementation. Used by Atlas to draw
// soft territory polygons around each Contact Circle. Inline (rather than
// pulling turf.js) because hulls of <500 points are trivial and the rest of
// turf is dead weight here.
// ─────────────────────────────────────────────────────────────────────────────
export function convexHull(points: Array<{ lat: number; lng: number }>): Array<{ lat: number; lng: number }> {
  if (points.length < 3) return points.slice();
  const sorted = points.slice().sort((a, b) =>
    a.lng === b.lng ? a.lat - b.lat : a.lng - b.lng,
  );
  const cross = (o: { lat: number; lng: number }, a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
    (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);
  const lower: Array<{ lat: number; lng: number }> = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Array<{ lat: number; lng: number }> = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

// ============================================================
// Map Styling — Coral Cockpit
// Tinted neutrals carry 90%+ of the surface. Rose appears only on
// highways (the structural backbone of the city) — same role coral
// plays everywhere else in Pulse: signal, not decoration.
// ============================================================

export const MAP_STYLE_LIGHT: google.maps.MapTypeStyle[] = [
  // Default geometry tone matches Pulse's --paper-warm canvas
  { elementType: 'geometry', stylers: [{ color: '#f4f1ee' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#52525b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f4f1ee' }] },

  // POI labels off — they clutter; we control places via our own pins
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e6ece4' }] },

  // Water — muted slate with a hint of warm grey, never disco-cyan
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dfe3e0' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#78716c' }] },

  // Landscape sits a half-step lighter than the canvas
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f4f1ee' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#ece8e3' }] },

  // Roads — the city's structural lines. Local roads near-white, arterial
  // a half-step darker, highways carry a quiet rose accent. The bright
  // stroke (was #f43f5e w0.6) turned every freeway into a spiderweb at
  // country-level zoom; softer fill + lighter stroke preserves the "rose
  // marks the backbone" intent without dominating the canvas.
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#52525b' }] },
  { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#fafafa' }] },
  { featureType: 'road.local', elementType: 'geometry.fill', stylers: [{ color: '#fafafa' }] },
  { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#ebe7e3' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#fde2e6' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#fda4af' }, { weight: 0.3 }] },

  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#78716c' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#52525b' }] },
];

export const MAP_STYLE_DARK: google.maps.MapTypeStyle[] = [
  // True-black canvas (Pulse dark-mode root) with translucent layers above
  { elementType: 'geometry', stylers: [{ color: '#0a0a0a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#b4b4b8' }] },

  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0e1410' }] },

  // Water reads as a slightly cooler shade than the canvas, never blue-disco
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#070a0d' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#52525b' }] },

  // Landscape sits one shade above canvas — the translucent-stack feel
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0f0f0f' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#0d0d0d' }] },

  // Roads against true-black: local roads barely lift, highways carry a
  // quiet rose accent. Stroke softened (was #f43f5e w0.5) to keep highways
  // legible at city zoom without the country-zoom spiderweb effect.
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#a1a1aa' }] },
  { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0a' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#171717' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#1f1f1f' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#2a0710' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#9f1239' }, { weight: 0.3 }] },

  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#27272a' }] },
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#71717a' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#a1a1aa' }] },
];

// ============================================================
// Map Options
// ============================================================

export function getMapOptions(isDarkMode: boolean): google.maps.MapOptions {
  return {
    styles: isDarkMode ? MAP_STYLE_DARK : MAP_STYLE_LIGHT,
    disableDefaultUI: true,
    zoomControl: true,
    zoomControlOptions: {
      position: google.maps.ControlPosition.RIGHT_BOTTOM,
    },
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    clickableIcons: false,
    gestureHandling: 'greedy',
    minZoom: 3,
    maxZoom: 20,
  };
}

// ============================================================
// Status Colors — shared by all map markers/panels
// ============================================================

export const MAP_STATUS_COLORS: Record<Contact['status'], string> = {
  online: '#22c55e',
  busy: '#ef4444',
  away: '#f59e0b',
  offline: '#6b7280',
};

// ============================================================
// Live-location color
// Cyan, deliberately outside the task-status vocabulary so a "live"
// teammate dot never reads as a "task in progress" pin once the Map
// view starts hosting cross-section entities.
// ============================================================

export const LIVE_LOCATION_COLOR = '#06b6d4';
export const LIVE_LOCATION_COLOR_SOFT = 'rgba(6, 182, 212, 0.30)';

// ============================================================
// Bounds Computation
// ============================================================

export function computeBounds(
  points: Array<{ lat: number; lng: number }>
): google.maps.LatLngBounds | null {
  if (!points.length) return null;
  const bounds = new google.maps.LatLngBounds();
  points.forEach(p => bounds.extend(new google.maps.LatLng(p.lat, p.lng)));
  return bounds;
}

// ============================================================
// Radius Ring Config
// ============================================================

export interface RadiusRing {
  radiusMiles: number;
  label: string;
  strokeColor: string;
  fillColor: string;
}

// Single-hue rings; the inner ring sits closer to coral, outer rings fade
// toward neutral. One color, varying weight — the eye reads concentric
// distance, not three different "categories."
export const RADIUS_RINGS: RadiusRing[] = [
  { radiusMiles: 0.5, label: '0.5 mi', strokeColor: '#f43f5e', fillColor: '#f43f5e' },
  { radiusMiles: 1,   label: '1 mi',   strokeColor: '#fb7185', fillColor: '#fb7185' },
  { radiusMiles: 5,   label: '5 mi',   strokeColor: '#fda4af', fillColor: '#fda4af' },
];

export const MILES_TO_METERS = 1609.344;
