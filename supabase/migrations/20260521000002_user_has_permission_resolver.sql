-- 20260521000002_user_has_permission_resolver.sql
-- Issue #42 Sub-PR 3 — direct-role permission resolver.
--
-- Returns true iff the calling user is a member of p_workspace_id AND
-- their workspace_members.role maps to a workspace_role that has been
-- granted p_permission_key in role_permissions.
--
-- Direct-role only — no group walk yet. p_resource_id is accepted for
-- forward-compatibility with group_grants (Sub-PR 5) but ignored here.
--
-- No app/RLS consumers yet — substrate. Sub-PR 4 starts migrating RLS
-- policies one resource at a time from `role IN ('owner','admin')` to
-- `user_has_permission(workspaces.id, '<key>')`.

BEGIN;

CREATE OR REPLACE FUNCTION public.user_has_permission(
  p_workspace_id  uuid,
  p_permission_key text,
  p_resource_id   uuid DEFAULT NULL  -- reserved for Sub-PR 5 group_grants
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_user_id     uuid := auth.uid();
  v_member_role text;
  v_has         boolean;
BEGIN
  IF v_user_id IS NULL OR p_workspace_id IS NULL OR p_permission_key IS NULL THEN
    RETURN false;
  END IF;

  -- Membership + role lookup. Returns NULL row if user isn't a member.
  SELECT role
    INTO v_member_role
    FROM public.workspace_members
   WHERE workspace_id = p_workspace_id
     AND user_id      = v_user_id;

  IF v_member_role IS NULL THEN
    RETURN false;
  END IF;

  -- Resolve role -> role_permissions grant.
  SELECT EXISTS (
    SELECT 1
      FROM public.workspace_roles  wr
      JOIN public.role_permissions rp ON rp.role_id = wr.id
     WHERE wr.workspace_id  = p_workspace_id
       AND wr.key           = v_member_role
       AND rp.permission_key = p_permission_key
  ) INTO v_has;

  RETURN COALESCE(v_has, false);
END;
$fn$;

COMMENT ON FUNCTION public.user_has_permission(uuid, text, uuid) IS
  'Returns true iff auth.uid() has p_permission_key in p_workspace_id. '
  'Direct-role only; group walk arrives in Sub-PR 5 (group_grants). '
  'p_resource_id is reserved for forward-compatibility.';

-- Authenticated callers may invoke this directly (RLS policies and app code).
-- anon + PUBLIC are denied so /rest/v1/rpc/user_has_permission isn't exposed
-- to unauthenticated callers (Supabase advisor 0028).
REVOKE EXECUTE ON FUNCTION public.user_has_permission(uuid, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_has_permission(uuid, text, uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.user_has_permission(uuid, text, uuid) TO   authenticated;

COMMIT;
