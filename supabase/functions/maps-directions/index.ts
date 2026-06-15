// Supabase Edge Function: Maps Directions (single origin -> destination ETA)
// Dual-provider, hardened (P5 legal-gate migration). STADIA_API_KEY present ->
// Stadia Route (Valhalla, costing auto); absent -> Google Directions
// (GOOGLE_MAPS_SERVER_KEY). Response contract unchanged so the client
// (directionsService) needs no changes.
//
// Runtime: Deno.serve + ZERO remote imports + whole-body try/catch. Auth via
// verify_jwt at the platform layer.
//
// Request:  POST { from:{lat,lng}, to:{lat,lng} }
// Response (200): { result: { minutes, distanceMeters } | null }

const STADIA_API_KEY = Deno.env.get('STADIA_API_KEY');
const GOOGLE_MAPS_SERVER_KEY = Deno.env.get('GOOGLE_MAPS_SERVER_KEY');
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  try {
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    let body: { from?: unknown; to?: unknown };
    try { body = await req.json(); } catch { return json({ error: 'invalid_body' }, 400); }
    if (!isPoint(body.from) || !isPoint(body.to)) return json({ error: 'invalid_input' }, 400);
    const from = body.from, to = body.to;

    const provider = STADIA_API_KEY ? 'stadia' : 'google';
    if (provider === 'google' && !GOOGLE_MAPS_SERVER_KEY) return json({ error: 'maps_not_configured' }, 503);

    if (provider === 'stadia') {
      const reqBody = JSON.stringify({
        locations: [{ lat: from.lat, lon: from.lng }, { lat: to.lat, lon: to.lng }],
        costing: 'auto',
        directions_options: { units: 'kilometers' },
      });
      const url = `https://api.stadiamaps.com/route/v1?api_key=${STADIA_API_KEY}`;
      const res = await fetchWithTimeout(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: reqBody });
      if (!res.ok) return json({ error: 'upstream_error', provider, status: res.status }, 502);
      const data = await res.json();
      const t = data?.trip?.summary;
      if (!t || typeof t.time !== 'number' || typeof t.length !== 'number') return json({ result: null });
      return json({ result: { minutes: Math.round(t.time / 60), distanceMeters: Math.round(t.length * 1000) } });
    }

    // Google fallback
    const url =
      `https://maps.googleapis.com/maps/api/directions/json?origin=${from.lat},${from.lng}` +
      `&destination=${to.lat},${to.lng}&mode=driving&key=${GOOGLE_MAPS_SERVER_KEY}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return json({ error: 'upstream_error', provider, status: res.status }, 502);
    const data = await res.json();
    if (data.status === 'REQUEST_DENIED') return json({ error: 'upstream_error', detail: data.error_message, status: 403 }, 502);
    if (data.status !== 'OK') return json({ result: null, status: data.status });
    const leg = data.routes?.[0]?.legs?.[0];
    const seconds = leg?.duration?.value;
    const meters = leg?.distance?.value;
    if (seconds == null || meters == null) return json({ result: null });
    return json({ result: { minutes: Math.round(seconds / 60), distanceMeters: meters } });
  } catch (e) {
    return json({ error: 'request_failed', detail: e instanceof Error ? e.message : String(e) }, 502);
  }
});
