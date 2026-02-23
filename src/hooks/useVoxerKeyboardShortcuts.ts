// useVoxerKeyboardShortcuts - Global keyboard shortcuts for Voxer
// Provides Space for record, Escape for back, 1-8 for modes, Ctrl+D/A/S for actions

import { useEffect } from 'react';
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
  '8': 'Switch to Video Vox',
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
  '8': 'video_vox',
};

export function useVoxerKeyboardShortcuts(
  handlers: VoxerShortcutHandlers,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
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
        handlers.onToggleRecording?.();
        return;
      }

      // Escape - Stop recording / Go back
      if (event.key === 'Escape') {
        event.preventDefault();
        if (handlers.onStopRecording) {
          handlers.onStopRecording();
        } else {
          handlers.onGoBack?.();
        }
        return;
      }

      // ? - Show help
      if (event.key === '?' && !isInInput && !isContentEditable) {
        event.preventDefault();
        handlers.onShowHelp?.();
        return;
      }

      // Number keys - Switch modes (1-8)
      if (MODE_MAP[event.key] && !isInInput && !isContentEditable) {
        event.preventDefault();
        handlers.onSwitchMode?.(MODE_MAP[event.key]);
        return;
      }

      // Ctrl+D - Download
      if (event.ctrlKey && event.key === 'd') {
        event.preventDefault();
        handlers.onDownload?.();
        return;
      }

      // Ctrl+A - Archive (override default select all)
      if (event.ctrlKey && event.key === 'a' && !isInInput && !isContentEditable) {
        event.preventDefault();
        handlers.onArchive?.();
        return;
      }

      // Ctrl+S - Summarize (override default save)
      if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        handlers.onSummarize?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers, enabled]);
}

export default useVoxerKeyboardShortcuts;
