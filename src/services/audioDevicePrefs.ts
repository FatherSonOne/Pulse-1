/**
 * Persisted audio I/O device choices for the realtime voice agent
 * (War Room Live + Summit). Stored in localStorage so the user's mic/speaker
 * selection survives reloads and is read by `RealtimeVoiceSession.connect()`
 * when it acquires the mic and routes playback.
 *
 * Empty string / missing → "system default" (no explicit deviceId, the browser
 * picks). We never throw on a stale deviceId here; `getUserMedia` with an
 * `{ exact }` constraint will reject if the device vanished, and the caller
 * falls back to the default.
 */

const INPUT_KEY = 'pulse_voice_input_device_v1';
const OUTPUT_KEY = 'pulse_voice_output_device_v1';

const read = (key: string): string | undefined => {
  try {
    return localStorage.getItem(key) || undefined;
  } catch {
    return undefined; // private mode / disabled storage
  }
};

const write = (key: string, id?: string): void => {
  try {
    if (id) localStorage.setItem(key, id);
    else localStorage.removeItem(key);
  } catch {
    /* non-fatal */
  }
};

export const getPreferredInputDevice = (): string | undefined => read(INPUT_KEY);
export const getPreferredOutputDevice = (): string | undefined => read(OUTPUT_KEY);
export const setPreferredInputDevice = (id?: string): void => write(INPUT_KEY, id);
export const setPreferredOutputDevice = (id?: string): void => write(OUTPUT_KEY, id);
