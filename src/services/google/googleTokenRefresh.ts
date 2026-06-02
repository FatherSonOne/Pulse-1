/**
 * Shared Google provider-token refresh.
 *
 * Supabase hands over the Google `provider_token` once at sign-in and never
 * refreshes it — that is the app's job, and it MUST happen server-side because
 * Google requires the OAuth `client_secret` for the refresh_token grant on a
 * Web client (a client-side refresh with only `client_id` always 401s). The
 * Pulse Express backend (server.js → /api/google/refresh-token) holds the
 * secret and does the exchange.
 *
 * Pass the session's `provider_refresh_token` when you still have it. When it is
 * absent — Supabase drops it from the session after its first JWT refresh — call
 * with no argument: the backend falls back to the per-user refresh token it
 * persisted at sign-in (see user_google_tokens / server.js).
 *
 * Returns the fresh access token, or null when no token can be obtained (caller
 * treats this as "not connected"). Throws GoogleReauthRequiredError when Google
 * reports the grant is dead (invalid_grant) so the UI can prompt a reconnect —
 * the error carries the `requiresReauth`/`isSessionExpired` flags the existing
 * reconnect surfaces (EmailHybridClient, contacts wizard) already key on.
 */

import { supabase } from '../supabase';
import { BACKEND_URL } from '../../config/backend';

export class GoogleReauthRequiredError extends Error {
  readonly requiresReauth = true;
  readonly isSessionExpired = true;
  readonly code: string;

  constructor(
    message = 'Your Google session has expired. Please reconnect your Google account.',
    code = 'GOOGLE_SESSION_EXPIRED'
  ) {
    super(message);
    this.name = 'GoogleReauthRequiredError';
    this.code = code;
  }
}

export interface GoogleTokenResult {
  accessToken: string;
  /** Seconds until expiry, as reported by Google (typically 3600). */
  expiresIn: number | null;
}

/**
 * Refresh and return the full token result (access token + expiry). Most callers
 * want {@link refreshGoogleProviderToken} which returns just the string.
 *
 * @param refreshToken The Google provider_refresh_token if available; omit to
 *   let the backend use the user's stored token.
 * @param reauthCode  Overrides the `code` on a thrown GoogleReauthRequiredError
 *   so per-service surfaces keep their existing error code (e.g. contacts uses
 *   GOOGLE_CONTACTS_SESSION_EXPIRED).
 */
export async function refreshGoogleProviderTokenResult(
  refreshToken?: string | null,
  reauthCode = 'GOOGLE_SESSION_EXPIRED'
): Promise<GoogleTokenResult | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return null;
  }

  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}/api/google/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(refreshToken ? { refresh_token: refreshToken } : {}),
    });
  } catch (err) {
    // Backend unreachable (e.g. server.js not running locally). Treat as
    // "could not refresh" rather than "needs reauth".
    console.warn('[GoogleToken] Backend refresh request failed:', err);
    return null;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({} as Record<string, unknown>));
    if (errorData.requiresReauth || errorData.code === 'INVALID_GRANT') {
      throw new GoogleReauthRequiredError(undefined, reauthCode);
    }
    console.warn('[GoogleToken] Backend refresh failed:', errorData);
    return null;
  }

  const data = await response.json().catch(() => ({} as Record<string, unknown>));
  if (typeof data.access_token === 'string' && data.access_token) {
    return {
      accessToken: data.access_token,
      expiresIn: typeof data.expires_in === 'number' ? data.expires_in : null,
    };
  }
  return null;
}

/**
 * Convenience wrapper returning just the access token string (or null).
 */
export async function refreshGoogleProviderToken(
  refreshToken?: string | null,
  reauthCode = 'GOOGLE_SESSION_EXPIRED'
): Promise<string | null> {
  const result = await refreshGoogleProviderTokenResult(refreshToken, reauthCode);
  return result?.accessToken ?? null;
}

/**
 * Persist the user's Google provider_refresh_token to the backend so it survives
 * Supabase dropping it from the session. Call on SIGNED_IN, when the token is
 * guaranteed present (Pulse forces `prompt: consent` + offline access, so Google
 * returns a refresh token on every login). Best-effort: failures are logged, not
 * thrown — a missed store just means a future refresh falls back to the session
 * token if it is still there.
 */
export async function storeGoogleRefreshToken(refreshToken: string): Promise<void> {
  if (!refreshToken) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    await fetch(`${BACKEND_URL}/api/google/store-refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch (err) {
    console.warn('[GoogleToken] Failed to persist refresh token (non-fatal):', err);
  }
}
