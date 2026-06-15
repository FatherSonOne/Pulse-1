// Supabase Edge Function: Maps Distance Matrix (diagonal of point pairs)
// Dual-provider, hardened (P5 legal-gate migration). STADIA_API_KEY present ->
// Stadia Matrix (Valhalla sources_to_targets, diagonal cell k,k per pair);
// absent -> Google Distance Matrix (GOOGLE_MAPS_SERVER_KEY). Response contract
// unchanged so the client (distanceMatrixService / calendar travel buffers)
// needs no changes.
//
// Runtime: Deno.serve + ZERO remote imports + whole-body try/catch. Auth via
// verify_jwt at the platform layer.
//
// Request:  POST { pairs: Array<{ from:{lat,lng}, to:{lat,lng} }> }  (<=25)
// Response (200): { results: Array<{ minutes, distanceMeters } | null> }
//   (parallel-indexed with input pairs; unreachable -> null)

const STADIA_API_KEY = Deno.env.get('STADIA_API_KEY');
const GOOGLE_MAPS_SERVER_KEY = Deno.env.get('GOOGLE_MAPS_SERVER_KEY');
const MAX_PAIRS = 25;
const UPSTREAM_TIMEOUT_MS = 10_000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

function isPoint(v: unknown): v is { lat: number; lng: number } {
  if (!v || typeof v !== 'object') return false;
  const o = v as { lat?: unknown; lng?: unknown };
  return typeof o.lat === 'number' && typeof o.lng === 'number'
    && o.lat >= -90 && o.lat <= 90 && o.lng >= -180 && o.lng <= 180;
}

type Cell = { minutes: number; distanceMeters: number } | null;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  try {
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    let body: { pairs?: unknown };
    try { body = await req.json(); } catch { return json({ error: 'invalid_body' }, 400); }
    if (!Array.isArray(body.pairs)) return json({ error: 'invalid_input' }, 400);
    if (body.pairs.length === 0) return json({ error: 'no_pairs' }, 400);
    if (body.pairs.length > MAX_PAIRS) return json({ error: 'too_many_pairs', limit: MAX_PAIRS }, 400);
    for (const p of body.pairs) {
      const pp = p as { from?: unknown; to?: unknown };
      if (!pp || !isPoint(pp.from) || !isPoint(pp.to)) return json({ error: 'invalid_input' }, 400);
    }
    const pairs = body.pairs as Array<{ from: { lat: number; lng: number }; to: { lat: number; lng: number } }>;

    const provider = STADIA_API_KEY ? 'stadia' : 'google';
    if (provider === 'google' && !GOOGLE_MAPS_SERVER_KEY) return json({ error: 'maps_not_configured' }, 503);

    if (provider === 'stadia') {
      const reqBody = JSON.stringify({
        sources: pairs.map(p => ({ lat: p.from.lat, lon: p.from.lng })),
        targets: pairs.map(p => ({ lat: p.to.lat, lon: p.to.lng })),
        costing: 'auto',
        units: 'kilometers',
      });
      const url = `https://api.stadiamaps.com/matrix/v1?api_key=${STADIA_API_KEY}`;
      const res = await fetchWithTimeout(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: reqBody });
      if (!res.ok) return json({ error: 'upstream_error', provider, status: res.status }, 502);
      const data = await res.json();
      const matrix = data?.sources_to_targets;
      // Read the diagonal: pair k = source[k] -> target[k] = matrix[k][k].
      const results: Cell[] = pairs.map((_, k) => {
        const cell = Array.isArray(matrix) ? matrix?.[k]?.[k] : undefined;
        if (!cell || typeof cell.time !== 'number' || typeof cell.distance !== 'number') return null;
        return { minutes: Math.round(cell.time / 60), distanceMeters: Math.round(cell.distance * 1000) };
      });
      return json({ results });
    }

    // Google fallback
    const origins = pairs.map(p => `${p.from.lat},${p.from.lng}`).join('|');
    const destinations = pairs.map(p => `${p.to.lat},${p.to.lng}`).join('|');
    const url =
      `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origins)}` +
      `&destinations=${encodeURIComponent(destinations)}&mode=driving&key=${GOOGLE_MAPS_SERVER_KEY}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return json({ error: 'upstream_error', provider, status: res.status }, 502);
    const data = await res.json();
    if (data.status === 'REQUEST_DENIED') return json({ error: 'upstream_error', detail: data.error_message, status: 403 }, 502);
    if (data.status !== 'OK') return json({ results: new Array(pairs.length).fill(null), status: data.status });
    const results: Cell[] = pairs.map((_, k) => {
      const cell = data.rows?.[k]?.elements?.[k];
      if (!cell || cell.status !== 'OK') return null;
      const seconds = cell.duration?.value;
      const meters = cell.distance?.value;
      if (seconds == null || meters == null) return null;
      return { minutes: Math.round(seconds / 60), distanceMeters: meters };
    });
    return json({ results });
  } catch (e) {
    return json({ error: 'request_failed', detail: e instanceof Error ? e.message : String(e) }, 502);
  }
});
