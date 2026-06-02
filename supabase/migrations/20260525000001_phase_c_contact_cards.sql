-- ============================================================
-- MIGRATION: 20260525000001_phase_c_contact_cards.sql
-- PURPOSE:   Phase C — contact-card sharing protocol.
--            Pulse↔Pulse + non-Pulse vCard + Received inbox +
--            forwarding chain + revocation + bulk Accept dedup.
--
-- SCOPE:     Two new tables (contact_cards, card_send_blocks) +
--            one column added to contacts (possible_duplicate_of).
--            Five indexes + nine RLS policies. Single migration
--            because decisions #6 (forwarding) and #9 (revocation)
--            are coupled via the self-FK; splitting them would
--            add rollback complexity without isolation benefit.
--
-- DESIGN:
--   * contact_cards.sender_user_id is TEXT (matches contacts.user_id
--     convention). Every RLS policy comparing to auth.uid() casts
--     auth.uid()::text on the sender side; auth.uid() (uuid) is
--     used directly on the recipient_user_id side.
--   * card_send_blocks lookup happens via service role at edge
--     function time, NOT via RLS, so one user's block list is
--     never readable by the blocked sender.
--   * Public landing-page rendering bypasses RLS entirely —
--     resolve-card-deeplink + render-contact-vcard run as service
--     role and apply their own predicate (revoked / expired /
--     consumed / blocked).
--   * card_snapshot is jsonb; field whitelist is enforced by the
--     create-contact-card edge function serializer, NOT in DB.
--   * possible_duplicate_of on contacts is gated by the existing
--     contacts_owner_all policy — no new policy needed for the
--     column itself.
--   * TODO(phase-7): all RLS sites tagged in-line — when Sub-PR 7
--     ships user_has_permission(), swap auth.uid() owner checks
--     for user_has_permission('cards.send') predicates.
--
-- DATE:      2026-05-25 (one day past Phase B's last migration)
-- SAFE:      All ADD COLUMN / CREATE TABLE are metadata-only DDL.
--            No data rewrite on PG13+.
-- ROLLBACK:
--   BEGIN;
--     ALTER TABLE public.contacts DROP COLUMN IF EXISTS possible_duplicate_of;
--     DROP TABLE IF EXISTS public.card_send_blocks CASCADE;
--     DROP TABLE IF EXISTS public.contact_cards CASCADE;
--   COMMIT;
-- ============================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- ============================================================
-- 1. contact_cards  (new)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contact_cards (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id          text        NOT NULL,
  recipient_hint          text                 CHECK (recipient_hint IS NULL OR length(recipient_hint) BETWEEN 1 AND 320),
  recipient_user_id       uuid                 REFERENCES auth.users(id) ON DELETE SET NULL,
  card_snapshot           jsonb       NOT NULL,
  intro_note              text                 CHECK (intro_note IS NULL OR length(intro_note) <= 500),
  token_policy            text        NOT NULL DEFAULT 'multi_use'
                                       CHECK (token_policy IN ('multi_use', 'single_use')),
  is_forwardable          boolean     NOT NULL DEFAULT true,
  forwarded_from_card_id  uuid                 REFERENCES public.contact_cards(id) ON DELETE SET NULL,
  expires_at              timestamptz,
  revoked_at              timestamptz,
  consumed_at             timestamptz,
  view_count              integer     NOT NULL DEFAULT 0
                                       CHECK (view_count >= 0),
  created_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.contact_cards IS
  'Phase C contact-card protocol. Sender shares a frozen card_snapshot '
  'of one of their contacts with a recipient (Pulse user or non-Pulse '
  'email). PK doubles as the share token; landing page lives at '
  'https://go.pulse.logosvision.org/c/{id}. Revoked/expired/consumed '
  'rows return HTTP 410 (never 404) per Adversarial Adam UUID-probing '
  'defense.';

COMMENT ON COLUMN public.contact_cards.sender_user_id IS
  'auth.users.id stored as TEXT to match contacts.user_id convention. '
  'RLS cast: auth.uid()::text. No FK — a TEXT column cannot reference '
  'auth.users.uuid; like card_send_blocks.sender_user_id, cleanup of a '
  'purged user''s outbound cards is handled by delete_user_account, not '
  'an FK cascade.';

COMMENT ON COLUMN public.contact_cards.recipient_user_id IS
  'Eager-resolved Pulse user (open Q#1: eager). Set at create time if '
  'recipient_hint matches an auth.users.email. NULL otherwise — late '
  'sign-up triggers a service-role backfill keyed by recipient_hint.';

COMMENT ON COLUMN public.contact_cards.card_snapshot IS
  'Frozen jsonb snapshot. Field whitelist enforced by edge-function '
  'serializer (allowed: name, email, phone, company, title, address, '
  'avatar_color). notes / case_notes / private_notes / import_* / '
  'archived_at / is_vip / role MUST NEVER appear here.';

COMMENT ON COLUMN public.contact_cards.token_policy IS
  'multi_use (default) = redeemable by any number of recipients. '
  'single_use = atomically marked consumed_at on first Accept (NOT '
  'first landing view). Bulk-send + QR paths force multi_use.';

COMMENT ON COLUMN public.contact_cards.revoked_at IS
  'Set by both Unsend (<30 min, view_count=0) and Revoke (any time) — '
  'same column, distinction is linguistic only. Cascade behavior at '
  'write time (WITH RECURSIVE) handled by edge function, not DB.';

COMMENT ON COLUMN public.contact_cards.view_count IS
  'Atomic counter incremented per landing-page render. Internal abuse '
  'signal only — NEVER surfaced to sender UI as a number (R-20). '
  'Sender UI shows binary "Viewed / Not yet viewed" only.';

-- ----- Indexes -----

CREATE INDEX IF NOT EXISTS idx_contact_cards_sender_recent
  ON public.contact_cards (sender_user_id, created_at DESC);
-- Sent Cards inbox (R-23) + rate-limit count (R-21): the same
-- (sender_user_id, created_at) ordering serves both reads, so no
-- duplicate index for the rate-limit window.

CREATE INDEX IF NOT EXISTS idx_contact_cards_recipient_user
  ON public.contact_cards (recipient_user_id, created_at DESC)
  WHERE recipient_user_id IS NOT NULL;
-- Received inbox primary path (R-8). Partial — skips rows with no
-- resolved Pulse recipient.

CREATE INDEX IF NOT EXISTS idx_contact_cards_recipient_hint
  ON public.contact_cards (recipient_hint)
  WHERE recipient_hint IS NOT NULL
    AND recipient_user_id IS NULL;
-- Claim-on-signup: when an email-only card waits for the recipient
-- to register, the post-signup backfill scans this index by hint.

CREATE INDEX IF NOT EXISTS idx_contact_cards_chain
  ON public.contact_cards (forwarded_from_card_id)
  WHERE forwarded_from_card_id IS NOT NULL;
-- Cascade revocation WITH RECURSIVE traversal (R-17). Partial —
-- ~90% of rows are roots and never reached by the recursion.

CREATE INDEX IF NOT EXISTS idx_contact_cards_abuse_recent
  ON public.contact_cards (created_at DESC)
  WHERE view_count > 50;
-- Internal abuse query (R-20): "cards with anomalous view counts in
-- the last hour". Partial keeps this cheap; not user-facing.

ALTER TABLE public.contact_cards ENABLE ROW LEVEL SECURITY;

-- ----- RLS: sender (owner) policies -----

DROP POLICY IF EXISTS contact_cards_sender_select ON public.contact_cards;
CREATE POLICY contact_cards_sender_select
  ON public.contact_cards FOR SELECT
  TO authenticated
  USING (
    sender_user_id = auth.uid()::text
    -- TODO(phase-7): replace with public.user_has_permission(NULL, 'cards.send')
    -- once Sub-PR 7 ships custom-roles. Phase C uses owner-only check.
  );

DROP POLICY IF EXISTS contact_cards_sender_insert ON public.contact_cards;
CREATE POLICY contact_cards_sender_insert
  ON public.contact_cards FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_user_id = auth.uid()::text
    -- TODO(phase-7): replace with public.user_has_permission(NULL, 'cards.send')
  );

DROP POLICY IF EXISTS contact_cards_sender_update ON public.contact_cards;
CREATE POLICY contact_cards_sender_update
  ON public.contact_cards FOR UPDATE
  TO authenticated
  USING (sender_user_id = auth.uid()::text)
  WITH CHECK (sender_user_id = auth.uid()::text);
-- Sender Revoke writes revoked_at via this policy. Service layer
-- enforces "no other column may be UPDATEd by sender" — Magi
-- "card editing after send" out-of-scope, enforced in code.

DROP POLICY IF EXISTS contact_cards_sender_delete ON public.contact_cards;
CREATE POLICY contact_cards_sender_delete
  ON public.contact_cards FOR DELETE
  TO authenticated
  USING (sender_user_id = auth.uid()::text);
-- Reserved for hard-purge admin paths. UI Revoke writes revoked_at,
-- never DELETE.

-- ----- RLS: recipient (resolved Pulse user) policy -----

DROP POLICY IF EXISTS contact_cards_recipient_select ON public.contact_cards;
CREATE POLICY contact_cards_recipient_select
  ON public.contact_cards FOR SELECT
  TO authenticated
  USING (
    recipient_user_id = auth.uid()
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  );
-- Resolved Pulse recipient reads their own Received inbox. Revoked
-- and expired rows are filtered by RLS so the recipient's app never
-- sees them; landing-page rendering for those uses the edge function
-- service role and returns 410 Gone explicitly.

-- No anon / public-token RLS policy. Landing page reads happen
-- exclusively via resolve-card-deeplink + render-contact-vcard edge
-- functions running with the service-role key.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_cards TO authenticated;

-- ============================================================
-- 2. card_send_blocks  (new)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.card_send_blocks (
  blocked_by_user_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_user_id      text        NOT NULL,
  blocked_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocked_by_user_id, sender_user_id)
);

COMMENT ON TABLE public.card_send_blocks IS
  'Recipient-driven block list. (blocked_by_user_id, sender_user_id) '
  'composite PK provides natural dedup. Looked up by service role at '
  'create-contact-card / create-contact-card-bundle time — never '
  'exposed to the blocked sender via RLS. Loose FK on sender_user_id '
  'on purpose: block survives sender account deletion.';

COMMENT ON COLUMN public.card_send_blocks.sender_user_id IS
  'TEXT (matches contacts.user_id + contact_cards.sender_user_id '
  'convention). No FK so the block persists if the sender deletes + '
  're-registers.';

ALTER TABLE public.card_send_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS card_send_blocks_select ON public.card_send_blocks;
CREATE POLICY card_send_blocks_select
  ON public.card_send_blocks FOR SELECT
  TO authenticated
  USING (blocked_by_user_id = auth.uid());

DROP POLICY IF EXISTS card_send_blocks_insert ON public.card_send_blocks;
CREATE POLICY card_send_blocks_insert
  ON public.card_send_blocks FOR INSERT
  TO authenticated
  WITH CHECK (blocked_by_user_id = auth.uid());

DROP POLICY IF EXISTS card_send_blocks_delete ON public.card_send_blocks;
CREATE POLICY card_send_blocks_delete
  ON public.card_send_blocks FOR DELETE
  TO authenticated
  USING (blocked_by_user_id = auth.uid());

-- No UPDATE policy. Blocks are immutable; to "edit", delete + re-insert.

GRANT SELECT, INSERT, DELETE ON public.card_send_blocks TO authenticated;

-- ============================================================
-- 3. contacts.possible_duplicate_of  (alter)
-- ============================================================

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS possible_duplicate_of uuid
    REFERENCES public.contacts(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.contacts.possible_duplicate_of IS
  'Phase C bulk-Accept dedup link (Magi D-12). When a bulk Accept '
  'matches an existing contact, a NEW row is created with this FK '
  'pointing to the existing match — never overwrites recipient data. '
  'Existing contacts_owner_all policy (user_id = auth.uid()::text) '
  'gates this column; no new RLS policy required. Verified against '
  'supabase/migrations/20260119062007_remote_schema.sql:5496.';

-- No new index on possible_duplicate_of. The read pattern is single-
-- row fetch by PK on detail-render; per-row, not per-list. If a later
-- "Review duplicates" UI scans by this column at list scale, add
-- (user_id, possible_duplicate_of) WHERE possible_duplicate_of IS NOT NULL.

COMMIT;
