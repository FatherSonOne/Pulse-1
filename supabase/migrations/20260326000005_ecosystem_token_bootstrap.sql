-- =====================================================
-- ECOSYSTEM BRIDGE: Token Bootstrap
-- Generates service tokens for Entomate and Logos Vision connections.
--
-- HOW TOKENS WORK:
--   Each connection stores TWO tokens:
--
--   service_token  = the token PULSE sends to the other app
--                    (goes in Entomate's/LV's ecosystem_config.inbound_token)
--
--   inbound_token  = the token the other app sends TO PULSE
--                    (goes in Entomate's/LV's ecosystem_config.service_token)
--
--   They are mirrors of each other across the two databases.
--
-- AFTER RUNNING:
--   SELECT app_name, api_url, service_token, inbound_token
--   FROM ecosystem_config;
--
--   Copy the values into the other app's ecosystem_config table.
-- =====================================================

-- Insert Entomate connection config with auto-generated tokens
-- Replace the api_url with your actual Entomate URL
INSERT INTO ecosystem_config (
  app_name,
  api_url,
  service_token,
  inbound_token,
  enabled,
  features
) VALUES (
  'entomate',
  'https://your-entomate-project.supabase.co/functions/v1',
  encode(gen_random_bytes(32), 'hex'),   -- Pulse → Entomate token
  encode(gen_random_bytes(32), 'hex'),   -- Entomate → Pulse token
  false,   -- disabled until URLs are confirmed
  '{
    "bot_messages": true,
    "sync_tasks": true,
    "notifications": true,
    "meeting_recaps": true
  }'::jsonb
) ON CONFLICT (app_name) DO NOTHING;   -- Don't overwrite existing tokens

-- Insert Logos Vision connection config with auto-generated tokens
INSERT INTO ecosystem_config (
  app_name,
  api_url,
  service_token,
  inbound_token,
  enabled,
  features
) VALUES (
  'logos_vision',
  'https://your-logos-vision-project.supabase.co/functions/v1',
  encode(gen_random_bytes(32), 'hex'),   -- Pulse → LV token
  encode(gen_random_bytes(32), 'hex'),   -- LV → Pulse token
  false,
  '{
    "contact_sync": true,
    "donation_alerts": true,
    "notifications": true
  }'::jsonb
) ON CONFLICT (app_name) DO NOTHING;

-- =====================================================
-- AFTER RUNNING THIS MIGRATION:
-- Run this query and copy the results to set up the other apps:
-- =====================================================
--
-- SELECT
--   app_name,
--   api_url,
--   service_token  AS "copy_to_other_app_inbound_token",
--   inbound_token  AS "copy_to_other_app_service_token"
-- FROM ecosystem_config
-- ORDER BY app_name;
--
-- =====================================================
-- WHAT TO PUT IN ENTOMATE'S ecosystem_config:
--   app_name      = 'pulse'
--   api_url       = 'https://YOUR-PULSE-PROJECT.supabase.co/functions/v1'
--   service_token = (Pulse's inbound_token)   ← Entomate sends this to Pulse
--   inbound_token = (Pulse's service_token)   ← Pulse sends this to Entomate
-- =====================================================
