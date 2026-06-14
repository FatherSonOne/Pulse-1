// ============================================================
// routeService — multi-stop driving route geometry (overview
// polyline + total driving duration) via the `maps-route`
// Supabase edge function.
//
// Used by the Map AI strip's Accept-Route action (useMapAiProposals).
// Routing this server-side removes the last `google.maps.DirectionsService`
// dependency from the map's accept path — P0 of the MapLibre rebrand — and
// keeps the referer-restricted browser key off Google's REST endpoint
// (the server holds the unrestricted GOOGLE_MAPS_SERVER_KEY).
//
// One-shot per user action, so unlike directionsService there is no cache
// or token bucket here — just a short retry on transient failure.
// ============================================================

import { supabase } from './supabase';

export interface DrivingRoute {
  /** Decoded overview polyline as lat/lng points. */
  path: Array<{ lat: number; lng: number }>;
  /** Total driving duration across all legs, in seconds. */
  durationSec: number;
  /** Total driving duration across all legs, in minutes (rounded). */
  durationMin: number;
}

const TIMEOUT_MS = 12_000;
const MAX_RETRIES = 2;

/**
 * Fetch the driving route geometry for an ordered origin → waypoints →
 * destination. Waypoint order is preserved (the edge function does not
 * optimize). Returns null on persistent failure or no-route — the caller
 * leaves the UI as-is so the user can retry.
 */
export async function getDrivingRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  waypoints: Array<{ lat: number; lng: number }> = [],
): Promise<DrivingRoute | null> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const base = Math.min(2000, 300 * Math.pow(2, attempt - 1));
      const jitter = base * (Math.random() * 0.5 - 0.25);
      await new Promise(r => setTimeout(r, base + jitter));
    }

    // supabase-js invoke() takes no AbortSignal, so race it against a real
    // timeout — otherwise a hung socket could leave the Accept button
    // spinning forever. The abandoned invoke resolves harmlessly in the bg.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('maps-route client timeout')), TIMEOUT_MS);
      });
      const { data, error } = await Promise.race([
        supabase.functions.invoke('maps-route', {
          body: { origin, destination, waypoints },
        }),
        timeout,
      ]);
      if (error) {
        lastErr = error;
        continue;
      }
      const payload = data as {
        result?: DrivingRoute | null;
        error?: string;
      };
      if (payload.error) {
        // invalid_input / maps_not_configured / too_many_waypoints are
        // terminal — no point retrying. Everything else (upstream_error /
        // request_failed) is transient.
        if (
          payload.error === 'invalid_input' ||
          payload.error === 'maps_not_configured' ||
          payload.error === 'too_many_waypoints'
        ) {
          console.error('[routeService] terminal error:', payload.error);
          return null;
        }
        lastErr = new Error(`maps-route ${payload.error}`);
        continue;
      }
      return payload.result ?? null;
    } catch (err) {
      lastErr = err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  if (lastErr) console.error('[routeService] getDrivingRoute failed:', lastErr);
  return null;
}
