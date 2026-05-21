// src/components/ToolsMenuV2/useToolsMenu.ts
// PR 3a — Surface 3 · slim Tools menu.
//
// Hook owning (a) which tile body (if any) is currently expanded inline
// and (b) the desktop "pin open" preference. Pin state persists across
// reloads via localStorage so power users don't have to re-pin every
// time they switch threads.

import { useCallback, useEffect, useState } from 'react';
import type { ToolsMenuTileId } from './types';

const PIN_KEY = 'pulse_tools_menu_pinned';

export interface UseToolsMenuReturn {
  activeTile: ToolsMenuTileId | null;
  openTile: (id: ToolsMenuTileId) => void;
  closeTile: () => void;
  pinned: boolean;
  togglePinned: () => void;
}

export function useToolsMenu(): UseToolsMenuReturn {
  const [activeTile, setActiveTile] = useState<ToolsMenuTileId | null>(null);
  const [pinned, setPinned] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(PIN_KEY) === '1';
    } catch {
      return false;
    }
  });

  const openTile = useCallback((id: ToolsMenuTileId) => {
    setActiveTile(id);
  }, []);

  const closeTile = useCallback(() => {
    setActiveTile(null);
  }, []);

  const togglePinned = useCallback(() => {
    setPinned((prev) => !prev);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(PIN_KEY, pinned ? '1' : '0');
    } catch {
      /* localStorage may be unavailable in sandboxes — swallow */
    }
  }, [pinned]);

  return { activeTile, openTile, closeTile, pinned, togglePinned };
}
