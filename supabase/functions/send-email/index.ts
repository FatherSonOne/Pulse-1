// Supabase Edge Function: send-email
// General-purpose transactional email relay backed by Resend.
//
// Auth: Bearer token (any logged-in Pulse user).
// Why JWT-gated: prevents the function from becoming an open spam relay.
// Why platform verify_jwt=false + manual getUser(): same reason as billing-checkout —
// the gateway 401 path is buggy under our auth setup, so we validate the token
// inside the function with the service-role client.
//
// Body: { to: string, subject: string, html: string, text?: string }
// Returns 200 { ok: true, id } on success, 4xx/5xx { ok: false, error } on failure.
//
// Requires `RESEND_API_KEY` as a Supabase secret. Until the Pulse domain is
// verified in Resend, FROM_ADDRESS is `onboarding@resend.dev` — Resend will
// only deliver to the Resend account-owner's email in that mode.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// pulse.logosvision.org is verified in Resend (DKIM/SPF via IONOS DNS).
// REPLY_TO points at a real inbox (or IONOS forwarder) so recipients who
// hit "Reply" reach a human instead of bouncing off the no-reply address.
const FROM_ADDRESS = 'Pulse <noreply@pulse.logosvision.org>';
const REPLY_TO = 'support@pulse.logosvision.org';

const MAX_HTML_BYTES = 256 * 1024;
const MAX_SUBJECT_LEN = 500;
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  try {
    // ── Authenticate caller ──────────────────────────────────────────────
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader) return json({ ok: false, error: 'Unauthorized — no auth header' }, 401);

    const token = authHeader.replace('Bearer ', '');
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) {
      console.error('[send-email] Token validation failed:', authError?.message);
      return json({ ok: false, error: 'Unauthorized — invalid token' }, 401);
    }

    // ── Validate payload ─────────────────────────────────────────────────
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return json({ ok: false, error: 'Invalid JSON body' }, 400);
    }

    const { to, subject, html, text } = body as {
      to?: unknown; subject?: unknown; html?: unknown; text?: unknown;
    };

    if (typeof to !== 'string' || !EMAIL_RE.test(to)) {
      return json({ ok: false, error: 'Field "to" must be a valid email address' }, 400);
    }
    if (typeof subject !== 'string' || subject.length === 0 || subject.length > MAX_SUBJECT_LEN) {
      return json({ ok: false, error: `Field "subject" must be 1..${MAX_SUBJECT_LEN} chars` }, 400);
    }
    if (typeof html !== 'string' || html.length === 0) {
      return json({ ok: false, error: 'Field "html" is required' }, 400);
    }
    if (new TextEncoder().encode(html).byteLength > MAX_HTML_BYTES) {
      return json({ ok: false, error: 'HTML body too large' }, 413);
    }
    if (text !== undefined && typeof text !== 'string') {
      return json({ ok: false, error: 'Field "text" must be a string when provided' }, 400);
    }

    // ── Send via Resend ──────────────────────────────────────────────────
    if (!RESEND_API_KEY) {
      console.error('[send-email] RESEND_API_KEY not configured');
      return json({ ok: false, error: 'Email service not configured' }, 503);
    }

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        reply_to: REPLY_TO,
        to: [to],
        subject,
        html,
        text,
      }),
    });

    const result = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error('[send-email] Resend error:', resp.status, result);
      const reason = (result as any)?.message || `Resend ${resp.status}`;
      return json({ ok: false, error: reason }, 502);
    }

    console.log(`[send-email] sent id=${(result as any)?.id} to=${to} by user=${user.id}`);
    return json({ ok: true, id: (result as any)?.id ?? null });

  } catch (err) {
    console.error('[send-email] threw:', err);
    return json({ ok: false, error: String((err as Error)?.message ?? err) }, 500);
  }
});
