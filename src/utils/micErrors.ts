// micErrors — classify a getUserMedia / microphone-acquisition failure into an
// actionable, environment-aware message.
//
// Why this exists: a denied microphone behaves differently in the Pulse desktop
// app (Electron) than on the web. On the web the browser's address-bar site
// permission can re-grant it; in Electron that prompt is gone — the OS privacy
// settings own the grant, so a generic "Could not access microphone" toast
// leaves desktop users stuck with no idea how to fix it. This returns copy that
// points at the right place for the current environment, and distinguishes a
// permission denial (recoverable by the user) from no-device / device-busy.
//
// Detection matches the repo's canonical Electron check (window.electronAPI,
// see Settings.tsx / authService.ts).
//
// describeMicError stays pure (no toast import) so surfaces that render their
// own UI (e.g. ClassicMode's persistent banner) can classify without pulling
// in react-hot-toast. toastMicError is the convenience for fire-and-forget
// call sites that just need a transient, actionable message.

import toast from 'react-hot-toast';

const isElectron = (): boolean =>
  typeof window !== 'undefined' && !!(window as any).electronAPI;

const isMac = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const uaPlatform = (navigator as any).userAgentData?.platform as string | undefined;
  if (uaPlatform) return uaPlatform === 'macOS';
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
};

export interface MicErrorInfo {
  /** Short headline, e.g. "Microphone blocked". */
  title: string;
  /** One-line actionable detail, tailored to env (Electron vs web, macOS vs Windows). */
  detail: string;
  /** True when the cause is a permission denial (vs no device / in use). */
  isPermission: boolean;
}

export function describeMicError(error: unknown): MicErrorInfo {
  const name = (error as { name?: string } | null | undefined)?.name;

  // Permission denied or the prompt was dismissed; SecurityError covers a
  // non-secure context (no https) which presents the same way to the user.
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    if (isElectron()) {
      const where = isMac()
        ? 'System Settings → Privacy & Security → Microphone'
        : 'Windows Settings → Privacy & security → Microphone';
      return {
        title: 'Microphone blocked',
        detail: `Pulse needs microphone access. Turn it on for the Pulse desktop app in ${where}, then try again.`,
        isPermission: true,
      };
    }
    return {
      title: 'Microphone blocked',
      detail:
        'Microphone access is blocked. Allow it for this site from your browser’s address-bar permissions, then try again.',
      isPermission: true,
    };
  }

  // No input device available.
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return {
      title: 'No microphone found',
      detail: 'No microphone is connected. Plug one in (or check your input device) and try again.',
      isPermission: false,
    };
  }

  // Device is busy or the OS/hardware couldn't start the stream.
  if (name === 'NotReadableError' || name === 'AbortError') {
    return {
      title: 'Microphone unavailable',
      detail:
        'Your microphone is in use by another app, or the system couldn’t start it. Close anything else using it and try again.',
      isPermission: false,
    };
  }

  return {
    title: 'Could not access microphone',
    detail: 'Something went wrong reaching your microphone. Check your input device and try again.',
    isPermission: false,
  };
}

/**
 * Classify + surface a mic failure as a toast. For fire-and-forget recorders
 * that only need a transient message (no persistent banner). Permission
 * denials get a longer duration since the fix lives outside the app (OS /
 * browser settings). Returns the classification for callers that also want it.
 *
 * Usage: `startRecording().catch(toastMicError)`.
 */
export function toastMicError(error: unknown): MicErrorInfo {
  const info = describeMicError(error);
  toast.error(info.detail, { duration: info.isPermission ? 8000 : 5000 });
  return info;
}
