-- Migration: Workspace unread message count RPC
-- Returns the total unread message count across all channels in a workspace.
--
-- Originally (pre-2026-05-03 edit) this function referenced
-- `messages.channel_id` and `channel_read_status` — neither of which exist:
--   * public.messages is the legacy SMS-thread table keyed by thread_id;
--     it has no channel_id column.
--   * channel_read_status was never created. The canonical workspace-channel
--     read-receipts table is `message_reads`, created by
--     20260426000008_channel_messages_canonical.
--
-- Rewritten to query the canonical `channel_messages` + `message_reads`
-- tables. "Unread" = messages in this workspace's channels that this user
-- did NOT send and has NOT marked read.

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
      (
        SELECT COUNT(*)::integer
        FROM channel_messages cm
        WHERE cm.channel_id = mc.id
          AND cm.sender_id <> p_user_id
          AND NOT EXISTS (
            SELECT 1 FROM message_reads mr
            WHERE mr.message_id = cm.id AND mr.user_id = p_user_id
          )
      ) AS unread
    FROM message_channels mc
    INNER JOIN channel_members chm
      ON chm.channel_id = mc.id AND chm.user_id = p_user_id
    WHERE mc.workspace_id = p_workspace_id
  ) sub;
$$;

GRANT EXECUTE ON FUNCTION public.get_workspace_unread_count(UUID, UUID) TO authenticated;
