-- ============================================================
-- MIGRATION: 20260514000003_workspace_members_owner_hardening.sql
-- PURPOSE:   Close three live privilege-integrity gaps on
--            workspace_members + workspaces:
--
--   1. Admin → owner promotion: workspace_members_update permits
--      admins to UPDATE other members' rows, with no WITH CHECK
--      on the role column.  An admin can run
--          UPDATE workspace_members SET role='owner' WHERE …
--      to create a second owner, then optionally remove the first.
--
--   2. Direct owner_id rewrite: the `authenticated` role has UPDATE
--      privilege on the `owner_id` column of `public.workspaces`,
--      and the workspaces_update RLS policy permits any admin to
--      UPDATE the row.  An admin can rewrite owner_id directly,
--      bypassing `transfer_workspace_ownership` (and its audit log).
--
--   3. Sole-owner self-brick: workspace_members_delete permits
--      `user_id = auth.uid()` regardless of role.  The sole owner
--      of a workspace can delete their own membership row, leaving
--      `workspaces.owner_id` pointing at a now-detached user and
--      no role='owner' row in workspace_members — workspace becomes
--      permanently un-administrable except via service_role.
--
-- ISSUE:     #39  (Pulse-1)
-- EPIC:      #33  (Workspace data-isolation hardening)
-- PLAN DOC:  docs/plans/2026-05-14-team-mgmt-audit-revisal.md  § A.3
--
-- CASCADE SAFETY:
--   `hard_delete_workspace` (20260405000004) issues a direct
--   `DELETE FROM workspaces` which fires FK-cascade row-deletes on
--   workspace_members.  Those cascaded deletes will fire our new
--   row-level last-owner trigger — including on the owner's row,
--   which would falsely raise.  We avoid this by adding a paired
--   BEFORE DELETE trigger on `workspaces` itself that sets a
--   transaction-local GUC; the workspace_members trigger checks
--   the GUC and returns OLD when the parent workspace is being
--   deleted in the same transaction.
-- ============================================================

BEGIN;

-- ── 1. Skip-flag trigger on workspaces (cascade-safety) ─────────
-- Sets a transaction-local GUC so the workspace_members trigger
-- can detect "I am being fired by a parent-workspace deletion".
-- The flag auto-resets at COMMIT/ROLLBACK because is_local=true.

CREATE OR REPLACE FUNCTION public.workspaces_before_delete_set_skip_flag()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.skip_last_owner_check', 'on', true);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS workspaces_before_delete_set_skip_flag
  ON public.workspaces;

CREATE TRIGGER workspaces_before_delete_set_skip_flag
BEFORE DELETE ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.workspaces_before_delete_set_skip_flag();


-- ── 2. Last-owner guard trigger on workspace_members ────────────
-- Fires BEFORE UPDATE OR DELETE.  Raises when the operation would
-- leave the workspace with zero `role='owner'` rows.
--
-- Skips when:
--   - The skip-flag GUC is set (parent workspace is being deleted)
--   - The row being changed is NOT an owner row in OLD (irrelevant case)
--   - The OLD row's role IS 'owner' but NEW.role is still 'owner'
--     (UPDATE not changing the role; nothing to protect against)

CREATE OR REPLACE FUNCTION public.workspace_members_protect_last_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_remaining_owners int;
  v_demoting_or_removing_owner boolean;
BEGIN
  -- Fast-path skip: parent workspace deletion is in flight
  IF current_setting('app.skip_last_owner_check', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Only care about ops that strip owner status from an owner row
  v_demoting_or_removing_owner :=
       (TG_OP = 'DELETE' AND OLD.role = 'owner')
    OR (TG_OP = 'UPDATE' AND OLD.role = 'owner' AND NEW.role <> 'owner');

  IF NOT v_demoting_or_removing_owner THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Would any owner remain after this row's change?
  SELECT count(*)
    INTO v_remaining_owners
  FROM   public.workspace_members
  WHERE  workspace_id = OLD.workspace_id
    AND  role          = 'owner'
    AND  user_id      <> OLD.user_id;

  IF v_remaining_owners = 0 THEN
    RAISE EXCEPTION
      'cannot remove or demote the last owner of workspace %; transfer ownership first',
      OLD.workspace_id
      USING ERRCODE = 'check_violation',
            HINT    = 'call public.transfer_workspace_ownership(workspace_id, new_owner_id) before leaving';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS workspace_members_protect_last_owner
  ON public.workspace_members;

CREATE TRIGGER workspace_members_protect_last_owner
BEFORE UPDATE OR DELETE ON public.workspace_members
FOR EACH ROW
EXECUTE FUNCTION public.workspace_members_protect_last_owner();


-- ── 3. Lock owner_id column from direct UPDATE ─────────────────
-- Force routing through `transfer_workspace_ownership` (SECURITY
-- DEFINER, runs as the function owner, retains UPDATE on owner_id).
-- service_role keeps UPDATE for ops use; anon/authenticated lose it.

REVOKE UPDATE (owner_id) ON public.workspaces FROM anon, authenticated;


-- ── 4. Add WITH CHECK on workspace_members_update ──────────────
-- Forbid admins from promoting anyone to 'owner' via raw UPDATE.
-- Demoting the current owner is forbidden by the trigger above;
-- promoting to owner is forbidden here.  Both layers reinforce.

DROP POLICY IF EXISTS workspace_members_update ON public.workspace_members;

CREATE POLICY workspace_members_update ON public.workspace_members
  FOR UPDATE
  USING (
    user_id <> auth.uid()
    AND public.wm_is_admin(workspace_id, auth.uid())
  )
  WITH CHECK (
    user_id <> auth.uid()
    AND public.wm_is_admin(workspace_id, auth.uid())
    AND role IN ('admin', 'member', 'viewer')
  );


COMMIT;

-- ── Post-deploy verification (run manually after apply) ─────────
--
-- 1. Triggers in place:
--      SELECT trigger_name, action_timing, event_manipulation
--      FROM   information_schema.triggers
--      WHERE  event_object_schema = 'public'
--        AND  event_object_table IN ('workspaces','workspace_members')
--        AND  trigger_name LIKE '%owner%' OR trigger_name LIKE '%skip%';
--      -- expect: workspaces_before_delete_set_skip_flag (BEFORE DELETE)
--      --         workspace_members_protect_last_owner   (BEFORE UPDATE, BEFORE DELETE)
--
-- 2. owner_id column GRANT:
--      SELECT grantee, privilege_type, column_name
--      FROM   information_schema.column_privileges
--      WHERE  table_schema = 'public'
--        AND  table_name   = 'workspaces'
--        AND  column_name  = 'owner_id'
--        AND  grantee     IN ('anon','authenticated')
--        AND  privilege_type = 'UPDATE';
--      -- expect: 0 rows
--
-- 3. WITH CHECK on workspace_members_update:
--      SELECT policyname, with_check::text
--      FROM   pg_policies
--      WHERE  schemaname='public' AND tablename='workspace_members'
--        AND  policyname='workspace_members_update';
--      -- expect: with_check mentions  role IN ('admin','member','viewer')
--
-- 4. Behavioural smoke (run as admin of test workspace):
--      - UPDATE workspace_members SET role='owner' WHERE user_id='<other_member>'
--        → expect: new row policy violation (WITH CHECK fails)
--      - UPDATE workspaces SET owner_id='<self>' WHERE id='<workspace>'
--        → expect: permission denied for column owner_id
--      - DELETE FROM workspace_members WHERE user_id='<self_when_sole_owner>'
--        → expect: cannot remove or demote the last owner …
--      - SELECT public.transfer_workspace_ownership('<ws>', '<other_member>')
--        → expect: succeeds (SECURITY DEFINER bypasses both guards)
--      - hard_delete_workspace('<test_ws>')
--        → expect: succeeds (skip-flag trigger lets cascade through)
