// Supabase Edge Function: Maps Geocode
// Server-side proxy for Google Geocoding API. Mirrors the ai-router /
// gemini-embed pattern: auth-gated, server-held key, timeout, clean errors.
//
// Why server-side: Google Geocoding API silently rejects keys that have
// HTTP referer restrictions configured (a separate policy from the Maps
// JS SDK). Routing through this function lets the client-facing key keep
// referer restrictions while the server-side key restricted by IP can hit
// the REST endpoint freely.
//
// Request:  POST /functions/v1/maps-geocode
//   body:   { kind: 'forward', address: string }
//     or:   { kind: 'reverse', lat: number, lng: number }
//
// Response (200): { result: { lat, lng, formatted_address } | null }
// Response (401): { error: 'unauthorized' }
// Response (400): { error: 'invalid_body' | 'invalid_input' }
// Response (503): { error: 'maps_not_configured' }   // server key missing
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

interface GeocodeResponse {
  status: string;
  error_message?: string;
  results?: Array<{
    geometry?: { location?: { lat?: number; lng?: number } };
    formatted_address?: string;
  }>;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!MAPS_KEY) return json({ error: 'maps_not_configured' }, 503);

  // Auth — same pattern as the rest of Pulse's edge functions.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (authErr || !user) return json({ error: 'unauthorized' }, 401);

  let body: { kind?: string; address?: string; lat?: number; lng?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  // Build the Google URL based on kind. Both forward and reverse use the
  // same /geocode/json endpoint with different query params.
  let url: string;
  if (body.kind === 'forward') {
    const addr = (body.address ?? '').trim();
    if (!addr || addr.length > 500) return json({ error: 'invalid_input' }, 400);
    url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&key=${MAPS_KEY}`;
  } else if (body.kind === 'reverse') {
    const { lat, lng } = body;
    if (typeof lat !== 'number' || typeof lng !== 'number') return json({ error: 'invalid_input' }, 400);
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return json({ error: 'invalid_input' }, 400);
    url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${MAPS_KEY}`;
  } else {
    return json({ error: 'invalid_input' }, 400);
  }

  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      const detail = await res.text();
      console.error(`[maps-geocode] upstream ${res.status}:`, detail);
      return json({ error: 'upstream_error', status: res.status }, 502);
    }
    const data = (await res.json()) as GeocodeResponse;

    if (data.status === 'OK' && data.results?.[0]) {
      const first = data.results[0];
      const loc = first.geometry?.location;
      return json({
        result: {
          lat: typeof loc?.lat === 'number' ? loc.lat : null,
          lng: typeof loc?.lng === 'number' ? loc.lng : null,
          formatted_address: first.formatted_address ?? null,
        },
      });
    }
    // ZERO_RESULTS / NOT_FOUND / over_query_limit — return null so the client
    // can fall back gracefully without retrying.
    if (data.status === 'REQUEST_DENIED') {
      console.error('[maps-geocode] REQUEST_DENIED:', data.error_message);
      return json({ error: 'upstream_error', detail: data.error_message, status: 403 }, 502);
    }
    return json({ result: null, status: data.status });
  } catch (e) {
    console.error('[maps-geocode] request failed:', e);
    return json(
      { error: 'request_failed', detail: e instanceof Error ? e.message : 'unknown' },
      502,
    );
  }
});
