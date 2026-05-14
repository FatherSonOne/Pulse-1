-- ============================================================
-- MIGRATION: 20260514000006_billing_drift_log.sql
-- PURPOSE:   Capture every seat-sync failure or detected drift so the
--            reconciler edge function can pick them up and re-attempt.
--
--            Pulse's seat-sync path swallows failures into console.warn
--            at three sites:
--              - billingService.ts:333-336  (inner syncSeats catch)
--              - workspaceService.ts:658-663 (acceptInvite seat sync)
--              - workspaceService.ts:707-713 (removeMember seat sync)
--            Plus there's no sync at all for the auto_join_workspace_by_domain
--            trigger path (silent free seats forever).
--
--            This migration creates billing_drift_log as a durable queue
--            of "I tried to sync and failed" + "I detected drift" rows.
--            The reconciler edge function (deployed separately) consumes
--            the queue daily and marks rows resolved when Stripe matches
--            the live member count.
--
-- ISSUE:     #40  (Pulse-1)
-- PLAN DOC:  docs/plans/2026-05-14-team-mgmt-audit-revisal.md  § B.2
-- ============================================================

BEGIN;

-- ── Table ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.billing_drift_log (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  -- Where the drift was noticed.  Free text + CHECK to keep it lightweight
  -- but disciplined.  Add new values here as new entry points appear.
  source             text NOT NULL CHECK (source IN (
                       'accept_invite',
                       'remove_member',
                       'auto_join_domain',
                       'reconciler_diff',
                       'manual',
                       'other'
                     )),
  expected_quantity  integer,        -- DB-side member count when known (NULL if not computed)
  observed_quantity  integer,        -- Stripe quantity when known (NULL on swallowed sync errors)
  error_message      text,           -- Short message (typically the sync error)
  metadata           jsonb DEFAULT '{}'::jsonb,  -- structured extras (e.g. subscription_id)
  detected_at        timestamptz NOT NULL DEFAULT now(),
  resolved_at        timestamptz,
  resolved_by        text            -- 'reconciler' | 'manual' | edge-fn name | etc.
);

CREATE INDEX IF NOT EXISTS idx_billing_drift_unresolved
  ON public.billing_drift_log (workspace_id, detected_at DESC)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_billing_drift_by_workspace_time
  ON public.billing_drift_log (workspace_id, detected_at DESC);

COMMENT ON TABLE public.billing_drift_log IS
  'Durable queue of seat-sync failures and detected Stripe-vs-DB drift. '
  'Consumed by the billing-reconcile-seats edge function on cron.';


-- ── RLS ─────────────────────────────────────────────────────────

ALTER TABLE public.billing_drift_log ENABLE ROW LEVEL SECURITY;

-- Admins of the workspace can read their workspace's drift entries
-- (gives the UI a way to surface "billing is out of sync" if we ever want it).
DROP POLICY IF EXISTS billing_drift_log_select ON public.billing_drift_log;
CREATE POLICY billing_drift_log_select ON public.billing_drift_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      WHERE wm.workspace_id = public.billing_drift_log.workspace_id
        AND wm.user_id      = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

-- Direct INSERT from authenticated is forbidden — only the SECURITY DEFINER
-- helper below (or service_role) writes rows.  This stops a client from
-- spamming drift entries.
DROP POLICY IF EXISTS billing_drift_log_insert ON public.billing_drift_log;
CREATE POLICY billing_drift_log_insert ON public.billing_drift_log
  FOR INSERT TO authenticated
  WITH CHECK (false);

-- service_role bypasses RLS for UPDATE/DELETE; admins do not need direct
-- mutation rights from the client.


-- ── SECURITY DEFINER helper for the JS layer ───────────────────
--
-- The browser client cannot write to billing_drift_log directly (insert
-- policy = false).  This helper lets workspaceService / billingService
-- queue a drift entry without leaking service_role to the client.

CREATE OR REPLACE FUNCTION public.queue_billing_drift_entry(
  p_workspace_id      uuid,
  p_source            text,
  p_error_message     text DEFAULT NULL,
  p_expected_quantity integer DEFAULT NULL,
  p_observed_quantity integer DEFAULT NULL,
  p_metadata          jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller       uuid := auth.uid();
  v_is_member    boolean;
  v_id           uuid;
BEGIN
  -- Authn
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Authz: caller must be a current member of the target workspace.  No
  -- role restriction — any member's mutation can surface drift that's worth
  -- queueing (e.g. self-leave triggers the existing 403, which is also
  -- worth queueing).
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id      = v_caller
  ) INTO v_is_member;

  -- A user who just left their workspace will fail this check.  That's OK:
  -- the JS catches the exception and logs it; reconciler will eventually
  -- detect the drift on its own scan.
  IF NOT v_is_member THEN
    RAISE EXCEPTION 'caller is not a member of workspace %', p_workspace_id
      USING ERRCODE = '42501';
  END IF;

  -- Reject unknown sources defensively (also CHECK-constrained at table level)
  IF p_source NOT IN ('accept_invite', 'remove_member', 'auto_join_domain', 'reconciler_diff', 'manual', 'other') THEN
    RAISE EXCEPTION 'unknown drift source: %', p_source USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.billing_drift_log
    (workspace_id, source, expected_quantity, observed_quantity, error_message, metadata)
  VALUES
    (p_workspace_id, p_source, p_expected_quantity, p_observed_quantity, p_error_message, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_billing_drift_entry(uuid, text, text, integer, integer, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.queue_billing_drift_entry(uuid, text, text, integer, integer, jsonb) TO authenticated;

COMMENT ON FUNCTION public.queue_billing_drift_entry IS
  'Queue a billing-drift entry from the client without granting direct INSERT. '
  'Caller must be a current member of the workspace.';

COMMIT;

-- ── Post-deploy ────────────────────────────────────────────────
--
-- 1. After this migration applies, deploy the billing-reconcile-seats
--    edge function (supabase/functions/billing-reconcile-seats/).
--
-- 2. Schedule the reconciler via pg_cron once the service-role key is
--    available in pg_settings or vault.  Example (run from psql or
--    Supabase SQL editor, NOT this migration, because secrets shouldn't
--    live in git):
--
--      SELECT cron.schedule(
--        'billing-reconcile-seats-daily',
--        '0 6 * * *',   -- 06:00 UTC daily
--        $$
--          SELECT net.http_post(
--            url      := 'https://<project_ref>.supabase.co/functions/v1/billing-reconcile-seats',
--            headers  := jsonb_build_object(
--              'Content-Type',  'application/json',
--              'Authorization', 'Bearer ' || current_setting('app.service_role_key')
--            ),
--            body     := '{}'::jsonb,
--            timeout_milliseconds := 60000
--          );
--        $$
--      );
--
--    Set 'app.service_role_key' on the database via:
--      ALTER DATABASE postgres SET app.service_role_key = '<service_role_jwt>';
--
-- 3. Verify the cron entry:
--      SELECT jobid, schedule, jobname, active FROM cron.job
--      WHERE jobname = 'billing-reconcile-seats-daily';
