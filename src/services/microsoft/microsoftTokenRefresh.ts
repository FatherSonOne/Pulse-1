/**
 * Shared Microsoft (Azure / Graph) provider-token refresh.
 *
 * Mirror of google/googleTokenRefresh.ts. Supabase hands over the Microsoft
 * `provider_token` once at sign-in and never refreshes it — that is the app's
 * job, and it MUST happen server-side because the Azure refresh_token grant
 * requires the app's `client_secret` (the same app Supabase's azure provider is
 * configured with). The Pulse Express backend (server.js →
 * /api/microsoft/refresh-token) holds the secret and does the exchange.
 *
 * Pass the session's `provider_refresh_token` when you still have it. When it is
 * absent — Supabase drops it from the session after its first JWT refresh — call
 * with no argument: the backend falls back to the per-user refresh token it
 * persisted at sign-in (see user_microsoft_tokens / server.js). Azure rotates
 * refresh tokens on every grant, so the backend persists the rotated token.
 *
 * Returns the fresh access token, or null when no token can be obtained (caller
 * treats this as "not connected"). Throws MicrosoftReauthRequiredError when
 * Azure reports the grant is dead (invalid_grant) so the UI can prompt a
 * reconnect.
 */

import { supabase } from '../supabase';
import { BACKEND_URL } from '../../config/backend';

export class MicrosoftReauthRequiredError extends Error {
  readonly requiresReauth = true;
  readonly isSessionExpired = true;
  readonly code: string;

  constructor(
    message = 'Your Microsoft session has expired. Please reconnect your Microsoft account.',
    code = 'MICROSOFT_SESSION_EXPIRED'
  ) {
    super(message);
    this.name = 'MicrosoftReauthRequiredError';
    this.code = code;
  }
}

export interface MicrosoftTokenResult {
  accessToken: string;
  /** Seconds until expiry, as reported by Azure (typically 3600/4500). */
  expiresIn: number | null;
}

/**
 * Refresh and return the full token result (access token + expiry). Most callers
 * want {@link refreshMicrosoftProviderToken} which returns just the string.
 *
 * @param refreshToken The Microsoft provider_refresh_token if available; omit to
 *   let the backend use the user's stored token.
 * @param reauthCode  Overrides the `code` on a thrown MicrosoftReauthRequiredError
 *   so per-service surfaces keep their existing error code (e.g. contacts uses
 *   MICROSOFT_CONTACTS_SESSION_EXPIRED).
 */
export async function refreshMicrosoftProviderTokenResult(
  refreshToken?: string | null,
  reauthCode = 'MICROSOFT_SESSION_EXPIRED'
): Promise<MicrosoftTokenResult | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return null;
  }

  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}/api/microsoft/refresh-token`, {
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
    console.warn('[MicrosoftToken] Backend refresh request failed:', err);
    return null;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({} as Record<string, unknown>));
    if (errorData.requiresReauth || errorData.code === 'INVALID_GRANT') {
      throw new MicrosoftReauthRequiredError(undefined, reauthCode);
    }
    console.warn('[MicrosoftToken] Backend refresh failed:', errorData);
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
export async function refreshMicrosoftProviderToken(
  refreshToken?: string | null,
  reauthCode = 'MICROSOFT_SESSION_EXPIRED'
): Promise<string | null> {
  const result = await refreshMicrosoftProviderTokenResult(refreshToken, reauthCode);
  return result?.accessToken ?? null;
}

/**
 * Persist the user's Microsoft provider_refresh_token to the backend so it
 * survives Supabase dropping it from the session. Call on SIGNED_IN when the
 * active provider is azure and the token is present. Best-effort: failures are
 * logged, not thrown — a missed store just means a future refresh falls back to
 * the session token if it is still there.
 */
export async function storeMicrosoftRefreshToken(refreshToken: string): Promise<void> {
  if (!refreshToken) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    await fetch(`${BACKEND_URL}/api/microsoft/store-refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch (err) {
    console.warn('[MicrosoftToken] Failed to persist refresh token (non-fatal):', err);
  }
}
