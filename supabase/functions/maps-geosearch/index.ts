// Supabase Edge Function: Maps Geosearch (Photon / OSM forward autocomplete)
// Server-side proxy for an OpenStreetMap-based geosearch. Mirrors the
// maps-geocode pattern: auth-gated, server-held upstream URL, timeout, clean
// errors. Powers the MapLibre-path location pickers (P4 of the map rebrand).
//
// WHY a separate, non-Google geosearch: the MapLibre (non-Google) base map may
// NOT legally display Google Places geocodes (Google Maps Service-Specific
// Terms — "No use with a non-Google map"). Photon returns OSM-derived results,
// which both pair legally with the MapLibre map AND are storable long-term
// (Google's are not). When the mapLibreRenderer flag is OFF the client keeps
// using Google Autocomplete directly — this function is only hit on the
// MapLibre path.
//
// UPSTREAM: Photon (https://github.com/komoot/photon). PHOTON_URL is read from
// env and defaults to the komoot PUBLIC demo instance for development. That
// instance is DEV-ONLY (komoot's usage policy bars heavy/production traffic) —
// point PHOTON_URL at the self-hosted Photon box before any real traffic. The
// self-host swap is a pure env change; no client or function-code change.
//
// Request:  POST /functions/v1/maps-geosearch
//   body:   { query: string, limit?: number, lat?: number, lng?: number }
//             lat/lng (optional) bias results toward that point.
//
// Response (200): { results: Array<{ lat, lng, name, address, type }> }
// Response (401): { error: 'unauthorized' }
// Response (400): { error: 'invalid_body' | 'invalid_input' }
// Response (502): { error: 'upstream_error' | 'request_failed', detail?, status? }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Self-hosted Photon takes precedence; falls back to the komoot public demo
// instance (DEV ONLY — see header note).
const PHOTON_URL = (Deno.env.get('PHOTON_URL') ?? 'https://photon.komoot.io').replace(/\/$/, '');

const UPSTREAM_TIMEOUT_MS = 10_000;
const MAX_QUERY_LEN = 200;
const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 10;

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

// Photon returns a GeoJSON FeatureCollection. Each feature carries OSM address
// components in `properties`; compose a single human-readable address line.
interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, string | undefined>;
}
interface PhotonResponse {
  features?: PhotonFeature[];
}

function composeAddress(p: Record<string, string | undefined>): string {
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  const locality = p.city || p.town || p.village || p.district || p.county;
  return [street, locality, p.state, p.country]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(', ');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // Auth — same pattern as the rest of Pulse's edge functions.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (authErr || !user) return json({ error: 'unauthorized' }, 401);

  let body: { query?: string; limit?: number; lat?: number; lng?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const query = (body.query ?? '').trim();
  if (!query || query.length > MAX_QUERY_LEN) return json({ error: 'invalid_input' }, 400);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(body.limit ?? DEFAULT_LIMIT)));

  const params = new URLSearchParams({ q: query, limit: String(limit), lang: 'en' });
  // Optional proximity bias — Photon uses lat/lon.
  if (typeof body.lat === 'number' && typeof body.lng === 'number'
    && body.lat >= -90 && body.lat <= 90 && body.lng >= -180 && body.lng <= 180) {
    params.set('lat', String(body.lat));
    params.set('lon', String(body.lng));
  }

  try {
    const res = await fetchWithTimeout(`${PHOTON_URL}/api?${params.toString()}`);
    if (!res.ok) {
      const detail = await res.text();
      console.error(`[maps-geosearch] upstream ${res.status}:`, detail.slice(0, 300));
      return json({ error: 'upstream_error', status: res.status }, 502);
    }
    const data = (await res.json()) as PhotonResponse;
    const results = (data.features ?? [])
      .map((f) => {
        const coords = f.geometry?.coordinates;
        if (!coords || coords.length < 2) return null;
        const [lng, lat] = coords;
        if (typeof lat !== 'number' || typeof lng !== 'number') return null;
        const props = f.properties ?? {};
        const address = composeAddress(props);
        return {
          lat,
          lng,
          name: props.name ?? null,
          address: address || props.name || '',
          type: props.osm_value || props.type || null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    return json({ results });
  } catch (e) {
    console.error('[maps-geosearch] request failed:', e);
    return json(
      { error: 'request_failed', detail: e instanceof Error ? e.message : 'unknown' },
      502,
    );
  }
});
