-- Add per-user soft-delete columns to pulse_conversations
-- Allows each participant to independently hide/delete a conversation from their view

ALTER TABLE pulse_conversations
  ADD COLUMN IF NOT EXISTS is_deleted_by_user1 BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_deleted_by_user2 BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for fast filtering in getConversations() queries
CREATE INDEX IF NOT EXISTS idx_pulse_conversations_deleted_user1
  ON pulse_conversations (user1_id, is_deleted_by_user1)
  WHERE is_deleted_by_user1 = FALSE;

CREATE INDEX IF NOT EXISTS idx_pulse_conversations_deleted_user2
  ON pulse_conversations (user2_id, is_deleted_by_user2)
  WHERE is_deleted_by_user2 = FALSE;

-- Comment for documentation
COMMENT ON COLUMN pulse_conversations.is_deleted_by_user1
  IS 'Soft-delete flag: conversation is hidden for user1 but preserved for user2';

COMMENT ON COLUMN pulse_conversations.is_deleted_by_user2
  IS 'Soft-delete flag: conversation is hidden for user2 but preserved for user1';

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: hard-delete the conversation (and cascade messages) once BOTH users
-- have soft-deleted it — no orphaned rows.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION delete_conversation_when_both_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.is_deleted_by_user1 = TRUE AND NEW.is_deleted_by_user2 = TRUE THEN
    DELETE FROM pulse_conversations WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_conversation_both_deleted ON pulse_conversations;

CREATE TRIGGER trg_conversation_both_deleted
  AFTER UPDATE OF is_deleted_by_user1, is_deleted_by_user2
  ON pulse_conversations
  FOR EACH ROW
  EXECUTE FUNCTION delete_conversation_when_both_deleted();
