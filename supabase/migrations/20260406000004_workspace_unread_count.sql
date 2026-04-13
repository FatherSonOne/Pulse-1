-- Migration: Workspace unread message count RPC
-- Returns the total unread message count across all channels in a workspace.

CREATE OR REPLACE FUNCTION public.get_workspace_unread_count(
  p_workspace_id UUID,
  p_user_id UUID
) RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(unread)::integer, 0)
  FROM (
    SELECT
      CASE
        WHEN crs.last_read_at IS NULL THEN (
          SELECT COUNT(*)::integer FROM messages m WHERE m.channel_id = mc.id
        )
        ELSE (
          SELECT COUNT(*)::integer FROM messages m
          WHERE m.channel_id = mc.id AND m.created_at > crs.last_read_at
        )
      END AS unread
    FROM message_channels mc
    INNER JOIN channel_members cm
      ON cm.channel_id = mc.id AND cm.user_id = p_user_id
    LEFT JOIN channel_read_status crs
      ON crs.channel_id = mc.id AND crs.user_id = p_user_id
    WHERE mc.workspace_id = p_workspace_id
  ) sub;
$$;

GRANT EXECUTE ON FUNCTION public.get_workspace_unread_count(UUID, UUID) TO authenticated;
