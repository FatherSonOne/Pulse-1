-- 20260521000006_workspaces_update_rls_to_user_has_permission.sql
-- Issue #42 Sub-PR 4e — migrate workspaces_update RLS from wm_is_admin()
-- to user_has_permission(id, 'workspace.update').
--
-- Resource scope: workspaces (UPDATE policy only).
-- workspaces_select / workspaces_select_deleted / workspaces_insert /
-- workspaces_delete are unchanged — they use owner_id or membership
-- EXISTS clauses, not role checks.
--
-- Helper retirement
--   wm_is_admin / wm_is_member are still referenced by
--   public.user_has_workspace_access() and possibly app code, so they
--   stay in place. Final retirement scheduled for a later cleanup PR
--   once consumers are inventoried.
--
-- OR clause preserved
--   The `owner_id = auth.uid()` OR clause is kept as a defensive fallback
--   for legacy workspaces where owner_id might not have a matching
--   workspace_members row (e.g. pre-bootstrap_workspace creations).
--   In normal operation it's redundant — the owner row will always have
--   workspace.update — but dropping it could break edge cases.
--
-- WITH CHECK added
--   Original policy had USING only. New policy uses WITH CHECK = USING
--   so post-update row remains visible to the caller. Matches the
--   hardening pattern from Sub-PR 4a / 4b / 4d.

BEGIN;

DROP POLICY IF EXISTS workspaces_update ON public.workspaces;
CREATE POLICY workspaces_update
  ON public.workspaces
  FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.user_has_permission(id, 'workspace.update')
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR public.user_has_permission(id, 'workspace.update')
  );

COMMIT;
