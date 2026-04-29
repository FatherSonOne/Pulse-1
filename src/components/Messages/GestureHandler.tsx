import React, { useRef, useState, useEffect, useCallback } from 'react';
import { hapticService } from '../../services/hapticService';

export interface GestureHandlerProps {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onLongPress?: () => void;
  swipeThreshold?: number;
  longPressDelay?: number;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  // Accessibility
  ariaLabel?: string;
  role?: string;
  tabIndex?: number;
  // Keyboard support
  enableKeyboard?: boolean;
  keyboardShortcuts?: {
    swipeLeft?: string;  // e.g., 'Delete' or 'Backspace'
    swipeRight?: string; // e.g., 'r' for reply
    longPress?: string;  // e.g., 'Enter' or 'm' for menu
  };
}

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
  currentX: number;
  currentY: number;
  isSwiping: boolean;
  isLongPressing: boolean;
}

/**
 * GestureHandler - Mobile gesture detection component
 *
 * Features:
 * - Swipe left/right detection with threshold
 * - Long-press detection with configurable delay
 * - Visual feedback during gestures
 * - Conflict resolution (swipe vs long-press)
 * - Touch-optimized for mobile devices
 *
 * Usage:
 * ```tsx
 * <GestureHandler
 *   onSwipeLeft={() => handleDelete()}
 *   onSwipeRight={() => handleReply()}
 *   onLongPress={() => showContextMenu()}
 *   swipeThreshold={100}
 *   longPressDelay={500}
 * >
 *   <MessageBubble />
 * </GestureHandler>
 * ```
 */
export const GestureHandler: React.FC<GestureHandlerProps> = ({
  onSwipeLeft,
  onSwipeRight,
  onLongPress,
  swipeThreshold = 100, // pixels
  longPressDelay = 500, // ms
  disabled = false,
  children,
  className = '',
  style = {},
  ariaLabel,
  role = 'button',
  tabIndex = 0,
  enableKeyboard = true,
  keyboardShortcuts = {
    swipeLeft: 'Delete',
    swipeRight: 'r',
    longPress: 'm',
  },
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStateRef = useRef<TouchState | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isLongPressing, setIsLongPressing] = useState(false);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStateRef.current = null;
    setSwipeOffset(0);
    setIsLongPressing(false);
  }, []);

  // Handle touch start
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;

      const touch = e.touches[0];
      const now = Date.now();

      touchStateRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: now,
        currentX: touch.clientX,
        currentY: touch.clientY,
        isSwiping: false,
        isLongPressing: false,
      };

      // Start long-press timer
      if (onLongPress) {
        longPressTimerRef.current = setTimeout(() => {
          if (touchStateRef.current && !touchStateRef.current.isSwiping) {
            touchStateRef.current.isLongPressing = true;
            setIsLongPressing(true);
            onLongPress();

            // Phase 6 — platform-aware haptic. On Android (Capacitor)
            // this routes to the native Haptics plugin; on web it
            // falls back to navigator.vibrate.
            void hapticService.trigger('medium');
          }
        }, longPressDelay);
      }
    },
    [disabled, onLongPress, longPressDelay]
  );

  // Handle touch move
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || !touchStateRef.current) return;

      const touch = e.touches[0];
      const state = touchStateRef.current;

      state.currentX = touch.clientX;
      state.currentY = touch.clientY;

      const deltaX = state.currentX - state.startX;
      const deltaY = state.currentY - state.startY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // If user moved significantly, cancel long-press
      if (distance > 10 && longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      // Detect horizontal swipe (more horizontal than vertical)
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
        state.isSwiping = true;
        setSwipeOffset(deltaX);

        // Prevent vertical scrolling during horizontal swipe
        if (Math.abs(deltaX) > 20) {
          e.preventDefault();
        }
      }
    },
    [disabled]
  );

  // Handle touch end
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || !touchStateRef.current) return;

      const state = touchStateRef.current;
      const deltaX = state.currentX - state.startX;
      const deltaY = state.currentY - state.startY;
      const duration = Date.now() - state.startTime;

      // Clear long-press timer
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      // Don't trigger swipe if it was a long-press
      if (state.isLongPressing) {
        cleanup();
        return;
      }

      // Check for swipe gestures
      if (state.isSwiping && Math.abs(deltaX) > Math.abs(deltaY)) {
        // Note: velocity could be used for future fast-swipe detection
        // const velocity = Math.abs(deltaX) / duration;

        // Swipe left (negative deltaX)
        if (deltaX < -swipeThreshold && onSwipeLeft) {
          onSwipeLeft();
          void hapticService.trigger('light');
        }
        // Swipe right (positive deltaX)
        else if (deltaX > swipeThreshold && onSwipeRight) {
          onSwipeRight();
          void hapticService.trigger('light');
        }
      }

      cleanup();
    },
    [disabled, swipeThreshold, onSwipeLeft, onSwipeRight, cleanup]
  );

  // Handle touch cancel
  const handleTouchCancel = useCallback(() => {
    cleanup();
  }, [cleanup]);

  // Handle keyboard events for accessibility
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled || !enableKeyboard) return;

      const key = e.key;

      // Swipe left (Delete/Backspace)
      if (key === keyboardShortcuts.swipeLeft && onSwipeLeft) {
        e.preventDefault();
        onSwipeLeft();
      }
      // Swipe right (e.g., 'r' for reply)
      else if (key === keyboardShortcuts.swipeRight && onSwipeRight) {
        e.preventDefault();
        onSwipeRight();
      }
      // Long-press (e.g., 'm' for menu)
      else if (key === keyboardShortcuts.longPress && onLongPress) {
        e.preventDefault();
        onLongPress();
      }
      // Alternative: Context menu key
      else if (key === 'ContextMenu' && onLongPress) {
        e.preventDefault();
        onLongPress();
      }
    },
    [
      disabled,
      enableKeyboard,
      keyboardShortcuts,
      onSwipeLeft,
      onSwipeRight,
      onLongPress,
    ]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Check for reduced motion preference
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Calculate transform for visual feedback
  const transform =
    swipeOffset !== 0 && !prefersReducedMotion
      ? `translateX(${Math.max(-200, Math.min(200, swipeOffset))}px)`
      : undefined;

  const opacity = isLongPressing ? 0.7 : 1;

  // Build ARIA attributes
  const ariaAttributes: Record<string, string> = {
    'aria-label': ariaLabel || 'Interactive message',
  };

  if (onSwipeLeft) {
    ariaAttributes['aria-description'] =
      `${ariaAttributes['aria-description'] || ''} Press ${keyboardShortcuts.swipeLeft} to delete.`.trim();
  }
  if (onSwipeRight) {
    ariaAttributes['aria-description'] =
      `${ariaAttributes['aria-description'] || ''} Press ${keyboardShortcuts.swipeRight} to reply.`.trim();
  }
  if (onLongPress) {
    ariaAttributes['aria-description'] =
      `${ariaAttributes['aria-description'] || ''} Press ${keyboardShortcuts.longPress} for menu.`.trim();
  }

  return (
    <div
      ref={containerRef}
      className={`gesture-handler ${className}`}
      role={role}
      tabIndex={disabled ? -1 : tabIndex}
      {...ariaAttributes}
      style={{
        ...style,
        transform,
        opacity,
        transition: swipeOffset === 0 ? 'transform 0.2s ease-out, opacity 0.2s' : 'opacity 0.2s',
        touchAction: 'pan-y', // Allow vertical scrolling but not horizontal
        outline: 'none', // Remove default focus outline, add custom if needed
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
};

/**
 * Hook version of GestureHandler for more control
 *
 * Usage:
 * ```tsx
 * const { handlers, swipeOffset, isLongPressing } = useGestureHandler({
 *   onSwipeLeft: handleDelete,
 *   onSwipeRight: handleReply,
 *   onLongPress: showMenu,
 * });
 *
 * return <div {...handlers}>{content}</div>;
 * ```
 */
export function useGestureHandler({
  onSwipeLeft,
  onSwipeRight,
  onLongPress,
  swipeThreshold = 100,
  longPressDelay = 500,
  disabled = false,
}: Omit<GestureHandlerProps, 'children' | 'className' | 'style'>) {
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStateRef = useRef<TouchState | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isLongPressing, setIsLongPressing] = useState(false);

  const cleanup = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStateRef.current = null;
    setSwipeOffset(0);
    setIsLongPressing(false);
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;

      const touch = e.touches[0];
      touchStateRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
        currentX: touch.clientX,
        currentY: touch.clientY,
        isSwiping: false,
        isLongPressing: false,
      };

      if (onLongPress) {
        longPressTimerRef.current = setTimeout(() => {
          if (touchStateRef.current && !touchStateRef.current.isSwiping) {
            touchStateRef.current.isLongPressing = true;
            setIsLongPressing(true);
            onLongPress();
            void hapticService.trigger('medium');
          }
        }, longPressDelay);
      }
    },
    [disabled, onLongPress, longPressDelay]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || !touchStateRef.current) return;

      const touch = e.touches[0];
      const state = touchStateRef.current;
      state.currentX = touch.clientX;
      state.currentY = touch.clientY;

      const deltaX = state.currentX - state.startX;
      const deltaY = state.currentY - state.startY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (distance > 10 && longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
        state.isSwiping = true;
        setSwipeOffset(deltaX);
        if (Math.abs(deltaX) > 20) e.preventDefault();
      }
    },
    [disabled]
  );

  const handleTouchEnd = useCallback(() => {
    if (disabled || !touchStateRef.current) return;

    const state = touchStateRef.current;
    const deltaX = state.currentX - state.startX;
    const deltaY = state.currentY - state.startY;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (!state.isLongPressing && state.isSwiping && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < -swipeThreshold && onSwipeLeft) {
        onSwipeLeft();
        void hapticService.trigger('light');
      } else if (deltaX > swipeThreshold && onSwipeRight) {
        onSwipeRight();
        void hapticService.trigger('light');
      }
    }

    cleanup();
  }, [disabled, swipeThreshold, onSwipeLeft, onSwipeRight, cleanup]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: cleanup,
    },
    swipeOffset,
    isLongPressing,
  };
}
