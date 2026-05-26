// Supabase Edge Function: send-push
//
// Dispatches Web Push (VAPID, RFC 8291 aes128gcm) notifications to the stored
// browser/PWA subscriptions in `push_subscriptions`. This is the server-side
// SENDER that was previously missing — the client subscribes and the service
// worker (`public/sw-notifications.js`) handles the `push` event, but nothing
// actually delivered a push to the push service until this function.
//
// Invocation: POST. Server-to-server only (called by other edge functions such
// as `check-search-alerts`, or by an admin/cron job). NOT meant to be called
// from the browser.
//
// Auth — REQUIRES a shared secret. Read `PUSH_DISPATCH_SECRET` and compare it
// to the `Authorization: Bearer <secret>` or `x-push-secret` header. Without
// this guard an open dispatch endpoint could be abused to blast notifications
// to every subscribed device (spam + push-service reputation damage). This
// mirrors the `CRON_SECRET` rationale in `check-search-alerts`.
//
// VAPID config comes from secrets (NEVER hardcoded):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (e.g. mailto:alerts@…)
// See ./README.md for the human-owned key generation + deploy steps.
//
// Body: {
//   user_id?: string,
//   user_ids?: string[],
//   notification: { title, body, icon?, badge?, tag?, priority?, actionUrl?,
//                   data?, actions?, image? }
// }
// The `notification` shape is emitted verbatim as the push payload and matches
// what the service worker's `push` handler expects.
//
// Returns 200 { sent, failed, deactivated, total }.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// VAPID keypair + contact subject. Generated via `npx web-push generate-vapid-keys`
// and set as Supabase secrets — never committed. See README.md.
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')

// Required to invoke. Without it, anyone with the URL could blast notifications
// to every subscribed device. Mirrors CRON_SECRET in check-search-alerts.
const PUSH_DISPATCH_SECRET = Deno.env.get('PUSH_DISPATCH_SECRET')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-push-secret, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface NotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  priority?: string
  actionUrl?: string
  data?: Record<string, unknown>
  actions?: unknown[]
  image?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // ── Auth — require the shared dispatch secret ───────────────────────────
  if (!PUSH_DISPATCH_SECRET) {
    return json({ error: 'PUSH_DISPATCH_SECRET not configured' }, 500)
  }
  const providedSecret =
    req.headers.get('x-push-secret') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (providedSecret !== PUSH_DISPATCH_SECRET) {
    return json({ error: 'Unauthorized' }, 401)
  }

  // ── VAPID config must be present ────────────────────────────────────────
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    return json(
      { error: 'VAPID not configured — set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT' },
      500,
    )
  }

  // ── Parse + validate body ───────────────────────────────────────────────
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { user_id, user_ids, notification } = body as {
    user_id?: string
    user_ids?: string[]
    notification?: NotificationPayload
  }

  const ids = Array.isArray(user_ids)
    ? user_ids.filter((v) => typeof v === 'string' && v.length > 0)
    : (typeof user_id === 'string' && user_id.length > 0 ? [user_id] : [])

  if (ids.length === 0) {
    return json({ error: 'Provide user_id (string) or user_ids (string[])' }, 400)
  }
  if (!notification || typeof notification.title !== 'string' || typeof notification.body !== 'string') {
    return json({ error: 'notification.title and notification.body are required' }, 400)
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // ── Load active subscriptions for the target users ──────────────────────
  const { data: subscriptions, error: fetchError } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', ids)
    .eq('is_active', true)

  if (fetchError) {
    console.error('[send-push] Failed to fetch subscriptions:', fetchError)
    return json({ error: fetchError.message }, 500)
  }

  const total = subscriptions?.length ?? 0
  let sent = 0
  let failed = 0
  let deactivated = 0

  // The push payload is emitted verbatim — the service worker parses this JSON.
  const payloadString = JSON.stringify(notification)

  for (const row of (subscriptions ?? [])) {
    const sub = {
      endpoint: row.endpoint,
      keys: {
        p256dh: row.p256dh_key,
        auth: row.auth_key,
      },
    }

    try {
      await webpush.sendNotification(sub, payloadString)
      sent++

      // Mark this subscription as recently used.
      await supabase
        .from('push_subscriptions')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', row.id)
    } catch (err) {
      // web-push throws a WebPushError carrying the push-service statusCode.
      const statusCode = (err as { statusCode?: number })?.statusCode
      if (statusCode === 404 || statusCode === 410) {
        // Subscription is gone (expired/unsubscribed) — standard hygiene is to
        // deactivate it so we stop trying. Not a "failure" we surface to caller.
        await supabase
          .from('push_subscriptions')
          .update({ is_active: false })
          .eq('id', row.id)
        deactivated++
        console.log(`[send-push] Deactivated gone subscription ${row.id} (status ${statusCode})`)
      } else {
        failed++
        console.error(`[send-push] Failed to send to subscription ${row.id}:`, statusCode ?? '', (err as Error)?.message ?? err)
      }
    }
  }

  console.log(`[send-push] sent=${sent} failed=${failed} deactivated=${deactivated} total=${total} users=${ids.length}`)
  return json({ sent, failed, deactivated, total })
})
