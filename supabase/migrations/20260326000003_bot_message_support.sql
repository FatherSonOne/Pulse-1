-- =====================================================
-- ECOSYSTEM BRIDGE: Bot Message Support in chat_messages
-- Adds bot message columns alongside existing E2EE columns
-- Human messages continue using encrypted_content + nonce
-- Bot messages use bot_content (plaintext, system-generated)
-- Created: 2026-03-26
-- =====================================================

-- Add bot message columns to chat_messages
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS bot_content TEXT;
  -- Plaintext content — only populated for bot messages (NULL for human E2EE messages)

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_bot_message BOOLEAN DEFAULT false;

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS bot_app TEXT;
  -- Source app: 'entomate', 'logos_vision'

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS bot_message_type TEXT DEFAULT 'text';
  -- 'text' | 'meeting_recap' | 'action_items' | 'alert' | 'card'

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS bot_metadata JSONB DEFAULT '{}';
  -- Structured data: { meetingId, actionItemIds, automationId, sourceUrl, ... }

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS bot_actions JSONB DEFAULT '[]';
  -- Action buttons: [{ label, action, url }]

-- Index for efficient bot message queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_bot
  ON chat_messages (is_bot_message, bot_app)
  WHERE is_bot_message = true;

CREATE INDEX IF NOT EXISTS idx_chat_messages_bot_type
  ON chat_messages (bot_message_type)
  WHERE is_bot_message = true;

-- Ensure channel_id column exists (in case older schema lacks it)
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES message_channels(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages (channel_id);

-- Add a check constraint: bot messages must have bot_content; human messages must not
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chk_message_content_type;
ALTER TABLE chat_messages ADD CONSTRAINT chk_message_content_type CHECK (
  (is_bot_message = true AND bot_content IS NOT NULL) OR
  (is_bot_message = false OR is_bot_message IS NULL)
);
