// Supabase Edge Function: revoke-contact-card
//
// Phase C — sender-side Revoke / Unsend. Atomically flips revoked_at
// on the targeted card AND every descendant in the forwarding chain
// (magi D-9: root revokes tree; mid-chain revokes its own subtree).
// The recursive CTE traverses forwarded_from_card_id descendants only;
// it never ascends, so a forwarder cannot revoke the original.
//
// Auth: Bearer token (Pulse JWT). Sender identity is read from JWT —
// never from the body.
//
// Request body (matches contactCardService.revokeCard wrapper):
//   { card_id: string }   // uuid; doubles as the share token.
//
// Response:
//   { ok: true, cascade_count: number }
//   cascade_count includes the card itself + every descendant that
//   was newly revoked. Cards that were already revoked are NOT
//   counted (the SQL filters `WHERE revoked_at IS NULL`).
//
// HTTP semantics:
//   200  — revoke succeeded
//   400  — bad body
//   401  — no JWT
//   403  — sender_user_id != auth.uid()::text (only the owner of the
//          specific card may revoke it; magi D-9 mid-chain semantics)
//   404  — card_id not found
//   410  — card was already revoked
//   500  — DB error / RPC failure

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
        '[revoke-contact-card] token validation failed:',
        authError?.message,
      );
      return json({ error: 'unauthorized' }, 401);
    }
    const senderUserId = user.id; // text-compatible

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

    // ── Lookup + ownership check ─────────────────────────────────────
    // NOTE: sender_user_id is TEXT (matches contacts.user_id), so we
    // compare with the auth.uid() string directly — no cast needed in
    // the JS layer.
    const { data: card, error: cardErr } = await admin
      .from('contact_cards')
      .select('id, sender_user_id, revoked_at')
      .eq('id', card_id)
      .maybeSingle();

    if (cardErr) {
      console.error('[revoke-contact-card] card fetch error:', cardErr);
      return json({ error: 'internal' }, 500);
    }
    if (!card) {
      return json({ error: 'not_found' }, 404);
    }
    if (card.sender_user_id !== senderUserId) {
      // Magi D-9: mid-chain revoke is allowed for the forwarder of that
      // specific card only. The ownership check binds to whoever sent
      // THIS row — not the root sender.
      return json({ error: 'forbidden' }, 403);
    }
    if (card.revoked_at) {
      return json({ error: 'gone' }, 410);
    }

    // ── Recursive cascade UPDATE ─────────────────────────────────────
    // Runs as a single SQL statement via a SECURITY DEFINER RPC. The
    // CTE descends through forwarded_from_card_id; it never ascends,
    // so a mid-chain revoker only nukes their own subtree.
    //
    // The Supabase JS client does not expose arbitrary SQL execution,
    // so we route through a stored function. The function lives in
    // Postgres and is callable via .rpc('revoke_contact_card_cascade',
    // { p_card_id: card_id }). The RPC is responsible for both the
    // cascade and the count.
    //
    // Implementation note: if the RPC is not yet deployed (initial
    // deploy ordering), fall back to a two-step descend-then-update
    // path that does the same work in JS. The fallback is racier (a
    // concurrent forward landing between the two queries lands in the
    // child set on the second sweep), but correctness is preserved
    // because forwards inserted AFTER the descend see revoked_at on
    // their parent in the next read and the create-contact-card
    // function refuses to forward from revoked parents.
    //
    // TODO(phase-7): swap the JS fallback for a guaranteed-deployed
    // SECURITY DEFINER function in a follow-up migration that doesn't
    // touch the schema — the function-only migration can land between
    // the table migration and this edge function without rollback
    // complexity.

    type RpcResult = { revoked_count: number } | null;
    let cascadeCount = 0;
    let rpcAvailable = true;

    try {
      const { data: rpcData, error: rpcErr } = await admin.rpc(
        'revoke_contact_card_cascade',
        { p_card_id: card_id, p_sender_user_id: senderUserId },
      );
      if (rpcErr) {
        // Postgres error codes: 42883 = undefined_function. Anything
        // else is a real error and should surface.
        const code = (rpcErr as { code?: string }).code;
        if (code === '42883' || code === 'PGRST202') {
          console.warn(
            '[revoke-contact-card] cascade RPC unavailable, using JS fallback:',
            rpcErr.message,
          );
          rpcAvailable = false;
        } else {
          console.error('[revoke-contact-card] RPC error:', rpcErr);
          return json({ error: 'internal' }, 500);
        }
      } else if (rpcData !== null && rpcData !== undefined) {
        const r = rpcData as RpcResult;
        if (r && typeof r.revoked_count === 'number') {
          cascadeCount = r.revoked_count;
        } else if (typeof rpcData === 'number') {
          cascadeCount = rpcData as number;
        }
      }
    } catch (e) {
      console.warn(
        '[revoke-contact-card] cascade RPC threw, using JS fallback:',
        e,
      );
      rpcAvailable = false;
    }

    if (!rpcAvailable) {
      // ── JS fallback: BFS descend, then bulk UPDATE ─────────────────
      // The traversal is bounded by max forwarding depth in practice
      // (typically <10), so iteration count is small.
      const allIds: string[] = [card_id];
      let frontier: string[] = [card_id];
      // Defensive cap to keep a pathological cycle from spinning
      // forever. The schema doesn't prevent a cycle today (Postgres
      // CHECK constraints on recursive references are awkward), but
      // create-contact-card always points forwarded_from_card_id at
      // an existing row, so cycles require manual SQL — out of scope.
      const MAX_DEPTH = 32;
      for (let depth = 0; depth < MAX_DEPTH && frontier.length > 0; depth++) {
        const { data: children, error: childErr } = await admin
          .from('contact_cards')
          .select('id')
          .in('forwarded_from_card_id', frontier);
        if (childErr) {
          console.error(
            '[revoke-contact-card] fallback descend error:',
            childErr,
          );
          return json({ error: 'internal' }, 500);
        }
        const nextFrontier = (children ?? [])
          .map((r) => r.id as string)
          .filter((id) => !allIds.includes(id));
        allIds.push(...nextFrontier);
        frontier = nextFrontier;
      }

      const nowIso = new Date().toISOString();
      const { data: updated, error: updateErr } = await admin
        .from('contact_cards')
        .update({ revoked_at: nowIso })
        .in('id', allIds)
        .is('revoked_at', null)
        .select('id');

      if (updateErr) {
        console.error(
          '[revoke-contact-card] fallback update error:',
          updateErr,
        );
        return json({ error: 'internal' }, 500);
      }
      cascadeCount = (updated ?? []).length;
    }

    if (cascadeCount === 0) {
      // Race: a concurrent revoke from another session beat us. Treat
      // as 410 Gone — the desired terminal state holds.
      return json({ error: 'gone' }, 410);
    }

    // TODO(phase-7): emit card.revoked telemetry with cascade_count.
    // TODO(phase-7): when Sub-PR 7 ships, RLS may delegate revoke to
    //   workspace admins; this edge function would then check
    //   user_has_permission('cards.revoke') alongside ownership.

    return json({ ok: true, cascade_count: cascadeCount }, 200);
  } catch (err) {
    console.error('[revoke-contact-card] threw:', err);
    return json(
      {
        error: 'internal',
        details: String((err as Error)?.message ?? err),
      },
      500,
    );
  }
});
