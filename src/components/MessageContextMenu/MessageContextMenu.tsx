// src/components/MessageContextMenu/MessageContextMenu.tsx
// PR 2 — Messages Tools Redesign · Surface 2 · Message context-menu.
//
// Scope (per docs/messages-tools-redesign.md §2.x):
//   IN:  long-press / right-click open · quick reactions bar (above) ·
//        top-5 menu (state-dependent) · overflow expansion · keyboard
//        shortcuts · focus management · Esc / outside close · dark/light
//        parity · mobile bottom sheet + desktop 240px popover.
//   OUT: real backend wiring beyond the existing onAction handler.
//
// Coral budget: ZERO. Surface 2 carries no coral whatsoever. If a future
// patch adds coral to this file, the reviewer must reject the PR.

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ChevronDown } from 'lucide-react';
import QuickReactionsBar from './QuickReactionsBar';
import ContextMenuItem from './ContextMenuItem';
import { buildOverflow, buildTop5 } from './menuConfig';
import type {
  ContextMenuActionId,
  ContextMenuItemDescriptor,
  MessageContextMenuProps,
} from './types';

const DESKTOP_BREAKPOINT = 768;
const POPOVER_WIDTH = 240;
const VIEWPORT_EDGE_PAD = 8;

function useIsMobile(forceMobile?: boolean): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof forceMobile === 'boolean') return forceMobile;
    if (typeof window === 'undefined') return false;
    return window.innerWidth < DESKTOP_BREAKPOINT;
  });
  useEffect(() => {
    if (typeof forceMobile === 'boolean') {
      setIsMobile(forceMobile);
      return;
    }
    if (typeof window === 'undefined') return;
    const onResize = () =>
      setIsMobile(window.innerWidth < DESKTOP_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [forceMobile]);
  return isMobile;
}

/**
 * Clamp anchor coordinates so the popover stays inside the viewport.
 * Returns top/left in CSS pixels.
 */
function clampDesktopPosition(
  x: number,
  y: number,
  height: number,
): { top: number; left: number } {
  if (typeof window === 'undefined') return { top: y, left: x };
  const maxLeft = window.innerWidth - POPOVER_WIDTH - VIEWPORT_EDGE_PAD;
  const maxTop = window.innerHeight - height - VIEWPORT_EDGE_PAD;
  return {
    top: Math.max(VIEWPORT_EDGE_PAD, Math.min(y, maxTop)),
    left: Math.max(VIEWPORT_EDGE_PAD, Math.min(x, maxLeft)),
  };
}

export const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
  open,
  anchor,
  viewpoint,
  myReactions,
  onAction,
  onQuickReact,
  onClose,
  onOpenMorePicker,
  forceMobile,
  isDarkMode = false,
}) => {
  const isMobile = useIsMobile(forceMobile);
  const containerRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const [showOverflow, setShowOverflow] = useState(false);
  const [popoverHeight, setPopoverHeight] = useState(320);
  // Roving tabindex — index points into top5 first, then overflow.
  const [focusIndex, setFocusIndex] = useState(0);

  // Reset internal state when (re-)opening.
  useEffect(() => {
    if (!open) return;
    setShowOverflow(false);
    setFocusIndex(0);
  }, [open, viewpoint?.messageId]);

  // Build menus.
  const top5 = useMemo<ContextMenuItemDescriptor[]>(
    () => (viewpoint ? buildTop5(viewpoint) : []),
    [viewpoint],
  );
  const overflow = useMemo<ContextMenuItemDescriptor[]>(
    () => (viewpoint ? buildOverflow(viewpoint) : []),
    [viewpoint],
  );

  // Flattened list used for roving tabindex.
  const visibleItems = useMemo<ContextMenuItemDescriptor[]>(
    () => (showOverflow ? [...top5, ...overflow] : top5),
    [top5, overflow, showOverflow],
  );

  // Track height so desktop popover clamps to viewport.
  useEffect(() => {
    if (!open || isMobile) return;
    const el = containerRef.current;
    if (!el) return;
    setPopoverHeight(el.offsetHeight || 320);
  }, [open, isMobile, top5.length, overflow.length, showOverflow]);

  // Focus first menu item on open (NOT the quick-reactions bar — spec).
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      firstItemRef.current?.focus();
    });
  }, [open, viewpoint?.messageId]);

  // Esc + click-outside close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, onClose]);

  // Keyboard shortcuts (R / E / Cmd+C / Cmd+Enter / F / T) — active while
  // any item inside the menu has focus.
  const dispatchActionRef = useRef<((id: ContextMenuActionId) => void) | null>(null);
  dispatchActionRef.current = (id: ContextMenuActionId) => {
    onAction(id);
    onClose();
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const root = containerRef.current;
      if (!root) return;
      if (!root.contains(document.activeElement)) return;
      const has = (id: ContextMenuActionId) =>
        visibleItems.some((i) => i.id === id) ||
        // Top-5 always reachable even when overflow collapsed.
        top5.some((i) => i.id === id);
      const meta = e.metaKey || e.ctrlKey;
      if (!meta && (e.key === 'r' || e.key === 'R')) {
        if (has('reply')) {
          e.preventDefault();
          dispatchActionRef.current?.('reply');
        }
      } else if (!meta && (e.key === 'e' || e.key === 'E')) {
        if (has('react')) {
          e.preventDefault();
          dispatchActionRef.current?.('react');
        }
      } else if (meta && !e.shiftKey && (e.key === 'c' || e.key === 'C')) {
        if (has('copy')) {
          e.preventDefault();
          dispatchActionRef.current?.('copy');
        }
      } else if (meta && e.key === 'Enter') {
        if (has('edit')) {
          e.preventDefault();
          dispatchActionRef.current?.('edit');
        }
      } else if (!meta && (e.key === 'f' || e.key === 'F')) {
        if (has('forward')) {
          e.preventDefault();
          dispatchActionRef.current?.('forward');
        }
      } else if (!meta && (e.key === 't' || e.key === 'T')) {
        if (has('translate')) {
          e.preventDefault();
          dispatchActionRef.current?.('translate');
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, visibleItems, top5]);

  // Roving tabindex on Up/Down inside the menu.
  const focusItemByIndex = (idx: number) => {
    const root = containerRef.current;
    if (!root) return;
    const buttons = root.querySelectorAll<HTMLButtonElement>('[data-action-id]');
    buttons[idx]?.focus();
  };

  const onMenuKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!visibleItems.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIndex((i) => {
          const next = (i + 1) % visibleItems.length;
          focusItemByIndex(next);
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIndex((i) => {
          const next = (i - 1 + visibleItems.length) % visibleItems.length;
          focusItemByIndex(next);
          return next;
        });
      } else if (e.key === 'Home') {
        e.preventDefault();
        setFocusIndex(0);
        focusItemByIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        const last = visibleItems.length - 1;
        setFocusIndex(last);
        focusItemByIndex(last);
      }
    },
    [visibleItems],
  );

  const handleAction = useCallback(
    (id: ContextMenuActionId) => {
      onAction(id);
      onClose();
    },
    [onAction, onClose],
  );

  const handleQuick = useCallback(
    (emoji: string) => {
      onQuickReact(emoji);
      onClose();
    },
    [onQuickReact, onClose],
  );

  if (!open || !viewpoint || !anchor) return null;

  const renderItems = (items: ContextMenuItemDescriptor[], indexBase: number) =>
    items.map((item, i) => {
      const flatIndex = indexBase + i;
      const isFirst = flatIndex === 0;
      return (
        <React.Fragment key={item.id}>
          {item.destructive && i > 0 ? (
            <div
              role="separator"
              aria-hidden="true"
              className={[
                'my-1 h-px mx-2',
                isDarkMode ? 'bg-white/10' : 'bg-black/10',
              ].join(' ')}
            />
          ) : null}
          <ContextMenuItem
            ref={isFirst ? firstItemRef : undefined}
            item={item}
            tabIndex={flatIndex === focusIndex ? 0 : -1}
            showShortcut={!isMobile}
            onSelect={() => handleAction(item.id)}
            onFocus={() => setFocusIndex(flatIndex)}
            isDarkMode={isDarkMode}
          />
        </React.Fragment>
      );
    });

  // ─── Mobile bottom sheet ─────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <div
          aria-hidden="true"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in"
        />
        <div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Message actions"
          onKeyDown={onMenuKeyDown}
          className={[
            'fixed left-0 right-0 bottom-0 z-50 rounded-t-2xl pb-[env(safe-area-inset-bottom)]',
            'animate-slide-up',
            isDarkMode
              ? 'bg-zinc-900 border-t border-white/10 text-zinc-100'
              : 'bg-white border-t border-black/10 text-zinc-900',
          ].join(' ')}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-2.5 pb-1">
            <div
              className={[
                'h-1 w-10 rounded-full',
                isDarkMode ? 'bg-white/15' : 'bg-black/15',
              ].join(' ')}
            />
          </div>
          {/* Quick reactions (SIBLING role="toolbar") */}
          <div className="px-3 py-2">
            <QuickReactionsBar
              onPick={handleQuick}
              onMore={onOpenMorePicker}
              myReactions={myReactions}
              isDarkMode={isDarkMode}
            />
          </div>
          {/* Menu items */}
          <div
            role="menu"
            aria-label="Message actions"
            className="px-2 pt-1 pb-2"
          >
            {renderItems(top5, 0)}
            {overflow.length > 0 ? (
              <>
                {!showOverflow ? (
                  <button
                    type="button"
                    onClick={() => setShowOverflow(true)}
                    aria-expanded={false}
                    aria-controls="msg-menu-overflow"
                    className={[
                      'mt-1 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg',
                      'min-h-[44px] text-xs font-mono uppercase tracking-[0.1em]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40',
                      isDarkMode
                        ? 'text-zinc-400 hover:bg-white/5'
                        : 'text-zinc-500 hover:bg-black/5',
                    ].join(' ')}
                  >
                    More
                    <ChevronDown size={14} aria-hidden="true" />
                  </button>
                ) : (
                  <div
                    id="msg-menu-overflow"
                    className={[
                      'mt-1 pt-1 border-t',
                      isDarkMode ? 'border-white/10' : 'border-black/10',
                    ].join(' ')}
                  >
                    {renderItems(overflow, top5.length)}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </>
    );
  }

  // ─── Desktop popover (240px) ─────────────────────────────────────
  const pos = clampDesktopPosition(anchor.x, anchor.y, popoverHeight);
  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label="Message actions"
      onKeyDown={onMenuKeyDown}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: POPOVER_WIDTH,
        zIndex: 50,
      }}
      className={[
        'rounded-xl shadow-2xl backdrop-blur animate-fade-in',
        isDarkMode
          ? 'bg-zinc-900/95 border border-white/10 text-zinc-100'
          : 'bg-white/98 border border-black/10 text-zinc-900',
      ].join(' ')}
    >
      {/* Desktop quick-reactions deliberately omitted — the hover-bar
          owns emoji-reactions on desktop (you reach it without right-
          clicking). The right-click menu is for actions only. Mobile
          long-press still shows the bar above (see line ~328) because
          there's no hover affordance on touch. */}
      <div
        role="menu"
        aria-label="Message actions"
        className={[
          'px-1.5 pb-1.5 pt-1',
          isDarkMode ? '' : '',
        ].join(' ')}
      >
        {renderItems(top5, 0)}
        {overflow.length > 0 ? (
          <>
            <div
              role="separator"
              aria-hidden="true"
              className={[
                'my-1 h-px mx-1',
                isDarkMode ? 'bg-white/10' : 'bg-black/10',
              ].join(' ')}
            />
            {!showOverflow ? (
              <button
                type="button"
                onClick={() => setShowOverflow(true)}
                aria-expanded={false}
                aria-controls="msg-menu-overflow-desktop"
                className={[
                  'w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg',
                  'min-h-[44px] text-xs font-mono uppercase tracking-[0.1em]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40',
                  isDarkMode
                    ? 'text-zinc-400 hover:bg-white/5'
                    : 'text-zinc-500 hover:bg-black/5',
                ].join(' ')}
              >
                More
                <ChevronDown size={14} aria-hidden="true" />
              </button>
            ) : (
              <div id="msg-menu-overflow-desktop">
                {renderItems(overflow, top5.length)}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};

export default MessageContextMenu;
