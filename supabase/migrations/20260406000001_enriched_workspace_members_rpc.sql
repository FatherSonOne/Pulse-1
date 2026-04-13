-- Migration: Enriched workspace members RPC
-- Returns workspace_members joined with user_profiles for display_name, avatar_url, email.
-- Uses SECURITY DEFINER to avoid RLS recursion on the join.

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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    wm.workspace_id,
    wm.user_id,
    wm.role,
    wm.invited_by,
    wm.joined_at,
    up.display_name,
    up.full_name,
    up.avatar_url,
    au.email,
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
$$;

-- Grant execute to authenticated users (RLS on workspace_members still gates visibility)
GRANT EXECUTE ON FUNCTION public.get_enriched_workspace_members(UUID) TO authenticated;
