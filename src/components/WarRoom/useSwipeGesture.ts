/**
 * useSwipeGesture — Detects horizontal swipe gestures on touch devices.
 *
 * Usage:
 *   const ref = useSwipeGesture({
 *     onSwipeLeft: () => openArtifactsPanel(),
 *     onSwipeRight: () => openSourcesPanel(),
 *   });
 *   <div ref={ref}>...</div>
 *
 * Minimum swipe distance: 50px. Max vertical drift: 80px.
 * Also supports edge swipes (starting within 30px of screen edge).
 */

import { useRef, useEffect, useCallback } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** Minimum horizontal distance in px (default: 50) */
  threshold?: number;
  /** Only trigger on edge swipes starting within this many px of screen edge (0 = disabled) */
  edgeOnly?: number;
}

export function useSwipeGesture<T extends HTMLElement = HTMLDivElement>(
  handlers: SwipeHandlers
) {
  const ref = useRef<T>(null);
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const threshold = handlers.threshold ?? 50;
  const edgeOnly = handlers.edgeOnly ?? 0;

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;

    // If edge-only mode, check if touch started near screen edge
    if (edgeOnly > 0) {
      const fromLeft = touch.clientX;
      const fromRight = window.innerWidth - touch.clientX;
      if (fromLeft > edgeOnly && fromRight > edgeOnly) return;
    }

    touchStart.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  }, [edgeOnly]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!touchStart.current) return;

    const touch = e.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;
    const elapsed = Date.now() - touchStart.current.time;

    touchStart.current = null;

    // Must be primarily horizontal (not a scroll)
    if (Math.abs(dy) > 80) return;
    // Must be fast enough (under 500ms)
    if (elapsed > 500) return;
    // Must exceed threshold
    if (Math.abs(dx) < threshold) return;

    if (dx > 0) {
      handlers.onSwipeRight?.();
    } else {
      handlers.onSwipeLeft?.();
    }
  }, [handlers.onSwipeLeft, handlers.onSwipeRight, threshold]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd]);

  return ref;
}
