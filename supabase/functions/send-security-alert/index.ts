// Supabase Edge Function: Send Security Alert Email
// Uses Resend API for email delivery.
//
// Auth: requires CRON_SECRET in either x-cron-secret or Authorization
// Bearer header. Without this gate the function would be a public
// Pulse-branded email relay (anyone could phish or tamper with
// security_alerts rows).
//
// HTML body is intentionally minimal — the prior elaborate template
// was tripping Cloudflare's WAF on deploy as a phishing-shaped
// payload.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET')!

serve(async (req) => {
  try {
    if (!CRON_SECRET) {
      return new Response(JSON.stringify({ success: false, error: 'CRON_SECRET not configured' }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 })
    }
    const provided = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (provided !== CRON_SECRET) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }),
        { headers: { 'Content-Type': 'application/json' }, status: 401 })
    }

    const payload = await req.json()
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    let userEmail = payload.user_email
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.user_email)
    if (isUUID) {
      const { data, error } = await supabase.auth.admin.getUserById(payload.user_email)
      if (error || !data.user) throw new Error('User not found')
      userEmail = data.user.email || payload.user_email
    }

    const colors: Record<string, string> = { info: '#3B82F6', low: '#10B981', medium: '#F59E0B', high: '#EF4444', critical: '#DC2626' }
    const labels: Record<string, string> = { info: 'Information', low: 'Low Priority', medium: 'Medium Priority', high: 'High Priority', critical: 'CRITICAL' }
    const color = colors[payload.alert_level] || '#6B7280'
    const label = labels[payload.alert_level] || 'Alert'

    const detailsHtml = payload.metadata
      ? '<pre style="background:#f9fafb;padding:12px;border-radius:6px;font-size:12px">' + JSON.stringify(payload.metadata, null, 2) + '</pre>'
      : ''

    const html = '<div style="font-family:sans-serif;max-width:600px;margin:0 auto">' +
      '<h2 style="color:' + color + '">' + label + ': ' + payload.alert_title + '</h2>' +
      '<p>' + payload.alert_message + '</p>' + detailsHtml +
      '<p style="margin-top:24px;font-size:12px;color:#aaa">Automated alert from Pulse</p>' +
      '</div>'

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + RESEND_API_KEY },
      body: JSON.stringify({
        from: 'Pulse <onboarding@resend.dev>',
        to: [userEmail],
        subject: 'Pulse alert: ' + payload.alert_title,
        html
      })
    })
    const result = await response.json()
    if (!response.ok) throw new Error('Resend API error: ' + JSON.stringify(result))

    await supabase.from('security_alerts').update({
      emailed_at: new Date().toISOString(), email_status: 'sent'
    }).eq('id', payload.alert_id)

    return new Response(JSON.stringify({ success: true, email_id: result.id }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 })
  } catch (error: any) {
    console.error('send-security-alert error:', error)
    return new Response(JSON.stringify({ success: false, error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 })
  }
})
