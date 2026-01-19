/**
 * Mobile-Optimized React Components
 * Touch-friendly UI components for mobile experience
 */

import React, { useRef, useState, useCallback, useEffect, ReactNode } from 'react';
import {
  useSwipe,
  useLongPress,
  usePullToRefresh,
  useOrientation,
  hapticFeedback,
  isTouchDevice,
} from '../../utils/mobile';
import { isOnline, onOnlineStatusChange, getPendingActionsCount } from '../../utils/offlineManager';

// ============================================
// OFFLINE INDICATOR
// ============================================

interface OfflineIndicatorProps {
  className?: string;
}

export function OfflineIndicator({ className = '' }: OfflineIndicatorProps) {
  const [online, setOnline] = useState(isOnline());
  const [pendingCount, setPendingCount] = useState(getPendingActionsCount());
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const unsubscribe = onOnlineStatusChange((isOnline) => {
      setOnline(isOnline);
      setShowBanner(!isOnline);

      if (isOnline) {
        // Hide banner after 3 seconds when back online
        setTimeout(() => setShowBanner(false), 3000);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPendingCount(getPendingActionsCount());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  if (online && !showBanner && pendingCount === 0) {
    return null;
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${
        showBanner || !online ? 'translate-y-0' : '-translate-y-full'
      } ${className}`}
    >
      <div
        className={`px-4 py-2 text-center text-sm font-medium ${
          online
            ? 'bg-green-600 text-white'
            : 'bg-yellow-600 text-white'
        }`}
      >
        {online ? (
          pendingCount > 0 ? (
            <>
              <i className="fa fa-sync fa-spin mr-2" />
              Syncing {pendingCount} pending action{pendingCount > 1 ? 's' : ''}...
            </>
          ) : (
            <>
              <i className="fa fa-check mr-2" />
              Back online
            </>
          )
        ) : (
          <>
            <i className="fa fa-wifi mr-2" style={{ opacity: 0.5 }} />
            You're offline. Changes will sync when reconnected.
          </>
        )}
      </div>
    </div>
  );
}

// ============================================
// PULL TO REFRESH
// ============================================

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
  className?: string;
  disabled?: boolean;
  threshold?: number;
}

export function PullToRefresh({
  children,
  onRefresh,
  className = '',
  disabled = false,
  threshold = 80,
}: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isPulling, pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh,
    threshold,
    disabled,
  });

  const progress = Math.min(pullDistance / threshold, 1);
  const rotation = progress * 180;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 flex items-center justify-center pointer-events-none transition-opacity"
        style={{
          top: -50,
          height: 50,
          transform: `translateY(${Math.min(pullDistance, threshold)}px)`,
          opacity: isPulling || isRefreshing ? 1 : 0,
        }}
      >
        <div
          className={`w-8 h-8 flex items-center justify-center rounded-full bg-gray-700 ${
            isRefreshing ? 'animate-spin' : ''
          }`}
          style={{
            transform: isRefreshing ? undefined : `rotate(${rotation}deg)`,
          }}
        >
          <i className="fa fa-arrow-down text-white text-sm" />
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          transform: isPulling ? `translateY(${Math.min(pullDistance * 0.5, threshold * 0.5)}px)` : undefined,
          transition: isPulling ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ============================================
// SWIPEABLE CARD
// ============================================

interface SwipeableCardProps {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  className?: string;
  threshold?: number;
}

export function SwipeableCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction,
  rightAction,
  className = '',
  threshold = 100,
}: SwipeableCardProps) {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { handlers } = useSwipe({
    onSwipeLeft: () => {
      if (onSwipeLeft && offset < -threshold) {
        hapticFeedback('medium');
        onSwipeLeft();
      }
      setOffset(0);
      setIsDragging(false);
    },
    onSwipeRight: () => {
      if (onSwipeRight && offset > threshold) {
        hapticFeedback('medium');
        onSwipeRight();
      }
      setOffset(0);
      setIsDragging(false);
    },
    threshold: threshold / 2,
  });

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!containerRef.current) return;

    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const diff = touch.clientX - startX;

    // Limit the swipe distance
    const maxOffset = threshold * 1.5;
    const limitedOffset = Math.max(-maxOffset, Math.min(maxOffset, diff));

    setOffset(limitedOffset);
    setIsDragging(true);
  }, [threshold]);

  const handleTouchEnd = useCallback(() => {
    if (Math.abs(offset) < threshold) {
      setOffset(0);
    }
    setIsDragging(false);
  }, [offset, threshold]);

  const showLeftAction = offset > threshold / 2 && leftAction;
  const showRightAction = offset < -threshold / 2 && rightAction;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      {...handlers}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Left action background */}
      {leftAction && (
        <div
          className="absolute inset-y-0 left-0 flex items-center justify-start px-4 bg-green-600"
          style={{
            width: Math.max(0, offset),
            opacity: showLeftAction ? 1 : 0.5,
          }}
        >
          {leftAction}
        </div>
      )}

      {/* Right action background */}
      {rightAction && (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end px-4 bg-red-600"
          style={{
            width: Math.max(0, -offset),
            opacity: showRightAction ? 1 : 0.5,
          }}
        >
          {rightAction}
        </div>
      )}

      {/* Card content */}
      <div
        className="relative bg-gray-800"
        style={{
          transform: `translateX(${offset}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ============================================
// LONG PRESS MENU
// ============================================

interface MenuItem {
  label: string;
  icon?: string;
  onClick: () => void;
  danger?: boolean;
}

interface LongPressMenuProps {
  children: ReactNode;
  items: MenuItem[];
  className?: string;
  disabled?: boolean;
}

export function LongPressMenu({
  children,
  items,
  className = '',
  disabled = false,
}: LongPressMenuProps) {
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { handlers, isPressed } = useLongPress({
    onLongPress: (event) => {
      if (disabled) return;

      hapticFeedback('medium');

      // Calculate menu position
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const x = Math.min(event.clientX, window.innerWidth - 200);
        const y = Math.min(event.clientY, window.innerHeight - items.length * 44 - 20);
        setMenuPosition({ x, y });
      }
    },
    delay: 500,
    disabled,
  });

  const closeMenu = useCallback(() => {
    setMenuPosition(null);
  }, []);

  useEffect(() => {
    if (menuPosition) {
      const handleClickOutside = () => closeMenu();
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      };
    }
  }, [menuPosition, closeMenu]);

  return (
    <>
      <div
        ref={containerRef}
        className={`${className} ${isPressed ? 'opacity-75 scale-95' : ''} transition-all duration-150`}
        {...handlers}
      >
        {children}
      </div>

      {/* Context menu */}
      {menuPosition && (
        <div
          className="fixed z-50 bg-gray-800 rounded-lg shadow-xl border border-gray-700 overflow-hidden"
          style={{
            left: menuPosition.x,
            top: menuPosition.y,
            minWidth: 180,
            animation: 'fadeIn 0.15s ease-out',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item, index) => (
            <button
              key={index}
              className={`w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-700 transition-colors ${
                item.danger ? 'text-red-400 hover:text-red-300' : 'text-gray-200'
              }`}
              onClick={() => {
                hapticFeedback('light');
                item.onClick();
                closeMenu();
              }}
            >
              {item.icon && <i className={`fa ${item.icon} w-4`} />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ============================================
// BOTTOM SHEET
// ============================================

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  className?: string;
}

export function BottomSheet({
  isOpen,
  onClose,
  children,
  title,
  className = '',
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const { handlers } = useSwipe({
    onSwipeDown: () => {
      if (dragOffset > 100) {
        onClose();
      }
      setDragOffset(0);
      setIsDragging(false);
    },
    threshold: 50,
  });

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const rect = sheetRef.current?.getBoundingClientRect();
    if (rect) {
      const diff = touch.clientY - rect.top;
      if (diff > 0) {
        setDragOffset(diff);
        setIsDragging(true);
      }
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        style={{
          opacity: Math.max(0, 1 - dragOffset / 300),
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`absolute bottom-0 left-0 right-0 bg-gray-800 rounded-t-2xl max-h-[85vh] overflow-hidden ${className}`}
        style={{
          transform: `translateY(${dragOffset}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
        }}
        {...handlers}
        onTouchMove={handleTouchMove}
      >
        {/* Handle */}
        <div className="flex justify-center py-3">
          <div className="w-10 h-1 bg-gray-600 rounded-full" />
        </div>

        {/* Title */}
        {title && (
          <div className="px-4 pb-3 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 60px)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ============================================
// ORIENTATION AWARE CONTAINER
// ============================================

interface OrientationAwareProps {
  children: (orientation: 'portrait' | 'landscape') => ReactNode;
  className?: string;
}

export function OrientationAware({ children, className = '' }: OrientationAwareProps) {
  const orientation = useOrientation();

  return <div className={className}>{children(orientation)}</div>;
}

// ============================================
// TOUCH RIPPLE EFFECT
// ============================================

interface TouchRippleProps {
  children: ReactNode;
  className?: string;
  color?: string;
  disabled?: boolean;
  onClick?: () => void;
}

export function TouchRipple({
  children,
  className = '',
  color = 'rgba(255, 255, 255, 0.3)',
  disabled = false,
  onClick,
}: TouchRippleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);

  const handleClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (disabled || !isTouchDevice()) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const id = Date.now();

    setRipples((prev) => [...prev, { x, y, id }]);

    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 600);

    onClick?.();
  }, [disabled, onClick]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      onClick={handleClick}
      onTouchStart={handleClick}
    >
      {children}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: 10,
            height: 10,
            marginLeft: -5,
            marginTop: -5,
            backgroundColor: color,
            transform: 'scale(0)',
            animation: 'ripple 0.6s ease-out',
          }}
        />
      ))}
      <style>{`
        @keyframes ripple {
          to {
            transform: scale(40);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

export default {
  OfflineIndicator,
  PullToRefresh,
  SwipeableCard,
  LongPressMenu,
  BottomSheet,
  OrientationAware,
  TouchRipple,
};
