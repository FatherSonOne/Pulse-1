/**
 * useResizablePanel - Custom hook for drag-to-resize panel functionality
 *
 * Provides state management and event handlers for resizable split-view panels
 * with support for:
 * - Mouse and touch drag interactions
 * - Min/max width constraints
 * - LocalStorage persistence
 * - Responsive default widths based on viewport
 *
 * @author UI Designer Agent
 * @version 1.0.0
 */

import { useState, useCallback, useRef, useEffect } from 'react';

/* =========================================
   Type Definitions
   ========================================= */

interface ResizablePanelConstraints {
  /** Minimum width in pixels */
  minWidth: number;
  /** Maximum width in pixels */
  maxWidth: number;
  /** Default width in pixels */
  defaultWidth: number;
}

interface UseResizablePanelOptions {
  /** Panel width constraints */
  constraints: ResizablePanelConstraints;
  /** Whether to persist width to localStorage */
  persistKey?: string;
  /** Container width for calculating relative constraints */
  containerWidth?: number;
  /** Minimum width for the adjacent panel */
  siblingMinWidth?: number;
  /** Callback when resize starts */
  onResizeStart?: () => void;
  /** Callback during resize with current width */
  onResize?: (width: number) => void;
  /** Callback when resize ends with final width */
  onResizeEnd?: (width: number) => void;
}

interface UseResizablePanelReturn {
  /** Current panel width in pixels */
  width: number;
  /** Whether the panel is currently being resized */
  isResizing: boolean;
  /** Whether the divider is being hovered */
  isHovered: boolean;
  /** Set the panel width programmatically */
  setWidth: (width: number) => void;
  /** Reset to default width */
  resetWidth: () => void;
  /** Handler for mouse enter on divider */
  handleMouseEnter: () => void;
  /** Handler for mouse leave on divider */
  handleMouseLeave: () => void;
  /** Handler for drag/resize start */
  handleResizeStart: (clientX: number) => void;
  /** Handler for drag/resize move */
  handleResizeMove: (clientX: number) => void;
  /** Handler for drag/resize end */
  handleResizeEnd: () => void;
}

/* =========================================
   Utility Functions
   ========================================= */

/**
 * Clamps a value between min and max bounds
 */
const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

/**
 * Loads a persisted width from localStorage
 */
const loadPersistedWidth = (key: string): number | null => {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch (error) {
    console.warn('Failed to load persisted panel width:', error);
  }

  return null;
};

/**
 * Saves a width to localStorage
 */
const savePersistedWidth = (key: string, width: number): void => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(key, width.toString());
  } catch (error) {
    console.warn('Failed to persist panel width:', error);
  }
};

/* =========================================
   Main Hook
   ========================================= */

export const useResizablePanel = ({
  constraints,
  persistKey,
  containerWidth,
  siblingMinWidth = 400,
  onResizeStart,
  onResize,
  onResizeEnd,
}: UseResizablePanelOptions): UseResizablePanelReturn => {
  // State
  const [width, setWidthState] = useState<number>(() => {
    // Try to load persisted width first
    if (persistKey) {
      const persisted = loadPersistedWidth(persistKey);
      if (persisted !== null) {
        return clamp(persisted, constraints.minWidth, constraints.maxWidth);
      }
    }
    return constraints.defaultWidth;
  });

  const [isResizing, setIsResizing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Refs for tracking resize state
  const resizeStartXRef = useRef<number>(0);
  const resizeStartWidthRef = useRef<number>(0);

  // Calculate effective max width based on container and sibling constraints
  const effectiveMaxWidth = containerWidth
    ? Math.min(constraints.maxWidth, containerWidth - siblingMinWidth)
    : constraints.maxWidth;

  // Load persisted width on mount
  useEffect(() => {
    if (persistKey) {
      const persisted = loadPersistedWidth(persistKey);
      if (persisted !== null) {
        setWidthState(clamp(persisted, constraints.minWidth, effectiveMaxWidth));
      }
    }
  }, [persistKey, constraints.minWidth, effectiveMaxWidth]);

  // Set width with clamping
  const setWidth = useCallback((newWidth: number) => {
    const clampedWidth = clamp(newWidth, constraints.minWidth, effectiveMaxWidth);
    setWidthState(clampedWidth);

    if (persistKey) {
      savePersistedWidth(persistKey, clampedWidth);
    }
  }, [constraints.minWidth, effectiveMaxWidth, persistKey]);

  // Reset to default width
  const resetWidth = useCallback(() => {
    setWidthState(constraints.defaultWidth);

    if (persistKey) {
      savePersistedWidth(persistKey, constraints.defaultWidth);
    }
  }, [constraints.defaultWidth, persistKey]);

  // Hover handlers
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (!isResizing) {
      setIsHovered(false);
    }
  }, [isResizing]);

  // Resize start handler
  const handleResizeStart = useCallback((clientX: number) => {
    setIsResizing(true);
    resizeStartXRef.current = clientX;
    resizeStartWidthRef.current = width;

    // Set cursor and disable text selection globally
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';

    onResizeStart?.();
  }, [width, onResizeStart]);

  // Resize move handler
  const handleResizeMove = useCallback((clientX: number) => {
    if (!isResizing) return;

    const deltaX = clientX - resizeStartXRef.current;
    const newWidth = resizeStartWidthRef.current + deltaX;
    const clampedWidth = clamp(newWidth, constraints.minWidth, effectiveMaxWidth);

    setWidthState(clampedWidth);
    onResize?.(clampedWidth);
  }, [isResizing, constraints.minWidth, effectiveMaxWidth, onResize]);

  // Resize end handler
  const handleResizeEnd = useCallback(() => {
    if (!isResizing) return;

    setIsResizing(false);
    setIsHovered(false);

    // Reset cursor and text selection
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';

    // Persist the final width
    if (persistKey) {
      savePersistedWidth(persistKey, width);
    }

    onResizeEnd?.(width);
  }, [isResizing, persistKey, width, onResizeEnd]);

  // Global mouse/touch event listeners during resize
  useEffect(() => {
    if (!isResizing) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      handleResizeMove(e.clientX);
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (touch) {
        handleResizeMove(touch.clientX);
      }
    };

    const handleGlobalMouseUp = () => {
      handleResizeEnd();
    };

    const handleGlobalTouchEnd = () => {
      handleResizeEnd();
    };

    // Add listeners
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    document.addEventListener('touchend', handleGlobalTouchEnd);

    // Cleanup
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  return {
    width,
    isResizing,
    isHovered,
    setWidth,
    resetWidth,
    handleMouseEnter,
    handleMouseLeave,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd,
  };
};

export default useResizablePanel;
