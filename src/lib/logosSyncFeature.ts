/**
 * Single source of truth for whether the Logos Vision sync is enabled.
 *
 * The toggle lives in Settings → Features & Labs (Integrations) and is persisted
 * by FeatureContext under the `pulse_feature_flags` localStorage key. React code
 * should read it reactively via `useFeatures().features.logosVisionSync`; this
 * helper exists for the NON-React service modules (the send-side hooks in
 * pulseService / voxModeService land in P3) that gate the Pulse→Logos POST and
 * can't call a hook.
 *
 * Default is OFF — no Pulse→Logos sync fires until the user explicitly enables it.
 * Privileged Logos access runs server-side (server.js /api/logos/*); this flag
 * only decides whether the client bothers to POST.
 */

export const LOGOS_SYNC_FEATURE_KEY = 'logosVisionSync';
const FLAGS_STORAGE_KEY = 'pulse_feature_flags';

export function isLogosSyncEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(FLAGS_STORAGE_KEY);
    if (!raw) return false; // default OFF before FeatureContext has persisted
    const flags = JSON.parse(raw) as Record<string, unknown> | null;
    return flags?.[LOGOS_SYNC_FEATURE_KEY] === true;
  } catch {
    return false;
  }
}
