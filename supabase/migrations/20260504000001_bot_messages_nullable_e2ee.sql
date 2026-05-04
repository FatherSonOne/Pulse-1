-- =====================================================
-- ECOSYSTEM BRIDGE: Allow NULL encrypted_content/nonce for bot messages
-- Companion to 20260326000003_bot_message_support.sql, which added the bot
-- columns + comment "Bot messages use bot_content (plaintext)" but never
-- relaxed the NOT NULL on the E2EE columns. The check constraint now
-- enforces the human-vs-bot invariant directly.
-- Created: 2026-05-04
-- =====================================================

ALTER TABLE chat_messages ALTER COLUMN encrypted_content DROP NOT NULL;
ALTER TABLE chat_messages ALTER COLUMN nonce DROP NOT NULL;

ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chk_message_content_type;
ALTER TABLE chat_messages ADD CONSTRAINT chk_message_content_type CHECK (
  (is_bot_message = true AND bot_content IS NOT NULL)
  OR
  ((is_bot_message = false OR is_bot_message IS NULL)
   AND encrypted_content IS NOT NULL AND nonce IS NOT NULL)
);
