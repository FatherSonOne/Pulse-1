import { useReducedMotion } from 'framer-motion';
import type { Transition } from 'framer-motion';

/**
 * useMotionPreset — canonical Pulse motion presets, reduced-motion aware.
 *
 * DESIGN.md §4 (Motion): all motion uses the project ease-out
 * `cubic-bezier(0.16, 1, 0.3, 1)` at 0.22s. No springs, no bounce.
 *
 * When the user prefers reduced motion, transforms collapse to a plain
 * cross-fade (no slide / scale / rise) and the duration drops to 0 so
 * nothing animates spatially. Consume this for any framer-motion entrance
 * that wants the house style:
 *
 *   const m = useMotionPreset();
 *   <motion.div {...m.fadeRise}>…</motion.div>
 *
 * For components that animate without adopting this hook, wrap the subtree
 * in `<MotionConfig reducedMotion="user">` (done at the Messages provider
 * root) — framer-motion then strips transform/layout animation globally
 * while preserving opacity, so reduced-motion is honored end-to-end.
 */

export const PULSE_EASE = [0.16, 1, 0.3, 1] as const;
export const PULSE_DURATION = 0.22;

interface MotionVariant {
  initial: Record<string, number>;
  animate: Record<string, number>;
  exit: Record<string, number>;
  transition: Transition;
}

export interface MotionPreset {
  /** True when the user prefers reduced motion. */
  reduce: boolean;
  /** Bare ease-out transition (instant when reduced). */
  transition: Transition;
  /** Fade + 6px rise entrance (fade-only when reduced). */
  fadeRise: MotionVariant;
  /** Fade + subtle scale entrance (fade-only when reduced). */
  scaleIn: MotionVariant;
  /** Plain cross-fade — identical in both modes. */
  fade: MotionVariant;
}

export function useMotionPreset(): MotionPreset {
  const reduce = useReducedMotion() ?? false;

  const transition: Transition = reduce
    ? { duration: 0 }
    : { duration: PULSE_DURATION, ease: PULSE_EASE };

  const fade: MotionVariant = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition,
  };

  return {
    reduce,
    transition,
    fade,
    fadeRise: reduce
      ? fade
      : {
          initial: { opacity: 0, y: 6 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: 6 },
          transition,
        },
    scaleIn: reduce
      ? fade
      : {
          initial: { opacity: 0, scale: 0.96 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.96 },
          transition,
        },
  };
}
