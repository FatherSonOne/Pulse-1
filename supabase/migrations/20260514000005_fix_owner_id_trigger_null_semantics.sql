-- ============================================================
-- MIGRATION: 20260514000005_fix_owner_id_trigger_null_semantics.sql
-- PURPOSE:   The workspaces_protect_owner_id trigger introduced in
--            20260514000004 used `<> 'on'` to gate the RAISE branch:
--
--              IF current_setting('app.allow_owner_id_change', true) <> 'on' THEN
--                RAISE EXCEPTION …
--              END IF;
--
--            `current_setting(name, true)` returns NULL when the GUC
--            is unset.  `NULL <> 'on'` evaluates to NULL, which the IF
--            statement treats as FALSE.  Result: the trigger never
--            raises in the common case (GUC unset = direct UPDATE
--            attempt), and admins can still rewrite owner_id directly.
--            A behavioural probe on prod confirmed this.
--
--            Fix: use `IS DISTINCT FROM 'on'`, which returns TRUE for
--            NULL inputs, correctly raising when the bypass GUC isn't
--            explicitly set to 'on'.
--
-- ISSUE:     #39  (Pulse-1)
-- PLAN DOC:  docs/plans/2026-05-14-team-mgmt-audit-revisal.md  § A.3
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.workspaces_protect_owner_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    -- NULL-safe: when GUC is unset, current_setting(...) IS NULL,
    -- and NULL IS DISTINCT FROM 'on' is TRUE → raises.
    IF current_setting('app.allow_owner_id_change', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION
        'direct UPDATE of workspaces.owner_id is forbidden; use public.transfer_workspace_ownership(workspace_id, new_owner_id)'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;

-- ── Post-deploy verification ────────────────────────────────────
--
-- Probe (rejects expected) — run inside a function so the result row
-- carries the sqlstate back to the caller (RAISE NOTICE doesn't
-- surface via Supabase MCP):
--
--   CREATE OR REPLACE FUNCTION pg_temp.probe_owner_id_protection()
--   RETURNS TABLE(sqlstate text, message text) LANGUAGE plpgsql AS $fn$
--   DECLARE v_ws uuid; v_old uuid; v_new uuid; v_sqlstate text; v_msg text;
--   BEGIN
--     SELECT id, owner_id INTO v_ws, v_old FROM public.workspaces
--       WHERE deleted_at IS NULL ORDER BY id LIMIT 1;
--     SELECT id INTO v_new FROM auth.users WHERE id <> v_old ORDER BY id LIMIT 1;
--     BEGIN
--       UPDATE public.workspaces SET owner_id = v_new WHERE id = v_ws;
--       v_sqlstate := 'NONE'; v_msg := 'PROBE FAILED — trigger did not raise';
--       UPDATE public.workspaces SET owner_id = v_old WHERE id = v_ws;
--     EXCEPTION WHEN OTHERS THEN
--       GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
--     END;
--     RETURN QUERY SELECT v_sqlstate, v_msg;
--   END $fn$;
--   SELECT * FROM pg_temp.probe_owner_id_protection();
--   -- expect: sqlstate='23514' (check_violation) + the 'direct UPDATE … forbidden' message
