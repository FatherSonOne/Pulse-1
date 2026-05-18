// ─────────────────────────────────────────────────────────────────────────────
// useSpiderAnimation — choreographs the spider expand/contract for the
// cluster layer. Wraps useMarkerClusters' (expandedAnchorKey, entries)
// stream into per-leg animation metadata and an exitingLegs map that
// PulseMapView consumes to delay unmount until the exit animation finishes.
//
// Why this lives outside useMarkerClusters: the cluster hook is concerned
// with the deterministic mode tagging. Animation is a presentation concern
// — it needs to remember the prior frame's leg positions (so collapsing
// legs can animate from their final offset back to the centroid) and to
// hold those leg entries through a 180ms exit window even after the
// cluster hook has retagged them as 'cluster-member'.
//
// Reduced-motion: when prefers-reduced-motion is on, the hook emits
// zero-stagger / zero-delay metadata. The marker components shorten their
// own transition to opacity-only fades; spider lines suppress entirely.
// The choreography is preserved — just collapsed to "instant feedback"
// rather than a multi-step fan.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from 'react';
import type { MarkerClusterEntry } from './useMarkerClusters';

export type SpiderAnimationPhase = 'entering' | 'idle' | 'exiting';

export interface SpiderLegAnimation {
  phase: SpiderAnimationPhase;
  /** Stagger delay in ms. Always 0 under reduced motion. */
  delayMs: number;
  /** Final offset. For exiting legs the hook still emits the same offset
   *  so the leg can animate from there back to (0, 0). PulseMapView
   *  applies the offset; the marker handles the transition. */
  offsetX: number;
  offsetY: number;
}

export interface ActiveSpider {
  anchorKey: string;
  /** Sorted-by-angle list — needed for SpiderLines and the stagger ordering. */
  legs: Array<{
    key: string;
    offsetX: number;
    offsetY: number;
    delayMs: number;
  }>;
}

export interface UseSpiderAnimationResult {
  /** Per-leg animation entries. Includes both currently-expanded legs
   *  ('entering' immediately after a toggle, 'idle' after the entry
   *  window) and exiting legs (held for the exit duration). */
  legAnimations: Map<string, SpiderLegAnimation>;
  /** Currently-expanded spider, if any — feeds SpiderLines. null when
   *  reduced motion is active OR when no spider is open. */
  activeSpider: ActiveSpider | null;
  /** Keys the parent should keep rendering even though the cluster hook
   *  has stopped tagging them as spider-leg. PulseMapView checks this set
   *  before its `cluster-member ? null : render` short-circuit. */
  exitingKeys: Set<string>;
  /** True when reduced motion is active — markers use this to pick the
   *  fast-fade transition. */
  reducedMotion: boolean;
}

// Stagger cap so an 8-leg fan still finishes within the 220ms entry window
// (4 × 25ms = 100ms tail + 220ms transition = 320ms total — under the
// "feels instant" budget for an explicit click).
const STAGGER_STEP_MS = 25;
const STAGGER_CAP_LEGS = 4;
const ENTER_DURATION_MS = 220;
const EXIT_DURATION_MS = 180;
// Reduced-motion entry/exit collapse to a single 100ms opacity fade.
const REDUCED_FADE_MS = 100;

function legAngle(offsetX: number, offsetY: number): number {
  // atan2 returns -π…π; rotate so the top (-π/2 in screen coords) reads
  // as 0 in the sort. This matches the spider's visual order — top leg
  // animates first, sweeping clockwise.
  const raw = Math.atan2(offsetY, offsetX); // -π…π
  return (raw + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
}

function stagger(index: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  return Math.min(index, STAGGER_CAP_LEGS) * STAGGER_STEP_MS;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

/** Snapshot of a leg the hook is currently animating out. Held across
 *  renders via a ref so the cluster hook's retag-to-cluster-member
 *  doesn't blank the offset before the exit animation finishes. */
interface ExitingSnapshot {
  offsetX: number;
  offsetY: number;
  delayMs: number;
  /** Time at which the leg should be removed from the exiting set. */
  expiresAt: number;
}

interface UseSpiderAnimationInput {
  clusterEntries: Map<string, MarkerClusterEntry>;
  expandedAnchorKey: string | null;
}

export function useSpiderAnimation({
  clusterEntries,
  expandedAnchorKey,
}: UseSpiderAnimationInput): UseSpiderAnimationResult {
  const reducedMotion = usePrefersReducedMotion();
  const prevAnchorRef = useRef<string | null>(null);
  const exitingRef = useRef<Map<string, ExitingSnapshot>>(new Map());
  // Tick state purely so the hook can re-run when a setTimeout pops to
  // remove an expired exiting entry. The value is otherwise unused.
  const [, setTick] = useState(0);

  // Current spider's legs in radial order — derived fresh from clusterEntries
  // each render so the hook doesn't have to mirror the cluster snapshot.
  const currentSpider = useMemo<ActiveSpider | null>(() => {
    if (!expandedAnchorKey) return null;
    const legs: Array<{ key: string; offsetX: number; offsetY: number; angle: number }> = [];
    for (const [key, entry] of clusterEntries) {
      if (entry.mode !== 'spider-leg') continue;
      const ox = entry.offsetX ?? 0;
      const oy = entry.offsetY ?? 0;
      legs.push({ key, offsetX: ox, offsetY: oy, angle: legAngle(ox, oy) });
    }
    if (legs.length === 0) return null;
    legs.sort((a, b) => a.angle - b.angle);
    return {
      anchorKey: expandedAnchorKey,
      legs: legs.map((leg, i) => ({
        key: leg.key,
        offsetX: leg.offsetX,
        offsetY: leg.offsetY,
        delayMs: stagger(i, reducedMotion),
      })),
    };
  }, [clusterEntries, expandedAnchorKey, reducedMotion]);

  // Detect collapse / re-expand transitions and seed exiting snapshots.
  // The effect runs after render — by that time PulseMapView already
  // consumed the previous exitingKeys, so we mutate the ref and schedule
  // a tick to flush expired entries.
  useEffect(() => {
    const prev = prevAnchorRef.current;
    if (prev !== expandedAnchorKey && prev) {
      // The PREVIOUS spider just collapsed (or got replaced). Capture
      // its legs from the snapshot we built last render — but the hook
      // doesn't have last render's spider stored. We work around this
      // by reading clusterEntries again for the previous anchor key:
      // if the cluster hook still tagged its legs as spider-leg this
      // render (rare; only when expandedAnchorKey changed mid-render),
      // we'd see them. The common case is they've already been retagged
      // 'cluster-member', so we need a fallback: keep a ref of the last
      // emitted spider too.
      // (Handled below via lastSpiderRef.)
    }
    prevAnchorRef.current = expandedAnchorKey;
  }, [expandedAnchorKey]);

  // Cache the last non-null spider so we can seed exit snapshots when
  // the cluster hook has already moved on.
  const lastSpiderRef = useRef<ActiveSpider | null>(null);
  useEffect(() => {
    if (currentSpider) lastSpiderRef.current = currentSpider;
  }, [currentSpider]);

  // When expandedAnchorKey transitions away from a non-null value, copy
  // the prior spider's legs into the exitingRef map with a TTL.
  const lastSeenAnchorRef = useRef<string | null>(null);
  useEffect(() => {
    const prevAnchor = lastSeenAnchorRef.current;
    lastSeenAnchorRef.current = expandedAnchorKey;

    if (prevAnchor && prevAnchor !== expandedAnchorKey) {
      const exitingSpider =
        lastSpiderRef.current?.anchorKey === prevAnchor
          ? lastSpiderRef.current
          : null;
      if (exitingSpider) {
        const now = Date.now();
        const ttl = reducedMotion ? REDUCED_FADE_MS : EXIT_DURATION_MS;
        for (const leg of exitingSpider.legs) {
          // Reverse the stagger so the leg closest to top exits last —
          // the fan visibly retracts in the same rotational order it
          // opened. Skip the reversal under reduced motion (no stagger).
          const reverseIndex = exitingSpider.legs.length - 1 -
            exitingSpider.legs.findIndex(l => l.key === leg.key);
          const delayMs = stagger(reverseIndex, reducedMotion);
          exitingRef.current.set(leg.key, {
            offsetX: leg.offsetX,
            offsetY: leg.offsetY,
            delayMs,
            expiresAt: now + delayMs + ttl + 32, // +32ms cushion for tail RAF
          });
        }
        setTick(t => t + 1);

        // Schedule the cleanup. We use one timeout for the last-expiring
        // entry rather than N per-leg timeouts.
        const maxDelay = stagger(exitingSpider.legs.length - 1, reducedMotion);
        const cleanupIn = maxDelay + ttl + 64;
        const timer = window.setTimeout(() => {
          const now2 = Date.now();
          for (const [k, snap] of exitingRef.current) {
            if (snap.expiresAt <= now2) exitingRef.current.delete(k);
          }
          setTick(t => t + 1);
        }, cleanupIn);
        return () => window.clearTimeout(timer);
      }
    }
    return undefined;
  }, [expandedAnchorKey, reducedMotion]);

  // Compose the final per-leg map: current spider's legs are 'entering'
  // (transitioning to 'idle' after the entry window — but for CSS-only
  // animations we don't need to differentiate; the marker uses backwards
  // fill-mode keyframes so it self-finalizes).
  const legAnimations = useMemo(() => {
    const out = new Map<string, SpiderLegAnimation>();
    if (currentSpider) {
      for (const leg of currentSpider.legs) {
        out.set(leg.key, {
          phase: 'entering',
          delayMs: leg.delayMs,
          offsetX: leg.offsetX,
          offsetY: leg.offsetY,
        });
      }
    }
    // Overlay exiting snapshots — they take precedence when a key was
    // both in the prior spider AND somehow still in the current one
    // (impossible normally, but defensive).
    for (const [key, snap] of exitingRef.current) {
      out.set(key, {
        phase: 'exiting',
        delayMs: snap.delayMs,
        offsetX: snap.offsetX,
        offsetY: snap.offsetY,
      });
    }
    return out;
  }, [currentSpider, exitingRef.current.size]); // eslint-disable-line react-hooks/exhaustive-deps

  const exitingKeys = useMemo(
    () => new Set(exitingRef.current.keys()),
    [exitingRef.current.size], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return {
    legAnimations,
    activeSpider: reducedMotion ? null : currentSpider,
    exitingKeys,
    reducedMotion,
  };
}
