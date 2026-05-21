// src/components/MessageContextMenu/useMessageContextMenu.ts
// Open/close state machine for the message context-menu (Surface 2).
//
// One menu is open at a time. Parent passes a message id + anchor; the
// hook returns helpers to open from a click-event, a right-click event,
// or a long-press fire. On close, focus restores to the originating
// bubble (read with `focusRestoreSelector`).

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ContextMenuAnchor } from './types';

export interface UseMessageContextMenuReturn {
  openMessageId: string | null;
  anchor: ContextMenuAnchor | null;
  /** Right-click handler factory for desktop. */
  openFromContextMenu: (
    e: React.MouseEvent<HTMLElement>,
    messageId: string,
  ) => void;
  /** Long-press fire — invoked by useLongPress's callback. */
  openFromLongPress: (
    x: number,
    y: number,
    target: HTMLElement | null,
    messageId: string,
  ) => void;
  /** Keyboard fire — Shift+F10 / context-menu key. */
  openFromKeyboard: (
    target: HTMLElement,
    messageId: string,
  ) => void;
  close: () => void;
  isOpen: boolean;
}

/**
 * @param focusRestoreSelector  CSS query used to find the originating
 *   bubble after close. Receives the message id. Defaults to the
 *   convention `[data-message-id="<id>"]`.
 */
export function useMessageContextMenu(
  focusRestoreSelector: (messageId: string) => string = (id) =>
    `[data-message-id="${id}"]`,
): UseMessageContextMenuReturn {
  const [openMessageId, setOpenMessageId] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<ContextMenuAnchor | null>(null);
  const lastFocusedSelectorRef = useRef<string | null>(null);

  const close = useCallback(() => {
    const messageId = openMessageId;
    setOpenMessageId(null);
    setAnchor(null);
    if (typeof document === 'undefined') return;
    if (!messageId) return;
    const selector = lastFocusedSelectorRef.current ?? focusRestoreSelector(messageId);
    lastFocusedSelectorRef.current = null;
    // Defer focus restoration so React's commit completes first.
    requestAnimationFrame(() => {
      try {
        const el = document.querySelector<HTMLElement>(selector);
        if (el && typeof el.focus === 'function') {
          // Some bubbles aren't natively focusable; tabIndex={-1} is
          // enough to receive programmatic focus.
          el.focus({ preventScroll: true });
        }
      } catch {
        /* no-op */
      }
    });
  }, [openMessageId, focusRestoreSelector]);

  const openFromContextMenu = useCallback(
    (e: React.MouseEvent<HTMLElement>, messageId: string) => {
      e.preventDefault();
      lastFocusedSelectorRef.current = focusRestoreSelector(messageId);
      setOpenMessageId(messageId);
      // Ground the menu at the bubble. Pick the side based on which half
      // of the viewport the bubble lives in: right-half (own / sent)
      // bubbles anchor at the BUBBLE's right edge so the menu opens
      // leftward and never overflows the right side of the viewport;
      // left-half (received) bubbles anchor at the LEFT edge so the menu
      // opens rightward. clampDesktopPosition still handles the residual
      // edge cases for the top/bottom axis.
      const target = e.currentTarget;
      const rect = target.getBoundingClientRect();
      if (typeof window === 'undefined') {
        setAnchor({ x: rect.left, y: rect.top, source: target });
        return;
      }
      const POPOVER_W = 240;
      const bubbleCenter = rect.left + rect.width / 2;
      const anchorX = bubbleCenter > window.innerWidth / 2
        ? Math.max(0, rect.right - POPOVER_W)
        : rect.left;
      setAnchor({ x: anchorX, y: rect.top, source: target });
    },
    [focusRestoreSelector],
  );

  const openFromLongPress = useCallback(
    (
      x: number,
      y: number,
      target: HTMLElement | null,
      messageId: string,
    ) => {
      lastFocusedSelectorRef.current = focusRestoreSelector(messageId);
      setOpenMessageId(messageId);
      setAnchor({ x, y, source: target });
    },
    [focusRestoreSelector],
  );

  const openFromKeyboard = useCallback(
    (target: HTMLElement, messageId: string) => {
      lastFocusedSelectorRef.current = focusRestoreSelector(messageId);
      const rect = target.getBoundingClientRect();
      setOpenMessageId(messageId);
      setAnchor({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        source: target,
      });
    },
    [focusRestoreSelector],
  );

  // Esc / outside-click close handled by the menu component itself —
  // this hook just owns identity + anchor.

  // Defensive: if the menu's owner unmounts, drop state.
  useEffect(
    () => () => {
      lastFocusedSelectorRef.current = null;
    },
    [],
  );

  return {
    openMessageId,
    anchor,
    openFromContextMenu,
    openFromLongPress,
    openFromKeyboard,
    close,
    isOpen: openMessageId !== null,
  };
}

export default useMessageContextMenu;
