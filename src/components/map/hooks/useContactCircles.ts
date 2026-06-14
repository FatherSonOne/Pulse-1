// ─────────────────────────────────────────────────────────────────────────────
// useContactCircles — circle source for the Map.
//
// App.tsx currently mounts PulseMapView with `circles={[]}` because it doesn't
// lift the Contacts circle store up to the app shell. Left as-is, that starves
// every circle-driven Map surface — the circle filter chips, the Atlas
// territory hulls, the per-circle MapCircleOverlay, and the circle context the
// Atlas AI insight reads. Rather than leave that built surface dark, self-fetch
// the user's circles when the prop comes back empty — the same self-fetch
// fallback useGeoRelevanceSignals already uses for events/threads.
//
// Contract: the prop wins. When a parent DOES supply a non-empty circles array
// (a future App lift, or a test), no fetch runs and the prop is returned
// verbatim. getCircles itself falls back to localStorage and returns [] on
// total failure, so the worst case is the prior behaviour (no circles).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import type { ContactCircle } from '../../../types/contactCircleTypes';
import { getCircles } from '../../../services/contactCircleService';

export function useContactCircles(
  circlesProp: ContactCircle[],
  userId: string,
): ContactCircle[] {
  const [fetched, setFetched] = useState<ContactCircle[]>([]);
  const needsSelfFetch = circlesProp.length === 0 && !!userId;

  useEffect(() => {
    if (!needsSelfFetch) return;
    let cancelled = false;
    getCircles(userId)
      .then(list => { if (!cancelled) setFetched(list); })
      .catch(() => { /* getCircles already localStorage-falls-back; [] on total failure */ });
    return () => { cancelled = true; };
  }, [needsSelfFetch, userId]);

  return circlesProp.length > 0 ? circlesProp : fetched;
}
