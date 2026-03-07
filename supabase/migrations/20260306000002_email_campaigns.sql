-- 20260306000002_email_campaigns.sql

CREATE TABLE IF NOT EXISTS email_campaigns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'paused')),
  subject      TEXT,
  subject_b    TEXT,
  body_html    TEXT,
  body_text    TEXT,
  preview_text TEXT,
  from_name    TEXT,
  from_email   TEXT,
  reply_to     TEXT,
  segment_name TEXT NOT NULL DEFAULT 'All Contacts',
  schedule_at  TIMESTAMPTZ,
  sent_at      TIMESTAMPTZ,
  stats        JSONB NOT NULL DEFAULT '{"sent":0,"delivered":0,"opened":0,"clicked":0,"bounced":0,"unsubscribed":0}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;

-- C-2: Drop before recreate to ensure idempotency
DROP POLICY IF EXISTS "campaigns_owner" ON email_campaigns;

-- I-1: FOR ALL requires both USING and WITH CHECK
CREATE POLICY "campaigns_owner" ON email_campaigns
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- C-1: Idempotent index creation
CREATE INDEX IF NOT EXISTS idx_campaigns_user_status ON email_campaigns(user_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_schedule ON email_campaigns(schedule_at)
  WHERE status = 'scheduled';

-- M-3: Composite index for user + recency queries
CREATE INDEX IF NOT EXISTS idx_campaigns_user_created ON email_campaigns(user_id, created_at DESC);

-- C-1: Idempotent trigger creation (PostgreSQL 14+ / Supabase 15)
CREATE OR REPLACE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON email_campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
