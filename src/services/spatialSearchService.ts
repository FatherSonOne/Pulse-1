// ============================================================
// Spatial search filter (B3 / #35).
//
// Given a list of SearchResults and a parsed GeoFilter, returns
// only the results whose entity_places attachment is within the
// requested radius. SearchResult types that don't participate in
// the spatial layer (email, sms, message, vox, note, thread,
// archive, unified_message) are excluded when a geo filter is
// active — the filter is opt-in by definition.
//
// One Supabase round-trip: a single entity_places + places join
// scoped to the entity_types we care about, then in-memory
// Haversine distance per result.
// ============================================================

import { supabase } from './supabase';
import { SearchResult } from './unifiedSearchService';
import { GeoFilter } from './geoSearchParser';
import { distanceMiles, geocodeAddress, getCurrentUserLocation } from './locationService';

const SPATIAL_TYPES = new Set<SearchResult['type']>([
  'contact', 'task', 'event',
]);

interface SpatialMatch {
  /** Distance in miles from the geo center. */
  distanceMiles: number;
  placeId: string;
}

/**
 * Resolve the geo filter's center to {lat, lng}. Returns null if
 * the user denied geolocation (for 'near-me') or the geocoder
 * couldn't resolve the place query (for 'near-place').
 */
export async function resolveGeoCenter(
  filter: GeoFilter,
): Promise<{ lat: number; lng: number } | null> {
  if (filter.kind === 'near-me') {
    try {
      return await getCurrentUserLocation();
    } catch {
      return null;
    }
  }
  if (!filter.placeQuery) return null;
  return await geocodeAddress(filter.placeQuery);
}

/**
 * Apply a geo filter to search results. Non-spatial result types are
 * dropped entirely. Spatial types are kept only if they have a place
 * within `radiusMiles` of `center`.
 *
 * Each kept result is augmented with a `spatial` metadata field
 * carrying the matched distance; the search UI uses this to show
 * "0.7 mi" inline on the result card.
 */
export async function applyGeoFilter(
  results: SearchResult[],
  filter: GeoFilter,
  center: { lat: number; lng: number },
): Promise<SearchResult[]> {
  if (results.length === 0) return [];

  const spatialIdsByType: Record<string, string[]> = {};
  for (const r of results) {
    if (!SPATIAL_TYPES.has(r.type)) continue;
    (spatialIdsByType[r.type] ??= []).push(r.id);
  }

  if (Object.keys(spatialIdsByType).length === 0) return [];

  const orFilters: string[] = [];
  for (const [type, ids] of Object.entries(spatialIdsByType)) {
    const list = ids.map(id => `"${id}"`).join(',');
    orFilters.push(`and(entity_type.eq.${type},entity_id.in.(${list}))`);
  }

  const { data, error } = await supabase
    .from('entity_places')
    .select('entity_type, entity_id, place_id, places(lat, lng)')
    .or(orFilters.join(','));

  if (error) {
    console.error('[spatialSearchService] entity_places fetch failed:', error);
    return [];
  }

  const matchByKey = new Map<string, SpatialMatch>();
  for (const row of data ?? []) {
    const r = row as unknown as {
      entity_type: string;
      entity_id: string;
      place_id: string;
      places: { lat: number; lng: number } | { lat: number; lng: number }[] | null;
    };
    const placeRow = Array.isArray(r.places) ? r.places[0] : r.places;
    if (!placeRow) continue;
    const d = distanceMiles(center.lat, center.lng, placeRow.lat, placeRow.lng);
    if (d <= filter.radiusMiles) {
      const key = `${r.entity_type}:${r.entity_id}`;
      const existing = matchByKey.get(key);
      if (!existing || d < existing.distanceMiles) {
        matchByKey.set(key, { distanceMiles: d, placeId: r.place_id });
      }
    }
  }

  return results
    .filter(r => SPATIAL_TYPES.has(r.type) && matchByKey.has(`${r.type}:${r.id}`))
    .map(r => {
      const match = matchByKey.get(`${r.type}:${r.id}`)!;
      return {
        ...r,
        metadata: {
          ...(r.metadata ?? {}),
          spatial: {
            distanceMiles: match.distanceMiles,
            placeId: match.placeId,
          },
        },
      };
    })
    .sort((a, b) => {
      const da = (a.metadata?.spatial as { distanceMiles?: number } | undefined)?.distanceMiles ?? Infinity;
      const db = (b.metadata?.spatial as { distanceMiles?: number } | undefined)?.distanceMiles ?? Infinity;
      return da - db;
    });
}
