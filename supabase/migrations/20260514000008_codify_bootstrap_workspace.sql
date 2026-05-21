-- ============================================================
-- MIGRATION: 20260514000008_codify_bootstrap_workspace.sql
-- PURPOSE:   Codify the public.bootstrap_workspace SECURITY DEFINER
--            function that already exists in production but is NOT
--            tracked in the migration tree.  Discovered during the
--            2026-05-14 audit; see #46.
--
--            grep -r bootstrap_workspace supabase/migrations/ → 0 files
--            but pg_proc shows the function live in prod (added via
--            the dashboard or a long-forgotten one-off).  This puts
--            it under version control so future devs can read the
--            contract.
--
--            Function body is captured verbatim from the live function
--            definition (queried via pg_get_functiondef on
--            ucaeuszgoihoyrvhewxk).  CREATE OR REPLACE so the migration
--            is idempotent against the live definition that already
--            exists.
--
--            The function guarantees atomicity: both the workspaces
--            insert and the workspace_members owner-row insert happen
--            in the same transaction (the plpgsql function body), so
--            if either fails the workspace never appears half-created.
--            This is the fix for the orphan workspace pattern that
--            #39's cleanup found (an empty 'Dev Team' workspace with
--            no member rows that #46's TS callsite produced).
--
-- ISSUE:     #46  (Pulse-1)  — Phase 1: codify the RPC
-- PLAN DOC:  N/A (issue-only)
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.bootstrap_workspace(
  p_name        text,
  p_slug        text,
  p_description text DEFAULT NULL,
  p_plan        text DEFAULT 'free',
  p_id          uuid DEFAULT gen_random_uuid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.workspaces (id, name, slug, description, owner_id, plan)
  VALUES (p_id, p_name, p_slug, p_description, v_user_id, p_plan);

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (p_id, v_user_id, 'owner');

  RETURN p_id;
END;
$$;

COMMENT ON FUNCTION public.bootstrap_workspace(text, text, text, text, uuid) IS
  'Atomic workspace creation: inserts the workspaces row + the owner workspace_members row '
  'in the same transaction (the plpgsql function body).  SECURITY DEFINER so it bypasses '
  'the workspace_members_insert RLS chicken-and-egg (the new row IS the bootstrap caller).';

-- Match the live GRANTs.  authenticated calls from the client; anon
-- and service_role retained for parity with the existing live state
-- (auth.uid() check inside still gates anon to NULL → exception).
REVOKE ALL  ON FUNCTION public.bootstrap_workspace(text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_workspace(text, text, text, text, uuid)
  TO anon, authenticated, service_role;

COMMIT;
