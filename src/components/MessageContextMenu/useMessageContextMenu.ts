// src/components/MessageContextMenu/useMessageContextMenu.ts
// Open/close state machine for the message context-menu (Surface 2).
//
// One menu is open at a time. Parent passes a message id + anchor; the
// hook returns helpers to open from a click-event, a right-click event,
// or a long-press fire. On close, focus restores to the originating
// bubble (read with `focusRestoreSelector`).

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ContextMenuAnchor } from './types';

/** Exit-animation hold — must be ≥ the longest msgCtx*Out in messages.css
 *  (mobile sheet-out is 160ms). Keeps the menu mounted one beat so it can
 *  animate out before the parent unmounts it. */
const EXIT_MS = 170;

export interface UseMessageContextMenuReturn {
  openMessageId: string | null;
  anchor: ContextMenuAnchor | null;
  /** True while the menu is animating out (deferred close in flight). */
  closing: boolean;
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
  // `closing` keeps the menu mounted for one exit-animation beat. The parent
  // mounts the menu purely off `openMessageId`, so without this the element
  // would be ripped out of the tree the instant we cleared state — no frame
  // left to animate out. Matches msgCtx*Out durations in messages.css.
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFocusedSelectorRef = useRef<string | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  // Actually tear the menu down + restore focus to the originating bubble.
  const finalizeClose = useCallback(
    (messageId: string | null) => {
      setOpenMessageId(null);
      setAnchor(null);
      setClosing(false);
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
    },
    [focusRestoreSelector],
  );

  const close = useCallback(() => {
    const messageId = openMessageId;
    if (!messageId) return; // nothing open
    if (closing) return; // already animating out — idempotent
    // Reduced motion: skip the exit animation (and its delay) entirely.
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      clearCloseTimer();
      finalizeClose(messageId);
      return;
    }
    setClosing(true);
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      finalizeClose(messageId);
    }, EXIT_MS);
  }, [openMessageId, closing, clearCloseTimer, finalizeClose]);

  const openFromContextMenu = useCallback(
    (e: React.MouseEvent<HTMLElement>, messageId: string) => {
      e.preventDefault();
      clearCloseTimer();
      setClosing(false);
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
    [focusRestoreSelector, clearCloseTimer],
  );

  const openFromLongPress = useCallback(
    (
      x: number,
      y: number,
      target: HTMLElement | null,
      messageId: string,
    ) => {
      clearCloseTimer();
      setClosing(false);
      lastFocusedSelectorRef.current = focusRestoreSelector(messageId);
      setOpenMessageId(messageId);
      setAnchor({ x, y, source: target });
    },
    [focusRestoreSelector, clearCloseTimer],
  );

  const openFromKeyboard = useCallback(
    (target: HTMLElement, messageId: string) => {
      clearCloseTimer();
      setClosing(false);
      lastFocusedSelectorRef.current = focusRestoreSelector(messageId);
      const rect = target.getBoundingClientRect();
      setOpenMessageId(messageId);
      setAnchor({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        source: target,
      });
    },
    [focusRestoreSelector, clearCloseTimer],
  );

  // Esc / outside-click close handled by the menu component itself —
  // this hook just owns identity + anchor.

  // Defensive: if the menu's owner unmounts, drop state + any pending timer.
  useEffect(
    () => () => {
      lastFocusedSelectorRef.current = null;
      if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current);
    },
    [],
  );

  return {
    openMessageId,
    anchor,
    closing,
    openFromContextMenu,
    openFromLongPress,
    openFromKeyboard,
    close,
    isOpen: openMessageId !== null,
  };
}

export default useMessageContextMenu;
