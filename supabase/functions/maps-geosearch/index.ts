// Supabase Edge Function: Maps Geosearch (Photon / OSM forward autocomplete)
// Server-side proxy for an OpenStreetMap-based geosearch. Powers the MapLibre-
// path location pickers (P4 of the map rebrand).
//
// WHY a separate, non-Google geosearch: the MapLibre (non-Google) base map may
// NOT legally display Google Places geocodes (Google Maps Service-Specific
// Terms — "No use with a non-Google map"). Photon returns OSM-derived results,
// which both pair legally with the MapLibre map AND are storable long-term.
// When the mapLibreRenderer flag is OFF the client keeps using Google
// Autocomplete directly — this function is only hit on the MapLibre path.
//
// RUNTIME NOTES (learned the hard way, 2026-06-15):
//  - Uses the runtime-native `Deno.serve` and ZERO remote imports. The earlier
//    version imported `serve` from deno.land/std + `createClient` from esm.sh;
//    a freshly API-deployed function crashed at boot (502 EDGE_FUNCTION_ERROR,
//    an UNCAUGHT throw the gateway reports) fetching those. The whole body is
//    now wrapped in try/catch so any failure returns a clean JSON error instead.
//  - Auth: with verify_jwt enabled the platform gates this before our code
//    runs, so a valid user JWT is guaranteed — no in-function token check (and
//    no supabase-js client) needed.
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
// Response (400): { error: 'invalid_body' | 'invalid_input' }
// Response (500/502): { error: 'request_failed' | 'upstream_error', detail?, status? }

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

// Compose a single human-readable address line from Photon's OSM properties.
function composeAddress(p: Record<string, string | undefined>): string {
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  const locality = p.city || p.town || p.village || p.district || p.county;
  return [street, locality, p.state, p.country]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(', ');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  // Everything is wrapped so no throw can escape as an opaque EDGE_FUNCTION_ERROR;
  // failures come back as a readable JSON body instead.
  try {
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    let body: { query?: string; limit?: number; lat?: number; lng?: number };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'invalid_body' }, 400);
    }

    const query = (body?.query ?? '').trim();
    if (!query || query.length > MAX_QUERY_LEN) return json({ error: 'invalid_input' }, 400);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(body.limit ?? DEFAULT_LIMIT)));

    const params = new URLSearchParams({ q: query, limit: String(limit), lang: 'en' });
    // Optional proximity bias — Photon uses lat/lon.
    if (typeof body.lat === 'number' && typeof body.lng === 'number'
      && body.lat >= -90 && body.lat <= 90 && body.lng >= -180 && body.lng <= 180) {
      params.set('lat', String(body.lat));
      params.set('lon', String(body.lng));
    }

    // Fetch with a manual timeout (no helper import).
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${PHOTON_URL}/api?${params.toString()}`, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const detail = await res.text();
      console.error(`[maps-geosearch] upstream ${res.status}:`, detail.slice(0, 300));
      return json({ error: 'upstream_error', status: res.status }, 502);
    }

    const data = await res.json();
    const features: Array<Record<string, unknown>> = Array.isArray(data?.features) ? data.features : [];
    const results: Array<{ lat: number; lng: number; name: string | null; address: string; type: string | null }> = [];
    for (const f of features) {
      const coords = (f?.geometry as { coordinates?: [number, number] } | undefined)?.coordinates;
      if (!coords || coords.length < 2) continue;
      const [lng, lat] = coords;
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;
      const props = (f?.properties ?? {}) as Record<string, string | undefined>;
      const address = composeAddress(props);
      results.push({
        lat,
        lng,
        name: props.name ?? null,
        address: address || props.name || '',
        type: props.osm_value || props.type || null,
      });
    }
    return json({ results });
  } catch (e) {
    console.error('[maps-geosearch] crashed:', e);
    return json(
      { error: 'request_failed', detail: e instanceof Error ? e.message : String(e) },
      500,
    );
  }
});
