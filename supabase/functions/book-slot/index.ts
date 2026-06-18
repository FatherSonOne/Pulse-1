// Supabase Edge Function: book-slot
//
// Public (anonymous) booking endpoint for the /book/:slug flow (#131).
//
// Why this exists: the booker is NOT authenticated, so they cannot (and must
// not) write the organiser's calendar_events row directly under RLS, and they
// cannot call the JWT-gated send-email relay. This function runs server-side
// with the service-role key:
//   1. confirm_booking() RPC — atomically claims the slot (partial unique index
//      prevents double-booking) and creates the organiser's calendar event.
//   2. Sends the booker a confirmation email via Resend (best-effort: a mail
//      failure never fails an already-committed booking).
//
// Platform verify_jwt MUST be false (see config.toml) — the booker sends no JWT.
//
// Body: { page_id: string(uuid), start: string(iso), end: string(iso),
//         name: string, email: string, notes?: string }
// Returns 200 { ok: true, request, emailSent } on success,
//         409 { ok: false, error: 'slot_taken' } when the slot is gone,
//         4xx/5xx { ok: false, error } otherwise.
//
// Requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and (for email) RESEND_API_KEY
// as Supabase secrets. Resend sends from the verified pulse.logosvision.org domain.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

// Same verified sender as the send-email relay.
const FROM_ADDRESS = 'Pulse <noreply@pulse.logosvision.org>';
const REPLY_TO = 'support@logosvision.org';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!),
  );
}

function formatSlot(startIso: string, endIso: string, tz: string): string {
  const zone = tz && tz !== 'local' ? tz : 'UTC';
  try {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const date = start.toLocaleString('en-US', { dateStyle: 'full', timeZone: zone });
    const t1 = start.toLocaleString('en-US', { timeStyle: 'short', timeZone: zone });
    const t2 = end.toLocaleString('en-US', { timeStyle: 'short', timeZone: zone });
    return `${date}, ${t1} – ${t2} (${zone})`;
  } catch {
    return `${startIso} – ${endIso} (UTC)`;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return json({ ok: false, error: 'invalid_body' }, 400);

    const { page_id, start, end, name, email, notes } = body as Record<string, unknown>;

    if (typeof page_id !== 'string' || !page_id) return json({ ok: false, error: 'invalid_page' }, 400);
    if (typeof start !== 'string' || Number.isNaN(Date.parse(start))) return json({ ok: false, error: 'invalid_start' }, 400);
    if (typeof end !== 'string' || Number.isNaN(Date.parse(end))) return json({ ok: false, error: 'invalid_end' }, 400);
    if (typeof name !== 'string' || name.trim().length === 0) return json({ ok: false, error: 'invalid_name' }, 400);
    if (typeof email !== 'string' || !EMAIL_RE.test(email)) return json({ ok: false, error: 'invalid_email' }, 400);
    if (notes !== undefined && notes !== null && typeof notes !== 'string') return json({ ok: false, error: 'invalid_notes' }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1. Atomic booking: claim slot + create organiser event.
    const { data: request, error: rpcError } = await admin.rpc('confirm_booking', {
      p_page_id: page_id,
      p_start: start,
      p_end: end,
      p_name: name,
      p_email: email,
      p_notes: typeof notes === 'string' ? notes : null,
    });

    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('slot_taken')) return json({ ok: false, error: 'slot_taken' }, 409);
      if (msg.includes('page_not_found')) return json({ ok: false, error: 'page_not_found' }, 404);
      if (msg.includes('page_inactive')) return json({ ok: false, error: 'page_inactive' }, 410);
      if (msg.includes('invalid_')) return json({ ok: false, error: msg.trim() }, 400);
      console.error('[book-slot] confirm_booking failed:', rpcError);
      return json({ ok: false, error: 'booking_failed' }, 500);
    }

    // 2. Best-effort confirmation email — a mail failure never fails the booking.
    let emailSent = false;
    if (RESEND_API_KEY) {
      try {
        const { data: page } = await admin
          .from('booking_pages')
          .select('title, timezone')
          .eq('id', page_id)
          .single();

        const title = page?.title ?? 'your meeting';
        const when = formatSlot(start, end, page?.timezone ?? 'local');
        const safeName = esc(name.trim());
        const safeTitle = esc(title);
        const safeWhen = esc(when);

        const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#18181b">
  <h2 style="font-size:18px;margin:0 0 8px">You're booked${safeName ? ', ' + safeName : ''} 🎉</h2>
  <p style="margin:0 0 16px;color:#52525b">Your booking for <strong>${safeTitle}</strong> is confirmed.</p>
  <div style="padding:12px 14px;border:1px solid #e4e4e7;border-radius:10px;background:#fafafa">
    <div style="font-size:13px;color:#71717a;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">When</div>
    <div style="font-size:15px;font-weight:600">${safeWhen}</div>
  </div>
  <p style="margin:16px 0 0;color:#a1a1aa;font-size:12px">If you need to change or cancel, just reply to this email.</p>
</div>`;
        const text = `You're booked${name.trim() ? ', ' + name.trim() : ''}!\n\n${title}\n${when}\n\nIf you need to change or cancel, just reply to this email.`;

        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: FROM_ADDRESS,
            reply_to: REPLY_TO,
            to: [email],
            subject: `Confirmed: ${title}`,
            html,
            text,
          }),
        });
        if (resp.ok) {
          emailSent = true;
        } else {
          console.error('[book-slot] Resend error:', resp.status, await resp.text().catch(() => ''));
        }
      } catch (mailErr) {
        console.error('[book-slot] email send threw:', mailErr);
      }
    } else {
      console.warn('[book-slot] RESEND_API_KEY not set — booking saved, confirmation email skipped');
    }

    return json({ ok: true, request, emailSent });
  } catch (err) {
    console.error('[book-slot] threw:', err);
    return json({ ok: false, error: String((err as Error)?.message ?? err) }, 500);
  }
});
