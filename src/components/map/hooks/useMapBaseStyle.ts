// ─────────────────────────────────────────────────────────────────────────────
// useMapBaseStyle — persisted base-style + label-density for the Direction D
// (Horizon, P3) base-style switch on the MapLibre branch. Mirrors useMapViewMode:
// the operator's pick survives reloads via localStorage.
//
// Base style SEEDS from the app theme (dark app → 'dark' map) on first run, then
// becomes an explicit, theme-independent choice once persisted. Density defaults
// to 'high' (today's full-label behavior). Only consumed when mapHorizon is ON;
// when OFF, PulseMapView passes neither to MapLibreCanvas, so the map keeps
// following the app theme exactly as before.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useState } from 'react';
import {
  MAP_BASE_STYLE_LS_KEY,
  MAP_DENSITY_LS_KEY,
  type MapBaseStyle,
  type MapDensity,
} from '../sub/mapLens';

export interface UseMapBaseStyleResult {
  baseStyle: MapBaseStyle;
  density: MapDensity;
  changeBaseStyle: (next: MapBaseStyle) => void;
  changeDensity: (next: MapDensity) => void;
}

export function useMapBaseStyle(isDarkMode: boolean): UseMapBaseStyleResult {
  const [baseStyle, setBaseStyle] = useState<MapBaseStyle>(() => {
    const seed: MapBaseStyle = isDarkMode ? 'dark' : 'light';
    if (typeof localStorage === 'undefined') return seed;
    const saved = localStorage.getItem(MAP_BASE_STYLE_LS_KEY);
    return (['light', 'dark', 'contrast'] as const).includes(saved as MapBaseStyle)
      ? (saved as MapBaseStyle)
      : seed;
  });

  const [density, setDensity] = useState<MapDensity>(() => {
    if (typeof localStorage === 'undefined') return 'high';
    const saved = localStorage.getItem(MAP_DENSITY_LS_KEY);
    return (['high', 'low'] as const).includes(saved as MapDensity)
      ? (saved as MapDensity)
      : 'high';
  });

  const changeBaseStyle = useCallback((next: MapBaseStyle) => {
    setBaseStyle(next);
    try { localStorage.setItem(MAP_BASE_STYLE_LS_KEY, next); } catch { /* ignore */ }
  }, []);

  const changeDensity = useCallback((next: MapDensity) => {
    setDensity(next);
    try { localStorage.setItem(MAP_DENSITY_LS_KEY, next); } catch { /* ignore */ }
  }, []);

  return { baseStyle, density, changeBaseStyle, changeDensity };
}
