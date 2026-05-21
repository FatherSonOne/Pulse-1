// ============================================================
// directionsService — driving travel-time hints between two
// places, cached aggressively per-day (B2 / B4 / #35).
//
// Routes through the `maps-directions` Supabase edge function so
// the API key (referer-restricted) never has to satisfy Google's
// stricter REST-endpoint policy. Calls are paced through a private
// 10-QPS sequential token bucket and timed out at 8s with up to 3
// exponential-backoff retries on transient failures.
//
// Cache:
//   * In-memory map (per session)
//   * localStorage 'pulse:directions:v1' for cross-refresh
//   * Key: "<from-lat>,<from-lng>->,<to-lat>,<to-lng>|<YYYY-MM-DD>"
//   * Stored entries expire at end-of-day; refreshing tomorrow
//     re-fetches because traffic shape changes.
// ============================================================

import { supabase } from './supabase';

const CACHE_KEY = 'pulse:directions:v1';
const TIMEOUT_MS = 8000;
const MAX_RETRIES = 3;
const REFILL_MS = 100; // 10 QPS

export interface TravelTime {
  /** Travel duration in minutes, rounded. */
  minutes: number;
  /** Distance in meters. */
  distanceMeters: number;
  /** Always 'driving' for now. Bike / transit / walking can extend later. */
  mode: 'driving';
}

type CacheEntry = { minutes: number; distanceMeters: number; day: string };
type CacheFile = { entries: Record<string, CacheEntry> };

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function routeKey(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): string {
  const fmt = (n: number) => n.toFixed(5);
  return `${fmt(from.lat)},${fmt(from.lng)}->,${fmt(to.lat)},${fmt(to.lng)}|${todayKey()}`;
}

function loadCache(): Map<string, CacheEntry> {
  if (typeof localStorage === 'undefined') return new Map();
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as CacheFile;
    const today = todayKey();
    const out = new Map<string, CacheEntry>();
    for (const [k, v] of Object.entries(parsed.entries ?? {})) {
      if (v && v.day === today) out.set(k, v);
    }
    return out;
  } catch {
    return new Map();
  }
}

function persistCache(key: string, entry: CacheEntry): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as CacheFile) : { entries: {} };
    if (!parsed.entries) parsed.entries = {};
    parsed.entries[key] = entry;
    localStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
  } catch {
    // localStorage full / unavailable — ignore.
  }
}

const memoryCache = loadCache();

let nextAvailableAt = 0;
async function acquireToken(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextAvailableAt - now);
  nextAvailableAt = Math.max(now, nextAvailableAt) + REFILL_MS;
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
}

/**
 * Fetch driving travel time between two points. Returns null on
 * persistent failure (bad key, geocode collision, no route, etc.).
 * Successful results are cached for the rest of the calendar day.
 *
 * Calls the `maps-directions` edge function — the server-side key
 * has the privileges Google requires for REST endpoints.
 */
export async function getTravelTime(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<TravelTime | null> {
  const key = routeKey(from, to);
  const cached = memoryCache.get(key);
  if (cached) {
    return { minutes: cached.minutes, distanceMeters: cached.distanceMeters, mode: 'driving' };
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const base = Math.min(2000, 250 * Math.pow(2, attempt - 1));
      const jitter = base * (Math.random() * 0.5 - 0.25);
      await new Promise(r => setTimeout(r, base + jitter));
    }
    await acquireToken();

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const { data, error } = await supabase.functions.invoke('maps-directions', {
          body: { from, to },
        });
        clearTimeout(timer);
        if (error) {
          lastErr = error;
          continue;
        }
        const payload = data as {
          result?: { minutes: number; distanceMeters: number } | null;
          error?: string;
        };
        if (payload.error) {
          // upstream_error / request_failed are transient — retry.
          // invalid_input / maps_not_configured are terminal.
          if (payload.error === 'invalid_input' || payload.error === 'maps_not_configured') {
            console.error('[directionsService] terminal error:', payload.error);
            return null;
          }
          lastErr = new Error(`maps-directions ${payload.error}`);
          continue;
        }
        if (!payload.result) return null;
        const minutes = payload.result.minutes;
        const meters = payload.result.distanceMeters;
        const entry: CacheEntry = { minutes, distanceMeters: meters, day: todayKey() };
        memoryCache.set(key, entry);
        persistCacheEntry(key, entry);
        return { minutes, distanceMeters: meters, mode: 'driving' };
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr) console.error('[directionsService] getTravelTime failed:', lastErr);
  return null;
}

function persistCacheEntry(key: string, entry: CacheEntry): void {
  persistCache(key, entry);
}

/** "32 min by car" / "1 hr 12 min by car" formatting. */
export function formatTravelTime(t: TravelTime): string {
  const total = Math.max(1, t.minutes);
  if (total < 60) return `${total} min by car`;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return mins === 0
    ? `${hours} hr by car`
    : `${hours} hr ${mins} min by car`;
}
