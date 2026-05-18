// src/components/ToolsMenuV2/ToolsMenuTile.tsx
// PR 3a — Surface 3 · slim Tools menu · reusable tile primitive.
//
// Renders a single tile in the slim menu grid (desktop 2-col) / stack
// (mobile 1-col). Tiles are role="button" — the inline accordion that
// expands when activated is the parent's responsibility. PR 3a keeps
// every tile coral-free; PR 3b will add an `aiChip` slot for the
// Summary + Insights tiles.

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { TILE_MIN_HEIGHT_PX } from './types';

export interface ToolsMenuTileProps {
  title: string;
  purpose: string;
  icon: LucideIcon;
  /** Stable id used as the tabindex / focus target. */
  tileId: string;
  /** Whether this tile is the currently-focused one in roving tabindex. */
  isFocused: boolean;
  onActivate: () => void;
  onFocus: () => void;
  isDarkMode?: boolean;
  /** Optional override — defaults to `${title}. ${purpose}`. */
  ariaLabel?: string;
}

export const ToolsMenuTile = React.forwardRef<HTMLButtonElement, ToolsMenuTileProps>(
  (
    {
      title,
      purpose,
      icon: Icon,
      tileId,
      isFocused,
      onActivate,
      onFocus,
      isDarkMode = false,
      ariaLabel,
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        role="button"
        data-tile-id={tileId}
        tabIndex={isFocused ? 0 : -1}
        aria-label={ariaLabel ?? `${title}. ${purpose}`}
        onClick={onActivate}
        onFocus={onFocus}
        style={{ minHeight: TILE_MIN_HEIGHT_PX }}
        className={[
          'w-full text-left rounded-xl border px-4 py-3.5 flex items-start gap-3',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40',
          isDarkMode
            ? 'bg-zinc-900/60 border-white/10 hover:bg-zinc-800/80 text-zinc-100'
            : 'bg-white border-black/10 hover:bg-black/5 text-zinc-900',
        ].join(' ')}
      >
        <span
          className={[
            'shrink-0 mt-0.5 inline-flex items-center justify-center rounded-lg w-9 h-9',
            isDarkMode ? 'bg-white/5 text-zinc-300' : 'bg-black/5 text-zinc-700',
          ].join(' ')}
          aria-hidden="true"
        >
          <Icon size={18} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold leading-snug">
            {title}
          </span>
          <span
            className={[
              'block text-xs leading-snug mt-0.5',
              isDarkMode ? 'text-zinc-400' : 'text-zinc-500',
            ].join(' ')}
          >
            {purpose}
          </span>
        </span>
      </button>
    );
  },
);

ToolsMenuTile.displayName = 'ToolsMenuTile';

export default ToolsMenuTile;
