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

import { CalendarRange, Contrast, Globe, Layers, Map as MapIcon, Minimize2, Moon, Mountain, Satellite, Sun, Type } from 'lucide-react';

export type MapLens = 'today' | 'week' | 'atlas';

// Direction D (Horizon) time axis. The scrubber (P5) moves through these four
// detents; Atlas becomes an orthogonal boolean MODE (see isAtlasMode) rather than
// a peer value. MapHorizon is intentionally SEPARATE from MapLens — the live tabs
// stay TODAY/WEEK/ATLAS until P5 replaces them, so adding 'now'/'3d' here neither
// implies new tabs nor touches LENS_OPTIONS. The lens predicate accepts both.
export type MapHorizon = 'now' | 'today' | '3d' | 'week';

// Atlas as a decoupled boolean MODE (Direction D / P5). Today Atlas is the
// 'atlas' MapLens value; the scrubber will make it orthogonal so a time-horizon
// can stay active while zoomed out. This bridge derives the boolean from the
// current lens WITHOUT changing the enum, so existing consumers keep working and
// P5 can flip the source of truth later. (P1: computed alongside, not replacing.)
export const isAtlasMode = (lens: MapLens): boolean => lens === 'atlas';

export const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };
export const DEFAULT_ZOOM = 11;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;
// Direction D (Horizon) windows — the two detents that don't exist in the
// TODAY/WEEK lens today. NOW_MS = 3h per the 2026-06-15 decision ("Now" = the
// nearest un-visited stop AND events in [now, now + NOW_MS)); THREE_DAY_MS spans
// the near-term batch. Pure additions — no UI consumes them until the scrubber (P5).
export const NOW_MS = 3 * 60 * 60 * 1000;
export const THREE_DAY_MS = 3 * DAY_MS;

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

// ─── Direction D (Horizon, P3) base-style switch ─────────────────────────────
// Replaces the dead Sat/Terr/Hybrid picker on the MapLibre branch (under the
// mapHorizon flag). 'light'/'dark' map to the existing Coral palettes; 'contrast'
// is the net-new high-contrast palette (buildCoralStyle). Density thins the
// label/symbol layers so pins (signal) dominate at a glance. The Google fallback
// branch keeps MapViewPicker — this control is MapLibre-only.
export type MapBaseStyle = 'light' | 'dark' | 'contrast';
export type MapDensity = 'high' | 'low';
export const MAP_BASE_STYLE_LS_KEY = 'pulse:map:base-style';
export const MAP_DENSITY_LS_KEY = 'pulse:map:density';

export const MAP_BASE_STYLE_OPTIONS: { id: MapBaseStyle; label: string; Icon: typeof Sun }[] = [
  { id: 'light',    label: 'Light',    Icon: Sun },
  { id: 'dark',     label: 'Dark',     Icon: Moon },
  { id: 'contrast', label: 'Contrast', Icon: Contrast },
];

// 'high' = full label set (today's behavior); 'low' = minor labels hidden + road
// labels thinned. Two detents only — a third would over-complicate a chrome chip.
export const MAP_DENSITY_OPTIONS: { id: MapDensity; label: string; Icon: typeof Sun }[] = [
  { id: 'high', label: 'Detailed', Icon: Type },
  { id: 'low',  label: 'Minimal',  Icon: Minimize2 },
];
