-- 20260521000004_workspace_integrations_rls_to_user_has_permission.sql
-- Issue #42 Sub-PR 4b — migrate workspace_integrations RLS policies from
-- `role IN ('owner','admin')` literals to
-- `user_has_permission(workspace_id, 'integrations.workspace.manage')`.
--
-- Resource scope: workspace_integrations only.
-- 3 policies migrated (INSERT/UPDATE/DELETE). 1 SELECT policy untouched.
--
-- Behaviour: owner+admin have integrations.workspace.manage in the catalog
-- seed; member+viewer do not. Truth table preserved 1:1.
--
-- Secondary effect: the pre-migration UPDATE policy had only USING (no
-- WITH CHECK), letting a privileged caller move a row to a workspace
-- where they lacked permission. The new policy uses WITH CHECK = USING
-- to align pre- and post-update permission requirements. This matches
-- the pattern established in Sub-PR 4a (workspace_groups).

BEGIN;

DROP POLICY IF EXISTS workspace_integrations_insert ON public.workspace_integrations;
CREATE POLICY workspace_integrations_insert
  ON public.workspace_integrations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_permission(workspace_id, 'integrations.workspace.manage')
  );

DROP POLICY IF EXISTS workspace_integrations_update ON public.workspace_integrations;
CREATE POLICY workspace_integrations_update
  ON public.workspace_integrations
  FOR UPDATE
  TO authenticated
  USING (
    public.user_has_permission(workspace_id, 'integrations.workspace.manage')
  )
  WITH CHECK (
    public.user_has_permission(workspace_id, 'integrations.workspace.manage')
  );

DROP POLICY IF EXISTS workspace_integrations_delete ON public.workspace_integrations;
CREATE POLICY workspace_integrations_delete
  ON public.workspace_integrations
  FOR DELETE
  TO authenticated
  USING (
    public.user_has_permission(workspace_id, 'integrations.workspace.manage')
  );

-- SELECT policy unchanged — enforces membership only, no role gate.

COMMIT;
