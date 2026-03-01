// Supabase Edge Function: Check Search Alerts
//
// Checks saved searches with alert_enabled=true that are due for re-running,
// executes each search, and sends email notifications via Resend when new
// results are found since the last alert.
//
// Intended to be invoked by pg_cron or a Supabase Scheduled Function.
// Cron schedule example: every hour → '0 * * * *'

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const APP_URL = Deno.env.get('APP_URL') ?? 'https://app.pulse.ai'
const FROM_EMAIL = Deno.env.get('ALERT_FROM_EMAIL') ?? 'alerts@pulse.ai'

// ── Helpers ───────────────────────────────────────────────────────────────────

function isAlertDue(lastAlertAt: string | null, frequency: 'instant' | 'daily' | 'weekly'): boolean {
  if (!lastAlertAt) return true   // Never sent — always due
  const last = new Date(lastAlertAt).getTime()
  const now = Date.now()
  const intervals: Record<typeof frequency, number> = {
    instant: 60 * 60 * 1000,          // 1 hour (invocation cadence)
    daily:   24 * 60 * 60 * 1000,     // 24 hours
    weekly:  7  * 24 * 60 * 60 * 1000,
  }
  return now - last >= intervals[frequency]
}

async function sendAlertEmail(
  userEmail: string,
  savedSearchName: string,
  query: string,
  newResultCount: number,
  sampleResults: Array<{ title: string; type: string; timestamp: string }>
): Promise<void> {
  const resultRows = sampleResults.map(r =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${r.title}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#888;">${r.type}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#888;">${new Date(r.timestamp).toLocaleDateString()}</td>
    </tr>`
  ).join('')

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#e91e8c;">Search Alert: ${savedSearchName}</h2>
      <p>Your saved search <strong>"${query}"</strong> has <strong>${newResultCount} new result${newResultCount !== 1 ? 's' : ''}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <thead>
          <tr style="background:#f9f9f9;">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#666;">Title</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#666;">Type</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#666;">Date</th>
          </tr>
        </thead>
        <tbody>${resultRows}</tbody>
      </table>
      <a href="${APP_URL}?view=search&q=${encodeURIComponent(query)}"
         style="display:inline-block;background:#e91e8c;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">
        View all results →
      </a>
      <p style="margin-top:24px;font-size:12px;color:#aaa;">
        You're receiving this because you enabled alerts for this saved search.<br>
        <a href="${APP_URL}?view=search" style="color:#aaa;">Manage search alerts</a>
      </p>
    </div>
  `

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [userEmail],
      subject: `[Pulse] ${newResultCount} new result${newResultCount !== 1 ? 's' : ''} for "${savedSearchName}"`,
      html,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend API error ${res.status}: ${body}`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // 1. Fetch all alert-enabled saved searches
  const { data: searches, error: fetchError } = await supabase
    .from('saved_searches')
    .select('*')
    .eq('alert_enabled', true)

  if (fetchError) {
    console.error('Failed to fetch saved searches:', fetchError)
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 })
  }

  const processed: string[] = []
  const skipped: string[] = []
  const errors: string[] = []

  for (const search of (searches ?? [])) {
    const frequency: 'instant' | 'daily' | 'weekly' = search.alert_frequency ?? 'daily'

    if (!isAlertDue(search.last_alert_at, frequency)) {
      skipped.push(search.id)
      continue
    }

    try {
      // 2. Re-run the search using Supabase full-text search
      //    We search the unified_messages table as a representative source.
      //    In production you may want to fan out across all sources.
      const lastAlertTime = search.last_alert_at
        ? new Date(search.last_alert_at).toISOString()
        : new Date(Date.now() - 7 * 86_400_000).toISOString()

      const searchTerm = (search.query ?? '').trim()
      if (!searchTerm) { skipped.push(search.id); continue }

      const { data: newResults, error: searchError } = await supabase
        .from('unified_messages')
        .select('id, content, sender_name, source, timestamp')
        .eq('user_id', search.user_id)
        .textSearch('search_vector', searchTerm, { type: 'websearch', config: 'english' })
        .gt('timestamp', lastAlertTime)
        .order('timestamp', { ascending: false })
        .limit(5)

      if (searchError) {
        console.error(`Search failed for saved search ${search.id}:`, searchError)
        errors.push(search.id)
        continue
      }

      if (!newResults || newResults.length === 0) {
        // No new results — update last_alert_at anyway to avoid hammering
        await supabase
          .from('saved_searches')
          .update({ last_alert_at: new Date().toISOString() })
          .eq('id', search.id)
        skipped.push(search.id)
        continue
      }

      // 3. Get user email
      const { data: userRecord } = await supabase.auth.admin.getUserById(search.user_id)
      const userEmail = userRecord?.user?.email
      if (!userEmail) { errors.push(search.id); continue }

      // 4. Send alert email
      const sampleResults = newResults.map((r: any) => ({
        title: `${r.sender_name ?? 'Unknown'}: ${(r.content ?? '').slice(0, 80)}`,
        type: r.source ?? 'message',
        timestamp: r.timestamp,
      }))

      await sendAlertEmail(userEmail, search.name, search.query, newResults.length, sampleResults)

      // 5. Update last_alert_at
      await supabase
        .from('saved_searches')
        .update({ last_alert_at: new Date().toISOString() })
        .eq('id', search.id)

      processed.push(search.id)
      console.log(`Alert sent for saved search "${search.name}" (${search.id}) → ${userEmail}`)

    } catch (err) {
      console.error(`Error processing saved search ${search.id}:`, err)
      errors.push(search.id)
    }
  }

  return new Response(
    JSON.stringify({ processed, skipped, errors }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
