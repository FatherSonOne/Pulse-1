import { Libraries } from '@react-google-maps/api';
import { Contact } from '../types';

// Stable library reference — prevents useJsApiLoader from re-loading the script
export const GOOGLE_MAPS_LIBRARIES: Libraries = ['places', 'geometry'];

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
  // a half-step darker, highways carry the rose accent.
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#52525b' }] },
  { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#fafafa' }] },
  { featureType: 'road.local', elementType: 'geometry.fill', stylers: [{ color: '#fafafa' }] },
  { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#ebe7e3' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#fecdd3' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#f43f5e' }, { weight: 0.6 }] },

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

  // Roads against true-black: local roads barely lift, highways glow rose
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#a1a1aa' }] },
  { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0a' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#171717' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#1f1f1f' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#3f0d18' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#f43f5e' }, { weight: 0.5 }] },

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
