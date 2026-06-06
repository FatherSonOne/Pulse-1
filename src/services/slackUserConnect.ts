/**
 * Slack USER-token connect flow (send-as-you + own-DM read) — P1 of
 * Slack-grounded Messages.
 *
 * Distinct from the Phase-8 BOT token (xoxb-, localStorage via src/lib/slackToken.ts)
 * which powers reads + Contacts send. This drives the connect/disconnect/status
 * against the backend's /api/slack/* user-OAuth routes. The backend holds the
 * Slack client secret and stores the xoxp- user token in public.user_slack_tokens
 * — nothing sensitive touches the browser. Mirrors src/services/google/gmailConnect.ts.
 */

import { supabase } from './supabase';
import { BACKEND_URL } from '../config/backend';

async function authHeaders(): Promise<Record<string, string> | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

export interface SlackUserConnectStatus {
  /** A Slack user-token grant is stored for this user. */
  connected: boolean;
  /** The server has the Slack OAuth client configured (SLACK_CLIENT_*). */
  configured: boolean;
  /** The connected Slack user id (authed_user.id), when known. */
  slackUserId: string | null;
  /** The connected Slack team/workspace id, when known. */
  teamId: string | null;
}

export async function getSlackUserConnectStatus(): Promise<SlackUserConnectStatus> {
  const fallback: SlackUserConnectStatus = { connected: false, configured: false, slackUserId: null, teamId: null };
  try {
    const headers = await authHeaders();
    if (!headers) return fallback;
    const res = await fetch(`${BACKEND_URL}/api/slack/status`, { headers });
    if (!res.ok) return fallback;
    const data = await res.json();
    return {
      connected: !!data.connected,
      configured: !!data.configured,
      slackUserId: data.slackUserId ?? null,
      teamId: data.teamId ?? null,
    };
  } catch {
    // Backend unreachable (e.g. server.js not running) → treat as not connected.
    return fallback;
  }
}

/**
 * Redirect the browser to Slack's consent screen for the user-token grant.
 * Returns false if it couldn't start (not authenticated, not configured, backend down).
 */
export async function startSlackUserConnect(): Promise<boolean> {
  try {
    const headers = await authHeaders();
    if (!headers) return false;
    const res = await fetch(`${BACKEND_URL}/api/slack/auth/url`, { headers });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data.url) return false;
    window.location.href = data.url;
    return true;
  } catch {
    return false;
  }
}

export async function disconnectSlackUser(): Promise<boolean> {
  try {
    const headers = await authHeaders();
    if (!headers) return false;
    const res = await fetch(`${BACKEND_URL}/api/slack/disconnect`, { method: 'DELETE', headers });
    return res.ok;
  } catch {
    return false;
  }
}
