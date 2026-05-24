import React, { useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { useFocusTrap } from '../../hooks/useFocusTrap';

import { X } from 'lucide-react';

export interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  side?: 'left' | 'right';
  width?: string;
  backdrop?: boolean;
  closeOnBackdropClick?: boolean;
  swipeToClose?: boolean;
  swipeThreshold?: number;
}

/**
 * MobileDrawer - Swipeable drawer component for mobile navigation
 *
 * Features:
 * - Swipe from edge to open (via parent component)
 * - Swipe to close
 * - Backdrop with click-to-close
 * - Smooth animations
 * - Touch-optimized
 * - Accessibility support
 *
 * Usage:
 * ```tsx
 * <MobileDrawer
 *   isOpen={isDrawerOpen}
 *   onClose={() => setIsDrawerOpen(false)}
 *   side="left"
 *   width="80%"
 * >
 *   <ChannelList />
 * </MobileDrawer>
 * ```
 */
export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  children,
  side = 'left',
  width = '80%',
  backdrop = true,
  closeOnBackdropClick = true,
  swipeToClose = true,
  swipeThreshold = 100,
}) => {
  // Focus trap + Escape handling + focus restoration
  const drawerRef = useFocusTrap<HTMLDivElement>({ active: isOpen, onEscape: onClose });

  // Prevent body scroll when drawer is open
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

  // Handle swipe to close
  const handleDragEnd = useCallback(
    (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (!swipeToClose) return;

      const swipeDistance = side === 'left' ? info.offset.x : -info.offset.x;
      const swipeVelocity = side === 'left' ? info.velocity.x : -info.velocity.x;

      // Close if swiped past threshold or fast swipe in close direction
      if (swipeDistance < -swipeThreshold || swipeVelocity < -500) {
        onClose();
      }
    },
    [swipeToClose, swipeThreshold, side, onClose]
  );

  // Backdrop animation variants
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  // Drawer animation variants
  const drawerVariants = {
    hidden: {
      x: side === 'left' ? '-100%' : '100%',
    },
    visible: {
      x: 0,
    },
  };

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          {/* Backdrop */}
          {backdrop && (
            <motion.div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              transition={{ duration: 0.2 }}
              onClick={closeOnBackdropClick ? onClose : undefined}
              aria-hidden="true"
            />
          )}

          {/* Drawer */}
          <motion.div
            ref={drawerRef}
            className={`fixed top-0 bottom-0 ${side === 'left' ? 'left-0' : 'right-0'} z-50 bg-white dark:bg-[rgba(255,255,255,0.03)] shadow-2xl overflow-hidden flex flex-col`}
            style={{
              width,
              maxWidth: '400px',
            }}
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            drag={swipeToClose ? 'x' : false}
            dragConstraints={
              side === 'left'
                ? { left: -400, right: 0 }
                : { left: 0, right: 400 }
            }
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation drawer"
          >
            {/* Drawer content */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {children}
            </div>

            {/* Swipe indicator (visual hint) */}
            <div
              className={`absolute top-1/2 -translate-y-1/2 ${side === 'left' ? 'right-2' : 'left-2'} w-1 h-12 bg-zinc-300 dark:bg-zinc-700 rounded-full opacity-30`}
              aria-hidden="true"
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

/**
 * Hook to detect swipe from edge to open drawer
 *
 * Usage:
 * ```tsx
 * const { isDrawerOpen, setIsDrawerOpen } = useSwipeFromEdge({
 *   side: 'left',
 *   threshold: 50,
 * });
 *
 * return (
 *   <MobileDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)}>
 *     ...
 *   </MobileDrawer>
 * );
 * ```
 */
export function useSwipeFromEdge({
  side = 'left',
  edgeThreshold = 20,
  swipeThreshold = 100,
  enabled = true,
}: {
  side?: 'left' | 'right';
  edgeThreshold?: number;
  swipeThreshold?: number;
  enabled?: boolean;
} = {}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      const isNearEdge =
        side === 'left'
          ? touch.clientX < edgeThreshold
          : touch.clientX > window.innerWidth - edgeThreshold;

      if (isNearEdge) {
        touchStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          time: Date.now(),
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartRef.current) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;

      // Check if swipe is more horizontal than vertical
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        const isOpenSwipe =
          side === 'left' ? deltaX > swipeThreshold : deltaX < -swipeThreshold;

        if (isOpenSwipe) {
          setIsOpen(true);
          touchStartRef.current = null;

          // Prevent default to avoid scrolling during swipe
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = () => {
      touchStartRef.current = null;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, side, edgeThreshold, swipeThreshold]);

  return {
    isDrawerOpen: isOpen,
    setIsDrawerOpen: setIsOpen,
    openDrawer: () => setIsOpen(true),
    closeDrawer: () => setIsOpen(false),
    toggleDrawer: () => setIsOpen((prev) => !prev),
  };
}

/**
 * MobileDrawerHeader - Standard header for drawer content
 *
 * Usage:
 * ```tsx
 * <MobileDrawer isOpen={isOpen} onClose={onClose}>
 *   <MobileDrawerHeader title="Messages" onClose={onClose} />
 *   <div className="flex-1 overflow-y-auto">
 *     ...content...
 *   </div>
 * </MobileDrawer>
 * ```
 */
export const MobileDrawerHeader: React.FC<{
  title: string;
  onClose: () => void;
  showCloseButton?: boolean;
}> = ({ title, onClose, showCloseButton = true }) => {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)] bg-white dark:bg-[rgba(255,255,255,0.03)] flex-shrink-0">
      <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{title}</h2>
      {showCloseButton && (
        <button
          onClick={onClose}
          className="w-12 h-12 flex items-center justify-center text-zinc-500 hover:bg-[var(--pulse-surface-raised)] rounded-lg transition"
          aria-label="Close drawer"
        >
          <X className="text-lg" />
        </button>
      )}
    </div>
  );
};
