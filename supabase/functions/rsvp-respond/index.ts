// Supabase Edge Function: rsvp-respond
//
// Public (anonymous) RSVP response endpoint for the /rsvp email-link flow (#132).
//
// Why this exists: invitees follow an Accept/Maybe/Decline link from their email
// and are NOT authenticated (external invitees have no Pulse account at all). The
// event_rsvp RLS update policy requires auth.uid(), so an anon client UPDATE is
// silently filtered to zero rows. This function applies the response server-side
// with the service-role key, keyed by (event_id, email) — the unguessable event
// UUID in the link is the capability.
//
// Platform verify_jwt MUST be false (see config.toml) — the invitee sends no JWT.
//
// Body: { event_id: string(uuid), email: string, status: 'accepted'|'declined'|'maybe', notes?: string }
// Returns 200 { ok: true, status, eventTitle } on success,
//         404 { ok: false, error: 'not_invited' } when no invite row matches,
//         4xx/5xx { ok: false, error } otherwise.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const VALID_STATUS = new Set(['accepted', 'declined', 'maybe']);
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
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return json({ ok: false, error: 'invalid_body' }, 400);

    const { event_id, email, status, notes } = body as Record<string, unknown>;

    if (typeof event_id !== 'string' || !event_id) return json({ ok: false, error: 'invalid_event' }, 400);
    if (typeof email !== 'string' || !EMAIL_RE.test(email)) return json({ ok: false, error: 'invalid_email' }, 400);
    if (typeof status !== 'string' || !VALID_STATUS.has(status)) return json({ ok: false, error: 'invalid_status' }, 400);
    if (notes !== undefined && notes !== null && typeof notes !== 'string') return json({ ok: false, error: 'invalid_notes' }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Apply the response to the matching invite row (unique on event_id+email).
    const { data: updated, error: updErr } = await admin
      .from('event_rsvp')
      .update({
        status,
        responded_at: new Date().toISOString(),
        notes: typeof notes === 'string' ? notes : null,
      })
      .eq('event_id', event_id)
      .eq('email', email)
      .select('id');

    if (updErr) {
      console.error('[rsvp-respond] update failed:', updErr);
      return json({ ok: false, error: 'update_failed' }, 500);
    }
    if (!updated || updated.length === 0) {
      return json({ ok: false, error: 'not_invited' }, 404);
    }

    // Best-effort event title for the confirmation screen.
    let eventTitle: string | null = null;
    try {
      const { data: ev } = await admin
        .from('calendar_events')
        .select('title')
        .eq('id', event_id)
        .single();
      eventTitle = ev?.title ?? null;
    } catch { /* title is optional */ }

    return json({ ok: true, status, eventTitle });
  } catch (err) {
    console.error('[rsvp-respond] threw:', err);
    return json({ ok: false, error: String((err as Error)?.message ?? err) }, 500);
  }
});
