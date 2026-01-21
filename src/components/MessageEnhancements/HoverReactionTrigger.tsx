import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useHoverWithDelay } from '../../hooks/useHoverWithDelay';

// Long-press progress ring component for mobile visual feedback
const LongPressIndicator: React.FC<{
  progress: number; // 0 to 1
  isActive: boolean;
  isCancelled: boolean;
}> = ({ progress, isActive, isCancelled }) => {
  if (!isActive && progress === 0) return null;

  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div
      className={`long-press-indicator ${isCancelled ? 'long-press-cancelled' : ''}`}
      aria-hidden="true"
    >
      {/* Pulse overlay during press */}
      {isActive && <div className="long-press-pulse-overlay" />}

      {/* SVG Progress Ring */}
      <svg
        className="long-press-ring"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        {/* Background track */}
        <circle
          className="long-press-ring-track"
          cx="50"
          cy="50"
          r={radius}
        />
        {/* Progress arc */}
        <circle
          className="long-press-ring-progress"
          cx="50"
          cy="50"
          r={radius}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: isActive ? undefined : strokeDashoffset,
            animationPlayState: isActive ? 'running' : 'paused',
          }}
        />
      </svg>
    </div>
  );
};

export interface Position {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

export interface HoverReactionTriggerProps {
  /** Message ID for reaction tracking */
  messageId: string;
  /** Whether this is the current user's message */
  isMe?: boolean;
  /** Children to wrap (message content) */
  children: React.ReactNode;
  /** Render function for the quick reaction bar */
  renderReactionBar: (props: {
    onReact: (emoji: string) => void;
    onShowMore: () => void;
    position: Position;
    /** Whether the reaction bar is currently exiting (for animation) */
    isExiting?: boolean;
  }) => React.ReactNode;
  /** Callback when a reaction is selected */
  onReact: (messageId: string, emoji: string) => void;
  /** Callback to show full emoji picker */
  onShowMore?: () => void;
  /** Additional CSS classes for the wrapper */
  className?: string;
  /** Disable hover reactions (useful for mobile-only or specific conditions) */
  disabled?: boolean;
  /** Custom hover delay in milliseconds (default: 300ms) */
  hoverDelay?: number;
  /** Enable mobile long-press (default: true) */
  enableMobileLongPress?: boolean;
}

/**
 * Wrapper component that adds hover-triggered reaction functionality to messages.
 * Displays a quick reaction bar when the user hovers over a message for 300ms,
 * with smart positioning to avoid overlapping message content.
 *
 * Features:
 * - 300ms hover delay to prevent accidental triggers
 * - Smart positioning (above/below message based on viewport space)
 * - Mobile long-press support (500ms)
 * - Haptic feedback on mobile
 * - Cancels on scroll or rapid hover/unhover
 * - Keyboard accessible
 *
 * @example
 * ```tsx
 * <HoverReactionTrigger
 *   messageId={message.id}
 *   isMe={message.sender === currentUser}
 *   onReact={handleReaction}
 *   renderReactionBar={({ onReact, onShowMore, position }) => (
 *     <QuickReactionBar onReact={onReact} onShowMore={onShowMore} style={position} />
 *   )}
 * >
 *   <MessageContent>{message.content}</MessageContent>
 * </HoverReactionTrigger>
 * ```
 */
export const HoverReactionTrigger: React.FC<HoverReactionTriggerProps> = ({
  messageId,
  isMe = false,
  children,
  renderReactionBar,
  onReact,
  onShowMore,
  className = '',
  disabled = false,
  hoverDelay = 300,
  enableMobileLongPress = true,
}) => {
  const [position, setPosition] = useState<Position>({});
  const [showReactionBar, setShowReactionBar] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [longPressProgress, setLongPressProgress] = useState(0);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [longPressCancelled, setLongPressCancelled] = useState(false);
  const [isPendingHover, setIsPendingHover] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const longPressStartTime = useRef<number>(0);
  const longPressAnimationRef = useRef<number | null>(null);

  // Calculate optimal position for reaction bar
  const calculatePosition = useCallback(() => {
    if (!containerRef.current) return {};

    const rect = containerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const reactionBarHeight = 48; // Approximate height of reaction bar
    const gap = 8; // Gap between message and reaction bar

    const newPosition: Position = {};

    // Determine vertical position (above or below message)
    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;

    if (spaceBelow >= reactionBarHeight + gap) {
      // Show below message
      newPosition.top = rect.height + gap;
    } else if (spaceAbove >= reactionBarHeight + gap) {
      // Show above message
      newPosition.bottom = rect.height + gap;
    } else {
      // Default to below if neither has enough space
      newPosition.top = rect.height + gap;
    }

    // Determine horizontal position (align left or right based on message sender)
    if (isMe) {
      // Align to right edge for own messages
      newPosition.right = 0;
    } else {
      // Align to left edge for other messages
      newPosition.left = 0;
    }

    return newPosition;
  }, [isMe]);

  // Handle hover state changes with visual feedback
  const handleHoverPending = useCallback(() => {
    if (disabled) return;
    setIsPendingHover(true);
  }, [disabled]);

  const handleHoverStart = useCallback(() => {
    if (disabled) return;

    const pos = calculatePosition();
    setPosition(pos);
    setIsPendingHover(false);
    setIsExiting(false);
    setShowReactionBar(true);
  }, [disabled, calculatePosition]);

  const handleHoverEnd = useCallback(() => {
    setIsPendingHover(false);
    // Trigger exit animation
    setIsExiting(true);
    // Wait for exit animation to complete before hiding
    setTimeout(() => {
      setShowReactionBar(false);
      setIsExiting(false);
    }, 150);
  }, []);

  // Long-press progress animation for mobile
  const startLongPressAnimation = useCallback(() => {
    setIsLongPressing(true);
    setLongPressCancelled(false);
    longPressStartTime.current = Date.now();

    const animate = () => {
      const elapsed = Date.now() - longPressStartTime.current;
      const progress = Math.min(elapsed / 500, 1); // 500ms long-press delay
      setLongPressProgress(progress);

      if (progress < 1) {
        longPressAnimationRef.current = requestAnimationFrame(animate);
      }
    };

    longPressAnimationRef.current = requestAnimationFrame(animate);
  }, []);

  const cancelLongPressAnimation = useCallback(() => {
    if (longPressAnimationRef.current) {
      cancelAnimationFrame(longPressAnimationRef.current);
      longPressAnimationRef.current = null;
    }

    if (isLongPressing && longPressProgress < 1) {
      setLongPressCancelled(true);
      // Reset after cancel animation
      setTimeout(() => {
        setLongPressCancelled(false);
        setLongPressProgress(0);
      }, 200);
    }

    setIsLongPressing(false);
  }, [isLongPressing, longPressProgress]);

  const completeLongPressAnimation = useCallback(() => {
    if (longPressAnimationRef.current) {
      cancelAnimationFrame(longPressAnimationRef.current);
      longPressAnimationRef.current = null;
    }
    setLongPressProgress(1);
    setIsLongPressing(false);

    // Reset after a brief delay
    setTimeout(() => {
      setLongPressProgress(0);
    }, 300);
  }, []);

  // Use the hover hook with extended callbacks
  const { isHovering, hoverRef, isLongPressed } = useHoverWithDelay({
    hoverDelay,
    unhoverDelay: 100,
    onHoverStart: handleHoverStart,
    onHoverEnd: handleHoverEnd,
    enableLongPress: enableMobileLongPress,
    longPressDelay: 500,
    enableHaptic: true,
  });

  // Track mouse enter for pending hover state
  useEffect(() => {
    const element = containerRef.current;
    if (!element || disabled) return;

    const handleMouseEnter = () => {
      handleHoverPending();
    };

    const handleMouseLeave = () => {
      setIsPendingHover(false);
    };

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [disabled, handleHoverPending]);

  // Track touch events for long-press visual feedback
  useEffect(() => {
    const element = containerRef.current;
    if (!element || disabled || !enableMobileLongPress) return;

    const handleTouchStart = () => {
      startLongPressAnimation();
    };

    const handleTouchEnd = () => {
      if (longPressProgress >= 1) {
        completeLongPressAnimation();
      } else {
        cancelLongPressAnimation();
      }
    };

    const handleTouchMove = () => {
      cancelLongPressAnimation();
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd);
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchcancel', handleTouchEnd);

      if (longPressAnimationRef.current) {
        cancelAnimationFrame(longPressAnimationRef.current);
      }
    };
  }, [
    disabled,
    enableMobileLongPress,
    longPressProgress,
    startLongPressAnimation,
    cancelLongPressAnimation,
    completeLongPressAnimation,
  ]);

  // Determine hover visual state class
  const hoverStateClass = useMemo(() => {
    if (showReactionBar || isLongPressed) {
      return 'message-hover-active';
    }
    if (isPendingHover) {
      return 'message-hover-pending';
    }
    return '';
  }, [showReactionBar, isLongPressed, isPendingHover]);

  // Sync refs (containerRef for positioning, hoverRef for hover detection)
  useEffect(() => {
    if (containerRef.current) {
      (hoverRef as React.MutableRefObject<HTMLElement>).current = containerRef.current;
    }
  }, [hoverRef]);

  // Recalculate position on window resize
  useEffect(() => {
    if (!showReactionBar) return;

    const handleResize = () => {
      const pos = calculatePosition();
      setPosition(pos);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [showReactionBar, calculatePosition]);

  // Handle reaction selection
  const handleReact = useCallback(
    (emoji: string) => {
      onReact(messageId, emoji);
      setShowReactionBar(false); // Hide bar after selection
    },
    [messageId, onReact]
  );

  // Handle show more (emoji picker)
  const handleShowMore = useCallback(() => {
    onShowMore?.();
    setShowReactionBar(false); // Hide quick bar when showing full picker
  }, [onShowMore]);

  // Handle keyboard accessibility (Enter or Space to show reactions)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;

      // Show reactions on Enter or Space
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!showReactionBar) {
          handleHoverStart();
        } else {
          handleHoverEnd();
        }
      }

      // Hide on Escape
      if (e.key === 'Escape' && showReactionBar) {
        e.preventDefault();
        handleHoverEnd();
      }
    },
    [disabled, showReactionBar, handleHoverStart, handleHoverEnd]
  );

  return (
    <div
      ref={containerRef}
      className={`relative message-hover-container ${hoverStateClass} ${className}`}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
      role="group"
      aria-label="Message with hover reactions"
      aria-description="Hover or long-press to show quick reactions"
    >
      {/* Message Content */}
      <div className="message-content-bubble">
        {children}
      </div>

      {/* Reaction Bar Overlay */}
      {(showReactionBar || isHovering || isLongPressed) && (
        <div
          className="absolute z-50 pointer-events-auto"
          style={position}
          role="toolbar"
          aria-label="Quick reactions"
        >
          {renderReactionBar({
            onReact: handleReact,
            onShowMore: handleShowMore,
            position,
            isExiting,
          })}
        </div>
      )}

      {/* Enhanced visual indicator for long-press (mobile) */}
      {(isLongPressing || longPressProgress > 0) && (
        <LongPressIndicator
          progress={longPressProgress}
          isActive={isLongPressing}
          isCancelled={longPressCancelled}
        />
      )}

      {/* Haptic visual feedback flash */}
      {isLongPressed && (
        <div
          className="absolute inset-0 pointer-events-none rounded-lg haptic-visual-feedback long-press-complete"
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default HoverReactionTrigger;
