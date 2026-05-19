// ─────────────────────────────────────────────────────────────────────────────
// useMapViewMode — persisted base-tile mode (roadmap / satellite / terrain /
// hybrid). Default is roadmap (the Coral Cockpit canvas the rest of the
// section is tuned to); the operator's pick survives reloads via
// localStorage under MAP_VIEW_LS_KEY.
//
// changeViewMode wraps setState so callers don't have to remember to write
// through to localStorage themselves.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useState } from 'react';
import { MAP_VIEW_LS_KEY, type MapViewMode } from '../sub/mapLens';

export interface UseMapViewModeResult {
  viewMode: MapViewMode;
  changeViewMode: (next: MapViewMode) => void;
}

export function useMapViewMode(): UseMapViewModeResult {
  const [viewMode, setViewMode] = useState<MapViewMode>(() => {
    if (typeof localStorage === 'undefined') return 'roadmap';
    const saved = localStorage.getItem(MAP_VIEW_LS_KEY);
    return (['roadmap', 'satellite', 'terrain', 'hybrid'] as const).includes(saved as MapViewMode)
      ? (saved as MapViewMode)
      : 'roadmap';
  });
  const changeViewMode = useCallback((next: MapViewMode) => {
    setViewMode(next);
    try { localStorage.setItem(MAP_VIEW_LS_KEY, next); } catch { /* ignore */ }
  }, []);
  return { viewMode, changeViewMode };
}
