// Supabase Edge Function: Maps Geocode (forward + reverse)
// Dual-provider, hardened (P5 legal-gate migration). STADIA_API_KEY present ->
// Stadia (Pelias) geocoding; absent -> Google Geocoding (GOOGLE_MAPS_SERVER_KEY)
// as a fallback. A non-Google map may not display Google geocodes, so Stadia is
// the path that lets the MapLibre map show address-derived pins legally; OSM
// geocodes are also storable long-term (Google's are not).
//
// Runtime: Deno.serve + ZERO remote imports + whole-body try/catch. A fresh
// API-deploy of the prior deno.land/esm.sh version crashed at boot (502
// EDGE_FUNCTION_ERROR). Auth is the platform's job via verify_jwt.
//
// Request:  POST { kind:'forward', address } | { kind:'reverse', lat, lng }
// Response (200): { result: { lat, lng, formatted_address } | null }
// Response (400/502/503): { error: ... }

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  try {
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    let body: { kind?: string; address?: string; lat?: number; lng?: number };
    try { body = await req.json(); } catch { return json({ error: 'invalid_body' }, 400); }

    const provider = STADIA_API_KEY ? 'stadia' : 'google';
    if (provider === 'google' && !GOOGLE_MAPS_SERVER_KEY) return json({ error: 'maps_not_configured' }, 503);

    if (body.kind === 'forward') {
      const addr = (body.address ?? '').trim();
      if (!addr || addr.length > 500) return json({ error: 'invalid_input' }, 400);

      if (provider === 'stadia') {
        const url = `https://api.stadiamaps.com/geocoding/v1/search?text=${encodeURIComponent(addr)}&size=1&api_key=${STADIA_API_KEY}`;
        const res = await fetchWithTimeout(url);
        if (!res.ok) return json({ error: 'upstream_error', provider, status: res.status }, 502);
        const data = await res.json();
        const f = data?.features?.[0];
        const c = f?.geometry?.coordinates;
        if (!f || !Array.isArray(c) || c.length < 2) return json({ result: null });
        return json({ result: { lat: c[1], lng: c[0], formatted_address: f.properties?.label ?? null } });
      }
      // Google fallback
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&key=${GOOGLE_MAPS_SERVER_KEY}`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) return json({ error: 'upstream_error', provider, status: res.status }, 502);
      const data = await res.json();
      if (data.status === 'REQUEST_DENIED') return json({ error: 'upstream_error', detail: data.error_message, status: 403 }, 502);
      if (data.status === 'OK' && data.results?.[0]) {
        const first = data.results[0];
        const loc = first.geometry?.location;
        return json({ result: { lat: loc?.lat ?? null, lng: loc?.lng ?? null, formatted_address: first.formatted_address ?? null } });
      }
      return json({ result: null, status: data.status });

    } else if (body.kind === 'reverse') {
      const lat = body.lat, lng = body.lng;
      if (typeof lat !== 'number' || typeof lng !== 'number') return json({ error: 'invalid_input' }, 400);
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return json({ error: 'invalid_input' }, 400);

      if (provider === 'stadia') {
        const url = `https://api.stadiamaps.com/geocoding/v1/reverse?point.lat=${lat}&point.lon=${lng}&size=1&api_key=${STADIA_API_KEY}`;
        const res = await fetchWithTimeout(url);
        if (!res.ok) return json({ error: 'upstream_error', provider, status: res.status }, 502);
        const data = await res.json();
        const f = data?.features?.[0];
        if (!f) return json({ result: null });
        const c = f.geometry?.coordinates;
        return json({ result: { lat: Array.isArray(c) ? c[1] : lat, lng: Array.isArray(c) ? c[0] : lng, formatted_address: f.properties?.label ?? null } });
      }
      // Google fallback
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_SERVER_KEY}`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) return json({ error: 'upstream_error', provider, status: res.status }, 502);
      const data = await res.json();
      if (data.status === 'REQUEST_DENIED') return json({ error: 'upstream_error', detail: data.error_message, status: 403 }, 502);
      if (data.status === 'OK' && data.results?.[0]) {
        const first = data.results[0];
        const loc = first.geometry?.location;
        return json({ result: { lat: loc?.lat ?? lat, lng: loc?.lng ?? lng, formatted_address: first.formatted_address ?? null } });
      }
      return json({ result: null, status: data.status });
    }

    return json({ error: 'invalid_input' }, 400);
  } catch (e) {
    return json({ error: 'request_failed', detail: e instanceof Error ? e.message : String(e) }, 502);
  }
});
