// useRelayKeyboardShortcuts - Global keyboard shortcuts for Relay
// Provides Space for record, Escape for back, T/M/N/L for top-level RelayView
// switching (Triage/Messages/Notes/Live, Stage 2.1d.2), legacy 1–7 for VoxMode
// mode switches (kept until downstream consumers migrate), and Ctrl+D/A/S for
// row-level actions.

import { useEffect, useRef } from 'react';
import { VoxMode, RelayMode } from '../services/relay/voxModeTypes';

export interface RelayShortcutHandlers {
  onToggleRecording?: () => void;
  onStopRecording?: () => void;
  onGoBack?: () => void;
  /** Legacy VoxMode switch (1–7). Kept functional during the transition. */
  onSwitchMode?: (mode: VoxMode | 'classic') => void;
  /** New top-level RelayView switch (T/M/N/L). 'triage' is the placeholder home view. */
  onSwitchView?: (view: 'triage' | RelayMode) => void;
  onDownload?: () => void;
  onArchive?: () => void;
  onSummarize?: () => void;
  onShowHelp?: () => void;
}

export const RELAY_SHORTCUTS = {
  Space: 'Toggle recording (when not in text input)',
  Escape: 'Stop recording / Go back',
  T: 'Switch to Triage',
  M: 'Switch to Messages',
  N: 'Switch to Notes',
  L: 'Switch to Live',
  '1': 'Switch to Classic Voxer (legacy)',
  '2': 'Switch to Pulse Radio (legacy)',
  '3': 'Switch to Voice Threads (legacy)',
  '4': 'Switch to Team Vox (legacy)',
  '5': 'Switch to Vox Notes (legacy)',
  '6': 'Switch to Quick Vox (legacy)',
  '7': 'Switch to Vox Drop (legacy)',
  'Ctrl+D': 'Download selected',
  'Ctrl+A': 'Archive selected',
  'Ctrl+S': 'Summarize conversation (AI)',
  '?': 'Show keyboard shortcuts',
} as const;

const MODE_MAP: Record<string, VoxMode | 'classic'> = {
  '1': 'classic',
  '2': 'pulse_radio',
  '3': 'voice_threads',
  '4': 'team_vox',
  '5': 'vox_notes',
  '6': 'quick_vox',
  '7': 'vox_drop',
};

const VIEW_MAP: Record<string, 'triage' | RelayMode> = {
  t: 'triage',
  m: 'messages',
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

      // Number keys - Switch legacy VoxMode (1-7). Kept for downstream
      // consumers that haven't migrated to RelayMode yet.
      if (MODE_MAP[event.key] && !isInInput && !isContentEditable) {
        event.preventDefault();
        h.onSwitchMode?.(MODE_MAP[event.key]);
        return;
      }

      // Ctrl+D - Download
      if (event.ctrlKey && event.key === 'd') {
        event.preventDefault();
        h.onDownload?.();
        return;
      }

      // Ctrl+A - Archive (override default select all)
      if (event.ctrlKey && event.key === 'a' && !isInInput && !isContentEditable) {
        event.preventDefault();
        h.onArchive?.();
        return;
      }

      // Ctrl+S - Summarize (override default save)
      if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        h.onSummarize?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true); // capture phase for reliable preventDefault
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [enabled]); // only re-attach when enabled changes, NOT when handlers change
}

export default useRelayKeyboardShortcuts;
