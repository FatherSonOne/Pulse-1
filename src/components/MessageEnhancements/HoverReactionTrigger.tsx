import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useHoverWithDelay } from '../../hooks/useHoverWithDelay';

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
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Handle hover state changes
  const handleHoverStart = useCallback(() => {
    if (disabled) return;

    const pos = calculatePosition();
    setPosition(pos);
    setShowReactionBar(true);
  }, [disabled, calculatePosition]);

  const handleHoverEnd = useCallback(() => {
    setShowReactionBar(false);
  }, []);

  // Use the hover hook
  const { isHovering, hoverRef, isLongPressed } = useHoverWithDelay({
    hoverDelay,
    unhoverDelay: 100,
    onHoverStart: handleHoverStart,
    onHoverEnd: handleHoverEnd,
    enableLongPress: enableMobileLongPress,
    longPressDelay: 500,
    enableHaptic: true,
  });

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
      className={`relative ${className}`}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
      role="group"
      aria-label="Message with hover reactions"
      aria-description="Hover or long-press to show quick reactions"
    >
      {/* Message Content */}
      {children}

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
          })}
        </div>
      )}

      {/* Visual indicator for long-press (mobile) */}
      {isLongPressed && (
        <div className="absolute inset-0 pointer-events-none rounded-lg ring-2 ring-blue-400 ring-opacity-50 animate-pulse" />
      )}
    </div>
  );
};

export default HoverReactionTrigger;
