-- ============================================================
-- MIGRATION: 20260525000002_phase_c_decline_state.sql
-- PURPOSE:   Phase C follow-up — recipient-side Decline state + the
--            recursive revoke cascade RPC.
--            Adds card_recipient_state for the Decline (and future
--            Snooze) actions so they survive sign-out/sign-in without
--            polluting the sender-owned revoked_at column. Also ships
--            revoke_contact_card_cascade(uuid, text) — the SECURITY
--            DEFINER function the revoke-contact-card edge function
--            calls to atomically revoke the targeted card + every
--            descendant of forwarded_from_card_id (magi D-9).
--
-- SCOPE:     One new table (card_recipient_state). Two indexes. Three
--            RLS policies. One SECURITY DEFINER function (revoke_
--            contact_card_cascade).
--
-- DESIGN:
--   * Magi verdict (D-9) explicitly distinguishes revoke (sender) from
--     decline (recipient) — they share neither column nor semantics.
--     `card_recipient_state` is the recipient-side counterpart.
--   * Composite PK (card_id, recipient_user_id) gives natural dedup:
--     a recipient can only have one state per card. To change state
--     (e.g. un-decline), delete the row.
--   * Service-role inserts at decline-contact-card time also fall
--     under the insert policy (service-role bypasses RLS entirely),
--     so the policy is sized for the future case where a recipient
--     direct-writes a snooze from the client.
--   * possible future values: 'snoozed' with a snooze_until timestamp
--     column — magi did not lock this, but the CHECK enum is scoped
--     to leave room.
--   * TODO(phase-7): when Sub-PR 7 ships user_has_permission(), the
--     RLS predicates can swap to permission-aware predicates so a
--     workspace admin can hide cards on behalf of a delegated user.
--
-- DATE:      2026-05-25 (companion to 20260525000001)
-- SAFE:      Pure additive — CREATE TABLE only.
-- ROLLBACK:
--   BEGIN;
--     DROP TABLE IF EXISTS public.card_recipient_state CASCADE;
--   COMMIT;
-- ============================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- ============================================================
-- 1. card_recipient_state  (new)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.card_recipient_state (
  card_id            uuid        NOT NULL REFERENCES public.contact_cards(id) ON DELETE CASCADE,
  recipient_user_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state              text        NOT NULL
                                  CHECK (state IN ('declined', 'snoozed')),
  recorded_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, recipient_user_id)
);

COMMENT ON TABLE public.card_recipient_state IS
  'Phase C recipient-side card state. Distinct from contact_cards.revoked_at '
  '(which is sender-side). Recipient declines/snoozes here without affecting '
  'sender''s audit trail. fetchReceived can NOT EXISTS subquery against this '
  'table to hide declined cards from the Received inbox.';

COMMENT ON COLUMN public.card_recipient_state.state IS
  '''declined'' = recipient hid this card from their inbox. '
  '''snoozed'' = reserved for a future "Remind me later" UX; not consumed by '
  'decline-contact-card today.';

-- ----- Indexes -----

CREATE INDEX IF NOT EXISTS idx_card_recipient_state_recipient
  ON public.card_recipient_state (recipient_user_id, state, recorded_at DESC);
-- Lookup pattern: "give me all declined card_ids for this recipient",
-- consumed by the future server-side fetchReceived RPC.

CREATE INDEX IF NOT EXISTS idx_card_recipient_state_card
  ON public.card_recipient_state (card_id);
-- Reverse path for the sender-side analytics ("how many recipients
-- declined this card?") and for the ON DELETE CASCADE from contact_cards.

ALTER TABLE public.card_recipient_state ENABLE ROW LEVEL SECURITY;

-- ----- RLS policies (owner = recipient_user_id) -----

DROP POLICY IF EXISTS card_recipient_state_select ON public.card_recipient_state;
CREATE POLICY card_recipient_state_select
  ON public.card_recipient_state FOR SELECT
  TO authenticated
  USING (recipient_user_id = auth.uid());
  -- TODO(phase-7): replace with public.user_has_permission(NULL, 'cards.receive')
  -- once Sub-PR 7 ships custom-roles.

DROP POLICY IF EXISTS card_recipient_state_insert ON public.card_recipient_state;
CREATE POLICY card_recipient_state_insert
  ON public.card_recipient_state FOR INSERT
  TO authenticated
  WITH CHECK (recipient_user_id = auth.uid());
  -- TODO(phase-7): replace with public.user_has_permission(NULL, 'cards.receive').

DROP POLICY IF EXISTS card_recipient_state_delete ON public.card_recipient_state;
CREATE POLICY card_recipient_state_delete
  ON public.card_recipient_state FOR DELETE
  TO authenticated
  USING (recipient_user_id = auth.uid());

-- No UPDATE policy on purpose. State is immutable; un-declining or
-- changing snooze duration is DELETE + INSERT (or just DELETE).

GRANT SELECT, INSERT, DELETE ON public.card_recipient_state TO authenticated;

-- ============================================================
-- 2. revoke_contact_card_cascade  (SECURITY DEFINER function)
-- ============================================================
--
-- Atomically revokes the targeted contact_card AND every descendant in
-- the forwarded_from_card_id chain (magi D-9: root revokes tree, mid-
-- chain revokes own subtree). The function is the canonical
-- implementation; the revoke-contact-card edge function calls it via
-- supabase.rpc() and falls back to a JS BFS only if this RPC is
-- absent (initial-deploy ordering safety net).
--
-- SECURITY DEFINER lets the function bypass RLS for the cascade UPDATE
-- — the edge function has already verified the caller owns the
-- *targeted* row, and the recursive descent only revokes downstream
-- forwards (it never ascends), so ownership of descendants is not
-- required. This matches the magi verdict: the forwarding chain is a
-- single revocable unit from any sender's POV on their own subtree.
--
-- Defensive parameters:
--   p_card_id            uuid  — the target row.
--   p_sender_user_id     text  — auth.uid() of the caller. The
--                                 function re-checks that p_sender_
--                                 user_id matches the target row's
--                                 sender_user_id, so a stale or forged
--                                 RPC call from a malicious client
--                                 cannot revoke someone else's card.
--
-- Returns:                jsonb { "revoked_count": integer } —
--                                 newly revoked rows (excluding rows
--                                 that were already revoked before
--                                 this call).
--
-- TODO(phase-7): swap the explicit sender ownership check inside the
-- function for user_has_permission(workspace, 'cards.revoke') once
-- Sub-PR 7 ships custom-roles.

CREATE OR REPLACE FUNCTION public.revoke_contact_card_cascade(
  p_card_id        uuid,
  p_sender_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target_sender text;
  v_already_revoked timestamptz;
  v_count integer;
BEGIN
  -- Re-verify ownership inside the function. The edge function
  -- already did this, but SECURITY DEFINER means we MUST NOT trust
  -- the caller — a misconfigured RPC ACL would otherwise let any
  -- authenticated user revoke arbitrary cards.
  SELECT sender_user_id, revoked_at
    INTO v_target_sender, v_already_revoked
    FROM public.contact_cards
    WHERE id = p_card_id;

  IF v_target_sender IS NULL THEN
    -- Card does not exist; nothing to do. Edge function will surface
    -- the 0 count as 410 Gone (race with concurrent revoke or with
    -- a pre-call delete).
    RETURN jsonb_build_object('revoked_count', 0);
  END IF;

  IF v_target_sender <> p_sender_user_id THEN
    RAISE EXCEPTION 'forbidden: caller does not own card %', p_card_id
      USING ERRCODE = '42501';
  END IF;

  IF v_already_revoked IS NOT NULL THEN
    -- Already revoked: edge function will return 410.
    RETURN jsonb_build_object('revoked_count', 0);
  END IF;

  -- Single recursive CTE: descend the forwarding tree from the target
  -- and bulk-flip revoked_at on every row that's still active.
  WITH RECURSIVE descendants AS (
    SELECT id FROM public.contact_cards WHERE id = p_card_id
    UNION ALL
    SELECT c.id
      FROM public.contact_cards c
      JOIN descendants d ON c.forwarded_from_card_id = d.id
  ),
  revoked AS (
    UPDATE public.contact_cards
       SET revoked_at = now()
     WHERE id IN (SELECT id FROM descendants)
       AND revoked_at IS NULL
     RETURNING id
  )
  SELECT count(*)::int INTO v_count FROM revoked;

  RETURN jsonb_build_object('revoked_count', v_count);
END;
$$;

COMMENT ON FUNCTION public.revoke_contact_card_cascade(uuid, text) IS
  'Phase C revoke cascade. Verifies p_sender_user_id matches the target '
  'card''s sender_user_id, then UPDATE...WHERE id IN (RECURSIVE descend '
  'on forwarded_from_card_id) SET revoked_at = now(). Returns '
  '{ "revoked_count": n }. Called exclusively by the revoke-contact-card '
  'edge function. Bypasses RLS via SECURITY DEFINER — see migration '
  'header for the safety argument.';

REVOKE ALL ON FUNCTION public.revoke_contact_card_cascade(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_contact_card_cascade(uuid, text) TO authenticated;
-- Service-role is implicit on SECURITY DEFINER + GRANT TO authenticated;
-- the edge function calls with the user's JWT and the function runs
-- as its owner (postgres / supabase_admin per cluster).

COMMIT;
