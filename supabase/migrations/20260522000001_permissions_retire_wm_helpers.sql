-- 20260522000001_permissions_retire_wm_helpers.sql
-- Issue #42 Sub-PR 6 — retire wm_is_admin / wm_is_member; rewrite
-- user_has_workspace_access() body to go through the permission catalog.
--
-- BEFORE:
--   user_has_workspace_access(ws_id)
--     -> wm_is_member(ws_id, auth.uid())
--     -> EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=ws_id AND user_id=uid)
--
-- AFTER:
--   user_has_workspace_access(ws_id)
--     -> user_has_permission(ws_id, 'workspace.read')
--
-- workspace.read is granted to all 4 system roles (owner/admin/member/viewer).
-- For users in the system-role membership shape that's the entire production
-- userbase today, behavior is unchanged. For future custom roles (is_system =
-- false) that do NOT grant 'workspace.read', this is a fail-closed semantic
-- shift — those roles would lose access to the ~70 tables guarded by
-- user_has_workspace_access(). That's the desired behavior: a custom role
-- defined without workspace.read should NOT be able to read workspace tables.
--
-- Surface inheriting this change without code edits:
--   - 70 RLS policies across 18 tables
--   - 3 SECURITY DEFINER functions: get_enriched_workspace_members,
--     get_workspace_unread_count, write_workspace_audit
--
-- Helpers being dropped:
--   - wm_is_admin(ws_id, uid)  — zero callers in pg_policies or pg_proc
--   - wm_is_member(ws_id, uid) — only caller is user_has_workspace_access,
--     which this migration rewrites
--
-- Ordering matters: rewrite user_has_workspace_access first, then drop the
-- helpers it no longer depends on.

BEGIN;

CREATE OR REPLACE FUNCTION public.user_has_workspace_access(ws_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
  SELECT public.user_has_permission(ws_id, 'workspace.read')
$function$;

DROP FUNCTION public.wm_is_member(uuid, uuid);
DROP FUNCTION public.wm_is_admin(uuid, uuid);

COMMIT;
