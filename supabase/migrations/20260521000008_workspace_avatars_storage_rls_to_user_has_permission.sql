-- 20260521000008_workspace_avatars_storage_rls_to_user_has_permission.sql
-- Issue #42 Sub-PR 4i — migrate storage.objects policy
-- `workspace_admins_manage_avatars` from role IN ('owner','admin') to
-- user_has_permission(workspace_id, 'workspace.update').
--
-- The workspace_id is extracted from the storage path via
-- `(storage.foldername(name))[1]::uuid` — file convention is
-- `<workspace_id>/<filename>`. That extraction is preserved verbatim.
--
-- The public read policy (public_read_workspace_avatars, SELECT for the
-- whole bucket) is untouched — avatars are intentionally publicly readable
-- so img tags can load without auth.
--
-- WITH CHECK added (hardening)
--   Original policy was FOR ALL with USING only. New policy adds matching
--   WITH CHECK so INSERT/UPDATE row movement requires the same permission.

BEGIN;

DROP POLICY IF EXISTS workspace_admins_manage_avatars ON storage.objects;
CREATE POLICY workspace_admins_manage_avatars
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'workspace-avatars'
    AND public.user_has_permission(
          ((storage.foldername(name))[1])::uuid,
          'workspace.update'
        )
  )
  WITH CHECK (
    bucket_id = 'workspace-avatars'
    AND public.user_has_permission(
          ((storage.foldername(name))[1])::uuid,
          'workspace.update'
        )
  );

COMMIT;
