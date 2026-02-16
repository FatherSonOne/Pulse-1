/**
 * ContextMenu Component - Right-click and long-press context menu
 * Phase 3: Feature Refinements - Task 3
 *
 * Features:
 * - Right-click detection (desktop)
 * - Long-press detection (mobile)
 * - Smart positioning (avoids viewport overflow)
 * - Keyboard navigation (arrow keys, Enter, Escape)
 * - Action items with icons
 * - Touch-friendly 48px targets
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean; // Red styling for delete actions
  divider?: boolean; // Show divider after this item
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  isOpen: boolean;
  onClose: () => void;
  x?: number;
  y?: number;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  items,
  isOpen,
  onClose,
  x = 0,
  y = 0
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Calculate smart position to avoid viewport overflow
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const menu = menuRef.current;
    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = x;
    let adjustedY = y;

    // Adjust X if menu overflows right edge
    if (x + menuRect.width > viewportWidth - 16) {
      adjustedX = viewportWidth - menuRect.width - 16;
    }

    // Adjust X if menu overflows left edge
    if (adjustedX < 16) {
      adjustedX = 16;
    }

    // Adjust Y if menu overflows bottom edge
    if (y + menuRect.height > viewportHeight - 16) {
      adjustedY = viewportHeight - menuRect.height - 16;
    }

    // Adjust Y if menu overflows top edge
    if (adjustedY < 16) {
      adjustedY = 16;
    }

    setPosition({ x: adjustedX, y: adjustedY });
  }, [isOpen, x, y]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const enabledItems = items.filter(item => !item.disabled);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => {
            const nextIndex = prev + 1;
            return nextIndex >= enabledItems.length ? 0 : nextIndex;
          });
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => {
            const prevIndex = prev - 1;
            return prevIndex < 0 ? enabledItems.length - 1 : prevIndex;
          });
          break;

        case 'Enter':
          e.preventDefault();
          const selectedItem = enabledItems[selectedIndex];
          if (selectedItem && !selectedItem.disabled) {
            selectedItem.onClick();
            onClose();
          }
          break;

        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, items, selectedIndex, onClose]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Delay to prevent immediate close from trigger click
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);

    return () => document.removeEventListener('click', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="context-menu"
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          zIndex: 10000,
          minWidth: '220px',
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          padding: '8px',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((item, index) => {
          const isSelected = index === selectedIndex;

          return (
            <React.Fragment key={item.id}>
              <button
                className={`context-menu-item ${isSelected ? 'selected' : ''} ${item.destructive ? 'destructive' : ''}`}
                onClick={() => {
                  if (!item.disabled) {
                    item.onClick();
                    onClose();
                  }
                }}
                onMouseEnter={() => setSelectedIndex(index)}
                disabled={item.disabled}
                aria-label={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  minHeight: '48px', // WCAG AAA touch target
                  padding: '12px 14px',
                  background: isSelected ? 'rgba(244, 63, 94, 0.08)' : 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: item.destructive ? '#dc2626' : '#18181B',
                  opacity: item.disabled ? 0.4 : 1,
                  textAlign: 'left'
                }}
              >
                {/* Icon */}
                <i
                  className={`fa-solid ${item.icon}`}
                  style={{
                    fontSize: '16px',
                    width: '20px',
                    textAlign: 'center',
                    color: item.destructive ? '#dc2626' : '#f43f5e'
                  }}
                />

                {/* Label */}
                <span style={{ flex: 1 }}>{item.label}</span>
              </button>

              {/* Divider */}
              {item.divider && (
                <div
                  style={{
                    height: '1px',
                    background: 'rgba(0, 0, 0, 0.1)',
                    margin: '4px 8px'
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * Hook for context menu state management
 */
export function useContextMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const open = useCallback((x: number, y: number) => {
    setPosition({ x, y });
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    position,
    open,
    close
  };
}

/**
 * Hook for right-click detection
 * Prevents default context menu and opens custom menu
 */
export function useRightClick(onRightClick: (x: number, y: number) => void) {
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onRightClick(e.clientX, e.clientY);
  }, [onRightClick]);

  return { onContextMenu: handleContextMenu };
}

/**
 * Hook for long-press detection (mobile)
 * Triggers after holding for specified duration
 */
export function useLongPressMenu(
  onLongPress: (x: number, y: number) => void,
  duration = 500
) {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const positionRef = useRef({ x: 0, y: 0 });
  const [pressing, setPressing] = useState(false);

  const handleStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    setPressing(true);

    // Get position
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
    positionRef.current = { x, y };

    // Start timer
    timeoutRef.current = setTimeout(() => {
      // Trigger haptic feedback on mobile
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
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

  const handleMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    // Cancel if user moves more than 10px
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const y = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const deltaX = Math.abs(x - positionRef.current.x);
    const deltaY = Math.abs(y - positionRef.current.y);

    if (deltaX > 10 || deltaY > 10) {
      handleEnd();
    }
  }, [handleEnd]);

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
    onMouseMove: handleMove,
    onMouseLeave: handleEnd,
    onTouchStart: handleStart,
    onTouchEnd: handleEnd,
    onTouchMove: handleMove,
    onTouchCancel: handleEnd
  };
}

export default ContextMenu;
