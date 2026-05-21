-- 20260521000005_workspace_members_rls_to_user_has_permission.sql
-- Issue #42 Sub-PR 4d — migrate workspace_members RLS from `wm_is_admin()` /
-- `wm_is_member()` helpers to `user_has_permission(workspace_id, '<key>')`.
--
-- Resource scope: workspace_members only.
-- 4 policies migrated. Triggers untouched (the #39 last-owner protection
-- BEFORE UPDATE/DELETE trigger is independent of RLS).
--
-- Recursion concern (intentionally addressed)
--   user_has_permission() is SECURITY DEFINER and runs as `postgres`, which
--   has BYPASSRLS. When it queries workspace_members internally, RLS is
--   skipped. So RLS on workspace_members that calls user_has_permission()
--   does NOT recurse — the function reads the table directly without
--   re-invoking the RLS policy.
--
-- Helpers wm_is_admin / wm_is_member
--   Kept intact. Still used by workspaces_update RLS — Sub-PR 4e will
--   migrate that policy, after which the helpers can be retired.
--
-- Permission key mapping
--   SELECT  -> members.read         (granted to all 4 system roles, so 1:1 with wm_is_member)
--   INSERT  -> members.invite       (admin+ only, matches wm_is_admin) PLUS self-bootstrap clause kept verbatim
--   UPDATE  -> members.update_role  (admin+ only, matches wm_is_admin) PLUS user_id<>auth.uid() and role-escalation guards kept verbatim
--   DELETE  -> members.remove       (admin+ only, matches wm_is_admin) PLUS self-leave clause kept verbatim

BEGIN;

-- --- SELECT -----------------------------------------------------------------
DROP POLICY IF EXISTS workspace_members_select ON public.workspace_members;
CREATE POLICY workspace_members_select
  ON public.workspace_members
  FOR SELECT
  TO authenticated
  USING (
    public.user_has_permission(workspace_id, 'members.read')
  );

-- --- INSERT -----------------------------------------------------------------
-- Two paths: admin invites OR user inserts themselves as owner (bootstrap).
-- The self-bootstrap clause is preserved verbatim — bootstrap_workspace()
-- is SECURITY DEFINER and bypasses RLS, but direct-INSERT callers
-- (older clients) may still take this path.
DROP POLICY IF EXISTS workspace_members_insert ON public.workspace_members;
CREATE POLICY workspace_members_insert
  ON public.workspace_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_permission(workspace_id, 'members.invite')
    OR (
      user_id = auth.uid()
      AND role = 'owner'
      AND EXISTS (
        SELECT 1 FROM public.workspaces w
         WHERE w.id = workspace_members.workspace_id
           AND w.owner_id = auth.uid()
      )
    )
  );

-- --- UPDATE -----------------------------------------------------------------
-- - user_id <> auth.uid()   : admin can't mutate their own role (transfer-of-
--                              ownership goes through a dedicated RPC).
-- - role IN (...)            : role escalation guard from #39. Prevents an
--                              admin from promoting anyone to 'owner' through
--                              an UPDATE — only the transfer RPC can do that.
DROP POLICY IF EXISTS workspace_members_update ON public.workspace_members;
CREATE POLICY workspace_members_update
  ON public.workspace_members
  FOR UPDATE
  TO authenticated
  USING (
    user_id <> auth.uid()
    AND public.user_has_permission(workspace_id, 'members.update_role')
  )
  WITH CHECK (
    user_id <> auth.uid()
    AND public.user_has_permission(workspace_id, 'members.update_role')
    AND role IN ('admin','member','viewer')
  );

-- --- DELETE -----------------------------------------------------------------
-- Two paths: self-leave (user removes their own row) OR admin removes
-- another. The last-owner BEFORE DELETE trigger from #39 still blocks the
-- self-leave path if the caller is the only remaining owner.
DROP POLICY IF EXISTS workspace_members_delete ON public.workspace_members;
CREATE POLICY workspace_members_delete
  ON public.workspace_members
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.user_has_permission(workspace_id, 'members.remove')
  );

COMMIT;
