// ─────────────────────────────────────────────────────────────────────────────
// useMapLibreRenderer — resolves whether the MapLibre renderer is active.
//
// Canonical source is the FeatureContext `mapLibreRenderer` flag (default OFF).
// Layered on top is a dev override `?ff_mapLibreRenderer=on|off` (persisted to
// localStorage), mirroring the lib/featureFlags `?ff_` convention — so the spike
// is togglable locally without a Settings UI (the flag is deliberately not
// surfaced as a Settings toggle yet; it has no production consumer).
// ─────────────────────────────────────────────────────────────────────────────

import { useFeatures } from '../../../contexts/FeatureContext';

function readDevOverride(): boolean | null {
  if (typeof window === 'undefined') return null;
  const key = 'ff_mapLibreRenderer';
  try {
    const params = new URLSearchParams(window.location.search);
    const q = params.get(key);
    if (q === 'on' || q === '1' || q === 'true') {
      window.localStorage.setItem(key, 'on');
      return true;
    }
    if (q === 'off' || q === '0' || q === 'false') {
      window.localStorage.setItem(key, 'off');
      return false;
    }
    const stored = window.localStorage.getItem(key);
    if (stored === 'on') return true;
    if (stored === 'off') return false;
  } catch {
    // private browsing / blocked storage — fall through to the context value.
  }
  return null;
}

export function useMapLibreRenderer(): boolean {
  const { features } = useFeatures();
  const override = readDevOverride();
  return override ?? features.mapLibreRenderer;
}
