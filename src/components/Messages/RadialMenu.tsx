/**
 * RadialMenu Component - Circular reaction picker
 * Phase 3: Feature Refinements - Task 2
 *
 * Features:
 * - Radial layout algorithm for circular positioning
 * - Smooth spin-out animations
 * - Hover trigger (desktop) and long-press trigger (mobile)
 * - Customizable reaction options
 * - Touch-friendly 44px buttons
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface RadialMenuItem {
  id: string;
  emoji: string;
  label: string;
  onClick: () => void;
}

interface RadialMenuProps {
  items: RadialMenuItem[];
  isOpen: boolean;
  onClose: () => void;
  centerX?: number;
  centerY?: number;
  radius?: number;
}

export const RadialMenu: React.FC<RadialMenuProps> = ({
  items,
  isOpen,
  onClose,
  centerX = 0,
  centerY = 0,
  radius = 90 // Distance from center to items
}) => {
  const angleStep = (2 * Math.PI) / items.length;

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent clicks inside menu from closing it
  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop - clicking anywhere closes menu */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9998,
              background: 'transparent'
            }}
          />

          {/* Radial Menu Container */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{
              duration: 0.25,
              ease: [0.34, 1.56, 0.64, 1] // Spring-like easing
            }}
            onClick={handleMenuClick}
            style={{
              position: 'fixed',
              left: centerX,
              top: centerY,
              transform: 'translate(-50%, -50%)',
              zIndex: 9999,
              pointerEvents: 'all'
            }}
          >
            {/* Center close button */}
            <motion.button
              className="radial-menu-center"
              onClick={onClose}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label="Close menu"
              style={{
                position: 'absolute',
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #f43f5e 0%, #ec4899 100%)',
                border: '3px solid rgba(255, 255, 255, 0.9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(244, 63, 94, 0.4), 0 0 0 4px rgba(244, 63, 94, 0.1)',
                color: 'white',
                fontSize: '20px',
                fontWeight: 'bold',
                transform: 'translate(-50%, -50%)',
                left: '50%',
                top: '50%',
                zIndex: 2,
                transition: 'all 0.2s'
              }}
            >
              ✕
            </motion.button>

            {/* Radial items */}
            {items.map((item, index) => {
              // Calculate position on circle
              const angle = angleStep * index - Math.PI / 2; // Start at top
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;

              return (
                <motion.button
                  key={item.id}
                  className="radial-menu-item"
                  initial={{
                    scale: 0,
                    x: 0,
                    y: 0,
                    opacity: 0
                  }}
                  animate={{
                    scale: 1,
                    x,
                    y,
                    opacity: 1
                  }}
                  exit={{
                    scale: 0,
                    x: 0,
                    y: 0,
                    opacity: 0
                  }}
                  transition={{
                    delay: index * 0.04, // Staggered animation
                    duration: 0.3,
                    ease: [0.34, 1.56, 0.64, 1]
                  }}
                  whileHover={{
                    scale: 1.25,
                    rotate: 5,
                    transition: { duration: 0.15 }
                  }}
                  whileTap={{
                    scale: 0.9,
                    rotate: -5
                  }}
                  onClick={() => {
                    item.onClick();
                    onClose();
                  }}
                  title={item.label}
                  aria-label={item.label}
                  style={{
                    position: 'absolute',
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.95)',
                    border: '2px solid rgba(244, 63, 94, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '22px',
                    boxShadow: '0 3px 12px rgba(0, 0, 0, 0.15)',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 1
                  }}
                >
                  {item.emoji}
                </motion.button>
              );
            })}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

/**
 * Hook for radial menu state management
 * Handles open/close state and position tracking
 */
export function useRadialMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const open = useCallback((x: number, y: number) => {
    setPosition({ x, y });
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Close on click outside (handled by backdrop)
  useEffect(() => {
    if (!isOpen) return;

    // Additional safety: close on window blur
    const handleBlur = () => close();
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('blur', handleBlur);
    };
  }, [isOpen, close]);

  return {
    isOpen,
    position,
    open,
    close
  };
}

/**
 * Hook for long-press detection (mobile support)
 * Returns true if user has held down for specified duration
 */
export function useLongPress(
  onLongPress: (x: number, y: number) => void,
  duration = 500
) {
  const [pressing, setPressing] = useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout>();
  const positionRef = React.useRef({ x: 0, y: 0 });

  const handleStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    setPressing(true);

    // Get position from touch or mouse event
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
    positionRef.current = { x, y };

    timeoutRef.current = setTimeout(() => {
      onLongPress(x, y);
      setPressing(false);
    }, duration);
  }, [onLongPress, duration]);

  const handleEnd = useCallback(() => {
    setPressing(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    pressing,
    onMouseDown: handleStart,
    onMouseUp: handleEnd,
    onMouseLeave: handleEnd,
    onTouchStart: handleStart,
    onTouchEnd: handleEnd,
    onTouchCancel: handleEnd
  };
}

export default RadialMenu;
