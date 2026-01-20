import { useEffect, useRef, useState, useCallback } from 'react';

export interface UseHoverWithDelayOptions {
  /** Delay in milliseconds before triggering hover state (default: 300ms) */
  hoverDelay?: number;
  /** Delay in milliseconds before triggering unhover state (default: 100ms) */
  unhoverDelay?: number;
  /** Callback when hover state becomes true */
  onHoverStart?: () => void;
  /** Callback when hover state becomes false */
  onHoverEnd?: () => void;
  /** Enable mobile long-press detection (default: false) */
  enableLongPress?: boolean;
  /** Long-press delay in milliseconds (default: 500ms) */
  longPressDelay?: number;
  /** Enable haptic feedback on mobile (default: false) */
  enableHaptic?: boolean;
}

export interface UseHoverWithDelayReturn {
  /** Current hover state */
  isHovering: boolean;
  /** Ref to attach to the element */
  hoverRef: React.RefObject<HTMLElement>;
  /** Manual trigger for hover state */
  triggerHover: () => void;
  /** Manual trigger to end hover state */
  endHover: () => void;
  /** Whether long-press is active */
  isLongPressed: boolean;
}

/**
 * Custom hook for handling hover interactions with configurable delays.
 * Prevents accidental triggers from quick mouse movements and supports mobile long-press.
 *
 * @example
 * ```tsx
 * const { isHovering, hoverRef } = useHoverWithDelay({
 *   hoverDelay: 300,
 *   onHoverStart: () => console.log('Hover started'),
 *   enableLongPress: true,
 *   enableHaptic: true
 * });
 *
 * return (
 *   <div ref={hoverRef}>
 *     {isHovering && <QuickReactionBar />}
 *   </div>
 * );
 * ```
 */
export const useHoverWithDelay = (options: UseHoverWithDelayOptions = {}): UseHoverWithDelayReturn => {
  const {
    hoverDelay = 300,
    unhoverDelay = 100,
    onHoverStart,
    onHoverEnd,
    enableLongPress = false,
    longPressDelay = 500,
    enableHaptic = false,
  } = options;

  const [isHovering, setIsHovering] = useState(false);
  const [isLongPressed, setIsLongPressed] = useState(false);
  const hoverRef = useRef<HTMLElement>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const unhoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    if (unhoverTimerRef.current) {
      clearTimeout(unhoverTimerRef.current);
      unhoverTimerRef.current = null;
    }
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Trigger haptic feedback (mobile only)
  const triggerHaptic = useCallback(() => {
    if (enableHaptic && 'vibrate' in navigator) {
      navigator.vibrate(10); // Short 10ms vibration
    }
  }, [enableHaptic]);

  // Start hover state
  const triggerHover = useCallback(() => {
    clearTimers();
    setIsHovering(true);
    onHoverStart?.();
  }, [clearTimers, onHoverStart]);

  // End hover state
  const endHover = useCallback(() => {
    clearTimers();
    setIsHovering(false);
    setIsLongPressed(false);
    onHoverEnd?.();
  }, [clearTimers, onHoverEnd]);

  // Handle mouse enter
  const handleMouseEnter = useCallback(() => {
    // Cancel any pending unhover
    if (unhoverTimerRef.current) {
      clearTimeout(unhoverTimerRef.current);
      unhoverTimerRef.current = null;
    }

    // Start hover delay timer
    hoverTimerRef.current = setTimeout(() => {
      setIsHovering(true);
      onHoverStart?.();
      hoverTimerRef.current = null;
    }, hoverDelay);
  }, [hoverDelay, onHoverStart]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    // Cancel any pending hover
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }

    // Start unhover delay timer
    unhoverTimerRef.current = setTimeout(() => {
      setIsHovering(false);
      setIsLongPressed(false);
      onHoverEnd?.();
      unhoverTimerRef.current = null;
    }, unhoverDelay);
  }, [unhoverDelay, onHoverEnd]);

  // Handle touch start (mobile long-press)
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enableLongPress) return;

    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };

    // Start long-press timer
    longPressTimerRef.current = setTimeout(() => {
      setIsHovering(true);
      setIsLongPressed(true);
      triggerHaptic();
      onHoverStart?.();
      longPressTimerRef.current = null;
    }, longPressDelay);
  }, [enableLongPress, longPressDelay, onHoverStart, triggerHaptic]);

  // Handle touch move (cancel if user moves finger)
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enableLongPress || !touchStartRef.current) return;

    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

    // Cancel if moved more than 10px
    if (deltaX > 10 || deltaY > 10) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      touchStartRef.current = null;
    }
  }, [enableLongPress]);

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    if (!enableLongPress) return;

    // Cancel long-press timer if still active
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // Reset touch tracking
    touchStartRef.current = null;

    // End hover state after delay
    setTimeout(() => {
      setIsHovering(false);
      setIsLongPressed(false);
      onHoverEnd?.();
    }, unhoverDelay);
  }, [enableLongPress, unhoverDelay, onHoverEnd]);

  // Handle scroll (cancel hover on scroll)
  const handleScroll = useCallback(() => {
    if (isHovering) {
      clearTimers();
      setIsHovering(false);
      setIsLongPressed(false);
      onHoverEnd?.();
    }
  }, [isHovering, clearTimers, onHoverEnd]);

  // Set up event listeners
  useEffect(() => {
    const element = hoverRef.current;
    if (!element) return;

    // Mouse events
    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    // Touch events (mobile)
    if (enableLongPress) {
      element.addEventListener('touchstart', handleTouchStart, { passive: true });
      element.addEventListener('touchmove', handleTouchMove, { passive: true });
      element.addEventListener('touchend', handleTouchEnd);
      element.addEventListener('touchcancel', handleTouchEnd);
    }

    // Scroll listener (cancel hover on scroll)
    const scrollContainer = element.closest('.overflow-auto, .overflow-y-auto, .overflow-scroll');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    }
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Cleanup
    return () => {
      clearTimers();
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);

      if (enableLongPress) {
        element.removeEventListener('touchstart', handleTouchStart);
        element.removeEventListener('touchmove', handleTouchMove);
        element.removeEventListener('touchend', handleTouchEnd);
        element.removeEventListener('touchcancel', handleTouchEnd);
      }

      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      }
      window.removeEventListener('scroll', handleScroll);
    };
  }, [
    handleMouseEnter,
    handleMouseLeave,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleScroll,
    enableLongPress,
    clearTimers,
  ]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  return {
    isHovering,
    hoverRef,
    triggerHover,
    endHover,
    isLongPressed,
  };
};

export default useHoverWithDelay;
