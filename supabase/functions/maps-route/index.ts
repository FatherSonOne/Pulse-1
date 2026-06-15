// Supabase Edge Function: Maps Route (multi-stop directions geometry)
// Dual-provider, hardened (P5 legal-gate migration). STADIA_API_KEY present ->
// Stadia Route (Valhalla, costing auto), decode each leg's polyline; absent ->
// Google Directions (GOOGLE_MAPS_SERVER_KEY), decode overview_polyline. Returns
// the route path + total driving duration. Waypoint order is preserved (the AI
// already proposed it). Response contract unchanged so routeService /
// AcceptedRoute need no changes.
//
// IMPORTANT: Valhalla encodes its shape at precision 1e6; Google's
// overview_polyline is 1e5. decodePolyline takes the factor so both decode
// correctly -- using the wrong factor renders the route line garbled.
//
// Runtime: Deno.serve + ZERO remote imports + whole-body try/catch. Auth via
// verify_jwt at the platform layer.
//
// Request:  POST { origin:{lat,lng}, destination:{lat,lng}, waypoints?:Array<{lat,lng}> }
// Response (200): { result: { path: Array<{lat,lng}>, durationSec, durationMin } | null }

const STADIA_API_KEY = Deno.env.get('STADIA_API_KEY');
const GOOGLE_MAPS_SERVER_KEY = Deno.env.get('GOOGLE_MAPS_SERVER_KEY');
const MAX_WAYPOINTS = 25;
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

// Encoded-polyline decoder. `factor` = 1e5 for Google overview_polyline,
// 1e6 for Valhalla shape. Same algorithm, different fixed-point scale.
function decodePolyline(encoded: string, factor: number): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0, lat = 0, lng = 0;
  const len = encoded.length;
  while (index < len) {
    let b: number, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;
    points.push({ lat: lat / factor, lng: lng / factor });
  }
  return points;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  try {
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    let body: { origin?: unknown; destination?: unknown; waypoints?: unknown };
    try { body = await req.json(); } catch { return json({ error: 'invalid_body' }, 400); }
    if (!isPoint(body.origin) || !isPoint(body.destination)) return json({ error: 'invalid_input' }, 400);
    const waypointsRaw = body.waypoints ?? [];
    if (!Array.isArray(waypointsRaw)) return json({ error: 'invalid_input' }, 400);
    if (waypointsRaw.length > MAX_WAYPOINTS) return json({ error: 'too_many_waypoints', limit: MAX_WAYPOINTS }, 400);
    for (const w of waypointsRaw) { if (!isPoint(w)) return json({ error: 'invalid_input' }, 400); }
    const origin = body.origin, destination = body.destination;
    const waypoints = waypointsRaw as Array<{ lat: number; lng: number }>;

    const provider = STADIA_API_KEY ? 'stadia' : 'google';
    if (provider === 'google' && !GOOGLE_MAPS_SERVER_KEY) return json({ error: 'maps_not_configured' }, 503);

    if (provider === 'stadia') {
      const locations = [
        { lat: origin.lat, lon: origin.lng },
        ...waypoints.map(w => ({ lat: w.lat, lon: w.lng })),
        { lat: destination.lat, lon: destination.lng },
      ];
      const reqBody = JSON.stringify({ locations, costing: 'auto', directions_options: { units: 'kilometers' } });
      const url = `https://api.stadiamaps.com/route/v1?api_key=${STADIA_API_KEY}`;
      const res = await fetchWithTimeout(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: reqBody });
      if (!res.ok) return json({ error: 'upstream_error', provider, status: res.status }, 502);
      const data = await res.json();
      const trip = data?.trip;
      const legs = trip?.legs;
      if (!trip || !Array.isArray(legs) || legs.length === 0) return json({ result: null });
      let path: Array<{ lat: number; lng: number }> = [];
      for (const leg of legs) {
        if (typeof leg?.shape === 'string') path = path.concat(decodePolyline(leg.shape, 1e6));
      }
      if (path.length === 0) return json({ result: null });
      const durationSec = Math.round(trip.summary?.time ?? 0);
      return json({ result: { path, durationSec, durationMin: Math.round(durationSec / 60) } });
    }

    // Google fallback
    const originStr = `${origin.lat},${origin.lng}`;
    const destStr = `${destination.lat},${destination.lng}`;
    const waypointsParam = waypoints.map(w => `${w.lat},${w.lng}`).join('|');
    let url =
      `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(originStr)}` +
      `&destination=${encodeURIComponent(destStr)}&mode=driving&key=${GOOGLE_MAPS_SERVER_KEY}`;
    if (waypointsParam) url += `&waypoints=${encodeURIComponent(waypointsParam)}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return json({ error: 'upstream_error', provider, status: res.status }, 502);
    const data = await res.json();
    if (data.status === 'REQUEST_DENIED') return json({ error: 'upstream_error', detail: data.error_message, status: 403 }, 502);
    if (data.status !== 'OK') return json({ result: null, status: data.status });
    const route = data.routes?.[0];
    const encoded = route?.overview_polyline?.points;
    if (!route || !encoded) return json({ result: null });
    const path = decodePolyline(encoded, 1e5);
    if (path.length === 0) return json({ result: null });
    const durationSec = (route.legs ?? []).reduce((acc: number, leg: { duration?: { value?: number } }) => acc + (leg.duration?.value ?? 0), 0);
    return json({ result: { path, durationSec, durationMin: Math.round(durationSec / 60) } });
  } catch (e) {
    return json({ error: 'request_failed', detail: e instanceof Error ? e.message : String(e) }, 502);
  }
});
