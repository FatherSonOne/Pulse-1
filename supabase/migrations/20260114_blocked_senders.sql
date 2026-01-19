-- Migration: Blocked Senders
-- Created: 2026-01-14
-- Description: Block email addresses or domains

CREATE TABLE IF NOT EXISTS blocked_senders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email_address TEXT,
  domain TEXT,
  reason TEXT,
  auto_delete BOOLEAN DEFAULT false,
  blocked_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT blocked_senders_email_or_domain CHECK (
    (email_address IS NOT NULL AND email_address <> '') OR
    (domain IS NOT NULL AND domain <> '')
  )
);

-- Uniqueness constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_blocked_senders_unique_email
  ON blocked_senders(user_id, lower(email_address))
  WHERE email_address IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_blocked_senders_unique_domain
  ON blocked_senders(user_id, lower(domain))
  WHERE domain IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_blocked_senders_user ON blocked_senders(user_id);
CREATE INDEX IF NOT EXISTS idx_blocked_senders_email ON blocked_senders(lower(email_address));
CREATE INDEX IF NOT EXISTS idx_blocked_senders_domain ON blocked_senders(lower(domain));

ALTER TABLE blocked_senders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own blocked senders"
  ON blocked_senders
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own blocked senders"
  ON blocked_senders
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own blocked senders"
  ON blocked_senders
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own blocked senders"
  ON blocked_senders
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_blocked_senders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blocked_senders_updated_at
  BEFORE UPDATE ON blocked_senders
  FOR EACH ROW
  EXECUTE FUNCTION update_blocked_senders_updated_at();

COMMENT ON TABLE blocked_senders IS 'User-defined blocked email addresses or domains';
COMMENT ON COLUMN blocked_senders.auto_delete IS 'Auto-delete emails from this sender/domain';
