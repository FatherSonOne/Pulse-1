// Supabase Edge Function: Maps Directions
// Server-side proxy for Google Directions API. Returns travel-time +
// distance for a single origin → destination, mode=driving.
//
// Why server-side: same as maps-geocode — Directions API also rejects
// referer-restricted keys when called from a browser fetch.
//
// Request:  POST /functions/v1/maps-directions
//   body:   { from: {lat, lng}, to: {lat, lng} }
//
// Response (200): { result: { minutes: number, distanceMeters: number } | null }
// Response (401): { error: 'unauthorized' }
// Response (400): { error: 'invalid_body' | 'invalid_input' }
// Response (503): { error: 'maps_not_configured' }
// Response (502): { error: 'upstream_error' | 'request_failed', detail?, status? }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MAPS_KEY = Deno.env.get('GOOGLE_MAPS_SERVER_KEY');

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
    legs?: Array<{
      duration?: { value?: number };
      distance?: { value?: number };
    }>;
  }>;
}

function isPoint(v: unknown): v is { lat: number; lng: number } {
  if (!v || typeof v !== 'object') return false;
  const o = v as { lat?: unknown; lng?: unknown };
  return typeof o.lat === 'number' && typeof o.lng === 'number'
    && o.lat >= -90 && o.lat <= 90 && o.lng >= -180 && o.lng <= 180;
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

  let body: { from?: unknown; to?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  if (!isPoint(body.from) || !isPoint(body.to)) return json({ error: 'invalid_input' }, 400);

  const url =
    `https://maps.googleapis.com/maps/api/directions/json?origin=${body.from.lat},${body.from.lng}` +
    `&destination=${body.to.lat},${body.to.lng}&mode=driving&key=${MAPS_KEY}`;

  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      console.error(`[maps-directions] upstream ${res.status}`);
      return json({ error: 'upstream_error', status: res.status }, 502);
    }
    const data = (await res.json()) as DirectionsResponse;
    if (data.status === 'REQUEST_DENIED') {
      console.error('[maps-directions] REQUEST_DENIED:', data.error_message);
      return json({ error: 'upstream_error', detail: data.error_message, status: 403 }, 502);
    }
    if (data.status !== 'OK') {
      return json({ result: null, status: data.status });
    }
    const leg = data.routes?.[0]?.legs?.[0];
    const seconds = leg?.duration?.value;
    const meters = leg?.distance?.value;
    if (seconds == null || meters == null) return json({ result: null });
    return json({
      result: {
        minutes: Math.round(seconds / 60),
        distanceMeters: meters,
      },
    });
  } catch (e) {
    console.error('[maps-directions] request failed:', e);
    return json(
      { error: 'request_failed', detail: e instanceof Error ? e.message : 'unknown' },
      502,
    );
  }
});
