/**
 * Performance Utilities
 * Optimization helpers for the Pulse application
 */

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';

// ============================================
// DEBOUNCE & THROTTLE
// ============================================

/**
 * Debounce function - delays execution until after wait ms since last call
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * Throttle function - limits execution to once per wait ms
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (...args: Parameters<T>) {
    const now = Date.now();
    const remaining = wait - (now - lastCall);

    if (remaining <= 0) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastCall = now;
      func(...args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        func(...args);
      }, remaining);
    }
  };
}

/**
 * Hook for debounced value
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for debounced callback
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useMemo(
    () =>
      debounce((...args: Parameters<T>) => {
        callbackRef.current(...args);
      }, delay) as T,
    [delay]
  );
}

// ============================================
// INTERSECTION OBSERVER (Lazy Loading)
// ============================================

/**
 * Hook for lazy loading with Intersection Observer
 */
export function useLazyLoad(
  options: IntersectionObserverInit = {}
): [React.RefObject<HTMLDivElement>, boolean] {
  const elementRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, {
      root: options.root ?? null,
      rootMargin: options.rootMargin ?? '100px',
      threshold: options.threshold ?? 0,
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [options.root, options.rootMargin, options.threshold]);

  return [elementRef, isVisible];
}

/**
 * Hook for infinite scroll with Intersection Observer
 */
export function useInfiniteScroll(
  callback: () => void,
  hasMore: boolean,
  loading: boolean
): React.RefObject<HTMLDivElement> {
  const observerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const element = observerRef.current;
    if (!element || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          callbackRef.current();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loading]);

  return observerRef;
}

// ============================================
// VIRTUAL SCROLLING
// ============================================

interface VirtualScrollOptions {
  itemCount: number;
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

interface VirtualScrollResult {
  virtualItems: { index: number; start: number }[];
  totalHeight: number;
  startIndex: number;
  endIndex: number;
}

/**
 * Hook for basic virtual scrolling
 */
export function useVirtualScroll(
  options: VirtualScrollOptions,
  scrollTop: number
): VirtualScrollResult {
  const { itemCount, itemHeight, containerHeight, overscan = 3 } = options;

  return useMemo(() => {
    const totalHeight = itemCount * itemHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const endIndex = Math.min(itemCount - 1, startIndex + visibleCount + overscan * 2);

    const virtualItems: { index: number; start: number }[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      virtualItems.push({
        index: i,
        start: i * itemHeight,
      });
    }

    return {
      virtualItems,
      totalHeight,
      startIndex,
      endIndex,
    };
  }, [itemCount, itemHeight, containerHeight, overscan, scrollTop]);
}

// ============================================
// MEMOIZATION CACHE
// ============================================

/**
 * Create a memoized function with LRU cache
 */
export function memoizeWithLRU<T extends (...args: any[]) => any>(
  fn: T,
  maxSize: number = 100
): T {
  const cache = new Map<string, ReturnType<T>>();
  const keyOrder: string[] = [];

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      // Move to end (most recently used)
      const index = keyOrder.indexOf(key);
      if (index > -1) {
        keyOrder.splice(index, 1);
        keyOrder.push(key);
      }
      return cache.get(key)!;
    }

    const result = fn(...args);

    // Add to cache
    cache.set(key, result);
    keyOrder.push(key);

    // Evict if over capacity
    if (keyOrder.length > maxSize) {
      const oldestKey = keyOrder.shift()!;
      cache.delete(oldestKey);
    }

    return result;
  }) as T;
}

// ============================================
// RAF SCHEDULER
// ============================================

/**
 * Schedule updates with requestAnimationFrame
 */
export function useRAFCallback<T extends (...args: any[]) => void>(
  callback: T
): T {
  const rafId = useRef<number | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const scheduledCallback = useCallback((...args: Parameters<T>) => {
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
    }

    rafId.current = requestAnimationFrame(() => {
      callbackRef.current(...args);
      rafId.current = null;
    });
  }, []) as T;

  useEffect(() => {
    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  return scheduledCallback;
}

// ============================================
// IMAGE OPTIMIZATION
// ============================================

/**
 * Generate optimized image srcset
 */
export function generateSrcSet(
  src: string,
  widths: number[] = [320, 640, 960, 1280, 1920]
): string {
  // If the URL supports width parameters (like Supabase storage)
  if (src.includes('supabase') || src.includes('cloudinary')) {
    return widths
      .map(w => {
        const url = src.includes('?')
          ? `${src}&width=${w}`
          : `${src}?width=${w}`;
        return `${url} ${w}w`;
      })
      .join(', ');
  }

  // Return original for other sources
  return src;
}

/**
 * Hook for lazy loading images
 */
export function useLazyImage(src: string): {
  imgRef: React.RefObject<HTMLImageElement>;
  isLoaded: boolean;
  currentSrc: string | undefined;
} {
  const imgRef = useRef<HTMLImageElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setCurrentSrc(src);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(img);

    return () => {
      observer.disconnect();
    };
  }, [src]);

  useEffect(() => {
    if (!currentSrc) return;

    const img = new Image();
    img.onload = () => setIsLoaded(true);
    img.src = currentSrc;
  }, [currentSrc]);

  return { imgRef, isLoaded, currentSrc };
}

// ============================================
// PERFORMANCE MONITORING
// ============================================

/**
 * Measure component render time
 */
export function useRenderTime(componentName: string): void {
  const startTime = useRef(performance.now());

  useEffect(() => {
    const endTime = performance.now();
    const duration = endTime - startTime.current;

    if (duration > 16) {
      // More than 1 frame (60fps = 16ms)
      console.warn(`[Performance] ${componentName} render took ${duration.toFixed(2)}ms`);
    }
  });
}

/**
 * Track expensive operations
 */
export function measureOperation<T>(
  operationName: string,
  operation: () => T
): T {
  const start = performance.now();
  const result = operation();
  const duration = performance.now() - start;

  if (duration > 100) {
    console.warn(`[Performance] ${operationName} took ${duration.toFixed(2)}ms`);
  }

  return result;
}

// ============================================
// MEMORY MANAGEMENT
// ============================================

/**
 * Hook to cleanup resources on unmount
 */
export function useCleanup(cleanupFn: () => void): void {
  const cleanupRef = useRef(cleanupFn);
  cleanupRef.current = cleanupFn;

  useEffect(() => {
    return () => {
      cleanupRef.current();
    };
  }, []);
}

/**
 * Track memory usage (dev only)
 */
export function logMemoryUsage(label: string): void {
  if (process.env.NODE_ENV === 'development' && 'memory' in performance) {
    const memory = (performance as any).memory;
    console.log(`[Memory] ${label}:`, {
      usedJSHeapSize: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
      totalJSHeapSize: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
    });
  }
}

// ============================================
// BATCH UPDATES
// ============================================

/**
 * Batch multiple state updates
 */
export function batchUpdates<T>(updates: (() => void)[]): void {
  // React 18 automatically batches updates, but this can be used for older versions
  // or for explicit batching control
  updates.forEach(update => update());
}

/**
 * Queue updates for next idle period
 */
export function queueIdleTask(task: () => void): void {
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(task, { timeout: 1000 });
  } else {
    setTimeout(task, 1);
  }
}

// ============================================
// PRELOADING
// ============================================

/**
 * Preload a component
 */
export function preloadComponent(importFn: () => Promise<any>): void {
  queueIdleTask(() => {
    importFn().catch(() => {
      // Ignore preload errors
    });
  });
}

/**
 * Preload image
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Preload multiple images
 */
export function preloadImages(srcs: string[]): Promise<void[]> {
  return Promise.all(srcs.map(preloadImage));
}
