// Supabase Edge Function: decline-contact-card
//
// Phase C — recipient-side soft Decline. Records the recipient's
// decision to hide a card from their Received inbox WITHOUT touching
// contact_cards.revoked_at (revoke is sender-side; magi D-9 keeps
// these semantically distinct).
//
// Auth: Bearer token (Pulse JWT). Recipient identity is read from
// JWT — never from the body.
//
// Request body (matches contactCardService.declineCard wrapper):
//   { card_id: string }   // uuid; doubles as the share token.
//
// Response:
//   { ok: true }
//
// HTTP semantics:
//   200  — decline recorded (or no-op if already declined)
//   400  — bad body
//   401  — no JWT
//   403  — card.recipient_user_id is locked-in to a different user
//   404  — card_id not found
//   500  — DB error
//
// Storage: writes to public.card_recipient_state (see
// supabase/migrations/20260525000002_phase_c_decline_state.sql). The
// state row is keyed by (card_id, recipient_user_id) so repeated
// decline calls are idempotent at the DB layer via upsert.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')
    return json({ error: 'method_not_allowed' }, 405);

  try {
    // ── Authenticate caller ──────────────────────────────────────────
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader) return json({ error: 'unauthorized' }, 401);

    const token = authHeader.replace('Bearer ', '');
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(token);
    if (authError || !user) {
      console.error(
        '[decline-contact-card] token validation failed:',
        authError?.message,
      );
      return json({ error: 'unauthorized' }, 401);
    }
    const recipientUserId = user.id;

    // ── Parse + validate body ────────────────────────────────────────
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return json(
        { error: 'validation_failed', details: 'invalid_json' },
        400,
      );
    }
    const { card_id } = body as Record<string, unknown>;
    if (typeof card_id !== 'string' || !UUID_RE.test(card_id)) {
      return json(
        { error: 'validation_failed', details: 'card_id_required' },
        400,
      );
    }

    // ── Lookup the card ──────────────────────────────────────────────
    const { data: card, error: cardErr } = await admin
      .from('contact_cards')
      .select('id, recipient_user_id')
      .eq('id', card_id)
      .maybeSingle();

    if (cardErr) {
      console.error('[decline-contact-card] card fetch error:', cardErr);
      return json({ error: 'internal' }, 500);
    }
    if (!card) {
      // magi D-9 leans toward 410 for valid-but-gone tokens; pure
      // not-found is still 404 — the card_id never existed. We do NOT
      // upgrade missing-card-id to 410 here because Decline isn't part
      // of the UUID-probing attack surface (it requires JWT auth).
      return json({ error: 'not_found' }, 404);
    }

    // Recipient gate: only the locked-in recipient (when set) can
    // decline. Open-to-anyone cards (recipient_user_id IS NULL) may
    // be declined by any signed-in user — the row is keyed by both
    // card_id AND recipient_user_id so it won't affect other Pulse
    // users who land on the same token.
    if (
      card.recipient_user_id &&
      card.recipient_user_id !== recipientUserId
    ) {
      return json({ error: 'forbidden' }, 403);
    }

    // ── Upsert the decline state ─────────────────────────────────────
    // Composite PK (card_id, recipient_user_id) makes this idempotent.
    // Re-declining is a no-op at the row level; recorded_at is NOT
    // bumped on conflict so the original decline timestamp is
    // preserved as audit signal.
    const { error: upsertErr } = await admin
      .from('card_recipient_state')
      .upsert(
        {
          card_id,
          recipient_user_id: recipientUserId,
          state: 'declined',
        },
        { onConflict: 'card_id,recipient_user_id', ignoreDuplicates: true },
      );

    if (upsertErr) {
      console.error('[decline-contact-card] upsert error:', upsertErr);
      return json({ error: 'internal' }, 500);
    }

    // TODO(phase-7): emit card.declined telemetry event.
    // TODO(phase-7): when fetchReceived moves to a server-side RPC,
    //   filter out cards present in card_recipient_state for the
    //   caller. For now the client refetches after a decline and the
    //   row stays visible until the next view; UX tracks pending
    //   declines via local optimistic state.

    return json({ ok: true }, 200);
  } catch (err) {
    console.error('[decline-contact-card] threw:', err);
    return json(
      {
        error: 'internal',
        details: String((err as Error)?.message ?? err),
      },
      500,
    );
  }
});
