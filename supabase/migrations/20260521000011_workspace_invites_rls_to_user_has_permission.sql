-- 20260521000011_workspace_invites_rls_to_user_has_permission.sql
-- Issue #42 Sub-PR 4c — migrate workspace_invites RLS from role IN
-- ('owner','admin') to user_has_permission(workspace_id, 'members.invite').
--
-- Resource scope: workspace_invites only.
-- 4 policies migrated. The SELECT policy keeps its `email = auth.email()`
-- clause verbatim so an invitee (not yet a workspace member) can still
-- see their own pending invite by email match.
--
-- Builds on #44 (workspace_invites_rls_self_reference fix) — the
-- cross-tenant leak is already closed; this PR just centralises the
-- role check on the catalog vocabulary.
--
-- Per catalog seed: owner + admin have members.invite; member + viewer
-- don't.

BEGIN;

-- --- SELECT -----------------------------------------------------------------
-- Two paths: invitee by email match OR admin+ on the workspace.
DROP POLICY IF EXISTS workspace_invites_select ON public.workspace_invites;
CREATE POLICY workspace_invites_select
  ON public.workspace_invites
  FOR SELECT
  TO authenticated
  USING (
    email = auth.email()
    OR public.user_has_permission(workspace_id, 'members.invite')
  );

-- --- INSERT -----------------------------------------------------------------
DROP POLICY IF EXISTS workspace_invites_insert ON public.workspace_invites;
CREATE POLICY workspace_invites_insert
  ON public.workspace_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_permission(workspace_id, 'members.invite')
  );

-- --- UPDATE -----------------------------------------------------------------
DROP POLICY IF EXISTS workspace_invites_update ON public.workspace_invites;
CREATE POLICY workspace_invites_update
  ON public.workspace_invites
  FOR UPDATE
  TO authenticated
  USING (
    public.user_has_permission(workspace_id, 'members.invite')
  )
  WITH CHECK (
    public.user_has_permission(workspace_id, 'members.invite')
  );

-- --- DELETE -----------------------------------------------------------------
DROP POLICY IF EXISTS workspace_invites_delete ON public.workspace_invites;
CREATE POLICY workspace_invites_delete
  ON public.workspace_invites
  FOR DELETE
  TO authenticated
  USING (
    public.user_has_permission(workspace_id, 'members.invite')
  );

COMMIT;
