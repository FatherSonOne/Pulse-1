import { useEffect, useState, useCallback, useRef } from 'react';
import { isOverlayOpen } from '../lib/overlayStack';

interface RailRow {
  id: string;
  onPrimary: () => void;
  onSecondary?: () => void;
}

interface UseMeetingsKeyboardShortcutsArgs {
  rows: RailRow[];
  onStartPulse: () => void;
  onFocusJoin: () => void;
  onSchedule: () => void;
  onToggleTools: () => void;
  onToggleShortcutsOverlay: () => void;
  /**
   * True while a modal owns focus (Tools popover, Templates, Schedule view,
   * shortcut overlay itself, etc.). The hook no-ops so the modal's own
   * keyboard layer wins. The overlay-toggle key (?) is wired separately so
   * users can still close the overlay from inside it.
   */
  disabled?: boolean;
}

interface UseMeetingsKeyboardShortcutsReturn {
  cursorRowId: string | null;
  setCursorRowId: (id: string | null) => void;
}

const isTypingTarget = (e: KeyboardEvent): boolean => {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (t.isContentEditable) return true;
  return false;
};

export function useMeetingsKeyboardShortcuts(
  args: UseMeetingsKeyboardShortcutsArgs,
): UseMeetingsKeyboardShortcutsReturn {
  const { disabled = false } = args;
  const [cursorRowId, setCursorRowId] = useState<string | null>(null);

  const argsRef = useRef(args);
  argsRef.current = args;

  useEffect(() => {
    if (!cursorRowId) return;
    const stillExists = args.rows.some((r) => r.id === cursorRowId);
    if (!stillExists) setCursorRowId(null);
  }, [args.rows, cursorRowId]);

  const moveCursor = useCallback((delta: 1 | -1) => {
    const list = argsRef.current.rows;
    if (list.length === 0) return;
    const startIdx = cursorRowId ? list.findIndex((r) => r.id === cursorRowId) : -1;
    if (startIdx === -1) {
      setCursorRowId(list[delta > 0 ? 0 : list.length - 1].id);
      return;
    }
    const nextIdx = Math.min(list.length - 1, Math.max(0, startIdx + delta));
    if (nextIdx === startIdx) return;
    setCursorRowId(list[nextIdx].id);
  }, [cursorRowId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?' && !isTypingTarget(e) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        argsRef.current.onToggleShortcutsOverlay();
        return;
      }
      if (disabled) return;
      if (isTypingTarget(e)) return;
      if (isOverlayOpen()) return;

      const key = e.key;
      const isMod = e.ctrlKey || e.metaKey;

      if (isMod && (key === 'k' || key === 'K')) {
        e.preventDefault();
        argsRef.current.onToggleTools();
        return;
      }

      if (e.altKey) return;
      if (e.ctrlKey || e.metaKey) return;

      if (key === 'j' || key === 'J') {
        e.preventDefault();
        argsRef.current.onFocusJoin();
        return;
      }
      if (key === 'n' || key === 'N') {
        e.preventDefault();
        argsRef.current.onStartPulse();
        return;
      }
      if (key === 's' || key === 'S') {
        e.preventDefault();
        argsRef.current.onSchedule();
        return;
      }
      if (key === 'ArrowDown') {
        e.preventDefault();
        moveCursor(1);
        return;
      }
      if (key === 'ArrowUp') {
        e.preventDefault();
        moveCursor(-1);
        return;
      }
      if (key === 'Enter') {
        const target = cursorRowId;
        if (!target) return;
        const row = argsRef.current.rows.find((r) => r.id === target);
        if (!row) return;
        e.preventDefault();
        row.onPrimary();
        return;
      }
      if (key === 'm' || key === 'M') {
        const target = cursorRowId;
        if (!target) return;
        const row = argsRef.current.rows.find((r) => r.id === target);
        if (!row?.onSecondary) return;
        e.preventDefault();
        row.onSecondary();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [disabled, cursorRowId, moveCursor]);

  return { cursorRowId, setCursorRowId };
}
