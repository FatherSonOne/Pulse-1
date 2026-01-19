/**
 * Mobile Utilities
 * Touch gestures, device detection, and mobile optimizations
 */

import { useRef, useEffect, useState, useCallback } from 'react';

// ============================================
// DEVICE DETECTION
// ============================================

/**
 * Check if running on a touch device
 */
export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Check if running on iOS
 */
export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

/**
 * Check if running on Android
 */
export function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}

/**
 * Check if running on mobile
 */
export function isMobile(): boolean {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isSmallScreen = Math.min(width, height) <= 768;
  const isTouchEnabled = isTouchDevice();
  return isSmallScreen || (isTouchEnabled && width <= 1024);
}

/**
 * Hook to track device type
 */
export function useDeviceType(): {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
} {
  const [deviceType, setDeviceType] = useState(() => ({
    isMobile: isMobile(),
    isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
    isDesktop: window.innerWidth >= 1024,
    isTouchDevice: isTouchDevice(),
  }));

  useEffect(() => {
    const handleResize = () => {
      setDeviceType({
        isMobile: isMobile(),
        isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
        isDesktop: window.innerWidth >= 1024,
        isTouchDevice: isTouchDevice(),
      });
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return deviceType;
}

// ============================================
// TOUCH GESTURES
// ============================================

interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  preventDefault?: boolean;
}

/**
 * Hook for swipe gestures
 */
export function useSwipe(options: SwipeOptions = {}): React.RefObject<HTMLDivElement> {
  const { threshold = 50, preventDefault = false } = options;
  const ref = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return;

      const touchEnd = {
        x: e.changedTouches[0].clientX,
        y: e.changedTouches[0].clientY,
      };

      const deltaX = touchEnd.x - touchStartRef.current.x;
      const deltaY = touchEnd.y - touchStartRef.current.y;

      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      if (absDeltaX > threshold || absDeltaY > threshold) {
        if (preventDefault) {
          e.preventDefault();
        }

        if (absDeltaX > absDeltaY) {
          // Horizontal swipe
          if (deltaX > 0) {
            options.onSwipeRight?.();
          } else {
            options.onSwipeLeft?.();
          }
        } else {
          // Vertical swipe
          if (deltaY > 0) {
            options.onSwipeDown?.();
          } else {
            options.onSwipeUp?.();
          }
        }
      }

      touchStartRef.current = null;
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: !preventDefault });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [options.onSwipeLeft, options.onSwipeRight, options.onSwipeUp, options.onSwipeDown, threshold, preventDefault]);

  return ref;
}

interface LongPressOptions {
  onLongPress: () => void;
  duration?: number;
  onStart?: () => void;
  onCancel?: () => void;
}

/**
 * Hook for long press gesture
 */
export function useLongPress(options: LongPressOptions): {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onTouchMove: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
} {
  const { onLongPress, duration = 500, onStart, onCancel } = options;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);

  const start = useCallback(() => {
    isLongPressRef.current = false;
    onStart?.();

    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onLongPress();
    }, duration);
  }, [onLongPress, duration, onStart]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!isLongPressRef.current) {
      onCancel?.();
    }
  }, [onCancel]);

  return {
    onTouchStart: () => start(),
    onTouchEnd: cancel,
    onTouchMove: cancel,
    onMouseDown: () => start(),
    onMouseUp: cancel,
    onMouseLeave: cancel,
  };
}

interface PinchZoomOptions {
  onZoom: (scale: number) => void;
  minScale?: number;
  maxScale?: number;
}

/**
 * Hook for pinch-to-zoom gesture
 */
export function usePinchZoom(options: PinchZoomOptions): React.RefObject<HTMLDivElement> {
  const { onZoom, minScale = 0.5, maxScale = 3 } = options;
  const ref = useRef<HTMLDivElement>(null);
  const initialDistanceRef = useRef<number | null>(null);
  const currentScaleRef = useRef(1);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const getDistance = (touches: TouchList): number => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialDistanceRef.current = getDistance(e.touches);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistanceRef.current !== null) {
        e.preventDefault();

        const currentDistance = getDistance(e.touches);
        const scale = currentDistance / initialDistanceRef.current;
        const newScale = Math.min(maxScale, Math.max(minScale, currentScaleRef.current * scale));

        onZoom(newScale);
      }
    };

    const handleTouchEnd = () => {
      initialDistanceRef.current = null;
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onZoom, minScale, maxScale]);

  return ref;
}

// ============================================
// PULL TO REFRESH
// ============================================

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  maxPull?: number;
}

interface PullToRefreshState {
  isPulling: boolean;
  pullDistance: number;
  isRefreshing: boolean;
}

/**
 * Hook for pull-to-refresh gesture
 */
export function usePullToRefresh(options: PullToRefreshOptions): {
  ref: React.RefObject<HTMLDivElement>;
  state: PullToRefreshState;
} {
  const { onRefresh, threshold = 80, maxPull = 120 } = options;
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<PullToRefreshState>({
    isPulling: false,
    pullDistance: 0,
    isRefreshing: false,
  });
  const touchStartY = useRef(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only start if at top of scroll
      if (element.scrollTop === 0) {
        touchStartY.current = e.touches[0].clientY;
        setState(prev => ({ ...prev, isPulling: true }));
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!state.isPulling || state.isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const delta = currentY - touchStartY.current;

      if (delta > 0) {
        e.preventDefault();
        const distance = Math.min(maxPull, delta * 0.5);
        setState(prev => ({ ...prev, pullDistance: distance }));
      }
    };

    const handleTouchEnd = async () => {
      if (!state.isPulling) return;

      if (state.pullDistance >= threshold && !state.isRefreshing) {
        setState(prev => ({ ...prev, isRefreshing: true, pullDistance: threshold }));

        try {
          await onRefresh();
        } finally {
          setState({ isPulling: false, pullDistance: 0, isRefreshing: false });
        }
      } else {
        setState({ isPulling: false, pullDistance: 0, isRefreshing: false });
      }
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [state.isPulling, state.pullDistance, state.isRefreshing, onRefresh, threshold, maxPull]);

  return { ref, state };
}

// ============================================
// HAPTIC FEEDBACK
// ============================================

/**
 * Trigger haptic feedback (if available)
 */
export function hapticFeedback(type: 'light' | 'medium' | 'heavy' = 'light'): void {
  if ('vibrate' in navigator) {
    const patterns: Record<string, number[]> = {
      light: [10],
      medium: [30],
      heavy: [50],
    };
    navigator.vibrate(patterns[type]);
  }
}

// ============================================
// KEYBOARD HANDLING
// ============================================

/**
 * Hook to detect virtual keyboard
 */
export function useVirtualKeyboard(): { isKeyboardOpen: boolean; keyboardHeight: number } {
  const [state, setState] = useState({
    isKeyboardOpen: false,
    keyboardHeight: 0,
  });

  useEffect(() => {
    const initialHeight = window.innerHeight;

    const handleResize = () => {
      const currentHeight = window.innerHeight;
      const heightDiff = initialHeight - currentHeight;

      if (heightDiff > 150) {
        setState({ isKeyboardOpen: true, keyboardHeight: heightDiff });
      } else {
        setState({ isKeyboardOpen: false, keyboardHeight: 0 });
      }
    };

    // Use visualViewport API if available (better accuracy)
    if ('visualViewport' in window) {
      const viewport = (window as any).visualViewport;
      viewport.addEventListener('resize', handleResize);

      return () => {
        viewport.removeEventListener('resize', handleResize);
      };
    } else {
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, []);

  return state;
}

// ============================================
// SAFE AREA INSETS
// ============================================

interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Get safe area insets for notched devices
 */
export function getSafeAreaInsets(): SafeAreaInsets {
  const computedStyle = getComputedStyle(document.documentElement);

  return {
    top: parseInt(computedStyle.getPropertyValue('--sat') || '0', 10),
    right: parseInt(computedStyle.getPropertyValue('--sar') || '0', 10),
    bottom: parseInt(computedStyle.getPropertyValue('--sab') || '0', 10),
    left: parseInt(computedStyle.getPropertyValue('--sal') || '0', 10),
  };
}

/**
 * Hook for safe area insets
 */
export function useSafeAreaInsets(): SafeAreaInsets {
  const [insets, setInsets] = useState(getSafeAreaInsets);

  useEffect(() => {
    // Update CSS custom properties for safe area
    document.documentElement.style.setProperty(
      '--sat',
      'env(safe-area-inset-top)'
    );
    document.documentElement.style.setProperty(
      '--sar',
      'env(safe-area-inset-right)'
    );
    document.documentElement.style.setProperty(
      '--sab',
      'env(safe-area-inset-bottom)'
    );
    document.documentElement.style.setProperty(
      '--sal',
      'env(safe-area-inset-left)'
    );

    // Re-read after setting
    const timer = setTimeout(() => {
      setInsets(getSafeAreaInsets());
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return insets;
}

// ============================================
// ORIENTATION
// ============================================

type Orientation = 'portrait' | 'landscape';

/**
 * Hook to track orientation
 */
export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>(() =>
    window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
  );

  useEffect(() => {
    const handleOrientationChange = () => {
      setOrientation(
        window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
      );
    };

    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  return orientation;
}

// ============================================
// PREVENT BOUNCE SCROLL
// ============================================

/**
 * Prevent iOS bounce scroll on a container
 */
export function preventBounceScroll(element: HTMLElement): () => void {
  let startY = 0;

  const handleTouchStart = (e: TouchEvent) => {
    startY = e.touches[0].clientY;
  };

  const handleTouchMove = (e: TouchEvent) => {
    const y = e.touches[0].clientY;
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight;
    const clientHeight = element.clientHeight;

    if (
      (scrollTop <= 0 && y > startY) ||
      (scrollTop + clientHeight >= scrollHeight && y < startY)
    ) {
      e.preventDefault();
    }
  };

  element.addEventListener('touchstart', handleTouchStart, { passive: true });
  element.addEventListener('touchmove', handleTouchMove, { passive: false });

  return () => {
    element.removeEventListener('touchstart', handleTouchStart);
    element.removeEventListener('touchmove', handleTouchMove);
  };
}
