-- =====================================================
-- ECOSYSTEM BRIDGE: Core Tables
-- PULSE-SIDE integration for Logos Vision x Entomate
-- Created: 2026-03-26
-- =====================================================

-- Stores connection config for other ecosystem apps
CREATE TABLE IF NOT EXISTS ecosystem_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_name TEXT NOT NULL UNIQUE,           -- 'entomate', 'logos_vision'
  api_url TEXT NOT NULL,                    -- Base URL for the app's ecosystem-inbound
  service_token TEXT NOT NULL,             -- Token this app uses to call that app
  inbound_token TEXT NOT NULL,             -- Token that app uses to call us
  enabled BOOLEAN DEFAULT true,
  features JSONB DEFAULT '{}',             -- Feature flags per integration
  last_heartbeat TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Logs all cross-app events (audit trail)
CREATE TABLE IF NOT EXISTS ecosystem_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,                  -- Original event UUID
  source TEXT NOT NULL,                    -- 'entomate', 'logos_vision', 'pulse'
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  direction TEXT NOT NULL,                 -- 'inbound' or 'outbound'
  status TEXT DEFAULT 'received',          -- 'received', 'processed', 'failed', 'ignored'
  payload JSONB,
  error_message TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Maps entity IDs across apps (e.g., Entomate task ID ↔ LV task ID)
CREATE TABLE IF NOT EXISTS ecosystem_entity_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_entity_type TEXT NOT NULL,
  local_entity_id UUID NOT NULL,
  remote_app TEXT NOT NULL,
  remote_entity_type TEXT NOT NULL,
  remote_entity_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(local_entity_type, local_entity_id, remote_app)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ecosystem_events_source ON ecosystem_events (source, event_type);
CREATE INDEX IF NOT EXISTS idx_ecosystem_events_created ON ecosystem_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ecosystem_entity_map_local ON ecosystem_entity_map (local_entity_type, local_entity_id);

-- Auto-update updated_at on ecosystem_config
CREATE OR REPLACE FUNCTION update_ecosystem_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ecosystem_config_updated_at ON ecosystem_config;
CREATE TRIGGER ecosystem_config_updated_at
  BEFORE UPDATE ON ecosystem_config
  FOR EACH ROW EXECUTE FUNCTION update_ecosystem_config_updated_at();

-- RLS Policies
ALTER TABLE ecosystem_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecosystem_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecosystem_entity_map ENABLE ROW LEVEL SECURITY;

-- ecosystem_config: only service role can write; authenticated users can read (for UI display)
CREATE POLICY "service_role_full_access_ecosystem_config"
  ON ecosystem_config FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_ecosystem_config"
  ON ecosystem_config FOR SELECT
  TO authenticated USING (true);

-- ecosystem_events: service role writes, authenticated reads
CREATE POLICY "service_role_full_access_ecosystem_events"
  ON ecosystem_events FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_ecosystem_events"
  ON ecosystem_events FOR SELECT
  TO authenticated USING (true);

-- ecosystem_entity_map: service role full, authenticated read
CREATE POLICY "service_role_full_access_ecosystem_entity_map"
  ON ecosystem_entity_map FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_ecosystem_entity_map"
  ON ecosystem_entity_map FOR SELECT
  TO authenticated USING (true);
