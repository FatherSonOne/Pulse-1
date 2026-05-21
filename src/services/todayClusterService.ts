// ============================================================
// Today Cluster Service
//
// Groups Today feed items into geographic clusters so the user can
// see "what's at the bakery", "what's downtown", "what's by the
// office" instead of one long chronological list.
//
// Algorithm: greedy distance bucketing.
//   * For each item, resolve a (lat, lng) via the passed contacts
//     (preferred — they're already in memory) or, for geofence items,
//     metadata.placeId → places lookup.
//   * Compare against existing clusters; if within CLUSTER_RADIUS_M
//     of any centroid, append + update running-mean centroid.
//   * Otherwise start a new cluster.
//
// Cluster labels come from reverseGeocode(centroid) with a small
// in-memory cache so we don't re-fetch on every render.
// ============================================================

import { Contact } from '../types';
import { TodayFeedItem } from '../types/todayFeedTypes';
import { reverseGeocode } from './locationService';
import { supabase } from './supabase';

const CLUSTER_RADIUS_M = 1500;        // bucket items within 1.5 km
const UNLOCATED_CLUSTER_ID = '__unlocated__';

export interface FeedCluster {
  id: string;
  /** Running-mean centroid; recomputed as items are added. */
  centroid: { lat: number; lng: number } | null;
  /** Items in this cluster, in original input order. */
  items: TodayFeedItem[];
  /** Human-friendly label (e.g. "Hayes Valley · San Francisco"). null while loading. */
  label: string | null;
  /** Distance from the user's current position (meters), if known. */
  distanceM?: number;
}

/**
 * Resolve a feed item to a (lat, lng) by best-available path:
 *   1. metadata.placeId — geofence + place-attached items (cheapest if we have
 *      a placesById cache; otherwise null and the caller can backfill async)
 *   2. contact.homeLat/Lng — preferred for relationship items
 *   3. contact.workLat/Lng — fallback when home isn't set
 *
 * Returns null when no location is known so the item routes to the
 * "Other" cluster.
 */
function resolveItemLocation(
  item: TodayFeedItem,
  contactMap: Map<string, Contact>,
  placesById: Map<string, { lat: number; lng: number }>,
): { lat: number; lng: number } | null {
  const placeId = item.metadata?.placeId as string | undefined;
  if (placeId && placesById.has(placeId)) {
    return placesById.get(placeId)!;
  }
  const contact = contactMap.get(item.contactId);
  if (contact) {
    if (contact.homeLat != null && contact.homeLng != null) {
      return { lat: contact.homeLat, lng: contact.homeLng };
    }
    if (contact.workLat != null && contact.workLng != null) {
      return { lat: contact.workLat, lng: contact.workLng };
    }
  }
  return null;
}

/**
 * Build clusters from a flat list of feed items. Synchronous — labels
 * are loaded separately via `enrichClusterLabels` so the UI can render
 * the structure immediately and fill labels in as they resolve.
 */
export function clusterFeedItems(
  items: TodayFeedItem[],
  contacts: Contact[],
  placesById: Map<string, { lat: number; lng: number }> = new Map(),
  userPosition?: { lat: number; lng: number } | null,
): FeedCluster[] {
  const contactMap = new Map(contacts.map(c => [c.id, c]));
  const clusters: FeedCluster[] = [];
  const unlocated: TodayFeedItem[] = [];

  for (const item of items) {
    const loc = resolveItemLocation(item, contactMap, placesById);
    if (!loc) {
      unlocated.push(item);
      continue;
    }

    let placed = false;
    for (const c of clusters) {
      if (!c.centroid) continue;
      if (haversineMeters(c.centroid.lat, c.centroid.lng, loc.lat, loc.lng) <= CLUSTER_RADIUS_M) {
        c.items.push(item);
        // Running-mean centroid keeps it stable as the cluster grows.
        const n = c.items.length;
        c.centroid = {
          lat: c.centroid.lat + (loc.lat - c.centroid.lat) / n,
          lng: c.centroid.lng + (loc.lng - c.centroid.lng) / n,
        };
        placed = true;
        break;
      }
    }

    if (!placed) {
      clusters.push({
        id: `cluster-${clusters.length}`,
        centroid: { ...loc },
        items: [item],
        label: null,
      });
    }
  }

  // Annotate distance from user when we know it (drives sort below).
  if (userPosition) {
    for (const c of clusters) {
      if (c.centroid) {
        c.distanceM = haversineMeters(
          userPosition.lat, userPosition.lng,
          c.centroid.lat, c.centroid.lng,
        );
      }
    }
  }

  // Order: clusters closest to the user first (when user position known),
  // otherwise by largest cluster first. Unlocated items always last.
  if (userPosition) {
    clusters.sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
  } else {
    clusters.sort((a, b) => b.items.length - a.items.length);
  }

  if (unlocated.length > 0) {
    clusters.push({
      id: UNLOCATED_CLUSTER_ID,
      centroid: null,
      items: unlocated,
      label: 'No location',
    });
  }

  return clusters;
}

/**
 * Resolve placeIds referenced by `metadata.placeId` on items in a single
 * round-trip. Returns a Map placeId → {lat, lng} for use with
 * clusterFeedItems. Skips items without placeId metadata.
 */
export async function loadPlaceCoordsForItems(
  items: TodayFeedItem[],
): Promise<Map<string, { lat: number; lng: number }>> {
  const ids = new Set<string>();
  for (const it of items) {
    const pid = it.metadata?.placeId as string | undefined;
    if (pid) ids.add(pid);
  }
  if (ids.size === 0) return new Map();

  const { data, error } = await supabase
    .from('places')
    .select('id, lat, lng')
    .in('id', Array.from(ids));
  if (error || !data) return new Map();
  return new Map(data.map(r => [String(r.id), { lat: Number(r.lat), lng: Number(r.lng) }]));
}

// ============================================================
// Label enrichment — async, cached
// ============================================================

const labelCache = new Map<string, string>(); // key = lat,lng rounded

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

/**
 * Parse a Google formatted address into a compact two-segment label.
 * Examples:
 *   "1234 Main St, Hayes Valley, San Francisco, CA 94102, USA"
 *     → "Hayes Valley · San Francisco"
 *   "200 Larkin St, San Francisco, CA 94102, USA"
 *     → "San Francisco"
 *
 * We drop the street-address segment (always first) and the country
 * segment (always last). When 4+ parts remain we take the first two
 * for the neighborhood + city duo; otherwise just the first.
 */
function compactLabelFromFormatted(addr: string): string {
  const parts = addr.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return addr;
  // Strip leading street address if it starts with a digit
  const start = /^\d/.test(parts[0]) ? 1 : 0;
  // Strip trailing country
  const end = parts.length - 1;
  const middle = parts.slice(start, end);
  if (middle.length === 0) return parts[0];
  // Strip ZIP from the last middle segment ("CA 94102" → "CA")
  const last = middle[middle.length - 1].replace(/\s+\d{4,6}.*$/, '');
  middle[middle.length - 1] = last;
  if (middle.length >= 2) return `${middle[0]} · ${middle[1]}`;
  return middle[0];
}

/**
 * Fill in the `label` for each cluster. Mutates the passed clusters
 * (so React state updates fire) and returns the same array. Skips
 * clusters that already have a label or that lack a centroid.
 */
export async function enrichClusterLabels(clusters: FeedCluster[]): Promise<FeedCluster[]> {
  await Promise.allSettled(
    clusters.map(async c => {
      if (c.label || !c.centroid) return;
      const key = cacheKey(c.centroid.lat, c.centroid.lng);
      const cached = labelCache.get(key);
      if (cached) {
        c.label = cached;
        return;
      }
      const formatted = await reverseGeocode(c.centroid.lat, c.centroid.lng);
      if (formatted) {
        const compact = compactLabelFromFormatted(formatted);
        labelCache.set(key, compact);
        c.label = compact;
      } else {
        c.label = 'Nearby';
      }
    }),
  );
  return clusters;
}

// Haversine in meters — duplicated from geofenceService to avoid a
// circular import. Tiny, doesn't merit a shared module.
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function formatClusterDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)}m away`;
  return `${(m / 1000).toFixed(1)} km away`;
}
