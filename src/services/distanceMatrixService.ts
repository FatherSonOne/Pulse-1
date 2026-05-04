// ============================================================
// distanceMatrixService — batched driving travel-time matrix via
// Google's Distance Matrix REST API (B4 / #35).
//
// Why batched: B4's calendar travel-buffer feature computes travel
// for every consecutive pair of events with locations. With 6 events
// in a day we'd fire 5 separate Directions calls; with Distance
// Matrix we send all 5 origin/destination pairs in one HTTP call
// and read the diagonal of the response matrix.
//
// Cache key includes day-of-week (mon/tue/.../sun) and is valid for
// 7 days — same Tuesday-9am route reuses last Tuesday's number,
// because traffic shape is more about day-of-week than calendar date.
//
// Token bucket: separate from Geocoding and Directions so the three
// quotas are independently capped.
// ============================================================

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

const CACHE_KEY = 'pulse:distance-matrix:v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 8000;
const MAX_RETRIES = 3;
const REFILL_MS = 100; // 10 QPS

export interface MatrixCell {
  /** Driving time in whole minutes, rounded. */
  minutes: number;
  distanceMeters: number;
}

interface CacheEntry extends MatrixCell {
  /** Unix ms when cached — for the 7-day TTL check. */
  ts: number;
  /** Day of week for the cache key, redundant but useful for manual inspection. */
  dow: string;
}

type CacheFile = { entries: Record<string, CacheEntry> };

const DOW_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function dayOfWeek(d: Date): string {
  return DOW_NAMES[d.getDay()];
}

function pairKey(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  dow: string,
): string {
  const f = (n: number) => n.toFixed(5);
  return `${f(from.lat)},${f(from.lng)}->,${f(to.lat)},${f(to.lng)}|${dow}`;
}

function loadCache(): Map<string, CacheEntry> {
  if (typeof localStorage === 'undefined') return new Map();
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as CacheFile;
    const cutoff = Date.now() - CACHE_TTL_MS;
    const out = new Map<string, CacheEntry>();
    for (const [k, v] of Object.entries(parsed.entries ?? {})) {
      if (v && typeof v.ts === 'number' && v.ts >= cutoff) out.set(k, v);
    }
    return out;
  } catch {
    return new Map();
  }
}

function persistCacheEntry(key: string, entry: CacheEntry): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as CacheFile) : { entries: {} };
    if (!parsed.entries) parsed.entries = {};
    parsed.entries[key] = entry;
    localStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
  } catch {
    // localStorage unavailable — ignore.
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

interface DistanceMatrixResponse {
  status: string;
  error_message?: string;
  rows?: Array<{
    elements?: Array<{
      status: string;
      duration?: { value?: number };
      distance?: { value?: number };
    }>;
  }>;
}

interface PairInput {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  /** When this leg occurs — used for the day-of-week cache key. Defaults to now. */
  day?: Date;
}

/**
 * Returns travel times for every pair, parallel-indexed. null at
 * index i if that leg couldn't be computed (no route, geocode
 * collision, persistent API failure). Successful legs are cached
 * for 7 days keyed by day-of-week.
 */
export async function getTravelTimesForPairs(
  pairs: PairInput[],
): Promise<Array<MatrixCell | null>> {
  const out: Array<MatrixCell | null> = new Array(pairs.length).fill(null);
  if (pairs.length === 0 || !API_KEY) return out;

  // First pass — cache hits.
  const uncachedIndices: number[] = [];
  for (let i = 0; i < pairs.length; i++) {
    const dow = dayOfWeek(pairs[i].day ?? new Date());
    const key = pairKey(pairs[i].from, pairs[i].to, dow);
    const cached = memoryCache.get(key);
    if (cached) {
      out[i] = { minutes: cached.minutes, distanceMeters: cached.distanceMeters };
    } else {
      uncachedIndices.push(i);
    }
  }
  if (uncachedIndices.length === 0) return out;

  // Single batched request — full matrix, but we read only the diagonal
  // (origin[k] → destination[k]).
  const origins = uncachedIndices
    .map(i => `${pairs[i].from.lat},${pairs[i].from.lng}`)
    .join('|');
  const destinations = uncachedIndices
    .map(i => `${pairs[i].to.lat},${pairs[i].to.lng}`)
    .join('|');
  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origins)}` +
    `&destinations=${encodeURIComponent(destinations)}&mode=driving&key=${API_KEY}`;

  let lastErr: unknown;
  let response: DistanceMatrixResponse | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const base = Math.min(2000, 250 * Math.pow(2, attempt - 1));
      const jitter = base * (Math.random() * 0.5 - 0.25);
      await new Promise(r => setTimeout(r, base + jitter));
    }
    await acquireToken();

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        lastErr = new Error(`distancematrix http ${res.status}`);
        continue;
      }
      const data = (await res.json()) as DistanceMatrixResponse;
      if (data.status === 'OVER_QUERY_LIMIT' || data.status === 'UNKNOWN_ERROR') {
        lastErr = new Error(`distancematrix google ${data.status}`);
        continue;
      }
      if (data.status !== 'OK') {
        // REQUEST_DENIED / INVALID_REQUEST / MAX_*_EXCEEDED — terminal.
        return out;
      }
      response = data;
      break;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
    }
  }

  if (!response) {
    if (lastErr) console.error('[distanceMatrixService] batch failed:', lastErr);
    return out;
  }

  for (let k = 0; k < uncachedIndices.length; k++) {
    const i = uncachedIndices[k];
    const cell = response.rows?.[k]?.elements?.[k];
    if (!cell || cell.status !== 'OK') continue;
    const seconds = cell.duration?.value;
    const meters = cell.distance?.value;
    if (seconds == null || meters == null) continue;
    const minutes = Math.round(seconds / 60);
    const dow = dayOfWeek(pairs[i].day ?? new Date());
    const key = pairKey(pairs[i].from, pairs[i].to, dow);
    const entry: CacheEntry = { minutes, distanceMeters: meters, ts: Date.now(), dow };
    memoryCache.set(key, entry);
    persistCacheEntry(key, entry);
    out[i] = { minutes, distanceMeters: meters };
  }

  return out;
}

/** Compact format for the agenda buffer chip: "22 min" / "1 hr 5 min". */
export function formatBufferTime(cell: MatrixCell): string {
  const total = Math.max(1, cell.minutes);
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return mins === 0 ? `${hours} hr` : `${hours} hr ${mins} min`;
}
