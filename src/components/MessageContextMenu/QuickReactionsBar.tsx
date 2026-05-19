// src/components/MessageContextMenu/QuickReactionsBar.tsx
// PR 2 · Surface 2 · row of 6 emoji + a "more…" button above the menu.
//
// Lives as a SIBLING role="toolbar" of the role="menu" so screen readers
// hear it as a distinct surface (per spec § A11y Decisions).

import React, { useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { QUICK_REACTIONS } from './types';

export interface QuickReactionsBarProps {
  onPick: (emoji: string) => void;
  onMore?: () => void;
  /** Emoji that the current user already applied (highlighted). */
  myReactions?: ReadonlyArray<string>;
  isDarkMode?: boolean;
}

export const QuickReactionsBar: React.FC<QuickReactionsBarProps> = ({
  onPick,
  onMore,
  myReactions = [],
  isDarkMode = false,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  // Roving tabindex within the bar — arrow keys move focus.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const handler = (e: KeyboardEvent) => {
      if (!root.contains(document.activeElement)) return;
      const buttons = Array.from(
        root.querySelectorAll<HTMLButtonElement>('button[data-quick-reaction]'),
      );
      const current = document.activeElement as HTMLElement | null;
      const idx = current
        ? buttons.findIndex((b) => b === current)
        : -1;
      if (idx === -1) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        buttons[(idx + 1) % buttons.length]?.focus();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        buttons[(idx - 1 + buttons.length) % buttons.length]?.focus();
      }
    };
    root.addEventListener('keydown', handler);
    return () => root.removeEventListener('keydown', handler);
  }, []);

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label="Quick reactions"
      className={[
        'flex items-center justify-between gap-1 px-2 py-1.5 rounded-full',
        isDarkMode
          ? 'bg-zinc-900/80 border border-white/10'
          : 'bg-white border border-black/10',
      ].join(' ')}
    >
      {QUICK_REACTIONS.map((emoji) => {
        const picked = myReactions.includes(emoji);
        return (
          <button
            key={emoji}
            type="button"
            data-quick-reaction
            aria-label={`React with ${emoji}`}
            aria-pressed={picked}
            onClick={() => onPick(emoji)}
            className={[
              'inline-flex items-center justify-center rounded-full',
              // Touch target — 44x44 is parent constraint; emoji uses 40
              // tap area with 8px spacing per WCAG 2.2 SC 2.5.8.
              'h-11 w-11 text-xl leading-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40',
              'transition-transform active:scale-90',
              picked
                ? isDarkMode
                  ? 'bg-white/15'
                  : 'bg-black/10'
                : isDarkMode
                  ? 'hover:bg-white/10'
                  : 'hover:bg-black/5',
            ].join(' ')}
          >
            <span aria-hidden="true">{emoji}</span>
          </button>
        );
      })}
      <button
        type="button"
        data-quick-reaction
        aria-label="More reactions"
        onClick={onMore}
        disabled={!onMore}
        className={[
          'inline-flex items-center justify-center rounded-full h-11 w-11',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40',
          'transition-transform active:scale-90',
          isDarkMode
            ? 'hover:bg-white/10 text-zinc-200 disabled:opacity-40'
            : 'hover:bg-black/5 text-zinc-700 disabled:opacity-40',
        ].join(' ')}
      >
        <Plus size={18} aria-hidden="true" />
      </button>
    </div>
  );
};

export default QuickReactionsBar;
