-- =====================================================
-- ECOSYSTEM BRIDGE: Bot User Support
-- Adds bot user columns to pulse_users and seeds Entomate bot
-- Created: 2026-03-26
-- =====================================================

-- Add bot user support to pulse_users
ALTER TABLE pulse_users ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT false;
ALTER TABLE pulse_users ADD COLUMN IF NOT EXISTS bot_app TEXT;          -- 'entomate', 'logos_vision', etc.
ALTER TABLE pulse_users ADD COLUMN IF NOT EXISTS bot_config JSONB DEFAULT '{}';

-- Seed the Entomate bot user
-- Uses a fixed UUID so it's stable across environments
-- Columns: id, handle, display_name, avatar_url, is_bot, bot_app, bot_config
INSERT INTO pulse_users (
  id,
  handle,
  display_name,
  avatar_url,
  is_bot,
  bot_app,
  bot_config
) VALUES (
  'e0000000-0000-0000-0000-e00000000001',
  'entomate-bot',
  'Entomate',
  '/assets/entomate-bot-avatar.png',
  true,
  'entomate',
  '{
    "display_name": "Entomate",
    "description": "Meeting intelligence & automation",
    "can_post": true,
    "can_create_channels": true,
    "emoji": "🤖"
  }'::jsonb
) ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  bot_config   = EXCLUDED.bot_config,
  is_bot       = true;

-- Index for fast bot user lookups
CREATE INDEX IF NOT EXISTS idx_pulse_users_is_bot ON pulse_users (is_bot) WHERE is_bot = true;
CREATE INDEX IF NOT EXISTS idx_pulse_users_bot_app ON pulse_users (bot_app) WHERE bot_app IS NOT NULL;
