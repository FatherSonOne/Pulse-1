// Supabase Edge Function: gmail-push-receiver
//
// Email push (delivery leg). Google Pub/Sub POSTs here when the owner's Gmail
// mailbox changes (set up by gmail-watch-renew's users.watch). This function
// fetches what's new via history.list and dispatches a Web Push through the
// existing send-push function, so the owner is notified of new mail with the
// tab closed. Mirrors the inbound-DM push shipped in
// supabase/migrations/20260613000000_push_on_pulse_message.sql.
//
// AUTH (single-owner pragmatic choice, NOT Google OIDC):
// the endpoint is public (verify_jwt=false, Pub/Sub sends no Supabase JWT), so
// it self-guards with a shared PUSH_RECEIVER_SECRET that must match the token
// embedded in the Pub/Sub push-subscription endpoint URL (?secret=...) or an
// x-receiver-secret header. For a single-owner mailbox this is secure enough and
// is verifiable now (401 without it). The more robust path is Google OIDC token
// verification (verify the RS256-signed token's audience + issuer via Google's
// JWKS); switch to that if/when this goes multi-tenant. Documented in
// docs/EMAIL_PUSH_PLAN_HANDOFF_2026-06-13.md.
//
// Required edge secrets: PUSH_RECEIVER_SECRET, CRON_SECRET (to call send-push),
// GMAIL_OAUTH_CLIENT_ID, GMAIL_OAUTH_CLIENT_SECRET. SUPABASE_URL +
// SUPABASE_SERVICE_ROLE_KEY are always present.
//
// Pub/Sub semantics: at-least-once + the watch fires on ANY history change. We
// dedup by only advancing past the stored history cursor and only notifying on
// INBOX messagesAdded (excluding SENT/DRAFT). Always returns 200 so Pub/Sub does
// not retry-storm.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const PUSH_RECEIVER_SECRET = Deno.env.get('PUSH_RECEIVER_SECRET')
const CRON_SECRET = Deno.env.get('CRON_SECRET')
const GMAIL_CLIENT_ID = Deno.env.get('GMAIL_OAUTH_CLIENT_ID')
const GMAIL_CLIENT_SECRET = Deno.env.get('GMAIL_OAUTH_CLIENT_SECRET')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-receiver-secret, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID!,
      client_secret: GMAIL_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return typeof data.access_token === 'string' ? data.access_token : null
}

async function gmailGet(path: string, token: string): Promise<any | null> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    console.error('[gmail-push-receiver] gmail GET failed:', path, res.status)
    return null
  }
  return res.json()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // ── Auth: shared receiver secret (URL ?secret= or x-receiver-secret header) ──
  if (!PUSH_RECEIVER_SECRET) return json({ error: 'PUSH_RECEIVER_SECRET not configured' }, 500)
  const url = new URL(req.url)
  const provided = url.searchParams.get('secret') || req.headers.get('x-receiver-secret')
  if (provided !== PUSH_RECEIVER_SECRET) return json({ error: 'Unauthorized' }, 401)

  // ── Decode the Pub/Sub push envelope: { message: { data: base64({emailAddress, historyId}) } } ──
  const body = await req.json().catch(() => null)
  const dataB64 = body?.message?.data
  if (!dataB64) return json({ ok: true, skipped: 'no message data' }) // ack malformed; do not retry
  let notif: { emailAddress?: string; historyId?: string }
  try { notif = JSON.parse(atob(dataB64)) } catch { return json({ ok: true, skipped: 'bad data' }) }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    // Single-owner: resolve the one grant. (Multi-user later maps emailAddress -> user_id.)
    const { data: grant } = await supabase
      .from('user_gmail_tokens')
      .select('user_id, refresh_token')
      .limit(1)
      .maybeSingle()
    if (!grant?.refresh_token) return json({ ok: true, skipped: 'no grant' })

    const { data: syncRow } = await supabase
      .from('email_sync_state')
      .select('history_id, watch_history_id')
      .eq('user_id', grant.user_id)
      .maybeSingle()

    const startHistoryId = syncRow?.history_id || syncRow?.watch_history_id
    // Dedup: if Pub/Sub re-delivers an older/equal historyId, skip (ack 200).
    if (startHistoryId && notif.historyId && BigInt(notif.historyId) <= BigInt(startHistoryId)) {
      return json({ ok: true, skipped: 'already processed', historyId: notif.historyId })
    }
    if (!startHistoryId) {
      // No cursor yet — record the floor and wait for the next event (can't list without a start).
      if (notif.historyId) {
        await supabase.from('email_sync_state')
          .upsert({ user_id: grant.user_id, history_id: notif.historyId }, { onConflict: 'user_id' })
      }
      return json({ ok: true, skipped: 'no start cursor, floor recorded' })
    }

    const accessToken = await refreshAccessToken(grant.refresh_token as string)
    if (!accessToken) return json({ ok: true, skipped: 'token refresh failed' })

    const history = await gmailGet(
      `users/me/history?startHistoryId=${startHistoryId}&historyTypes=messageAdded&labelId=INBOX`,
      accessToken,
    )
    const newIds: string[] = []
    for (const h of (history?.history ?? [])) {
      for (const added of (h.messagesAdded ?? [])) {
        const m = added.message
        const labels: string[] = m?.labelIds ?? []
        if (labels.includes('INBOX') && !labels.includes('SENT') && !labels.includes('DRAFT')) {
          newIds.push(m.id)
        }
      }
    }

    // Advance the cursor regardless, so we don't re-scan this window.
    const newCursor = history?.historyId || notif.historyId
    if (newCursor) {
      await supabase.from('email_sync_state')
        .upsert({ user_id: grant.user_id, history_id: newCursor }, { onConflict: 'user_id' })
    }

    if (newIds.length === 0) return json({ ok: true, new: 0 })

    // Build a preview from the newest message (From + Subject).
    let title = 'New email'
    let preview = newIds.length > 1 ? `${newIds.length} new emails` : 'You have new mail'
    const newest = await gmailGet(
      `users/me/messages/${newIds[newIds.length - 1]}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
      accessToken,
    )
    if (newest?.payload?.headers) {
      const h = (name: string) =>
        newest.payload.headers.find((x: { name: string; value: string }) => x.name.toLowerCase() === name)?.value
      const from = h('from')
      const subject = h('subject')
      if (from) title = from.replace(/\s*<[^>]+>$/, '').trim() || 'New email'
      if (subject) preview = newIds.length > 1 ? `${subject} (+${newIds.length - 1} more)` : subject
    }

    // Dispatch via send-push (accepts CRON_SECRET since the 2026-06-13 widening).
    if (CRON_SECRET) {
      await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-push-secret': CRON_SECRET },
        body: JSON.stringify({
          user_id: grant.user_id,
          notification: {
            title,
            body: preview,
            tag: 'email-new',
            priority: 'normal',
            actionUrl: '/?view=email',
            data: { type: 'email', count: newIds.length },
          },
        }),
      }).catch((e) => console.error('[gmail-push-receiver] send-push failed:', e?.message ?? e))
    }

    console.log(`[gmail-push-receiver] pushed for ${grant.user_id}: new=${newIds.length}`)
    return json({ ok: true, new: newIds.length })
  } catch (err) {
    // Always ack so Pub/Sub does not retry-storm; log for the live-verify pass.
    console.error('[gmail-push-receiver] error:', (err as Error)?.message ?? err)
    return json({ ok: true, error: 'handled' })
  }
})
