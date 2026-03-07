-- 20260307000001_email_segments.sql
-- Audience segment definitions for email campaigns

CREATE TABLE IF NOT EXISTS email_segments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  -- filter_rules is a JSONB array of rule objects:
  -- [{"type": "all"}, {"type": "last_contacted_days", "value": 30}, ...]
  -- Types: "all" | "last_contacted_days" | "relationship_strength_min" | "is_important"
  filter_rules JSONB NOT NULL DEFAULT '[]',
  contact_count INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE email_segments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "segments_owner" ON email_segments;
CREATE POLICY "segments_owner" ON email_segments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_email_segments_user ON email_segments(user_id);

CREATE OR REPLACE TRIGGER email_segments_updated_at
  BEFORE UPDATE ON email_segments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Add segment_id FK to email_campaigns (Phase 4 wiring)
ALTER TABLE email_campaigns
  ADD COLUMN IF NOT EXISTS segment_id UUID REFERENCES email_segments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_segment_id ON email_campaigns(segment_id);
