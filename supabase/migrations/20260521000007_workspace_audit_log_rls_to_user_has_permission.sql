-- 20260521000007_workspace_audit_log_rls_to_user_has_permission.sql
-- Issue #42 Sub-PR 4h — migrate workspace_audit_log.admins_read_audit_log
-- from `role IN ('owner','admin')` to user_has_permission(..., 'audit.read').
--
-- Single policy migrated. The INSERT policy (service_role_write_audit_log,
-- WITH CHECK false) stays — service_role bypasses RLS and is the only
-- legitimate writer.
--
-- Per catalog seed: owner+admin have audit.read; member+viewer do not.

BEGIN;

DROP POLICY IF EXISTS admins_read_audit_log ON public.workspace_audit_log;
CREATE POLICY admins_read_audit_log
  ON public.workspace_audit_log
  FOR SELECT
  TO authenticated
  USING (
    public.user_has_permission(workspace_id, 'audit.read')
  );

COMMIT;
