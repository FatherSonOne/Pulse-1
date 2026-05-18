// src/components/ToolsMenuV2/ToolsMenuV2.tsx
// PR 3a — Messages Tools Redesign · Surface 3 · slim Tools menu shell.
//
// Scope (per docs/messages-tools-redesign.md §3 + Implementation Roadmap):
//   IN:  desktop 380px right-side panel (pin-open), mobile 60vh bottom
//        sheet with drag handle, search box, 2 tiles (Thread Audit +
//        Translate Settings), inline accordion expansion on tile activate,
//        role="dialog" wrapping, Esc / outside close, focus management,
//        dark/light parity.
//   OUT: Thread Summary tile, Insights tile (both PR 3b). Any coral.
//        Backend wiring beyond per-thread localStorage.
//
// Coral budget: ZERO in PR 3a. PR 3b adds the only six coral instances
// in the whole redesign (Summary + Insights tile chips and output
// cards). Reviewer rejects any coral in this file or its siblings.

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ChevronLeft, Globe, Pin, PinOff, Search, Sparkles, X } from 'lucide-react';
import { Activity } from 'lucide-react';
import ToolsMenuTile from './ToolsMenuTile';
import ThreadAudit from './ThreadAudit/ThreadAudit';
import TranslateSettings from './TranslateSettings/TranslateSettings';
import { useToolsMenu } from './useToolsMenu';
import {
  DESKTOP_BREAKPOINT,
  DESKTOP_PANEL_WIDTH,
  MOBILE_SHEET_VH,
  TOUCH_TARGET_PX,
} from './types';
import type {
  ToolsMenuTileDescriptor,
  ToolsMenuTileId,
  ToolsMenuV2Props,
} from './types';

/**
 * Tile catalogue for PR 3a. Order matches the spec mock 3.1/3.2 (Audit
 * before Translate Settings once Summary/Insights are removed in this
 * PR). When PR 3b ships Summary + Insights, they prepend onto this array.
 */
const TILES: ReadonlyArray<ToolsMenuTileDescriptor> = [
  {
    id: 'thread-audit',
    title: 'Thread Audit',
    purpose: 'Pace · Sentiment · Flow',
    icon: Activity,
  },
  {
    id: 'translate-settings',
    title: 'Translate Settings',
    purpose: 'Per-thread auto-translate',
    icon: Globe,
  },
];

function tileMatches(tile: ToolsMenuTileDescriptor, query: string): boolean {
  if (!query) return true;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    tile.title.toLowerCase().includes(needle) ||
    tile.purpose.toLowerCase().includes(needle)
  );
}

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
    const onResize = () => setIsMobile(window.innerWidth < DESKTOP_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [forceMobile]);
  return isMobile;
}

function TileBody({
  tileId,
  threadId,
  messageCount,
  isDarkMode,
  onBack,
}: {
  tileId: ToolsMenuTileId;
  threadId: string;
  messageCount: number;
  isDarkMode: boolean;
  onBack: () => void;
}): React.ReactElement | null {
  switch (tileId) {
    case 'thread-audit':
      return (
        <ThreadAudit
          threadId={threadId}
          messageCount={messageCount}
          isDarkMode={isDarkMode}
          onBack={onBack}
        />
      );
    case 'translate-settings':
      return (
        <TranslateSettings
          threadId={threadId}
          messageCount={messageCount}
          isDarkMode={isDarkMode}
          onBack={onBack}
        />
      );
    default:
      return null;
  }
}

export const ToolsMenuV2: React.FC<ToolsMenuV2Props> = ({
  open,
  threadId,
  messageCount,
  forceMobile,
  isDarkMode = false,
  onClose,
}) => {
  const isMobile = useIsMobile(forceMobile);
  const { activeTile, openTile, closeTile, pinned, togglePinned } = useToolsMenu();
  const [search, setSearch] = useState<string>('');
  const [tileFocusIdx, setTileFocusIdx] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const firstTileRef = useRef<HTMLButtonElement>(null);

  const visibleTiles = useMemo(
    () => TILES.filter((t) => tileMatches(t, search)),
    [search],
  );

  // Reset internal state on (re-)open. Don't clear pin — it persists.
  useEffect(() => {
    if (!open) return;
    setSearch('');
    closeTile();
    setTileFocusIdx(0);
  }, [open, closeTile, threadId]);

  // Focus the close button on mobile (drag-handle context), search on
  // desktop (power-user enters straight into search). Either way the
  // dialog gets keyboard focus.
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      if (isMobile) {
        closeBtnRef.current?.focus();
      } else {
        searchInputRef.current?.focus();
      }
    });
  }, [open, isMobile]);

  // Esc closes the panel (or first the inline tile body if one is open).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (activeTile) {
          closeTile();
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, activeTile, closeTile, onClose]);

  // Click-outside close — mobile bottom sheet uses an overlay sibling;
  // desktop panel without pin also closes on outside click. Pinned
  // desktop panel stays open (aria-modal="false" reflects the change).
  useEffect(() => {
    if (!open || isMobile || pinned) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, isMobile, pinned, onClose]);

  // Roving tabindex across visible tiles (when no tile body is open).
  const onTileGridKey = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (activeTile) return;
      if (!visibleTiles.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        setTileFocusIdx((idx) => {
          const next = (idx + 1) % visibleTiles.length;
          const root = containerRef.current;
          const btn = root?.querySelector<HTMLButtonElement>(
            `[data-tile-id="${visibleTiles[next].id}"]`,
          );
          btn?.focus();
          return next;
        });
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setTileFocusIdx((idx) => {
          const next = (idx - 1 + visibleTiles.length) % visibleTiles.length;
          const root = containerRef.current;
          const btn = root?.querySelector<HTMLButtonElement>(
            `[data-tile-id="${visibleTiles[next].id}"]`,
          );
          btn?.focus();
          return next;
        });
      }
    },
    [activeTile, visibleTiles],
  );

  if (!open) return null;

  const activeDescriptor = activeTile
    ? TILES.find((t) => t.id === activeTile)
    : null;

  const headerBase = (
    <div className="flex items-center justify-between px-4 pt-3 pb-2">
      <div className="flex items-center gap-2 min-w-0">
        {activeDescriptor ? (
          <>
            <button
              type="button"
              onClick={closeTile}
              aria-label="Back to tools list"
              style={{ minWidth: TOUCH_TARGET_PX, minHeight: TOUCH_TARGET_PX }}
              className={[
                'inline-flex items-center justify-center rounded-lg -ml-2',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40',
                isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5',
              ].join(' ')}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <h2
              id="tools-menu-v2-title"
              className="text-base font-semibold truncate"
            >
              {activeDescriptor.title}
            </h2>
          </>
        ) : (
          <>
            <Sparkles
              size={18}
              aria-hidden="true"
              className={isDarkMode ? 'text-zinc-300' : 'text-zinc-700'}
            />
            <h2
              id="tools-menu-v2-title"
              className="text-base font-semibold"
            >
              Tools
            </h2>
          </>
        )}
      </div>
      <div className="flex items-center gap-1">
        {!isMobile ? (
          <button
            type="button"
            onClick={togglePinned}
            aria-label={pinned ? 'Unpin tools panel' : 'Pin tools panel'}
            aria-pressed={pinned}
            style={{ minWidth: TOUCH_TARGET_PX, minHeight: TOUCH_TARGET_PX }}
            className={[
              'inline-flex items-center justify-center rounded-lg',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40',
              isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5',
            ].join(' ')}
          >
            {pinned ? (
              <PinOff size={16} aria-hidden="true" />
            ) : (
              <Pin size={16} aria-hidden="true" />
            )}
          </button>
        ) : null}
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          aria-label="Close tools"
          style={{ minWidth: TOUCH_TARGET_PX, minHeight: TOUCH_TARGET_PX }}
          className={[
            'inline-flex items-center justify-center rounded-lg -mr-1',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40',
            isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5',
          ].join(' ')}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  const body = (
    <div className="flex-1 overflow-y-auto px-4 pb-4">
      {activeDescriptor ? (
        <TileBody
          tileId={activeDescriptor.id}
          threadId={threadId}
          messageCount={messageCount}
          isDarkMode={isDarkMode}
          onBack={closeTile}
        />
      ) : (
        <>
          <div className="relative mb-3">
            <Search
              size={16}
              aria-hidden="true"
              className={[
                'absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none',
                isDarkMode ? 'text-zinc-400' : 'text-zinc-500',
              ].join(' ')}
            />
            <input
              ref={searchInputRef}
              type="text"
              role="searchbox"
              aria-label="Search tools"
              placeholder="Search tools…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setTileFocusIdx(0);
              }}
              className={[
                'w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40',
                isDarkMode
                  ? 'bg-zinc-900 border-white/10 text-zinc-100 placeholder:text-zinc-500'
                  : 'bg-white border-black/10 text-zinc-900 placeholder:text-zinc-400',
              ].join(' ')}
            />
          </div>
          <div
            role="group"
            aria-label="Available tools"
            onKeyDown={onTileGridKey}
            className={[
              'grid gap-2',
              isMobile ? 'grid-cols-1' : 'grid-cols-1',
            ].join(' ')}
          >
            {visibleTiles.length === 0 ? (
              <p
                className={[
                  'text-sm py-6 text-center',
                  isDarkMode ? 'text-zinc-400' : 'text-zinc-500',
                ].join(' ')}
              >
                No tools match &ldquo;{search}&rdquo;.
              </p>
            ) : (
              visibleTiles.map((tile, i) => (
                <ToolsMenuTile
                  key={tile.id}
                  ref={i === 0 ? firstTileRef : undefined}
                  title={tile.title}
                  purpose={tile.purpose}
                  icon={tile.icon}
                  tileId={tile.id}
                  isFocused={i === tileFocusIdx}
                  onActivate={() => openTile(tile.id)}
                  onFocus={() => setTileFocusIdx(i)}
                  isDarkMode={isDarkMode}
                  ariaLabel={tile.ariaLabel}
                />
              ))
            )}
          </div>
          <p
            className={[
              'mt-4 text-[11px] font-mono uppercase tracking-[0.1em]',
              isDarkMode ? 'text-zinc-500' : 'text-zinc-500',
            ].join(' ')}
          >
            Surface 3 · Messages Tools Redesign
          </p>
        </>
      )}
    </div>
  );

  // ─── Mobile bottom sheet ──────────────────────────────────────────
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
          aria-labelledby="tools-menu-v2-title"
          style={{
            height: `${MOBILE_SHEET_VH}vh`,
          }}
          className={[
            'fixed left-0 right-0 bottom-0 z-50 rounded-t-2xl flex flex-col',
            'pb-[env(safe-area-inset-bottom)] animate-slide-up',
            isDarkMode
              ? 'bg-zinc-900 border-t border-white/10 text-zinc-100'
              : 'bg-white border-t border-black/10 text-zinc-900',
          ].join(' ')}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-2.5 pb-1 shrink-0">
            <div
              aria-hidden="true"
              className={[
                'h-1 w-10 rounded-full',
                isDarkMode ? 'bg-white/15' : 'bg-black/15',
              ].join(' ')}
            />
          </div>
          {headerBase}
          {body}
        </div>
      </>
    );
  }

  // ─── Desktop side panel ───────────────────────────────────────────
  // Pinned: aria-modal=false, no overlay. Unpinned: aria-modal=false
  // still (panel can coexist with chat), but click-outside closes.
  return (
    <>
      {!pinned ? (
        <div
          aria-hidden="true"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/20 animate-fade-in"
        />
      ) : null}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tools-menu-v2-title"
        style={{
          width: DESKTOP_PANEL_WIDTH,
        }}
        className={[
          'fixed right-0 top-0 bottom-0 z-50 flex flex-col shadow-2xl animate-fade-in',
          isDarkMode
            ? 'bg-zinc-900 border-l border-white/10 text-zinc-100'
            : 'bg-white border-l border-black/10 text-zinc-900',
        ].join(' ')}
      >
        {headerBase}
        {body}
      </div>
    </>
  );
};

export default ToolsMenuV2;
