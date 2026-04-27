/**
 * MessagesVoiceComposerPlugin
 *
 * Phase 5d.4 — voice recording for `MessagesSplitView`.
 *
 * Like Focus Mode (5d.3), the heavy lifting already exists in a
 * self-contained hook: `useVoxRecording`. It owns the MediaRecorder
 * lifecycle, AudioContext for the visualizer, quality presets, hold
 * vs tap mode, mic permission flow, and lifecycle cleanup.
 *
 * What was missing was a clean record-button + recording-banner pair
 * for the `Messages` surface that any consumer (custom message-input
 * renderer) can drop in. Legacy `Messages.tsx` rolled its own inline
 * `MediaRecorder` setup duplicating that hook (see Session 1's voice
 * cleanup fix). This plugin replaces that pattern.
 *
 * Two exports:
 *   - <RecordButton ... />   — small inline button to start/stop a recording
 *   - <RecordingBanner ... /> — red "Recording… 0:42 [Stop & Send]" banner
 *
 * Both share state via the same `useVoxRecording` instance; the
 * consumer composes them however the surface needs them.
 *
 * Wiring example (inside a custom `renderMessageInput`):
 *
 *   const composer = useMessagesVoiceComposer({
 *     onRecordingComplete: async (blob, sec) => {
 *       await pulseService.sendVoxMessage(recipientId, blob, sec);
 *     },
 *   });
 *
 *   return (
 *     <>
 *       {composer.isRecording && <composer.RecordingBanner />}
 *       <input ... />
 *       <composer.RecordButton size="lg" />
 *     </>
 *   );
 */

import React, { useCallback, useMemo } from 'react';
import { Mic, X } from 'lucide-react';
import { useVoxRecording, type RecordingData } from '../../hooks/useVoxRecording';

interface UseMessagesVoiceComposerOptions {
  /** Called with the finished recording. The host typically uploads it
   *  to storage and sends a voice message. */
  onRecordingComplete: (blob: Blob, durationSeconds: number) => Promise<void> | void;
  /** Called when something fails (mic permission denied, MediaRecorder
   *  not supported, etc.). */
  onError?: (err: Error) => void;
  /** Maximum recording duration in seconds. Defaults to 5 minutes —
   *  a sane upper bound for a voice message in a chat surface. */
  maxDurationSeconds?: number;
}

interface MessagesVoiceComposerHandle {
  /** True while recording is in progress. */
  isRecording: boolean;
  /** Current recording length in seconds. */
  duration: number;
  /** Imperative start (e.g. for keyboard shortcuts). */
  startRecording: () => Promise<void>;
  /** Imperative stop — finalizes and triggers `onRecordingComplete`. */
  stopRecording: () => void;
  /** Imperative cancel — discards the in-progress recording without sending. */
  cancelRecording: () => void;
  /** The record-button component (start/stop). */
  RecordButton: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string; title?: string }>;
  /** The recording-active banner (red, with stop & cancel actions). */
  RecordingBanner: React.FC<{ className?: string }>;
}

/**
 * Hook variant — returns the imperative API + ready-to-render
 * `RecordButton` and `RecordingBanner` components bound to a single
 * underlying recorder instance. Use when the consumer wants to
 * compose the button and banner separately in their own layout.
 */
export function useMessagesVoiceComposer(
  options: UseMessagesVoiceComposerOptions,
): MessagesVoiceComposerHandle {
  const { onRecordingComplete, onError, maxDurationSeconds = 300 } = options;

  const handleComplete = useCallback(
    async (data: RecordingData) => {
      try {
        await onRecordingComplete(data.blob, data.duration);
      } catch (err) {
        onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [onRecordingComplete, onError],
  );

  const recorder = useVoxRecording({
    qualityPreset: 'voice_hd',
    maxDuration: maxDurationSeconds,
    onRecordingComplete: handleComplete,
  });

  const isRecording = recorder.state === 'recording';

  const RecordButton = useMemo<MessagesVoiceComposerHandle['RecordButton']>(
    () => ({ size = 'md', className = '', title }) => {
      const dimension =
        size === 'sm' ? 'w-8 h-8 sm:w-9 sm:h-9'
        : size === 'lg' ? 'w-12 h-12'
        : 'w-10 h-10';
      const iconSize =
        size === 'sm' ? 'w-3.5 h-3.5'
        : size === 'lg' ? 'w-5 h-5'
        : 'w-4 h-4';

      const handleClick = () => {
        if (isRecording) recorder.stopRecording();
        else void recorder.startRecording();
      };

      return (
        <button
          type="button"
          onClick={handleClick}
          aria-pressed={isRecording}
          aria-label={isRecording ? 'Stop recording' : 'Start voice recording'}
          title={title ?? (isRecording ? 'Stop & send' : 'Record voice message')}
          className={`${dimension} rounded-lg flex items-center justify-center transition flex-shrink-0 ${
            isRecording
              ? 'bg-red-500 text-white animate-pulse'
              : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-rose-500'
          } ${className}`}
        >
          <Mic className={iconSize} />
        </button>
      );
    },
    [isRecording, recorder],
  );

  const RecordingBanner = useMemo<MessagesVoiceComposerHandle['RecordingBanner']>(
    () => ({ className = '' }) => {
      if (!isRecording) return null;

      const minutes = Math.floor(recorder.duration / 60);
      const seconds = Math.floor(recorder.duration % 60);
      const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

      return (
        <div
          className={`bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-lg flex items-center justify-between animate-slide-up ${className}`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm text-red-700 dark:text-red-300 font-medium">
              Recording… {timeStr}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => recorder.cancelRecording()}
              className="px-2.5 py-1 text-xs text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md transition flex items-center gap-1"
              aria-label="Cancel recording"
              title="Cancel"
            >
              <X className="w-3 h-3" /> Cancel
            </button>
            <button
              type="button"
              onClick={() => recorder.stopRecording()}
              className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition"
            >
              Stop &amp; Send
            </button>
          </div>
        </div>
      );
    },
    [isRecording, recorder],
  );

  return {
    isRecording,
    duration: recorder.duration,
    startRecording: recorder.startRecording,
    stopRecording: recorder.stopRecording,
    cancelRecording: recorder.cancelRecording,
    RecordButton,
    RecordingBanner,
  };
}

/**
 * Component variant — pre-composed banner-above-button layout for
 * surfaces that want a drop-in voice-input affordance without
 * customizing the layout. Mostly useful as a standalone
 * `renderMessageInput` for prototypes; production surfaces typically
 * want the hook variant for tighter composition with their own input.
 */
export const MessagesVoiceComposerPlugin: React.FC<UseMessagesVoiceComposerOptions> = (
  options,
) => {
  const composer = useMessagesVoiceComposer(options);
  return (
    <div className="flex flex-col gap-2">
      {composer.isRecording && <composer.RecordingBanner />}
      <div className="flex justify-end">
        <composer.RecordButton size="lg" />
      </div>
    </div>
  );
};

export default MessagesVoiceComposerPlugin;
