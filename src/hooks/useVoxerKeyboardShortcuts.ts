// useVoxerKeyboardShortcuts - Global keyboard shortcuts for Voxer
// Provides Space for record, Escape for back, 1-7 for modes, Ctrl+D/A/S for actions

import { useEffect, useRef } from 'react';
import { VoxMode } from '../services/voxer/voxModeTypes';

export interface VoxerShortcutHandlers {
  onToggleRecording?: () => void;
  onStopRecording?: () => void;
  onGoBack?: () => void;
  onSwitchMode?: (mode: VoxMode | 'classic') => void;
  onDownload?: () => void;
  onArchive?: () => void;
  onSummarize?: () => void;
  onShowHelp?: () => void;
}

export const VOXER_SHORTCUTS = {
  Space: 'Toggle recording (when not in text input)',
  Escape: 'Stop recording / Go back',
  '1': 'Switch to Classic Voxer',
  '2': 'Switch to Pulse Radio',
  '3': 'Switch to Voice Threads',
  '4': 'Switch to Team Vox',
  '5': 'Switch to Vox Notes',
  '6': 'Switch to Quick Vox',
  '7': 'Switch to Vox Drop',
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

export function useVoxerKeyboardShortcuts(
  handlers: VoxerShortcutHandlers,
  enabled: boolean = true
) {
  // Store handlers in a ref so the event listener is never stale and never
  // needs to be removed/re-added on every render (which caused browser
  // select-all to fire during the brief gap between removal and re-addition).
  const handlersRef = useRef<VoxerShortcutHandlers>(handlers);
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

      // Number keys - Switch modes (1-8)
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

export default useVoxerKeyboardShortcuts;
