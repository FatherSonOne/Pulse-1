// useRelayKeyboardShortcuts - Global keyboard shortcuts for Relay
// Provides Space for record, Escape for back, T/D/C/B/N/L for top-level
// RelayView switching, and Ctrl+D/A/S for row-level actions when consumers
// wire them. The Messages umbrella collapsed into Direct/Channel/Broadcast
// in the 2026-04 brand sweep — the M shortcut was retired alongside it.

import { useEffect, useRef } from 'react';

/** Top-level Relay view (6 peers). Mirrors Relay.tsx's local RelayView. */
export type RelayShortcutView =
  | 'triage'
  | 'direct'
  | 'channel'
  | 'broadcast'
  | 'notes'
  | 'live';

export interface RelayShortcutHandlers {
  onToggleRecording?: () => void;
  onStopRecording?: () => void;
  onGoBack?: () => void;
  /** Top-level RelayView switch (T/D/C/B/N/L). 'triage' is the home view. */
  onSwitchView?: (view: RelayShortcutView) => void;
  onDownload?: () => void;
  onArchive?: () => void;
  onSummarize?: () => void;
  onShowHelp?: () => void;
}

export const RELAY_SHORTCUTS = {
  Space: 'Start or stop recording',
  Escape: 'Stop recording, close modal, or go back',
  T: 'Triage view (all)',
  D: 'Direct (1:1 messages)',
  C: 'Channel (team)',
  B: 'Broadcast',
  N: 'Notes view',
  L: 'Live view',
  'Ctrl+D': 'Download selected messages',
  'Ctrl+A': 'Archive selected messages',
  'Ctrl+S': 'Summarize conversation with AI',
  '?': 'Show keyboard shortcuts',
} as const;

const VIEW_MAP: Record<string, RelayShortcutView> = {
  t: 'triage',
  d: 'direct',
  c: 'channel',
  b: 'broadcast',
  n: 'notes',
  l: 'live',
};

export function useRelayKeyboardShortcuts(
  handlers: RelayShortcutHandlers,
  enabled: boolean = true
) {
  // Store handlers in a ref so the event listener is never stale and never
  // needs to be removed/re-added on every render (which caused browser
  // select-all to fire during the brief gap between removal and re-addition).
  const handlersRef = useRef<RelayShortcutHandlers>(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const h = handlersRef.current;
      const target = event.target as HTMLElement;
      const isInInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      const isContentEditable = target.isContentEditable;

      // Don't trigger shortcuts when typing in inputs (except Escape)
      if ((isInInput || isContentEditable) && event.key !== 'Escape') {
        return;
      }

      // Space - Toggle recording (only when not in input)
      if (event.key === ' ' && !isInInput && !isContentEditable) {
        event.preventDefault();
        h.onToggleRecording?.();
        return;
      }

      // Escape - Stop recording / Go back
      if (event.key === 'Escape') {
        event.preventDefault();
        if (h.onStopRecording) {
          h.onStopRecording();
        } else {
          h.onGoBack?.();
        }
        return;
      }

      // ? - Show help
      if (event.key === '?' && !isInInput && !isContentEditable) {
        event.preventDefault();
        h.onShowHelp?.();
        return;
      }

      // Top-level RelayView letter shortcuts (T/M/N/L). Only fire when no
      // modifier is held — Ctrl+D/A/S below need to win, and Cmd/Alt combos
      // are reserved for the OS / browser.
      if (
        !isInInput &&
        !isContentEditable &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        const viewKey = event.key.toLowerCase();
        if (VIEW_MAP[viewKey] !== undefined) {
          event.preventDefault();
          h.onSwitchView?.(VIEW_MAP[viewKey]);
          return;
        }
      }

      // Ctrl/Cmd shortcuts deliberately mirror browser globals (Save / Select
      // All / Bookmark) — only override when the consumer has actually wired
      // a handler. Without a handler, fall through to the browser default
      // instead of swallowing the chord. Ctrl+A additionally requires a
      // non-input target so we don't break Select All inside text fields.
      const isCtrl = event.ctrlKey || event.metaKey;

      if (isCtrl && event.key === 'd' && h.onDownload) {
        event.preventDefault();
        h.onDownload();
        return;
      }

      if (
        isCtrl &&
        event.key === 'a' &&
        !isInInput &&
        !isContentEditable &&
        h.onArchive
      ) {
        event.preventDefault();
        h.onArchive();
        return;
      }

      if (isCtrl && event.key === 's' && h.onSummarize) {
        event.preventDefault();
        h.onSummarize();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true); // capture phase for reliable preventDefault
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [enabled]); // only re-attach when enabled changes, NOT when handlers change
}

export default useRelayKeyboardShortcuts;
