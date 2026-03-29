-- =====================================================
-- ECOSYSTEM BRIDGE: Token Bootstrap
-- Seeds ecosystem_config with canonical inbound URLs
-- and generates service tokens for Entomate + Logos Vision.
--
-- CANONICAL URLS (never change unless Supabase project changes):
--   Pulse:        https://ucaeuszgoihoyrvhewxk.supabase.co/functions/v1/ecosystem-inbound
--   Entomate:     https://epftmicjaxrthmpyoguy.supabase.co/functions/v1/ecosystem-inbound
--   Logos Vision: https://psjgmdnrehcwvppbeqjy.supabase.co/functions/v1/ecosystem-inbound
--
-- HOW TOKENS WORK (values are SWAPPED across apps):
--
--   Pulse ecosystem_config row for 'entomate':
--     service_token = TOKEN_A   ← Pulse sends this TO Entomate
--     inbound_token = TOKEN_B   ← Entomate sends this TO Pulse
--
--   Entomate ecosystem_config row for 'pulse':
--     service_token = TOKEN_B   ← same as Pulse's inbound_token
--     inbound_token = TOKEN_A   ← same as Pulse's service_token
--
-- AFTER RUNNING: retrieve tokens to copy to other apps:
--   SELECT app_name,
--          service_token AS "→ paste as inbound_token in that app",
--          inbound_token AS "→ paste as service_token in that app"
--   FROM ecosystem_config ORDER BY app_name;
-- =====================================================

INSERT INTO ecosystem_config (
  app_name,
  api_url,
  service_token,
  inbound_token,
  enabled,
  features
) VALUES (
  'entomate',
  'https://epftmicjaxrthmpyoguy.supabase.co/functions/v1/ecosystem-inbound',
  encode(gen_random_bytes(32), 'hex'),
  encode(gen_random_bytes(32), 'hex'),
  false,   -- enable after confirming tokens are in Entomate
  '{"bot_messages": true, "sync_tasks": true, "notifications": true, "meeting_recaps": true}'::jsonb
) ON CONFLICT (app_name) DO NOTHING;

INSERT INTO ecosystem_config (
  app_name,
  api_url,
  service_token,
  inbound_token,
  enabled,
  features
) VALUES (
  'logos_vision',
  'https://psjgmdnrehcwvppbeqjy.supabase.co/functions/v1/ecosystem-inbound',
  encode(gen_random_bytes(32), 'hex'),
  encode(gen_random_bytes(32), 'hex'),
  false,
  '{"contact_sync": true, "donation_alerts": true, "notifications": true}'::jsonb
) ON CONFLICT (app_name) DO NOTHING;

-- =====================================================
-- WHAT TO INSERT IN ENTOMATE'S ecosystem_config:
--
--   INSERT INTO ecosystem_config (app_name, api_url, service_token, inbound_token, enabled)
--   VALUES (
--     'pulse',
--     'https://ucaeuszgoihoyrvhewxk.supabase.co/functions/v1/ecosystem-inbound',
--     '<Pulse inbound_token for entomate row>',   ← Entomate sends this to Pulse
--     '<Pulse service_token for entomate row>',   ← Pulse sends this to Entomate
--     true
--   );
--
-- WHAT TO INSERT IN LOGOS VISION'S ecosystem_config:
--
--   INSERT INTO ecosystem_config (app_name, api_url, service_token, inbound_token, enabled)
--   VALUES (
--     'pulse',
--     'https://ucaeuszgoihoyrvhewxk.supabase.co/functions/v1/ecosystem-inbound',
--     '<Pulse inbound_token for logos_vision row>',
--     '<Pulse service_token for logos_vision row>',
--     true
--   );
-- =====================================================
