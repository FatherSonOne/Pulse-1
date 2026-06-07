// Supabase Edge Function: slack-events
// Receives Slack Events API callbacks (message.im) for Slack-grounded Messages (P3)
// and lands incoming DMs as pulse_messages rows that broadcast live to the operator's
// open thread (both pulse_* tables are in supabase_realtime).
//
// Slack app setup (single-tenant, L1):
//   Event Subscriptions → Request URL:
//     https://ucaeuszgoihoyrvhewxk.supabase.co/functions/v1/slack-events
//   Subscribe to events on behalf of users (USER token):  message.im
//     (a BOT-token message.im only delivers DMs to the bot, not the operator's DMs)
//   Reinstall the app so the new event subscription takes effect.
//
// Secrets required (Supabase edge env):
//   SLACK_SIGNING_SECRET        — the Slack app "Signing Secret" (same value used on Render)
//   SUPABASE_URL                — auto-injected
//   SUPABASE_SERVICE_ROLE_KEY   — auto-injected
//
// MUST be deployed with verify_jwt = false (Slack sends no Supabase JWT); auth is the
// Slack v0 request signature instead. See supabase/config.toml [functions.slack-events].
//
// Security model mirrors billing-webhook: read the RAW body BEFORE parsing, reconstruct
// the signing basestring, HMAC-SHA256 it, constant-time compare to X-Slack-Signature,
// reject stale timestamps (replay window). Scope: docs/SLACK_MESSAGES_GROUNDING_SCOPE_2026-06-06.md §9.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SLACK_SIGNING_SECRET = Deno.env.get('SLACK_SIGNING_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-slack-signature, x-slack-request-timestamp',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// HMAC-SHA256 → lowercase hex (Web Crypto; no node deps).
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Constant-time string compare (no early return on first mismatch). Slack signatures
// are fixed length ('v0=' + 64 hex), so the length check leaks nothing useful.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// Verify the Slack v0 request signature over the RAW body. Returns true only on a
// valid, in-window signature.
async function verifySlackSignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
): Promise<boolean> {
  if (!SLACK_SIGNING_SECRET || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  // Replay window: reject anything more than 5 minutes from now (either direction).
  if (Math.abs(Date.now() / 1000 - ts) > 60 * 5) return false;
  const expected = 'v0=' + (await hmacSha256Hex(SLACK_SIGNING_SECRET, `v0:${timestamp}:${rawBody}`));
  return timingSafeEqual(expected, signature);
}

// Best-effort sender profile lookup via the operator's user token (users:read[.email]).
// Bounded so it can never hold up the 3s Slack ack; on any failure we proceed unenriched.
async function fetchSlackUserProfile(
  userToken: string,
  slackUserId: string,
): Promise<{ displayName: string | null; email: string | null }> {
  try {
    const res = await fetch(`https://slack.com/api/users.info?user=${encodeURIComponent(slackUserId)}`, {
      headers: { Authorization: `Bearer ${userToken}` },
      signal: AbortSignal.timeout(2500),
    });
    const data = await res.json();
    if (!data.ok) {
      // A dead operator token degrades enrichment (names fall back to the slack id) but
      // never blocks ingest. The send path is what surfaces a reconnect prompt; flag it
      // distinctly here so the cause is visible in logs.
      if (data.error === 'invalid_auth' || data.error === 'token_revoked' || data.error === 'account_inactive') {
        console.warn('[slack-events] enrichment token dead (' + data.error + ') — inbound names will be unenriched until reconnect');
      }
      return { displayName: null, email: null };
    }
    const u = data.user ?? {};
    const p = u.profile ?? {};
    return {
      displayName: p.real_name || u.real_name || p.display_name || u.name || null,
      email: p.email || null,
    };
  } catch (_e) {
    return { displayName: null, email: null };
  }
}

// The actual ingest — deferred off the request path so we can ack Slack within its 3s
// window (contract §9: "always 200 fast; heavy work after ack"). Resolves the owner,
// applies the own-message echo filter, enriches (skipped on retries), and writes via the
// atomic service-role RPC. Self-contained error handling: a rejection here never reaches
// the (already-sent) response.
async function processInboundEvent(event: any, teamId: string, isRetry: boolean): Promise<void> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Resolve the owner. Single-tenant L1 = one operator per workspace; order by
    // created_at so a (schema-permitted) second connection is at least deterministic.
    const { data: tokenRow } = await supabase
      .from('user_slack_tokens')
      .select('user_id, slack_user_id, access_token')
      .eq('slack_team_id', teamId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!tokenRow?.user_id) return; // no connected operator for this workspace

    // Echo filter, part 2: skip the operator's OWN messages (incl. our send-as-you
    // echoes, which post as the operator and come back as message.im events).
    if (event.user === tokenRow.slack_user_id) return;

    // Best-effort enrichment (usable name + email for graduation). Skipped on Slack
    // retries — the row almost certainly already landed, so don't re-pay the users.info
    // round-trip; the slack_ts de-dup makes the ingest itself a no-op anyway.
    const { displayName, email } = !isRetry && tokenRow.access_token
      ? await fetchSlackUserProfile(tokenRow.access_token as string, event.user)
      : { displayName: null, email: null };

    const { data: msgId, error } = await supabase.rpc('ingest_slack_inbound_message', {
      p_owner_pulse_id: tokenRow.user_id,
      p_team_id: teamId,
      p_sender_slack_id: event.user,
      p_text: event.text ?? '',
      p_slack_ts: event.ts,
      p_slack_channel: event.channel ?? null,
      p_email: email,
      p_display_name: displayName,
    });

    if (error) console.error('[slack-events] ingest error:', error.message);
    else if (msgId) console.log('[slack-events] ingested inbound DM', event.ts, '->', msgId);
    else console.log('[slack-events] duplicate slack_ts skipped', event.ts);
  } catch (err) {
    console.error('[slack-events] processInboundEvent error:', (err as Error).message);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // 1) Raw body BEFORE parse — Slack signs the exact bytes.
  const rawBody = await req.text();
  const timestamp = req.headers.get('x-slack-request-timestamp');
  const signature = req.headers.get('x-slack-signature');

  const ok = await verifySlackSignature(rawBody, timestamp, signature);
  if (!ok) {
    console.error('[slack-events] signature verification failed');
    return json({ error: 'invalid signature' }, 401);
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  // 2) URL verification handshake (sent when you set the Request URL). Signed, so it
  //    only reaches here after the check above.
  if (payload.type === 'url_verification') {
    return json({ challenge: payload.challenge });
  }

  if (payload.type !== 'event_callback' || !payload.event) {
    return json({ ok: true });
  }

  const event = payload.event;
  const teamId: string | undefined = payload.team_id;

  // Cheap synchronous filters — only 1:1 DMs in v1; skip non-message + edits/joins/bot
  // posts (echo filter, part 1). The channel_type/D-prefix check is fail-closed: a DM is
  // either channel_type='im' OR a 'D…' channel id; anything else is rejected (so a future
  // widening of the event subscription can't mis-ingest a channel post as a 1:1 DM).
  const isDm = event?.channel_type === 'im' || String(event?.channel ?? '').startsWith('D');
  if (
    event?.type !== 'message' || event.subtype || event.bot_id || !isDm ||
    !teamId || !event.user || !event.ts
  ) {
    return json({ ok: true });
  }

  // Ack within Slack's 3s window, then do the ingest off the request path. Falls back to
  // inline await when EdgeRuntime.waitUntil isn't present (local/older runtime).
  const isRetry = !!req.headers.get('x-slack-retry-num');
  const work = processInboundEvent(event, teamId, isRetry);
  const er = (globalThis as any).EdgeRuntime;
  if (er && typeof er.waitUntil === 'function') {
    er.waitUntil(work);
  } else {
    await work;
  }

  return json({ ok: true });
});
