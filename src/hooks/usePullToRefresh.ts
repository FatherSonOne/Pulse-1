import { useEffect, useRef, useState, useCallback } from 'react';

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number; // Pull distance to trigger refresh (px)
  maxPullDistance?: number; // Maximum pull distance (px)
  enabled?: boolean;
}

export const usePullToRefresh = (options: PullToRefreshOptions) => {
  const {
    onRefresh,
    threshold = 80,
    maxPullDistance = 120,
    enabled = true,
  } = options;

  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const touchStartY = useRef<number>(0);
  const containerRef = useRef<HTMLElement | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled || isRefreshing) return;

    // Only start pull if at the top of the scroll container
    const scrollTop = containerRef.current?.scrollTop || 0;
    if (scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }, [enabled, isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling || !enabled || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;

    // Only track downward pulls
    if (deltaY > 0) {
      // Apply resistance curve to make pulling feel natural
      const resistance = 0.5;
      const distance = Math.min(deltaY * resistance, maxPullDistance);
      setPullDistance(distance);

      // Prevent default scroll if pulling
      if (distance > 5) {
        e.preventDefault();
      }
    }
  }, [isPulling, enabled, isRefreshing, maxPullDistance]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling || !enabled) return;

    setIsPulling(false);

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold); // Lock at threshold during refresh

      try {
        await onRefresh();
      } catch (error) {
        console.error('Pull to refresh error:', error);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [isPulling, pullDistance, threshold, enabled, isRefreshing, onRefresh]);

  const bindToElement = useCallback((element: HTMLElement | null) => {
    containerRef.current = element;

    if (element && enabled) {
      element.addEventListener('touchstart', handleTouchStart, { passive: true });
      element.addEventListener('touchmove', handleTouchMove, { passive: false });
      element.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    return () => {
      if (element) {
        element.removeEventListener('touchstart', handleTouchStart);
        element.removeEventListener('touchmove', handleTouchMove);
        element.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  const progress = Math.min(pullDistance / threshold, 1); // 0-1 progress

  return {
    isPulling,
    pullDistance,
    isRefreshing,
    progress,
    bindToElement,
  };
};

export default usePullToRefresh;
