-- 20260521000003_workspace_groups_rls_to_user_has_permission.sql
-- Issue #42 Sub-PR 4a — migrate workspace_groups + workspace_group_members
-- RLS policies from `role IN ('owner','admin')` literals to
-- `user_has_permission(workspace_id, 'groups.manage')`.
--
-- Resource scope: workspace_groups, workspace_group_members.
-- 5 policies migrated (INSERT/UPDATE/DELETE on workspace_groups;
-- INSERT/DELETE on workspace_group_members). 2 SELECT policies stay
-- untouched — they enforce membership only, no role gating.
--
-- Behaviour equivalence: per the catalog seed, owner + admin both have
-- groups.manage; member + viewer do not. So the migration preserves the
-- pre-migration RLS truth table 1:1.

BEGIN;

-- ---------------------------------------------------------------------------
-- workspace_groups
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS workspace_groups_insert ON public.workspace_groups;
CREATE POLICY workspace_groups_insert
  ON public.workspace_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_permission(workspace_id, 'groups.manage')
  );

DROP POLICY IF EXISTS workspace_groups_update ON public.workspace_groups;
CREATE POLICY workspace_groups_update
  ON public.workspace_groups
  FOR UPDATE
  TO authenticated
  USING (
    public.user_has_permission(workspace_id, 'groups.manage')
  )
  WITH CHECK (
    public.user_has_permission(workspace_id, 'groups.manage')
  );

DROP POLICY IF EXISTS workspace_groups_delete ON public.workspace_groups;
CREATE POLICY workspace_groups_delete
  ON public.workspace_groups
  FOR DELETE
  TO authenticated
  USING (
    public.user_has_permission(workspace_id, 'groups.manage')
  );

-- ---------------------------------------------------------------------------
-- workspace_group_members
--
-- The INSERT policy preserves its second clause ‟target user must be a
-- workspace member" — that's a referential invariant, not a role check, so
-- it stays as-is. Only the first clause (caller is admin+) becomes
-- user_has_permission(...).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS workspace_group_members_insert ON public.workspace_group_members;
CREATE POLICY workspace_group_members_insert
  ON public.workspace_group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.workspace_groups g
       WHERE g.id = workspace_group_members.group_id
         AND public.user_has_permission(g.workspace_id, 'groups.manage')
    )
    AND EXISTS (
      SELECT 1
        FROM public.workspace_groups   g
        JOIN public.workspace_members  wm2
          ON wm2.workspace_id = g.workspace_id
         AND wm2.user_id      = workspace_group_members.user_id
       WHERE g.id = workspace_group_members.group_id
    )
  );

DROP POLICY IF EXISTS workspace_group_members_delete ON public.workspace_group_members;
CREATE POLICY workspace_group_members_delete
  ON public.workspace_group_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.workspace_groups g
       WHERE g.id = workspace_group_members.group_id
         AND public.user_has_permission(g.workspace_id, 'groups.manage')
    )
  );

COMMIT;
