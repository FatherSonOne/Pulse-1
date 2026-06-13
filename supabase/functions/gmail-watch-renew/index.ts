// Supabase Edge Function: gmail-watch-renew
//
// Email push (renewal leg). Gmail users.watch expires in <=7 days and must be
// re-issued. This is the cron-driven renewer: pg_cron POSTs here daily with the
// vault `cron_secret`, and for each stored Gmail grant it refreshes the access
// token and re-arms users.watch on the configured Pub/Sub topic, persisting the
// watch cursor (historyId) + expiration into email_sync_state.
//
// Architecture note: the original plan put this on the Express backend (server.js),
// but server.js has no CRON_SECRET auth wiring, so hosting it there meant adding
// new auth surface to the deployed backend. An edge function gets CRON_SECRET from
// Deno.env for free (same pattern as check-search-alerts / send-push) and does the
// token-refresh + users.watch via plain fetch, so no googleapis SDK and no backend
// change. See docs/EMAIL_PUSH_PLAN_HANDOFF_2026-06-13.md.
//
// Auth: requires CRON_SECRET via `Authorization: Bearer <secret>` or `x-cron-secret`.
// verify_jwt MUST be false (cron sends no Supabase JWT).
//
// Required edge secrets: CRON_SECRET, GMAIL_OAUTH_CLIENT_ID, GMAIL_OAUTH_CLIENT_SECRET
// (the private owner-only Gmail client — same creds the Render backend uses), and
// GMAIL_PUSH_TOPIC (projects/<gcp>/topics/<name>). Standard SUPABASE_URL +
// SUPABASE_SERVICE_ROLE_KEY are always present.
//
// Dormant-safe: with GMAIL_PUSH_TOPIC unset it returns { skipped: 'no topic' } and
// does nothing. It never throws on a single grant's failure — it logs and moves on.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET')
const GMAIL_CLIENT_ID = Deno.env.get('GMAIL_OAUTH_CLIENT_ID')
const GMAIL_CLIENT_SECRET = Deno.env.get('GMAIL_OAUTH_CLIENT_SECRET')
const GMAIL_PUSH_TOPIC = Deno.env.get('GMAIL_PUSH_TOPIC')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-cron-secret, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    console.error('[gmail-watch-renew] token refresh failed:', res.status, (err as { error?: string }).error)
    return null
  }
  const data = await res.json()
  return typeof data.access_token === 'string' ? data.access_token : null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // ── Auth: internal cron secret ──────────────────────────────────────────
  if (!CRON_SECRET) return json({ error: 'CRON_SECRET not configured' }, 500)
  const provided =
    req.headers.get('x-cron-secret') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (provided !== CRON_SECRET) return json({ error: 'Unauthorized' }, 401)

  // ── Config guards (dormant-safe) ────────────────────────────────────────
  if (!GMAIL_PUSH_TOPIC) return json({ skipped: 'GMAIL_PUSH_TOPIC not configured', renewed: 0 })
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
    return json({ error: 'GMAIL_OAUTH_CLIENT_ID/SECRET not configured' }, 500)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Single-owner today: loop all stored grants (usually one). Multi-user later
  // resolves per-grant; the data model (one email_sync_state row per user) holds.
  const { data: grants, error: grantErr } = await supabase
    .from('user_gmail_tokens')
    .select('user_id, refresh_token')

  if (grantErr) return json({ error: grantErr.message }, 500)

  let renewed = 0
  let failed = 0

  for (const grant of (grants ?? [])) {
    try {
      if (!grant.refresh_token) { failed++; continue }
      const accessToken = await refreshAccessToken(grant.refresh_token as string)
      if (!accessToken) { failed++; continue }

      const watchRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicName: GMAIL_PUSH_TOPIC,
          labelIds: ['INBOX'],
          labelFilterBehavior: 'include',
        }),
      })
      if (!watchRes.ok) {
        const err = await watchRes.text()
        console.error(`[gmail-watch-renew] users.watch failed for ${grant.user_id}:`, watchRes.status, err)
        failed++
        continue
      }
      const watch = await watchRes.json() as { historyId?: string; expiration?: string }

      await supabase.from('email_sync_state').upsert({
        user_id: grant.user_id,
        watch_topic: GMAIL_PUSH_TOPIC,
        watch_history_id: watch.historyId ?? null,
        watch_expiration: watch.expiration ? new Date(Number(watch.expiration)).toISOString() : null,
        watch_last_renewed: new Date().toISOString(),
      }, { onConflict: 'user_id' })

      renewed++
      console.log(`[gmail-watch-renew] watched ${grant.user_id} -> historyId ${watch.historyId}, expires ${watch.expiration}`)
    } catch (err) {
      failed++
      console.error('[gmail-watch-renew] error for grant:', (err as Error)?.message ?? err)
    }
  }

  console.log(`[gmail-watch-renew] renewed=${renewed} failed=${failed} grants=${grants?.length ?? 0}`)
  return json({ renewed, failed, grants: grants?.length ?? 0 })
})
