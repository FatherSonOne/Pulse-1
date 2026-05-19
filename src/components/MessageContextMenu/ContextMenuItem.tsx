// src/components/MessageContextMenu/ContextMenuItem.tsx
// PR 2 · Surface 2 · single menu item.
//
// Renders an icon · label · optional shortcut hint. Uses role="menuitem"
// so it nests cleanly inside the role="menu" wrapper. Roving tabindex
// is owned by the parent — this component just exposes `tabIndex` via
// props.

import React, { forwardRef } from 'react';
import type { ContextMenuItemDescriptor } from './types';

export interface ContextMenuItemProps {
  item: ContextMenuItemDescriptor;
  /** Roving tabindex — parent sets exactly one child to 0 at a time. */
  tabIndex: 0 | -1;
  /** Show the shortcut hint column (desktop only). */
  showShortcut?: boolean;
  /** Compact: smaller row (used in overflow lists). */
  compact?: boolean;
  onSelect: () => void;
  onFocus?: () => void;
  isDarkMode?: boolean;
}

export const ContextMenuItem = forwardRef<HTMLButtonElement, ContextMenuItemProps>(
  (
    {
      item,
      tabIndex,
      showShortcut = false,
      compact = false,
      onSelect,
      onFocus,
      isDarkMode = false,
    },
    ref,
  ) => {
    const Icon = item.icon;
    return (
      <button
        ref={ref}
        type="button"
        role="menuitem"
        tabIndex={tabIndex}
        onClick={onSelect}
        onFocus={onFocus}
        data-action-id={item.id}
        className={[
          'w-full flex items-center gap-3 text-left rounded-lg',
          // Touch target — always ≥44px on the row height.
          compact ? 'px-3 py-2 min-h-[44px]' : 'px-3 py-2.5 min-h-[44px]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40',
          isDarkMode
            ? item.destructive
              ? 'hover:bg-red-500/10 text-red-300'
              : 'hover:bg-white/5 text-zinc-100'
            : item.destructive
              ? 'hover:bg-red-500/10 text-red-600'
              : 'hover:bg-black/5 text-zinc-900',
        ].join(' ')}
      >
        <Icon
          size={16}
          className={[
            'shrink-0',
            item.destructive
              ? isDarkMode ? 'text-red-300' : 'text-red-500'
              : isDarkMode ? 'text-zinc-400' : 'text-zinc-500',
          ].join(' ')}
          aria-hidden="true"
        />
        <span className="flex-1 min-w-0 text-sm font-medium truncate">
          {item.label}
        </span>
        {showShortcut && item.shortcut ? (
          <span
            aria-hidden="true"
            className={[
              'shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] ml-2',
              isDarkMode ? 'text-zinc-500' : 'text-zinc-400',
            ].join(' ')}
          >
            {item.shortcut}
          </span>
        ) : null}
      </button>
    );
  },
);

ContextMenuItem.displayName = 'ContextMenuItem';

export default ContextMenuItem;
