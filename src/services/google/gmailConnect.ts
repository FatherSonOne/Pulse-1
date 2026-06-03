/**
 * Gmail connect flow (scope split — owner-only Gmail grant).
 *
 * After the scope split, Gmail is NOT granted at login; it comes from a separate
 * Gmail OAuth client (its own GCP project kept in Testing). These helpers drive
 * the connect/disconnect/status against the backend's /api/gmail/* routes. The
 * backend holds the Gmail client secret and stores the refresh token in
 * public.user_gmail_tokens — nothing sensitive touches the browser.
 */

import { supabase } from '../supabase';
import { BACKEND_URL } from '../../config/backend';

async function authHeaders(): Promise<Record<string, string> | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

export interface GmailConnectStatus {
  /** A Gmail grant is stored for this user. */
  connected: boolean;
  /** The server has the Gmail OAuth client configured (GMAIL_OAUTH_*). */
  configured: boolean;
}

export async function getGmailConnectStatus(): Promise<GmailConnectStatus> {
  try {
    const headers = await authHeaders();
    if (!headers) return { connected: false, configured: false };
    const res = await fetch(`${BACKEND_URL}/api/gmail/status`, { headers });
    if (!res.ok) return { connected: false, configured: false };
    const data = await res.json();
    return { connected: !!data.connected, configured: !!data.configured };
  } catch {
    // Backend unreachable (e.g. server.js not running locally) → treat as not connected.
    return { connected: false, configured: false };
  }
}

/**
 * Redirect the browser to Google's consent screen for the Gmail grant. Returns
 * false if it couldn't start (not authenticated, not configured, backend down).
 */
export async function startGmailConnect(): Promise<boolean> {
  try {
    const headers = await authHeaders();
    if (!headers) return false;
    const res = await fetch(`${BACKEND_URL}/api/gmail/auth/url`, { headers });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data.url) return false;
    window.location.href = data.url;
    return true;
  } catch {
    return false;
  }
}

export async function disconnectGmail(): Promise<boolean> {
  try {
    const headers = await authHeaders();
    if (!headers) return false;
    const res = await fetch(`${BACKEND_URL}/api/gmail/disconnect`, { method: 'DELETE', headers });
    return res.ok;
  } catch {
    return false;
  }
}
