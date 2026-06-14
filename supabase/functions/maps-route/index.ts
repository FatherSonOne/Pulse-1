// Supabase Edge Function: Maps Route (multi-stop directions geometry)
// Server-side proxy for the Google Directions API. Given an ordered
// origin → waypoints[] → destination, returns the route's overview
// polyline (decoded to lat/lng points) plus the total driving duration.
//
// Why server-side: same as maps-directions / maps-distance — the REST
// Directions endpoint rejects referer-restricted browser keys, and moving
// this off the client `google.maps.DirectionsService` is P0 of the MapLibre
// rebrand (the map AI strip's Accept-Route action no longer needs Google JS).
//
// Waypoint order is preserved (the AI already proposed the order); we do NOT
// send `optimize:true`, mirroring the old client call's optimizeWaypoints:false.
//
// Request:  POST /functions/v1/maps-route
//   body:   { origin: {lat,lng}, destination: {lat,lng}, waypoints?: Array<{lat,lng}> }
//
// Response (200): { result: { path: Array<{lat,lng}>, durationSec: number, durationMin: number } | null }
// Response (401): { error: 'unauthorized' }
// Response (400): { error: 'invalid_body' | 'invalid_input' | 'too_many_waypoints' }
// Response (503): { error: 'maps_not_configured' }
// Response (502): { error: 'upstream_error' | 'request_failed', detail?, status? }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MAPS_KEY = Deno.env.get('GOOGLE_MAPS_SERVER_KEY');

// Google Directions allows up to 25 waypoints (excluding origin/destination)
// on the standard plan. The map AI strip never proposes anywhere near that.
const MAX_WAYPOINTS = 25;
const UPSTREAM_TIMEOUT_MS = 10_000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = UPSTREAM_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error(`upstream timeout after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

interface DirectionsResponse {
  status: string;
  error_message?: string;
  routes?: Array<{
    overview_polyline?: { points?: string };
    legs?: Array<{
      duration?: { value?: number };
    }>;
  }>;
}

function isPoint(v: unknown): v is { lat: number; lng: number } {
  if (!v || typeof v !== 'object') return false;
  const o = v as { lat?: unknown; lng?: unknown };
  return typeof o.lat === 'number' && typeof o.lng === 'number'
    && o.lat >= -90 && o.lat <= 90 && o.lng >= -180 && o.lng <= 180;
}

// Standard Google encoded-polyline-algorithm decoder. Mirrors what the
// JS API's `route.overview_path` gave the client, so the decoded points
// land in the same `path: {lat,lng}[]` shape the AcceptedRoute expects.
function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const len = encoded.length;
  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!MAPS_KEY) return json({ error: 'maps_not_configured' }, 503);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (authErr || !user) return json({ error: 'unauthorized' }, 401);

  let body: { origin?: unknown; destination?: unknown; waypoints?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  if (!isPoint(body.origin) || !isPoint(body.destination)) {
    return json({ error: 'invalid_input' }, 400);
  }
  const waypointsRaw = body.waypoints ?? [];
  if (!Array.isArray(waypointsRaw)) return json({ error: 'invalid_input' }, 400);
  if (waypointsRaw.length > MAX_WAYPOINTS) {
    return json({ error: 'too_many_waypoints', limit: MAX_WAYPOINTS }, 400);
  }
  for (const w of waypointsRaw) {
    if (!isPoint(w)) return json({ error: 'invalid_input' }, 400);
  }
  const waypoints = waypointsRaw as Array<{ lat: number; lng: number }>;

  const origin = `${body.origin.lat},${body.origin.lng}`;
  const destination = `${body.destination.lat},${body.destination.lng}`;
  // No `optimize:true` prefix — preserve the AI-proposed order (the old
  // client call used optimizeWaypoints:false).
  const waypointsParam = waypoints.map(w => `${w.lat},${w.lng}`).join('|');

  let url =
    `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(destination)}&mode=driving&key=${MAPS_KEY}`;
  if (waypointsParam) url += `&waypoints=${encodeURIComponent(waypointsParam)}`;

  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      console.error(`[maps-route] upstream ${res.status}`);
      return json({ error: 'upstream_error', status: res.status }, 502);
    }
    const data = (await res.json()) as DirectionsResponse;
    if (data.status === 'REQUEST_DENIED') {
      console.error('[maps-route] REQUEST_DENIED:', data.error_message);
      return json({ error: 'upstream_error', detail: data.error_message, status: 403 }, 502);
    }
    if (data.status !== 'OK') {
      return json({ result: null, status: data.status });
    }
    const route = data.routes?.[0];
    const encoded = route?.overview_polyline?.points;
    if (!route || !encoded) return json({ result: null });

    const path = decodePolyline(encoded);
    if (path.length === 0) return json({ result: null });

    const durationSec = (route.legs ?? []).reduce(
      (acc, leg) => acc + (leg.duration?.value ?? 0),
      0,
    );

    return json({
      result: {
        path,
        durationSec,
        durationMin: Math.round(durationSec / 60),
      },
    });
  } catch (e) {
    console.error('[maps-route] request failed:', e);
    return json(
      { error: 'request_failed', detail: e instanceof Error ? e.message : 'unknown' },
      502,
    );
  }
});
