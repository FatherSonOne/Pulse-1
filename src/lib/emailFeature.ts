/**
 * Single source of truth for whether the Email section is enabled.
 *
 * The toggle lives in Settings → Features & Labs and is persisted by
 * FeatureContext under the `pulse_feature_flags` localStorage key. React code
 * should read it reactively via `useFeatures().features.emailEnabled`; this
 * helper exists for the NON-React modules (gmailService, emailSyncService) that
 * need to gate Gmail fetches/token use and can't call a hook.
 *
 * Default is OFF — Email is presented as "feature not available" until the user
 * explicitly turns it on for testing/development.
 */

export const EMAIL_FEATURE_KEY = 'emailEnabled';
const FLAGS_STORAGE_KEY = 'pulse_feature_flags';

export function isEmailEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(FLAGS_STORAGE_KEY);
    if (!raw) return false; // default OFF before FeatureContext has persisted
    const flags = JSON.parse(raw) as Record<string, unknown> | null;
    return flags?.[EMAIL_FEATURE_KEY] === true;
  } catch {
    return false;
  }
}

/**
 * Thrown by the Gmail token getter when Email is turned off, so any caller that
 * reaches for the Gmail token is hard-stopped. Carries the same `code` shape the
 * email surfaces already branch on; callers catch it and degrade to "off".
 */
export class EmailDisabledError extends Error {
  readonly code = 'EMAIL_DISABLED';
  constructor() {
    super('Email is turned off in Settings → Features & Labs.');
    this.name = 'EmailDisabledError';
  }
}
