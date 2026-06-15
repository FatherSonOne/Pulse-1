// ─────────────────────────────────────────────────────────────────────────────
// geosearchService — client wrapper for the maps-geosearch edge function
// (Photon / OSM forward autocomplete). P4 of the MapLibre map rebrand.
//
// This is the non-Google geocoder that pairs LEGALLY with the MapLibre base map
// (a non-Google map may not display Google Places geocodes). It's consumed by
// GeoSearchInput, which the location pickers (PlacePicker, LocationEditModal)
// render in place of Google's <Autocomplete> when the mapLibreRenderer flag is
// ON. When the flag is OFF the pickers keep calling Google directly and this
// service is never hit.
//
// Debouncing is the caller's concern (GeoSearchInput owns it) — this service is
// a single round-trip per call.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase';

export interface GeoSearchResult {
  lat: number;
  lng: number;
  /** OSM `name` when the hit is a named place/POI; null for a bare address. */
  name: string | null;
  /** Composed single-line human address (street, city, state, country). */
  address: string;
  /** OSM value (e.g. 'house', 'restaurant', 'city') when available. */
  type: string | null;
}

export interface GeoSearchOptions {
  /** Result cap (server clamps to 1..10). */
  limit?: number;
  /** Bias results toward this point (e.g. the user's position / map center). */
  near?: { lat: number; lng: number } | null;
}

/**
 * Forward-search an address / place string against the OSM geosearch. Returns
 * [] on empty/too-short input or any failure — callers render an empty dropdown
 * rather than an error (the input stays usable).
 */
export async function geosearch(
  query: string,
  opts: GeoSearchOptions = {},
): Promise<GeoSearchResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  try {
    const { data, error } = await supabase.functions.invoke('maps-geosearch', {
      body: {
        query: q,
        limit: opts.limit,
        lat: opts.near?.lat,
        lng: opts.near?.lng,
      },
    });
    if (error) {
      console.error('[geosearchService] invoke error:', error);
      return [];
    }
    const payload = data as { results?: GeoSearchResult[]; error?: string };
    if (payload?.error) {
      console.error('[geosearchService] upstream error:', payload.error);
      return [];
    }
    return Array.isArray(payload?.results) ? payload.results : [];
  } catch (err) {
    console.error('[geosearchService] request failed:', err);
    return [];
  }
}
