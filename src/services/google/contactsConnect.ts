/**
 * Google Contacts connect flow (separate owner-only grant).
 *
 * Mirrors the Gmail scope-split: Contacts-from-a-different-account is NOT granted
 * at login. It comes from a separate OAuth grant (reusing the private Gmail
 * Testing client with the contacts.readonly scope + its own redirect URI). These
 * helpers drive connect/disconnect/status against the backend's
 * /api/google-contacts/* routes. The backend holds the client secret and stores
 * the refresh token in public.user_google_contacts_tokens — nothing sensitive
 * touches the browser.
 *
 * This is DISTINCT from the login Google grant that googleContactsService uses by
 * default (session provider_token + contacts.readonly granted at login). Use this
 * only to import from an account OTHER than the Pulse login.
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

export interface ContactsConnectStatus {
  /** A separate Contacts grant is stored for this user. */
  connected: boolean;
  /** The server has the Contacts OAuth client configured (GOOGLE_CONTACTS_OAUTH_*). */
  configured: boolean;
}

export async function getContactsConnectStatus(): Promise<ContactsConnectStatus> {
  try {
    const headers = await authHeaders();
    if (!headers) return { connected: false, configured: false };
    const res = await fetch(`${BACKEND_URL}/api/google-contacts/status`, { headers });
    if (!res.ok) return { connected: false, configured: false };
    const data = await res.json();
    return { connected: !!data.connected, configured: !!data.configured };
  } catch {
    // Backend unreachable (e.g. server.js not running locally) → treat as not connected.
    return { connected: false, configured: false };
  }
}

/**
 * Redirect the browser to Google's consent screen for the separate Contacts
 * grant. The server forces prompt=select_account so the user can pick a
 * different account than their login. Returns false if it couldn't start.
 */
export async function startContactsConnect(): Promise<boolean> {
  try {
    const headers = await authHeaders();
    if (!headers) return false;
    const res = await fetch(`${BACKEND_URL}/api/google-contacts/auth/url`, { headers });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data.url) return false;
    window.location.href = data.url;
    return true;
  } catch {
    return false;
  }
}

export async function disconnectContacts(): Promise<boolean> {
  try {
    const headers = await authHeaders();
    if (!headers) return false;
    const res = await fetch(`${BACKEND_URL}/api/google-contacts/disconnect`, { method: 'DELETE', headers });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Mint a fresh access token for the separate Contacts grant (via the backend,
 * which holds the refresh token). Returns null if not connected / not configured
 * / backend down. Consumers (googleContactsService) use this to read the People
 * API as the OTHER account instead of the login session token.
 */
export async function getContactsAccessToken(): Promise<string | null> {
  try {
    const headers = await authHeaders();
    if (!headers) return null;
    const res = await fetch(`${BACKEND_URL}/api/google-contacts/refresh-token`, {
      method: 'POST',
      headers,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.access_token === 'string' ? data.access_token : null;
  } catch {
    return null;
  }
}
