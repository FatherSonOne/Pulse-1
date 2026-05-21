// ============================================
// CONTACTS KEYBOARD SHORTCUTS
// Keyboard navigation for Contacts.
// Cmd/Ctrl+K: focus AI search
// 1/2: switch tabs (Today/People)
// Escape: close panels
// D: dismiss active card (Today feed)
// S: snooze active card (Today feed)
// ============================================

import { useEffect, useCallback } from 'react';

type ContactsMode = 'today' | 'people';

interface ContactsKeyboardOptions {
  activeMode: ContactsMode;
  onModeChange: (mode: ContactsMode) => void;
  onSearchFocus?: () => void;
  onEscape?: () => void;
  enabled?: boolean;
}

export function useContactsKeyboard({
  activeMode,
  onModeChange,
  onSearchFocus,
  onEscape,
  enabled = true,
}: ContactsKeyboardOptions): void {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    // Skip if focused in an input/textarea
    const target = e.target as HTMLElement;
    const isInput =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable;

    // Cmd/Ctrl+K — focus search (works even in inputs)
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      onSearchFocus?.();
      return;
    }

    if (isInput) return; // don't intercept other keys when typing

    // 1/2 — switch tabs
    if (e.key === '1') { e.preventDefault(); onModeChange('today');  return; }
    if (e.key === '2') { e.preventDefault(); onModeChange('people'); return; }

    // Escape — close panels
    if (e.key === 'Escape') { e.preventDefault(); onEscape?.(); return; }
  }, [enabled, onModeChange, onSearchFocus, onEscape]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// ==================== KEYBOARD SHORTCUT HINT ====================

/**
 * Short list of shortcuts shown in UI hints.
 */
export const KEYBOARD_SHORTCUTS = [
  { keys: ['⌘', 'K'],  label: 'Search contacts' },
  { keys: ['1'],        label: 'Today' },
  { keys: ['2'],        label: 'People' },
  { keys: ['Esc'],      label: 'Close panel' },
] as const;
