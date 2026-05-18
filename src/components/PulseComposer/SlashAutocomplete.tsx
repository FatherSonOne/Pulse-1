// src/components/PulseComposer/SlashAutocomplete.tsx
// PR 1 — Messages Tools Redesign · Surface 1 · Compose bar.
//
// Listbox used for both `/t <q>` template lookups and `/` generic slash
// commands (mock 1.5). The data source is swapped by the caller — this
// component is a pure listbox over `SlashItem[]`.
//
// Accessibility:
//   • role="listbox" with aria-activedescendant
//   • role="option" items with aria-selected
//   • Esc closes via `onClose`
//   • Tab and Enter both insert via `onAccept`
//   • Hover updates the active option index
//
// Coral budget: ZERO.

import React, { useEffect, useRef } from 'react';
import type { SlashItem } from './types';

interface SlashAutocompleteProps {
  open: boolean;
  isMobile: boolean;
  isDarkMode: boolean;
  /** Items to render, in display order — already filtered. */
  items: ReadonlyArray<SlashItem>;
  /** Active option index (the caller owns this state). */
  activeIndex: number;
  /** Label shown in role="listbox" — "Template suggestions" / "Slash commands". */
  listLabel: string;
  /** Footer hint ("2 of 7 templates · ↑↓ navigate · Esc close"). */
  footerHint?: string;
  onActiveIndexChange: (next: number) => void;
  onAccept: (item: SlashItem) => void;
  onClose: () => void;
}

export const SlashAutocomplete: React.FC<SlashAutocompleteProps> = ({
  open,
  isMobile,
  isDarkMode,
  items,
  activeIndex,
  listLabel,
  footerHint,
  onActiveIndexChange,
  onAccept,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Outside-click dismiss.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      className={[
        'rounded-xl shadow-2xl backdrop-blur animate-fade-in overflow-hidden',
        isMobile ? 'w-full' : 'w-[320px]',
        isDarkMode
          ? 'bg-zinc-900/95 border border-white/10 text-zinc-100'
          : 'bg-white/98 border border-black/10 text-zinc-900',
      ].join(' ')}
      // Don't let listbox clicks blur the textarea.
      onMouseDown={(e) => e.preventDefault()}
    >
      <ul
        role="listbox"
        aria-label={listLabel}
        aria-activedescendant={
          items[activeIndex] ? `slash-opt-${items[activeIndex].id}` : undefined
        }
        className="max-h-[260px] overflow-y-auto py-1"
      >
        {items.length === 0 ? (
          <li
            role="option"
            aria-selected="false"
            className={[
              'px-3 py-3 text-sm',
              isDarkMode ? 'text-zinc-400' : 'text-zinc-500',
            ].join(' ')}
          >
            No matches. Press Esc to dismiss.
          </li>
        ) : (
          items.map((item, idx) => {
            const isActive = idx === activeIndex;
            return (
              <li
                key={item.id}
                id={`slash-opt-${item.id}`}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => onActiveIndexChange(idx)}
                onClick={() => onAccept(item)}
                className={[
                  'flex items-center gap-3 px-3 py-2 cursor-pointer',
                  isActive
                    ? isDarkMode
                      ? 'bg-white/10'
                      : 'bg-black/5'
                    : '',
                ].join(' ')}
              >
                <span
                  aria-hidden="true"
                  className={[
                    'inline-block w-1 self-stretch rounded',
                    isActive
                      ? isDarkMode
                        ? 'bg-white/30'
                        : 'bg-black/30'
                      : 'bg-transparent',
                  ].join(' ')}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{item.label}</div>
                  {item.hint ? (
                    <div
                      className={[
                        'text-xs truncate',
                        isDarkMode ? 'text-zinc-400' : 'text-zinc-500',
                      ].join(' ')}
                    >
                      {item.hint}
                    </div>
                  ) : null}
                </div>
                <span
                  aria-hidden="true"
                  className={[
                    'text-xs font-mono opacity-60',
                    isActive ? 'opacity-100' : '',
                  ].join(' ')}
                >
                  ↵
                </span>
              </li>
            );
          })
        )}
      </ul>
      {footerHint ? (
        <div
          className={[
            'px-3 py-2 text-[11px] font-mono uppercase tracking-[0.08em] border-t',
            isDarkMode
              ? 'border-white/10 text-zinc-500'
              : 'border-black/10 text-zinc-500',
          ].join(' ')}
        >
          {footerHint}
        </div>
      ) : null}
    </div>
  );
};

export default SlashAutocomplete;
