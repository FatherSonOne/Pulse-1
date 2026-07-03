// useVoxCaptureSettings — bridge the persisted Audio I/O settings into the
// shape useVoxRecording expects.
//
// The problem this closes: AudioIOSettings.tsx writes mic device, quality
// preset, and EC/NS/AGC toggles to settingsService, but every recorder hard-
// codes `{ qualityPreset: 'voice_hd' }` and never reads them — so the whole
// "Control Room" panel drives nothing. This hook reads the settings once and
// returns the option object the canonical recorder feeds to useVoxRecording,
// so what the user picks in settings is what actually gets captured.
//
// Async by nature (settingsService.getAll caches in memory but the first read
// may hydrate from storage). It resolves well before the user hits record, so
// capture always sees resolved settings; until then it returns the HD default
// so a very-early record still works rather than throwing.

import { useEffect, useState } from 'react';
import { settingsService } from '../services/settingsService';
import type { AudioQualityPreset } from './useVoxRecording';

export interface VoxCaptureSettings {
  /** Preset key selected in Audio I/O settings (sampleRate/bitrate/channel). */
  qualityPreset: 'voice_hd' | 'voice_balanced' | 'voice_low';
  /** Explicit input device, or undefined for the OS default. */
  deviceId?: string;
  /** EC/NS/AGC toggles layered over the preset — the user's real choices. */
  customAudioConstraints: Partial<AudioQualityPreset>;
  /** True once settings have loaded from storage (before this, HD default). */
  loaded: boolean;
}

const HD_DEFAULT: VoxCaptureSettings = {
  qualityPreset: 'voice_hd',
  deviceId: undefined,
  customAudioConstraints: {},
  loaded: false,
};

export function useVoxCaptureSettings(): VoxCaptureSettings {
  const [value, setValue] = useState<VoxCaptureSettings>(HD_DEFAULT);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await settingsService.getAll();
        if (cancelled) return;
        setValue({
          qualityPreset: s.voxAudioQuality || 'voice_hd',
          // Empty string means "OS default" — leave deviceId unset so we don't
          // pin an `{ exact: '' }` constraint that would fail acquisition.
          deviceId: s.voxMicrophoneDeviceId || undefined,
          // Only the processing toggles override the preset; sampleRate /
          // channelCount / bitrate stay preset-driven.
          customAudioConstraints: {
            echoCancellation: s.voxEchoCancellation ?? true,
            noiseSuppression: s.voxNoiseReduction ?? false,
            autoGainControl: s.voxAutoGainControl ?? false,
          },
          loaded: true,
        });
      } catch {
        // Settings unreadable (private mode / quota) — HD default already set,
        // just mark loaded so callers stop waiting.
        if (!cancelled) setValue((v) => ({ ...v, loaded: true }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return value;
}

export default useVoxCaptureSettings;
