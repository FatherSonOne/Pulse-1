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

export interface SlackUserSendResult {
  ok: boolean;
  /** The IM channel the message landed in (chat.postMessage result). */
  channel?: string;
  /** The Slack message ts — used to tag the local row + echo-dedup inbound (P3). */
  ts?: string;
  /** The shadow auth.users id minted for the recipient (the local row's recipient_id). */
  shadowUserId?: string | null;
  /** The transport='slack' conversation id the local outbound row belongs to. */
  conversationId?: string | null;
  /** The operator's Slack team id (from the stored grant). */
  teamId?: string | null;
  /** Error code when ok=false (RECONNECT_REQUIRED, NOT_CONNECTED, SLACK_ERROR, …). */
  code?: string;
  error?: string;
}

/**
 * Send a 1:1 DM to a Slack user AS THE OPERATOR (send-as-you, P2). The xoxp- user
 * token is injected server-side and never touches the browser. Pass the recipient's
 * Slack user id (contacts.slack_user_id) or an already-open DM channel id; email +
 * displayName seed the shadow/conversation identity. On success the server mints the
 * shadow recipient + the slack conversation and returns shadowUserId/conversationId,
 * which the caller uses to persist the local outbound row via pulseService.sendMessage.
 * A RECONNECT_REQUIRED code means the stored grant died and the user must reconnect.
 */
export async function sendSlackUserMessage(params: {
  slackUserId?: string;
  channel?: string;
  text: string;
  email?: string | null;
  displayName?: string | null;
}): Promise<SlackUserSendResult> {
  try {
    const headers = await authHeaders();
    if (!headers) return { ok: false, code: 'UNAUTHENTICATED', error: 'Not signed in' };
    const res = await fetch(`${BACKEND_URL}/api/slack/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return { ok: false, code: data.code || 'SEND_FAILED', error: data.error || `HTTP ${res.status}` };
    }
    return {
      ok: true,
      channel: data.channel,
      ts: data.ts,
      shadowUserId: data.shadowUserId ?? null,
      conversationId: data.conversationId ?? null,
      teamId: data.teamId ?? null,
    };
  } catch (error) {
    return { ok: false, code: 'NETWORK', error: error instanceof Error ? error.message : 'Network error' };
  }
}

/**
 * Slack→native graduation (P5 client half). Given a slack thread's verified counterpart
 * email, ask the DB whether that person is a real Pulse user (so the thread can flip to a
 * native DM). Returns the matching Pulse auth-user id, or null if there's no unambiguous
 * match / the caller doesn't hold that email as a contact (the resolver is oracle-guarded).
 * Read-only; safe to call on every slack-thread open.
 */
export async function resolveGraduationCandidate(email: string | null | undefined): Promise<string | null> {
  const trimmed = (email ?? '').trim();
  if (!trimmed) return null;
  try {
    const { data, error } = await supabase.rpc('resolve_pulse_user_by_email', { p_email: trimmed });
    if (error) return null;
    return (data as string | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * Flip a transport='slack' thread to a native Pulse DM. The DB derives the real counterpart
 * from the conversation's verified external_email (never client-supplied) and does a
 * conditional MERGE: CASE A flips in place (returns the SAME id); CASE B merges into an
 * existing native thread and deletes the shadow (returns the surviving NATIVE id, which
 * DIFFERS from the shadow id — callers must re-point the active thread to it).
 * Returns { ok, conversationId } where conversationId is the surviving thread.
 */
export async function graduateSlackConversation(
  shadowConversationId: string
): Promise<{ ok: boolean; conversationId?: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('graduate_slack_conversation', {
      p_shadow_conversation_id: shadowConversationId,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, conversationId: (data as string | null) ?? shadowConversationId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Graduation failed' };
  }
}

export interface SlackStartConversationResult {
  ok: boolean;
  /** The transport='slack' conversation id to open in Messages. */
  conversationId?: string;
  slackUserId?: string;
  displayName?: string | null;
  email?: string | null;
  /** Error code when ok=false (NOT_ON_SLACK, NOT_CONNECTED, RECONNECT_REQUIRED, …). */
  code?: string;
  error?: string;
}

/**
 * Start (or fetch) a 1:1 Slack thread to message someone AS YOU, without sending yet — the
 * Messages "New Slack message" front-door. Pass an email (resolved to a Slack user server-side
 * via the operator's token) or a known slackUserId. The server mints the shadow recipient + the
 * slack conversation and returns conversationId, which the caller opens in Messages.
 */
export async function startSlackUserConversation(params: {
  email?: string;
  slackUserId?: string;
  displayName?: string;
}): Promise<SlackStartConversationResult> {
  try {
    const headers = await authHeaders();
    if (!headers) return { ok: false, code: 'UNAUTHENTICATED', error: 'Not signed in' };
    const res = await fetch(`${BACKEND_URL}/api/slack/conversation`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return { ok: false, code: data.code || 'FAILED', error: data.error || `HTTP ${res.status}` };
    }
    return {
      ok: true,
      conversationId: data.conversationId,
      slackUserId: data.slackUserId,
      displayName: data.displayName ?? null,
      email: data.email ?? null,
    };
  } catch (error) {
    return { ok: false, code: 'NETWORK', error: error instanceof Error ? error.message : 'Network error' };
  }
}
