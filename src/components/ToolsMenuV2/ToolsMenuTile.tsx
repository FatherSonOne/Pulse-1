// src/components/ToolsMenuV2/ToolsMenuTile.tsx
// PR 3a + 3b — Surface 3 · slim Tools menu · reusable tile primitive.
//
// Renders a single tile in the slim menu grid (desktop 2-col) / stack
// (mobile 1-col). Tiles are role="button" — the inline accordion that
// expands when activated is the parent's responsibility. PR 3b adds the
// `aiChip` slot for the Summary + Insights tiles (the only tiles in the
// menu that consume coral).

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
  /**
   * Disable the tile (e.g. Summary at 10-49 messages). Renders the tile
   * with `aria-disabled`, suppresses onActivate, and dims it visually
   * while keeping the AI chip visible so users learn the identity.
   */
  disabled?: boolean;
  /**
   * Optional AI provenance chip rendered top-right. Used ONLY by the
   * Summary + Insights tiles per the coral budget. Tiles that don't
   * surface AI output must omit this slot.
   */
  aiChip?: React.ReactNode;
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
      disabled = false,
      aiChip,
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
        aria-disabled={disabled || undefined}
        onClick={disabled ? undefined : onActivate}
        onFocus={onFocus}
        style={{ minHeight: TILE_MIN_HEIGHT_PX }}
        className={[
          'w-full text-left rounded-xl border px-4 py-3.5 flex items-start gap-3 relative',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40',
          disabled ? 'opacity-60 cursor-not-allowed' : '',
          isDarkMode
            ? disabled
              ? 'bg-zinc-900/60 border-white/10 text-zinc-100'
              : 'bg-zinc-900/60 border-white/10 hover:bg-zinc-800/80 text-zinc-100'
            : disabled
              ? 'bg-white border-black/10 text-zinc-900'
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
        <span className="flex-1 min-w-0 pr-8">
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
        {aiChip ? (
          <span className="absolute top-2.5 right-2.5 pointer-events-none">
            {aiChip}
          </span>
        ) : null}
      </button>
    );
  },
);

ToolsMenuTile.displayName = 'ToolsMenuTile';

export default ToolsMenuTile;
