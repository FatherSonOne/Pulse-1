/**
 * useAudioInputDevice — microphone (audioinput) device selection.
 *
 * Added 2026-06-01 for the Message Settings "Audio" section
 * (docs/MESSAGE_SETTINGS_HANDOFF_2026-06-01.md §4).
 *
 * Responsibilities:
 * - Enumerate `audioinput` devices via `navigator.mediaDevices.enumerateDevices()`.
 *   Device *labels* are only exposed by the browser after a `getUserMedia`
 *   permission grant, so enumeration is gated behind `requestPermission()`.
 * - Persist the chosen `deviceId` to localStorage (`pulse_audio_input_device`),
 *   mirroring the simple-localStorage pattern used for composer drafts.
 * - Re-enumerate on the `devicechange` event.
 *
 * IMPORTANT LIMITATION (surfaced in the UI): the Web Speech API always records
 * from the OS-default microphone and cannot target a chosen `deviceId`. The
 * selected device is therefore only honored by the OpenAI/getUserMedia capture
 * path (see `useVoiceToText` `inputDeviceId`). This hook does not switch
 * providers; it only stores the preference.
 */

import { useCallback, useEffect, useState } from 'react';

export const AUDIO_INPUT_DEVICE_KEY = 'pulse_audio_input_device';

const CHANGE_EVENT = 'pulse-audio-input-device-change';

export type AudioPermissionState = 'unknown' | 'prompt' | 'granted' | 'denied';

export interface AudioInputDevice {
  deviceId: string;
  label: string;
}

/** Read the persisted input device id ('' / null = OS default). */
export function getStoredAudioInputDeviceId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(AUDIO_INPUT_DEVICE_KEY) || null;
  } catch {
    return null;
  }
}

/** Persist the input device id (null/'' clears it back to OS default). */
export function setStoredAudioInputDeviceId(deviceId: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (deviceId) window.localStorage.setItem(AUDIO_INPUT_DEVICE_KEY, deviceId);
    else window.localStorage.removeItem(AUDIO_INPUT_DEVICE_KEY);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: deviceId }));
  } catch {
    /* ignore */
  }
}

/**
 * Lightweight reactive read of the persisted input deviceId, without the
 * enumeration / permission machinery. For capture consumers (e.g. the composer
 * voice button) that only need to know which mic to record from.
 */
export function useStoredAudioInputDeviceId(): string {
  const [id, setId] = useState<string>(() => getStoredAudioInputDeviceId() || '');
  useEffect(() => {
    const onExternal = (e: Event) => setId((e as CustomEvent<string | null>).detail || '');
    const onStorage = (e: StorageEvent) => {
      if (e.key === AUDIO_INPUT_DEVICE_KEY) setId(e.newValue || '');
    };
    window.addEventListener(CHANGE_EVENT, onExternal);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onExternal);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return id;
}

function mediaDevicesSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.enumerateDevices === 'function'
  );
}

export interface UseAudioInputDeviceReturn {
  /** Whether device enumeration is available in this browser. */
  supported: boolean;
  /** Available audioinput devices (labels populated only after permission). */
  devices: AudioInputDevice[];
  /** Currently selected deviceId, or '' for OS default. */
  selectedDeviceId: string;
  /** Persist a new selection ('' = OS default). */
  selectDevice: (deviceId: string) => void;
  /** Current mic-permission state. */
  permissionState: AudioPermissionState;
  /** Prompt for mic access so device labels become readable, then enumerate. */
  requestPermission: () => Promise<void>;
  /** Re-run enumeration (no permission prompt). */
  refresh: () => Promise<void>;
}

export function useAudioInputDevice(active = true): UseAudioInputDeviceReturn {
  const supported = mediaDevicesSupported();
  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(
    () => getStoredAudioInputDeviceId() || '',
  );
  const [permissionState, setPermissionState] = useState<AudioPermissionState>('unknown');

  const enumerate = useCallback(async () => {
    if (!supported) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const inputs = all
        .filter((d) => d.kind === 'audioinput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          // Label is '' until permission is granted — fall back to a generic name.
          label: d.label || `Microphone ${i + 1}`,
        }));
      setDevices(inputs);
      // If any label is non-empty, permission has been granted at least once.
      if (inputs.some((d) => d.label && !/^Microphone \d+$/.test(d.label))) {
        setPermissionState('granted');
      }
    } catch {
      /* ignore enumeration failures */
    }
  }, [supported]);

  const requestPermission = useCallback(async () => {
    if (!supported || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      setPermissionState('denied');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Immediately release — we only needed the grant so labels become readable.
      stream.getTracks().forEach((t) => t.stop());
      setPermissionState('granted');
      await enumerate();
    } catch {
      setPermissionState('denied');
    }
  }, [supported, enumerate]);

  const selectDevice = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId);
    setStoredAudioInputDeviceId(deviceId || null);
  }, []);

  // Probe the Permissions API (where available) + enumerate on mount.
  useEffect(() => {
    if (!active || !supported) return;
    let cancelled = false;

    (async () => {
      try {
        // navigator.permissions.query for 'microphone' is Chromium-only.
        const perms = (navigator as Navigator & {
          permissions?: { query: (d: { name: PermissionName }) => Promise<PermissionStatus> };
        }).permissions;
        if (perms?.query) {
          const status = await perms.query({ name: 'microphone' as PermissionName });
          if (!cancelled) {
            setPermissionState(status.state as AudioPermissionState);
          }
        }
      } catch {
        /* Permissions API unsupported — leave as 'unknown'. */
      }
      if (!cancelled) await enumerate();
    })();

    return () => {
      cancelled = true;
    };
  }, [active, supported, enumerate]);

  // Re-enumerate when devices are plugged/unplugged.
  useEffect(() => {
    if (!active || !supported) return;
    const onChange = () => void enumerate();
    navigator.mediaDevices.addEventListener?.('devicechange', onChange);
    return () => navigator.mediaDevices.removeEventListener?.('devicechange', onChange);
  }, [active, supported, enumerate]);

  // Keep multiple hook instances (panel + composer) in sync.
  useEffect(() => {
    const onExternal = (e: Event) => {
      const detail = (e as CustomEvent<string | null>).detail;
      setSelectedDeviceId(detail || '');
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === AUDIO_INPUT_DEVICE_KEY) setSelectedDeviceId(e.newValue || '');
    };
    window.addEventListener(CHANGE_EVENT, onExternal);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onExternal);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return {
    supported,
    devices,
    selectedDeviceId,
    selectDevice,
    permissionState,
    requestPermission,
    refresh: enumerate,
  };
}
