-- =====================================================
-- ECOSYSTEM BRIDGE: Bot Channels
-- Tracks bot-managed channels per workspace per app
-- Created: 2026-03-26
-- =====================================================

-- Default channels that ecosystem apps create per workspace
CREATE TABLE IF NOT EXISTS ecosystem_bot_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  bot_app TEXT NOT NULL,                   -- 'entomate', 'logos_vision'
  channel_id UUID NOT NULL REFERENCES message_channels(id) ON DELETE CASCADE,
  channel_purpose TEXT NOT NULL,           -- 'meetings', 'alerts', 'action_items', 'automations'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, bot_app, channel_purpose)
);

CREATE INDEX IF NOT EXISTS idx_ecosystem_bot_channels_workspace
  ON ecosystem_bot_channels (workspace_id, bot_app);

-- RLS: All workspace members can read bot channel registrations
ALTER TABLE ecosystem_bot_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_bot_channels"
  ON ecosystem_bot_channels FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_bot_channels"
  ON ecosystem_bot_channels FOR SELECT
  TO authenticated USING (true);

-- Add a column to message_channels to mark bot-managed channels
ALTER TABLE message_channels ADD COLUMN IF NOT EXISTS is_bot_channel BOOLEAN DEFAULT false;
ALTER TABLE message_channels ADD COLUMN IF NOT EXISTS bot_app TEXT;

CREATE INDEX IF NOT EXISTS idx_message_channels_bot
  ON message_channels (is_bot_channel, bot_app)
  WHERE is_bot_channel = true;
