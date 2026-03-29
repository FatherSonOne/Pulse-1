-- =====================================================
-- ECOSYSTEM BRIDGE: Bot URL Support
-- Adds bot_url column to ecosystem_config for direct
-- bot API endpoints (e.g., ecosystem-bot).
-- Not all apps have a bot endpoint — column is nullable.
-- Created: 2026-03-28
-- =====================================================

ALTER TABLE ecosystem_config ADD COLUMN IF NOT EXISTS bot_url TEXT;
