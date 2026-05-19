// ─────────────────────────────────────────────────────────────────────────────
// Map lens + base-tile view-mode types and constants. Hoisted out of
// PulseMapView so the lens row, view-mode picker, and the hooks driving them
// can be extracted independently without dragging the whole component along.
//
// LENS_OPTIONS feeds the TODAY / WEEK / ATLAS triad. MAP_VIEW_OPTIONS feeds
// the base-tile picker (Map / Sat / Terr / Hybrid). DEFAULT_CENTER /
// DEFAULT_ZOOM / DAY_MS / WEEK_MS are referenced by both PulseMapView itself
// and the geo-relevance helper (lensIncludesContact).
// ─────────────────────────────────────────────────────────────────────────────

import { CalendarRange, Globe, Layers, Map as MapIcon, Mountain, Satellite, Sun } from 'lucide-react';

export type MapLens = 'today' | 'week' | 'atlas';

export const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };
export const DEFAULT_ZOOM = 11;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;

export const LENS_OPTIONS: { id: MapLens; label: string; Icon: typeof Sun }[] = [
  { id: 'today', label: 'Today', Icon: Sun },
  { id: 'week',  label: 'Week',  Icon: CalendarRange },
  { id: 'atlas', label: 'Atlas', Icon: Globe },
];

// Google Maps base-tile mode. Roadmap is the styled Coral Cockpit canvas;
// Satellite + Terrain + Hybrid all bypass our custom styling (Google ignores
// `styles` on non-roadmap modes), so the look-and-feel jumps deliberately.
export type MapViewMode = 'roadmap' | 'satellite' | 'terrain' | 'hybrid';

export const MAP_VIEW_OPTIONS: { id: MapViewMode; label: string; Icon: typeof Sun; hotkey: string }[] = [
  { id: 'roadmap',   label: 'Map',    Icon: MapIcon,   hotkey: '4' },
  { id: 'satellite', label: 'Sat',    Icon: Satellite, hotkey: '5' },
  { id: 'terrain',   label: 'Terr',   Icon: Mountain,  hotkey: '6' },
  { id: 'hybrid',    label: 'Hybrid', Icon: Layers,    hotkey: '7' },
];

export const MAP_VIEW_LS_KEY = 'pulse:map:view-mode';
