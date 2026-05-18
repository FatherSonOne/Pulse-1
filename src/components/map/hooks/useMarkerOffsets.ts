// ─────────────────────────────────────────────────────────────────────────────
// useMarkerOffsets — disambiguates markers that share (or near-share) a
// coordinate by computing a deterministic radial offset per marker and
// promoting exactly ONE label per offset group.
//
// The screenshot failure mode this addresses: two contacts pinned at the
// same parking lot stack into a pile of avatars with one name label
// peeking out as an apparent orphan. After this hook runs:
//
//   • Each marker in a same-coord group gets a CSS-pixel offset around a
//     small radius (~22-28px), so the avatars fan into a readable triangle.
//   • Exactly one marker per group keeps its name label — the topmost by
//     stable sort key (markerKey). The others suppress until hovered or
//     selected. The marker component already has the hover state wired.
//   • Offsets are deterministic via stable sort, so the same group lays
//     out the same way across renders and refreshes — the operator's
//     spatial memory survives.
//
// Why not zoom-aware pixel-distance clustering? Because doing that without
// dragging in @googlemaps/markerclusterer means writing a viewport-aware
// k-means against the live projection, and that's a separate, larger
// feature. Same-coord grouping covers the realistic case (two contacts
// pinned at the same address) which is what the screenshot showed. The
// follow-up clustering layer can wrap this hook later without changing
// the per-marker contract.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from 'react';

export interface MarkerOffsetEntry {
  /** Pixel offset to add to the marker's transform. (0,0) when the marker
   *  is the only one at its coord, or when it's the anchor of its group. */
  offsetX: number;
  offsetY: number;
  /** False when another marker in the same offset group owns the label
   *  slot for this group. The marker component should still render its
   *  label on hover / selected — the field only controls the resting
   *  visibility. */
  showLabel: boolean;
  /** Total markers in this group (>=1). The marker can use this to render
   *  a tiny `+2` chip if it wants to signal "this stop hides siblings."
   *  Currently unused; reserved for the future cluster-pill rendering. */
  groupSize: number;
}

export interface OffsetableMarker {
  /** Stable identity used as the Map key and the sort key inside a group. */
  key: string;
  lat: number;
  lng: number;
}

// Quantize lat/lng to 5 decimal places (~1.1m precision at the equator) so
// markers that geocoded to the "same address" cluster together even when
// the geocoder returned coords differing in the 6th-7th decimal.
function coordBucket(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

// Radial layout. Group of 2 places at ±90°; group of 3 at evenly-spaced
// 120° intervals; group of 4+ at 360/n. Radius widens slightly for larger
// groups so adjacent avatars still don't overlap.
function layoutAngles(count: number): number[] {
  if (count <= 1) return [0];
  const angles: number[] = [];
  const step = (2 * Math.PI) / count;
  // Start at the top (-π/2) so the first marker sits north of the anchor.
  // Visually this matches the convention in Apple Maps and Figma cursors.
  const start = -Math.PI / 2;
  for (let i = 0; i < count; i++) angles.push(start + i * step);
  return angles;
}

function radiusFor(count: number): number {
  if (count <= 1) return 0;
  if (count === 2) return 22;
  if (count === 3) return 24;
  return 28; // 4+
}

export function useMarkerOffsets(
  markers: OffsetableMarker[],
): Map<string, MarkerOffsetEntry> {
  return useMemo(() => {
    const out = new Map<string, MarkerOffsetEntry>();

    // 1. Bucket by quantized coord.
    const groups = new Map<string, OffsetableMarker[]>();
    for (const m of markers) {
      const bucket = coordBucket(m.lat, m.lng);
      const arr = groups.get(bucket);
      if (arr) arr.push(m);
      else groups.set(bucket, [m]);
    }

    // 2. Per group, lay out radially. Sort by key so the same group lays
    //    out the same way every render — operator's spatial memory holds.
    for (const group of groups.values()) {
      if (group.length === 1) {
        const m = group[0];
        out.set(m.key, { offsetX: 0, offsetY: 0, showLabel: true, groupSize: 1 });
        continue;
      }
      const sorted = group.slice().sort((a, b) => a.key.localeCompare(b.key));
      const angles = layoutAngles(sorted.length);
      const r = radiusFor(sorted.length);
      sorted.forEach((m, i) => {
        const a = angles[i];
        out.set(m.key, {
          // Label belongs to the first marker (alphabetical) so the
          // collision is broken deterministically. Others fall back to
          // hover/selected for label display.
          showLabel: i === 0,
          groupSize: sorted.length,
          offsetX: Math.cos(a) * r,
          offsetY: Math.sin(a) * r,
        });
      });
    }
    return out;
  }, [markers]);
}
