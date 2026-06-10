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
//   Subscribe to BOT events (Integration C, channels):  message.channels, message.groups
//     (delivered to the bot for channels it is a member of; landed via a SEPARATE channel
//      branch + ingest_slack_channel_message RPC — the DM path below is left untouched)
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

// Integration C (channels): land a Slack channel message into the owner-scoped sibling store
// (slack_channel_threads / slack_channel_messages) via the service-role RPC. Mirror of
// processInboundEvent's shape — owner resolution, echo filter, bounded enrichment, atomic RPC —
// but routes to ingest_slack_channel_message (per-channel, N-author) instead of the DM ingest.
async function processChannelEvent(event: any, teamId: string, isRetry: boolean): Promise<void> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Resolve ALL connected operators for this workspace and fan the channel message out into each
    // one's owner-scoped mirror (P8 §2 multi-operator routing). Channel events are workspace-level
    // (one bot delivers a post once), so a single post must reach every connected operator — the
    // old limit(1) "oldest token" resolver mirrored to ONE login and the rest saw nothing. For a
    // single operator this loops exactly once = identical to the prior behavior; the per-operator
    // rows are owner-scoped so copies are expected, not duplicates. (DM path's analogous 3.2 gap is
    // tracked separately under slackMessagesGrounding and is intentionally NOT touched here.)
    const { data: tokenRows } = await supabase
      .from('user_slack_tokens')
      .select('user_id, slack_user_id, access_token')
      .eq('slack_team_id', teamId)
      .order('created_at', { ascending: true });

    const operators = tokenRows ?? [];
    if (operators.length === 0) return; // no connected operator for this workspace

    // Enrich the author's name/email ONCE (users.info is workspace-scoped, so any operator's token
    // resolves any member). Skipped on Slack retries. Prefer a NON-author operator's token; fall
    // back to the first available.
    const enrichTok = (operators.find((o) => o.slack_user_id !== event.user) ?? operators[0])?.access_token;
    const { displayName, email } = !isRetry && enrichTok
      ? await fetchSlackUserProfile(enrichTok as string, event.user)
      : { displayName: null, email: null };

    // channel_type 'group' = private channel; 'channel' = public.
    const isPrivate = event.channel_type === 'group';

    for (const op of operators) {
      // Per-operator echo filter: skip the post for the operator who AUTHORED it (P6 reply-as-you
      // already recorded their own outgoing row), but still mirror it for every OTHER operator —
      // one operator's post is another's inbound. Getting this per-operator is the crux of fan-out.
      if (event.user === op.slack_user_id) continue;

      const { data: msgId, error } = await supabase.rpc('ingest_slack_channel_message', {
        p_owner_pulse_id: op.user_id,
        p_team_id: teamId,
        p_slack_channel_id: event.channel,
        p_channel_name: null, // not in the event payload; resolved client-side from the bot token in P5
        p_is_private: isPrivate,
        p_sender_slack_id: event.user,
        p_text: event.text ?? '',
        p_slack_ts: event.ts,
        p_slack_thread_ts: event.thread_ts ?? null,
        p_email: email,
        p_display_name: displayName,
      });

      if (error) console.error('[slack-events] channel ingest error:', error.message);
      else if (msgId) console.log('[slack-events] ingested channel msg', event.ts, 'in', event.channel, '-> owner', op.user_id);
      else console.log('[slack-events] duplicate channel slack_ts skipped', event.ts, 'owner', op.user_id);
    }
  } catch (err) {
    console.error('[slack-events] processChannelEvent error:', (err as Error).message);
  }
}

// Integration C (channels): apply an EDIT or DELETE to an already-mirrored channel message
// (P8 §1.2). message_changed → UPDATE the row's content (edits keep the same slack_ts, so this is
// an in-place update, never a new row); message_deleted → soft-delete (stamp deleted_at, render as
// "message deleted"). Both are no-ops when the target isn't mirrored (e.g. edited/deleted before
// the bot joined). Owner resolution mirrors processChannelEvent; the service-role RPCs keep the
// (thread, slack_ts) dedup intact. Idempotent, so Slack retries are harmless (no isRetry needed).
async function processChannelEdit(event: any, teamId: string): Promise<void> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Fan the edit/delete out to every connected operator's mirror (P8 §2), mirroring the ingest
    // resolver. The RPCs no-op for any operator that doesn't have the message mirrored (e.g. the
    // author-operator, whose own posts aren't mirrored inbound), so looping all operators is safe
    // and self-correcting. One operator → loops once = identical to the prior limit(1) behavior.
    const { data: tokenRows } = await supabase
      .from('user_slack_tokens')
      .select('user_id')
      .eq('slack_team_id', teamId)
      .order('created_at', { ascending: true });
    const operators = tokenRows ?? [];
    if (operators.length === 0) return;

    const channel = event.channel;
    if (!channel) return;

    if (event.subtype === 'message_changed') {
      const edited = event.message;
      // The edited message keeps its original ts; ignore non-user/system edits.
      if (!edited?.ts || edited.subtype || edited.bot_id) return;
      for (const op of operators) {
        const { error } = await supabase.rpc('edit_slack_channel_message', {
          p_owner_pulse_id: op.user_id,
          p_team_id: teamId,
          p_slack_channel_id: channel,
          p_slack_ts: edited.ts,
          p_text: edited.text ?? '',
        });
        if (error) console.error('[slack-events] channel edit error:', error.message);
      }
      console.log('[slack-events] channel edit applied', edited.ts, 'in', channel, 'to', operators.length, 'operator(s)');
    } else if (event.subtype === 'message_deleted') {
      if (!event.deleted_ts) return;
      for (const op of operators) {
        const { error } = await supabase.rpc('tombstone_slack_channel_message', {
          p_owner_pulse_id: op.user_id,
          p_team_id: teamId,
          p_slack_channel_id: channel,
          p_slack_ts: event.deleted_ts,
        });
        if (error) console.error('[slack-events] channel delete error:', error.message);
      }
      console.log('[slack-events] channel delete applied', event.deleted_ts, 'in', channel, 'to', operators.length, 'operator(s)');
    }
  } catch (err) {
    console.error('[slack-events] processChannelEdit error:', (err as Error).message);
  }
}

// Integration C (channels): apply a REACTION add/remove to a mirrored channel message (P8 §1.3).
// reaction_added / reaction_removed are their OWN Slack event types (not 'message'), carrying
// item.{channel,ts} + reaction (emoji name) + user (reactor). Stored as a per-emoji SET of reactor
// ids in metadata.reactions via the service-role RPCs (idempotent — a retry can't double-count).
// Fans out across all operators (like the ingest/edit paths); the RPCs no-op when the reacted
// message isn't mirrored. No echo skip — a reaction is display-only, so the operator's own reaction
// is shown too.
async function processChannelReaction(event: any, teamId: string): Promise<void> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const item = event.item;
    if (!item || item.type !== 'message' || !item.channel || !item.ts) return;
    if (!event.reaction || !event.user) return;

    const { data: tokenRows } = await supabase
      .from('user_slack_tokens')
      .select('user_id')
      .eq('slack_team_id', teamId)
      .order('created_at', { ascending: true });
    const operators = tokenRows ?? [];
    if (operators.length === 0) return;

    const rpc = event.type === 'reaction_added'
      ? 'add_slack_channel_reaction'
      : 'remove_slack_channel_reaction';

    for (const op of operators) {
      const { error } = await supabase.rpc(rpc, {
        p_owner_pulse_id: op.user_id,
        p_team_id: teamId,
        p_slack_channel_id: item.channel,
        p_slack_ts: item.ts,
        p_emoji: event.reaction,
        p_reactor: event.user,
      });
      if (error) console.error('[slack-events] channel reaction error:', error.message);
    }
    console.log('[slack-events]', event.type, event.reaction, 'on', item.ts, 'in', item.channel, 'to', operators.length, 'operator(s)');
  } catch (err) {
    console.error('[slack-events] processChannelReaction error:', (err as Error).message);
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

  // Integration C (channels): handle message.channels / message.groups via a SEPARATE branch
  // BEFORE the DM gate, so the fail-closed DM logic below stays byte-for-byte intact. A channel
  // post (channel_type 'channel'|'group') never matches isDm, and a DM never matches isChannel,
  // so the two paths are disjoint. Same subtype/bot/echo discipline as the DM path.
  const isChannel = event?.channel_type === 'channel' || event?.channel_type === 'group';
  if (
    event?.type === 'message' && !event.subtype && !event.bot_id && isChannel &&
    teamId && event.user && event.ts
  ) {
    const isRetryC = !!req.headers.get('x-slack-retry-num');
    const workC = processChannelEvent(event, teamId, isRetryC);
    const erC = (globalThis as any).EdgeRuntime;
    if (erC && typeof erC.waitUntil === 'function') erC.waitUntil(workC);
    else await workC;
    return json({ ok: true });
  }

  // Integration C (channels): EDITS / DELETES (P8 §1.2). Explicit subtype branch — placed AFTER the
  // new-message channel branch (which requires !event.subtype) and BEFORE the DM gate, so all three
  // paths stay disjoint and the fail-closed discipline holds: ONLY these two subtypes are handled
  // here; any other subtype still falls through and is dropped. Channel-scoped via channel_type OR a
  // C/G channel id (subtype events reliably carry the channel id; a DM 'D…' id never matches /^[CG]/).
  const chId = String(event?.channel ?? '');
  const isChannelMut = isChannel || (/^[CG]/.test(chId) && event?.channel_type !== 'im');
  if (
    event?.type === 'message' && isChannelMut && teamId &&
    (event.subtype === 'message_changed' || event.subtype === 'message_deleted')
  ) {
    const workM = processChannelEdit(event, teamId);
    const erM = (globalThis as any).EdgeRuntime;
    if (erM && typeof erM.waitUntil === 'function') erM.waitUntil(workM);
    else await workM;
    return json({ ok: true });
  }

  // Integration C (channels): REACTIONS (P8 §1.3). reaction_added / reaction_removed are their OWN
  // event types (not 'message'), so they never matched any gate above. Channel-scoped via the
  // item.channel C/G prefix (a DM reaction's item.channel starts with 'D' and is ignored). Placed
  // before the DM gate; the DM gate requires type==='message' so reactions would otherwise be dropped.
  if (
    (event?.type === 'reaction_added' || event?.type === 'reaction_removed') &&
    teamId && event.item?.type === 'message' && /^[CG]/.test(String(event.item?.channel ?? ''))
  ) {
    const workR = processChannelReaction(event, teamId);
    const erR = (globalThis as any).EdgeRuntime;
    if (erR && typeof erR.waitUntil === 'function') erR.waitUntil(workR);
    else await workR;
    return json({ ok: true });
  }

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
