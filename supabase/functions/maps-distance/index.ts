// Supabase Edge Function: Maps Distance Matrix
// Server-side proxy for Google Distance Matrix API. Returns the diagonal
// (origin[k] → destination[k]) for a list of point pairs in a single
// batched request — used by the calendar travel-buffer feature.
//
// Request:  POST /functions/v1/maps-distance
//   body:   { pairs: Array<{ from: {lat,lng}, to: {lat,lng} }> }
//
// Response (200): { results: Array<{ minutes, distanceMeters } | null> }
//   (parallel-indexed with input pairs)
// Response (401): { error: 'unauthorized' }
// Response (400): { error: 'invalid_body' | 'invalid_input' | 'no_pairs' | 'too_many_pairs' }
// Response (503): { error: 'maps_not_configured' }
// Response (502): { error: 'upstream_error' | 'request_failed' }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MAPS_KEY = Deno.env.get('GOOGLE_MAPS_SERVER_KEY');

// Google Distance Matrix accepts up to 25 origins × 25 destinations per
// request. Since we only use the diagonal, the practical cap is 25.
const MAX_PAIRS = 25;
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

  let body: { pairs?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  if (!Array.isArray(body.pairs)) return json({ error: 'invalid_input' }, 400);
  if (body.pairs.length === 0) return json({ error: 'no_pairs' }, 400);
  if (body.pairs.length > MAX_PAIRS) return json({ error: 'too_many_pairs', limit: MAX_PAIRS }, 400);

  for (const p of body.pairs) {
    const pp = p as { from?: unknown; to?: unknown };
    if (!pp || !isPoint(pp.from) || !isPoint(pp.to)) {
      return json({ error: 'invalid_input' }, 400);
    }
  }
  const pairs = body.pairs as Array<{ from: { lat: number; lng: number }; to: { lat: number; lng: number } }>;

  const origins = pairs.map(p => `${p.from.lat},${p.from.lng}`).join('|');
  const destinations = pairs.map(p => `${p.to.lat},${p.to.lng}`).join('|');
  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origins)}` +
    `&destinations=${encodeURIComponent(destinations)}&mode=driving&key=${MAPS_KEY}`;

  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      console.error(`[maps-distance] upstream ${res.status}`);
      return json({ error: 'upstream_error', status: res.status }, 502);
    }
    const data = (await res.json()) as DistanceMatrixResponse;
    if (data.status === 'REQUEST_DENIED') {
      console.error('[maps-distance] REQUEST_DENIED:', data.error_message);
      return json({ error: 'upstream_error', detail: data.error_message, status: 403 }, 502);
    }
    if (data.status !== 'OK') {
      return json({ results: new Array(pairs.length).fill(null), status: data.status });
    }

    // Read the diagonal (origin[k] → destination[k]). Cells with
    // status !== 'OK' surface as null so the client falls back.
    const results: Array<{ minutes: number; distanceMeters: number } | null> = pairs.map((_, k) => {
      const cell = data.rows?.[k]?.elements?.[k];
      if (!cell || cell.status !== 'OK') return null;
      const seconds = cell.duration?.value;
      const meters = cell.distance?.value;
      if (seconds == null || meters == null) return null;
      return { minutes: Math.round(seconds / 60), distanceMeters: meters };
    });

    return json({ results });
  } catch (e) {
    console.error('[maps-distance] request failed:', e);
    return json(
      { error: 'request_failed', detail: e instanceof Error ? e.message : 'unknown' },
      502,
    );
  }
});
