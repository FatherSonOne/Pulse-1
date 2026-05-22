-- ============================================================
-- DRAFT — Phase 2 schema for cross-org handle-lookup discovery
--
-- STATUS:    Design artifact. NOT a migration. Gated behind accord's
--            Phase 1.5 → Phase 2 criteria (see
--            docs/pulse-users-discovery-spec.md § Phase gate criteria).
--            Do not move under supabase/migrations/ until:
--              - C2 has been in prod ≥1 week
--              - Settings opt-in UI is in design / build
--              - Legal sign-off on cross-org user-locatable data
--
-- WHAT THIS ADDS:
--   1. user_profiles.is_discoverable_by_handle  — opt-in toggle (default OFF)
--   2. public.pulse_user_discovery_blocks       — caller→target block list
--   3. public.pulse_user_lookup_audit           — rate-limit ledger
--      (caller_id, called_at) — used by Phase 2 findByHandle to enforce
--      per-caller 30 lookups / 5min token bucket.
--
-- WHAT THIS DELIBERATELY DOES NOT ADD:
--   - user_profiles.public_handle  — the existing user_profiles.handle
--     column (UNIQUE, CHECK valid_handle ^[a-z0-9_]{3,30}$) already
--     serves this purpose. No second handle column.
--   - user_profiles.discoverable_fields jsonb  — accord's spec mentions
--     this for per-field opt-in; deferred to Phase 2.5 once we have UX
--     telemetry on whether users actually want finer-grained control
--     than is_discoverable_by_handle.
--
-- INDEXES JUSTIFIED:
--   - idx_user_profiles_handle_discoverable: partial covering index for
--     the exact-match lookup that runs on every findByHandle call.
--     Partial WHERE is_discoverable_by_handle keeps it small.
--   - idx_pulse_user_discovery_blocks_blocked_blocker: reverse-lookup
--     "is the caller blocked by this target?", run on every lookup.
--   - idx_pulse_user_lookup_audit_caller_time: caller-scoped time-range
--     scan for the 30-per-5min window check.
-- ============================================================

BEGIN;

-- ---- 1. user_profiles.is_discoverable_by_handle -----------------

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_discoverable_by_handle boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_profiles.is_discoverable_by_handle IS
  'Phase 2 opt-in: when true, this user is findable by exact handle match
   via discover_pulse_users (handle_lookup scope). Default false. The
   Settings opt-in UI is the only legitimate writer.';

-- Partial covering index for the Phase 2 exact-handle lookup.
-- Small because most users do not opt in.
CREATE INDEX IF NOT EXISTS idx_user_profiles_handle_discoverable
  ON public.user_profiles (lower(handle))
  WHERE is_discoverable_by_handle = true AND handle IS NOT NULL;

-- ---- 2. pulse_user_discovery_blocks -----------------------------

CREATE TABLE IF NOT EXISTS public.pulse_user_discovery_blocks (
  blocker_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

COMMENT ON TABLE public.pulse_user_discovery_blocks IS
  'Phase 2 abuse lever. If (blocker_id, blocked_id) exists, the lookup
   from blocked_id for blocker_id returns null indistinguishably from
   "no match". User-facing: target blocks caller.';

-- Reverse-lookup index: hot path is "is caller blocked by candidate?".
CREATE INDEX IF NOT EXISTS idx_pulse_user_discovery_blocks_blocked_blocker
  ON public.pulse_user_discovery_blocks (blocked_id, blocker_id);

ALTER TABLE public.pulse_user_discovery_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_user_discovery_blocks FORCE ROW LEVEL SECURITY;

-- A user can see only their own block list (rows where they are the blocker).
CREATE POLICY pulse_user_discovery_blocks_select
  ON public.pulse_user_discovery_blocks FOR SELECT TO authenticated
  USING (blocker_id = auth.uid());

CREATE POLICY pulse_user_discovery_blocks_insert
  ON public.pulse_user_discovery_blocks FOR INSERT TO authenticated
  WITH CHECK (blocker_id = auth.uid());

CREATE POLICY pulse_user_discovery_blocks_delete
  ON public.pulse_user_discovery_blocks FOR DELETE TO authenticated
  USING (blocker_id = auth.uid());

-- No UPDATE policy — blocks are immutable; delete + re-insert.

-- ---- 3. pulse_user_lookup_audit (rate-limit ledger) -------------

CREATE TABLE IF NOT EXISTS public.pulse_user_lookup_audit (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caller_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  called_at   timestamptz NOT NULL DEFAULT now(),
  hit         boolean     NOT NULL DEFAULT false
);

COMMENT ON TABLE public.pulse_user_lookup_audit IS
  'Phase 2 rate-limit ledger. Each row = one handle-lookup invocation.
   discover_pulse_users (handle_lookup) checks COUNT(*) WHERE caller_id =
   auth.uid() AND called_at > now() - interval ''5 minutes'' < 30.
   hit=true means a row was returned; analytics only — not used by the
   limiter. Retention: 7 days via scheduled cleanup (Tempo handoff).';

-- Caller-scoped time-range scan — covers the 5-minute window count.
CREATE INDEX IF NOT EXISTS idx_pulse_user_lookup_audit_caller_time
  ON public.pulse_user_lookup_audit (caller_id, called_at DESC);

ALTER TABLE public.pulse_user_lookup_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_user_lookup_audit FORCE ROW LEVEL SECURITY;

-- Callers may not read this table directly — the RPC reads it under
-- SECURITY DEFINER. No SELECT / INSERT / UPDATE / DELETE policies for
-- authenticated role = fail closed.

COMMIT;
