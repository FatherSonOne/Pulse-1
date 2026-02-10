import { useEffect, useRef, useState, useCallback } from 'react';

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  maxDistance?: number;
  resistance?: number;
  enabled?: boolean;
}

/**
 * usePullToRefresh Hook
 * Implements native-feeling pull-to-refresh gesture
 *
 * Usage:
 * const { pullDistance, isRefreshing, containerRef } = usePullToRefresh({
 *   onRefresh: async () => {
 *     await fetchData();
 *   }
 * });
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxDistance = 150,
  resistance = 0.5,
  enabled = true
}: PullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const scrollY = useRef(0);

  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    if ('vibrate' in navigator) {
      const patterns = {
        light: 10,
        medium: 20,
        heavy: 30
      };
      navigator.vibrate(patterns[type]);
    }
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled || isRefreshing) return;

    const container = containerRef.current;
    if (!container) return;

    // Only activate if scrolled to top
    scrollY.current = container.scrollTop;
    if (scrollY.current > 0) return;

    startY.current = e.touches[0].clientY;
    currentY.current = startY.current;
    setIsPulling(true);
  }, [enabled, isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling || !enabled || isRefreshing) return;

    const container = containerRef.current;
    if (!container) return;

    currentY.current = e.touches[0].clientY;
    const deltaY = currentY.current - startY.current;

    // Only pull down (positive delta)
    if (deltaY <= 0) {
      setPullDistance(0);
      return;
    }

    // Prevent default scroll behavior when pulling
    if (container.scrollTop === 0 && deltaY > 0) {
      e.preventDefault();
    }

    // Apply resistance curve
    const distance = Math.min(
      deltaY * resistance,
      maxDistance
    );

    setPullDistance(distance);

    // Haptic feedback at threshold
    if (distance >= threshold && pullDistance < threshold) {
      triggerHaptic('medium');
    }
  }, [isPulling, enabled, isRefreshing, threshold, maxDistance, resistance, pullDistance, triggerHaptic]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling || !enabled) return;

    setIsPulling(false);

    if (pullDistance >= threshold && !isRefreshing) {
      // Trigger refresh
      setIsRefreshing(true);
      setPullDistance(threshold); // Lock at threshold during refresh
      triggerHaptic('heavy');

      try {
        await onRefresh();
      } catch (error) {
        console.error('[PullToRefresh] Error during refresh:', error);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      // Snap back
      setPullDistance(0);
    }
  }, [isPulling, enabled, pullDistance, threshold, isRefreshing, onRefresh, triggerHaptic]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    // Use passive: false to allow preventDefault
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    pullDistance,
    isRefreshing,
    isPulling,
    containerRef,
    canRefresh: pullDistance >= threshold
  };
}
