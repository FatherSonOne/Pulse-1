// src/components/MessageContextMenu/useLongPress.ts
// Mobile long-press detection at 350ms (iOS-aligned). Cancels on:
//   - Movement >10px in any direction (scrolls / swipes)
//   - Pointer up before threshold
//   - Pointer cancel / leave
//
// On fire, invokes `onLongPress(x, y, target)` where x/y are the
// viewport-relative coordinates of the initiating pointer.

import { useCallback, useRef } from 'react';

const DEFAULT_THRESHOLD = 350;
const MOVE_TOLERANCE = 10; // px

export interface UseLongPressHandlers<T extends HTMLElement = HTMLElement> {
  onPointerDown: (e: React.PointerEvent<T>) => void;
  onPointerMove: (e: React.PointerEvent<T>) => void;
  onPointerUp: (e: React.PointerEvent<T>) => void;
  onPointerCancel: (e: React.PointerEvent<T>) => void;
  onPointerLeave: (e: React.PointerEvent<T>) => void;
  onContextMenu: (e: React.MouseEvent<T>) => void;
}

export interface UseLongPressOptions {
  /** Threshold in ms. Defaults to 350. */
  thresholdMs?: number;
  /** Disable detection entirely. */
  disabled?: boolean;
  /**
   * Skip when the active pointer type is "mouse" — desktop uses
   * right-click instead. Defaults to true.
   */
  skipMouse?: boolean;
}

export function useLongPress<T extends HTMLElement = HTMLElement>(
  onLongPress: (x: number, y: number, target: T) => void,
  options: UseLongPressOptions = {},
): UseLongPressHandlers<T> {
  const {
    thresholdMs = DEFAULT_THRESHOLD,
    disabled = false,
    skipMouse = true,
  } = options;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef<boolean>(false);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<T>) => {
      if (disabled) return;
      if (skipMouse && e.pointerType === 'mouse') return;
      // Two-finger or non-primary press is ignored.
      if (!e.isPrimary) return;
      firedRef.current = false;
      startRef.current = { x: e.clientX, y: e.clientY };
      const x = e.clientX;
      const y = e.clientY;
      const target = e.currentTarget;
      cancel();
      timerRef.current = setTimeout(() => {
        firedRef.current = true;
        onLongPress(x, y, target);
      }, thresholdMs);
    },
    [disabled, skipMouse, cancel, onLongPress, thresholdMs],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<T>) => {
      if (!startRef.current) return;
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      if (Math.hypot(dx, dy) > MOVE_TOLERANCE) cancel();
    },
    [cancel],
  );

  const handlePointerUp = useCallback(() => {
    cancel();
  }, [cancel]);

  const handlePointerCancel = useCallback(() => {
    cancel();
  }, [cancel]);

  const handlePointerLeave = useCallback(() => {
    cancel();
  }, [cancel]);

  // Suppress the OS context-menu only after we've fired — otherwise the
  // synthetic touch-and-hold context menu on iOS Safari double-fires.
  const handleContextMenu = useCallback((e: React.MouseEvent<T>) => {
    if (firedRef.current) {
      e.preventDefault();
      firedRef.current = false;
    }
  }, []);

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel,
    onPointerLeave: handlePointerLeave,
    onContextMenu: handleContextMenu,
  };
}

export default useLongPress;
