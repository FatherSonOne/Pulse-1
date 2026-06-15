// ─────────────────────────────────────────────────────────────────────────────
// computeMarkerLayout — per-marker cluster / spider / offset layout.
//
// MIRRORS the inline computation in PulseMapView's Google marker rendering (the
// visibleMarkers + meetingMarkers `.map` bodies). Extracted so the MapLibre
// branch can render contact AND meeting markers through the same logic without
// duplicating it per marker type. The Google branch intentionally keeps its
// proven inline version (perf-critical 500-marker path — not refactored); if
// that logic ever changes, keep this in sync.
// ─────────────────────────────────────────────────────────────────────────────

import type { MarkerClusterEntry } from '../hooks/useMarkerClusters';
import type { MarkerOffsetEntry } from '../hooks/useMarkerOffsets';
import type { SpiderLegAnimation, SpiderAnimationPhase } from '../hooks/useSpiderAnimation';

export interface MarkerLayout {
  /** True when the marker should not render (collapsed cluster member). */
  hidden: boolean;
  offsetX: number | undefined;
  offsetY: number | undefined;
  showLabel: boolean;
  mode: 'normal' | 'spider-leg';
  animationPhase: SpiderAnimationPhase | undefined;
  animationDelayMs: number;
}

export function computeMarkerLayout(
  key: string,
  clusterEntries: Map<string, MarkerClusterEntry>,
  exitingKeys: Set<string>,
  legAnimations: Map<string, SpiderLegAnimation>,
  markerOffsets: Map<string, MarkerOffsetEntry>,
): MarkerLayout {
  const cluster = clusterEntries.get(key);
  // Exiting legs render at their last-known offset so the exit animation has a
  // place to fade out from — even though the cluster hook has already retagged
  // them 'cluster-member'.
  const exitAnim = exitingKeys.has(key) ? legAnimations.get(key) : undefined;
  const hidden = cluster?.mode === 'cluster-member' && !exitAnim;

  const baseOffset = markerOffsets.get(key);
  const isSpiderLeg = cluster?.mode === 'spider-leg' || !!exitAnim;
  const isSpiderAnchor = cluster?.mode === 'spider-anchor';

  const offsetX = exitAnim
    ? exitAnim.offsetX
    : isSpiderLeg
      ? cluster?.offsetX ?? 0
      : isSpiderAnchor
        ? 0
        : baseOffset?.offsetX;
  const offsetY = exitAnim
    ? exitAnim.offsetY
    : isSpiderLeg
      ? cluster?.offsetY ?? 0
      : isSpiderAnchor
        ? 0
        : baseOffset?.offsetY;
  const showLabel = isSpiderLeg ? false : isSpiderAnchor ? true : (baseOffset?.showLabel ?? true);

  const animEntry = legAnimations.get(key);
  return {
    hidden,
    offsetX,
    offsetY,
    showLabel,
    mode: isSpiderLeg ? 'spider-leg' : 'normal',
    animationPhase: animEntry?.phase,
    animationDelayMs: animEntry?.delayMs ?? 0,
  };
}
