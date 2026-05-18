// ─────────────────────────────────────────────────────────────────────────────
// useMarkerClusters — zoom-aware clustering + spiderfy layer that composes
// over useMarkerOffsets without replacing it.
//
// Three regimes, picked by zoom:
//
//   zoom ≤ 15   → CLUSTER. Adjacent markers fold into coral discs that show
//                 the member count. Drawn as MapClusterMarker; the per-marker
//                 component is suppressed for any key tagged 'cluster-member'.
//
//   zoom = 16   → DIAL-BACK. No clustering, no spiderfy. Each marker renders
//                 individually so the operator can see the real distribution
//                 at the transition zoom. useMarkerOffsets still fans
//                 same-coord siblings via its CSS-pixel offsets.
//
//   zoom ≥ 17   → SPIDERFY (groups of 4+ at the same quantized coord). One
//                 marker becomes a 'spider-anchor' at the centroid; the rest
//                 collapse until the anchor is clicked, then fan out as
//                 'spider-leg' entries on a 36px radial fan (wider than
//                 useMarkerOffsets' 28px since these are explicitly expanded).
//
//                 Groups of 2-3 fall through to useMarkerOffsets — that hook
//                 already fans them tightly and spawning anchor+legs for two
//                 markers is more chrome than signal.
//
// The per-marker contract from useMarkerOffsets stays intact. This hook tags
// each marker with a `mode` that PulseMapView reads to decide whether to:
//   - render a cluster disc instead of the marker ('cluster-member'),
//   - render the marker normally ('normal') and apply useMarkerOffsets,
//   - render an anchor at the group centroid ('spider-anchor'),
//   - render a leg at a fixed pixel offset ('spider-leg').
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SuperClusterAlgorithm } from '@googlemaps/markerclusterer';
import type { OffsetableMarker } from './useMarkerOffsets';

export type MarkerClusterMode =
  | 'normal'           // render the marker; let useMarkerOffsets handle overlap
  | 'cluster-member'   // hidden — represented by a cluster disc or anchor
  | 'spider-anchor'    // render at group centroid; click toggles expansion
  | 'spider-leg';      // render at centroid + fixed pixel offset

export interface MarkerClusterEntry {
  mode: MarkerClusterMode;
  /** Pixel offset for spider-leg mode. Undefined for other modes. */
  offsetX?: number;
  offsetY?: number;
  /** For spider-anchor: total count including the anchor. */
  groupSize?: number;
  /** For spider-anchor: bucket key to pass back to toggleAnchor. */
  anchorBucketKey?: string;
}

export interface ClusterCentroid {
  /** Stable id derived from the sorted member keys — lets React reconcile. */
  id: string;
  lat: number;
  lng: number;
  count: number;
  memberKeys: string[];
  /** Bbox the parent can fitBounds to on click. */
  bounds: { north: number; south: number; east: number; west: number };
}

export interface UseMarkerClustersResult {
  /** Per-marker entry. Keys not in the map mean the marker should not render. */
  entries: Map<string, MarkerClusterEntry>;
  /** Cluster discs to draw at zoom ≤ 15. Empty at zoom ≥ 16. */
  clusters: ClusterCentroid[];
  /** Anchor bucket key currently expanded into a spider; null when none. */
  expandedAnchorKey: string | null;
  /** Toggle handler for the spider anchor. Pass the bucket key. */
  toggleAnchor: (bucketKey: string) => void;
  /** Clear expansion — call when zoom drops below 17 or on map click. */
  collapseAll: () => void;
}

// Must match useMarkerOffsets' bucket so both hooks agree on "same coord".
function coordBucket(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

// Wider fan than useMarkerOffsets — these are explicitly expanded, not just
// resting overlap, so they earn the extra screen space.
const SPIDER_RADIUS = 36;

function spiderLegOffset(index: number, total: number): { x: number; y: number } {
  if (total <= 1) return { x: 0, y: 0 };
  const step = (2 * Math.PI) / total;
  // Start at -π/2 (top) for visual consistency with useMarkerOffsets.
  const angle = -Math.PI / 2 + index * step;
  return {
    x: Math.cos(angle) * SPIDER_RADIUS,
    y: Math.sin(angle) * SPIDER_RADIUS,
  };
}

// ─── thresholds ─────────────────────────────────────────────────────────────
// 15 and below = clustered. 16 = dial-back (all individual). 17+ = spiderfy
// becomes available for dense same-coord groups.
const CLUSTER_ZOOM_MAX = 15;
const SPIDER_ZOOM_MIN = 17;
const SPIDER_MIN_GROUP = 4;

// Stub marker shape the algorithm needs — only `getPosition` is read by
// MarkerUtils. We attach `__key` so we can recover the source key from the
// cluster's member list without re-bucketing geographically.
interface KeyedStub {
  getPosition: () => google.maps.LatLng;
  __key: string;
}

export function useMarkerClusters(
  markers: OffsetableMarker[],
  zoom: number | null,
  mapRef: React.MutableRefObject<google.maps.Map | null>,
): UseMarkerClustersResult {
  const [expandedAnchorKey, setExpandedAnchorKey] = useState<string | null>(null);

  // Collapse if zoom drops below spider threshold — the anchor wouldn't
  // even exist at that zoom, so the expanded state is stale.
  const lastZoom = useRef<number | null>(null);
  useEffect(() => {
    if (zoom == null) return;
    if (
      lastZoom.current != null &&
      zoom < SPIDER_ZOOM_MIN &&
      lastZoom.current >= SPIDER_ZOOM_MIN
    ) {
      setExpandedAnchorKey(null);
    }
    lastZoom.current = zoom;
  }, [zoom]);

  const toggleAnchor = useCallback((bucketKey: string) => {
    setExpandedAnchorKey(prev => (prev === bucketKey ? null : bucketKey));
  }, []);

  const collapseAll = useCallback(() => setExpandedAnchorKey(null), []);

  // SuperCluster instance kept across renders — it caches internally and
  // only re-runs on input change. Created lazily on first use so SSR /
  // initial render without google.maps loaded doesn't crash.
  const algorithm = useRef<SuperClusterAlgorithm | null>(null);

  return useMemo<UseMarkerClustersResult>(() => {
    const entries = new Map<string, MarkerClusterEntry>();
    const clusters: ClusterCentroid[] = [];

    // No zoom yet (first paint before onLoad) → render normally.
    if (zoom == null || markers.length === 0) {
      for (const m of markers) entries.set(m.key, { mode: 'normal' });
      return { entries, clusters, expandedAnchorKey, toggleAnchor, collapseAll };
    }

    // ─── ZOOM ≤ 15 → cluster via SuperCluster ──────────────────────────────
    if (zoom <= CLUSTER_ZOOM_MAX) {
      const map = mapRef.current;
      // Map / google.maps not ready → fall back to normal so we don't drop
      // pins entirely. Defensive — onLoad should have fired by now.
      if (!map || typeof google === 'undefined' || !google.maps?.LatLng) {
        for (const m of markers) entries.set(m.key, { mode: 'normal' });
        return { entries, clusters, expandedAnchorKey, toggleAnchor, collapseAll };
      }

      if (algorithm.current == null) {
        algorithm.current = new SuperClusterAlgorithm({
          radius: 60,
          maxZoom: CLUSTER_ZOOM_MAX,
        });
      }

      // Synthesize keyed stubs the algorithm can read. Only getPosition()
      // is invoked by MarkerUtils.getPosition for legacy markers. We attach
      // __key so the cluster's member list round-trips back to our keys.
      const stubs: KeyedStub[] = markers.map(m => {
        const pos = new google.maps.LatLng(m.lat, m.lng);
        return { getPosition: () => pos, __key: m.key };
      });

      let result;
      try {
        result = algorithm.current.calculate({
          markers: stubs as unknown as google.maps.Marker[],
          map,
          mapCanvasProjection: undefined as unknown as google.maps.MapCanvasProjection,
        });
      } catch {
        // Algorithm threw (typically map zoom unavailable) → graceful fallback.
        for (const m of markers) entries.set(m.key, { mode: 'normal' });
        return { entries, clusters, expandedAnchorKey, toggleAnchor, collapseAll };
      }

      for (const c of result.clusters) {
        const count = c.count;
        const pos = c.position;
        const lat = pos.lat();
        const lng = pos.lng();
        const members = c.markers as unknown as KeyedStub[];
        const memberKeys = members.map(m => m.__key).filter(Boolean);

        if (count === 1 || memberKeys.length === 1) {
          // Singleton — render normally so useMarkerOffsets applies.
          if (memberKeys[0]) entries.set(memberKeys[0], { mode: 'normal' });
          continue;
        }

        for (const k of memberKeys) entries.set(k, { mode: 'cluster-member' });

        const bounds = c.bounds;
        clusters.push({
          id: 'c:' + memberKeys.slice().sort().join('|'),
          lat,
          lng,
          count,
          memberKeys,
          bounds: bounds
            ? {
                north: bounds.getNorthEast().lat(),
                south: bounds.getSouthWest().lat(),
                east: bounds.getNorthEast().lng(),
                west: bounds.getSouthWest().lng(),
              }
            : { north: lat, south: lat, east: lng, west: lng },
        });
      }

      // Defensive: any marker the algorithm didn't include falls back to
      // normal so it still renders.
      for (const m of markers) {
        if (!entries.has(m.key)) entries.set(m.key, { mode: 'normal' });
      }
      return { entries, clusters, expandedAnchorKey, toggleAnchor, collapseAll };
    }

    // ─── ZOOM 16 → dial-back, no clustering, no spiderfy ───────────────────
    if (zoom < SPIDER_ZOOM_MIN) {
      for (const m of markers) entries.set(m.key, { mode: 'normal' });
      return { entries, clusters, expandedAnchorKey, toggleAnchor, collapseAll };
    }

    // ─── ZOOM ≥ 17 → spiderfy candidate ────────────────────────────────────
    // Bucket by quantized coord. Groups of 4+ become spider candidates; the
    // expanded one fans, the rest collapse to an anchor that shows total
    // count. Groups of 2-3 fall through to normal so useMarkerOffsets handles
    // them with its tighter fan.
    const buckets = new Map<string, OffsetableMarker[]>();
    for (const m of markers) {
      const bk = coordBucket(m.lat, m.lng);
      const arr = buckets.get(bk);
      if (arr) arr.push(m);
      else buckets.set(bk, [m]);
    }

    for (const [bucketKey, group] of buckets) {
      if (group.length < SPIDER_MIN_GROUP) {
        for (const m of group) entries.set(m.key, { mode: 'normal' });
        continue;
      }

      // Stable sort by key — same group lays out the same way every render
      // so the operator's spatial memory holds.
      const sorted = group.slice().sort((a, b) => a.key.localeCompare(b.key));
      const isExpanded = expandedAnchorKey === bucketKey;

      if (!isExpanded) {
        // Collapsed: anchor (first by key) carries the group; siblings hide.
        entries.set(sorted[0].key, {
          mode: 'spider-anchor',
          groupSize: sorted.length,
          anchorBucketKey: bucketKey,
        });
        for (let i = 1; i < sorted.length; i++) {
          entries.set(sorted[i].key, { mode: 'cluster-member' });
        }
        continue;
      }

      // Expanded: anchor stays at centroid; legs fan radially.
      entries.set(sorted[0].key, {
        mode: 'spider-anchor',
        groupSize: sorted.length,
        anchorBucketKey: bucketKey,
      });
      for (let i = 1; i < sorted.length; i++) {
        const off = spiderLegOffset(i, sorted.length);
        entries.set(sorted[i].key, {
          mode: 'spider-leg',
          offsetX: off.x,
          offsetY: off.y,
        });
      }
    }

    return { entries, clusters, expandedAnchorKey, toggleAnchor, collapseAll };
  }, [markers, zoom, mapRef, expandedAnchorKey, toggleAnchor, collapseAll]);
}
