-- Fix: get_enriched_workspace_members RPC was failing with
--   "structure of query does not match function result type"
-- because auth.users.email is varchar(255) but the function's RETURNS TABLE
-- declares email as TEXT. Cast au.email::text to align.
--
-- Same body as 20260503000003_definer_lockdown.sql N7, with the email cast added.

CREATE OR REPLACE FUNCTION public.get_enriched_workspace_members(p_workspace_id UUID)
RETURNS TABLE (
  workspace_id UUID,
  user_id      UUID,
  role         TEXT,
  invited_by   UUID,
  joined_at    TIMESTAMPTZ,
  display_name TEXT,
  full_name    TEXT,
  avatar_url   TEXT,
  email        TEXT,
  handle       TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.user_has_workspace_access(p_workspace_id) THEN
    RAISE EXCEPTION 'forbidden: not a member of workspace'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    wm.workspace_id,
    wm.user_id,
    wm.role,
    wm.invited_by,
    wm.joined_at,
    up.display_name,
    up.full_name,
    up.avatar_url,
    au.email::text,
    up.handle
  FROM workspace_members wm
  LEFT JOIN user_profiles up ON up.id = wm.user_id
  LEFT JOIN auth.users    au ON au.id = wm.user_id
  WHERE wm.workspace_id = p_workspace_id
  ORDER BY
    CASE wm.role
      WHEN 'owner'  THEN 0
      WHEN 'admin'  THEN 1
      WHEN 'member' THEN 2
      WHEN 'viewer' THEN 3
      ELSE 4
    END,
    wm.joined_at ASC;
END;
$$;
