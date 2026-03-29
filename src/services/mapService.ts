import { Libraries } from '@react-google-maps/api';
import { Contact } from '../types';

// Stable library reference — prevents useJsApiLoader from re-loading the script
export const GOOGLE_MAPS_LIBRARIES: Libraries = ['places', 'geometry'];

// ============================================================
// Map Styling — Pulse-branded vibrant theme
// ============================================================

export const MAP_STYLE_LIGHT: google.maps.MapTypeStyle[] = [
  { featureType: 'all', elementType: 'geometry', stylers: [{ saturation: 10 }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#38bdf8' }, { saturation: 40 }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#0e7490' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f5f0e8' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#e8f4f0' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#bbf7d0' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#166534' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#fda4af' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#f43f5e' }, { weight: 1 }] },
  { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#fde68a' }] },
  { featureType: 'road.local', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#374151' }] },
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
];

export const MAP_STYLE_DARK: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e4166' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#38bdf8' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#162032' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0f2d1a' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#7f1d1d' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#f43f5e' }, { weight: 0.5 }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#1e2d45' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#172032' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#334155' }] },
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
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
// Status Colors
// ============================================================

const STATUS_COLORS: Record<Contact['status'], string> = {
  online: '#22c55e',
  busy: '#ef4444',
  away: '#f59e0b',
  offline: '#6b7280',
};

// ============================================================
// Marker Icon Builder
// ============================================================

export function buildMarkerDataUrl(
  avatarColor: string,
  status: Contact['status'],
  isSelected: boolean,
  locationType: 'home' | 'work',
  initials: string
): string {
  const size = isSelected ? 52 : 44;
  const r = size / 2;
  const innerR = r - 4;
  const statusColor = STATUS_COLORS[status];
  const badge = locationType === 'home' ? '🏠' : '🏢';
  // SVG — avatar circle with status ring and location badge
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size + 12}" height="${size + 12}" viewBox="0 0 ${size + 12} ${size + 12}">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
    </filter>
  </defs>
  <!-- Outer glow ring when selected -->
  ${isSelected ? `<circle cx="${r + 6}" cy="${r + 6}" r="${r + 4}" fill="none" stroke="${avatarColor}" stroke-width="3" opacity="0.5"/>` : ''}
  <!-- Status ring -->
  <circle cx="${r + 6}" cy="${r + 6}" r="${r}" fill="${statusColor}" filter="url(#shadow)"/>
  <!-- Avatar background -->
  <circle cx="${r + 6}" cy="${r + 6}" r="${innerR}" fill="${avatarColor}"/>
  <!-- Initials -->
  <text x="${r + 6}" y="${r + 6 + 5}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${innerR * 0.75}" font-weight="600" fill="white">${initials}</text>
  <!-- Location badge -->
  <text x="${size + 2}" y="${size + 8}" font-size="12">${badge}</text>
</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

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

export const RADIUS_RINGS: RadiusRing[] = [
  { radiusMiles: 0.5, label: '0.5 mi', strokeColor: '#f43f5e', fillColor: '#f43f5e' },
  { radiusMiles: 1,   label: '1 mi',   strokeColor: '#fb923c', fillColor: '#fb923c' },
  { radiusMiles: 5,   label: '5 mi',   strokeColor: '#facc15', fillColor: '#facc15' },
];

export const MILES_TO_METERS = 1609.344;
