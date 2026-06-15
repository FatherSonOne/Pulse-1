// Supabase Edge Function: Maps Geosearch (forward address/place autocomplete)
// Server-side proxy for an OpenStreetMap-derived geosearch. Powers the MapLibre-
// path location pickers (P4 of the map rebrand).
//
// WHY a separate, non-Google geosearch: the MapLibre (non-Google) base map may
// NOT legally display Google Places geocodes (Google Maps Service-Specific
// Terms — "No use with a non-Google map"). Both providers below return
// OSM-derived results, which pair legally with the MapLibre map AND are storable
// long-term. When the mapLibreRenderer flag is OFF the client keeps using Google
// Autocomplete directly — this function is only hit on the MapLibre path.
//
// PROVIDERS (chosen at boot by which env is set):
//   1. Stadia Maps (preferred) — set STADIA_API_KEY. Hosted Pelias geocoder,
//      free tier, nothing to run. This is the production path.
//   2. Photon — used when STADIA_API_KEY is absent. PHOTON_URL overrides the
//      upstream; with neither set it falls back to komoot's PUBLIC demo instance
//      (DEV-ONLY per komoot's usage policy).
// So setting STADIA_API_KEY makes Stadia win regardless of any (even broken)
// PHOTON_URL — no need to unset it.
//
// RUNTIME NOTES: runtime-native Deno.serve, ZERO remote imports (an earlier
// version crashed at cold boot fetching deno.land/esm.sh imports), whole body
// wrapped so failures return a readable JSON error instead of EDGE_FUNCTION_ERROR.
// Auth is handled by verify_jwt at the platform layer — no in-function check.
//
// Request:  POST /functions/v1/maps-geosearch
//   body:   { query: string, limit?: number, lat?: number, lng?: number }
//             lat/lng (optional) bias results toward that point.
//
// Response (200): { results: Array<{ lat, lng, name, address, type }>, provider }
// Response (400): { error: 'invalid_body' | 'invalid_input' }
// Response (500/502): { error: 'request_failed' | 'upstream_error', detail?, status? }

const STADIA_API_KEY = Deno.env.get('STADIA_API_KEY');
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

type GeoResult = { lat: number; lng: number; name: string | null; address: string; type: string | null };

// Compose a single human-readable address line from Photon's OSM properties.
function composePhotonAddress(p: Record<string, string | undefined>): string {
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  const locality = p.city || p.town || p.village || p.district || p.county;
  return [street, locality, p.state, p.country]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(', ');
}

// Both providers return a GeoJSON FeatureCollection; only the property names
// differ. Stadia (Pelias) ships a pre-formatted `label`; Photon needs composing.
function parseFeatures(data: unknown, provider: 'stadia' | 'photon'): GeoResult[] {
  const features: Array<Record<string, unknown>> =
    Array.isArray((data as { features?: unknown })?.features) ? (data as { features: Array<Record<string, unknown>> }).features : [];
  const out: GeoResult[] = [];
  for (const f of features) {
    const coords = (f?.geometry as { coordinates?: [number, number] } | undefined)?.coordinates;
    if (!coords || coords.length < 2) continue;
    const [lng, lat] = coords;
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;
    const props = (f?.properties ?? {}) as Record<string, string | undefined>;
    if (provider === 'stadia') {
      out.push({
        lat,
        lng,
        name: props.name ?? null,
        address: props.label || props.name || '',
        type: props.layer ?? null,
      });
    } else {
      const address = composePhotonAddress(props);
      out.push({
        lat,
        lng,
        name: props.name ?? null,
        address: address || props.name || '',
        type: props.osm_value || props.type || null,
      });
    }
  }
  return out;
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
    const hasBias = typeof body.lat === 'number' && typeof body.lng === 'number'
      && body.lat >= -90 && body.lat <= 90 && body.lng >= -180 && body.lng <= 180;

    const provider: 'stadia' | 'photon' = STADIA_API_KEY ? 'stadia' : 'photon';
    let url: string;
    if (provider === 'stadia') {
      const params = new URLSearchParams({ text: query, size: String(limit), 'api_key': STADIA_API_KEY! });
      if (hasBias) {
        params.set('focus.point.lat', String(body.lat));
        params.set('focus.point.lon', String(body.lng));
      }
      url = `https://api.stadiamaps.com/geocoding/v1/autocomplete?${params.toString()}`;
    } else {
      const params = new URLSearchParams({ q: query, limit: String(limit), lang: 'en' });
      if (hasBias) {
        params.set('lat', String(body.lat));
        params.set('lon', String(body.lng));
      }
      url = `${PHOTON_URL}/api?${params.toString()}`;
    }

    // Fetch with a manual timeout (no helper import).
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const detail = await res.text();
      console.error(`[maps-geosearch] ${provider} upstream ${res.status}:`, detail.slice(0, 300));
      return json({ error: 'upstream_error', provider, status: res.status }, 502);
    }

    const data = await res.json();
    return json({ results: parseFeatures(data, provider), provider });
  } catch (e) {
    console.error('[maps-geosearch] crashed:', e);
    return json(
      { error: 'request_failed', detail: e instanceof Error ? e.message : String(e) },
      500,
    );
  }
});
