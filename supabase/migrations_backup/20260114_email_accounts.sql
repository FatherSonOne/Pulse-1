-- Migration: Email Accounts
-- Created: 2026-01-14
-- Description: Support multiple email accounts per user

CREATE TABLE IF NOT EXISTS email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL DEFAULT 'google', -- 'google', 'microsoft', 'imap'
  email_address TEXT NOT NULL,
  display_name TEXT,
  is_primary BOOLEAN DEFAULT false,
  sync_enabled BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  integration_id UUID, -- optional link to integrations table
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT email_accounts_unique UNIQUE (user_id, provider, email_address)
);

CREATE INDEX IF NOT EXISTS idx_email_accounts_user ON email_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_primary ON email_accounts(user_id, is_primary) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_email_accounts_provider ON email_accounts(user_id, provider);

ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own email accounts"
  ON email_accounts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own email accounts"
  ON email_accounts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own email accounts"
  ON email_accounts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own email accounts"
  ON email_accounts
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_email_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_accounts_updated_at
  BEFORE UPDATE ON email_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_email_accounts_updated_at();

-- Ensure only one primary account per user
CREATE OR REPLACE FUNCTION ensure_single_primary_email_account()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE email_accounts
    SET is_primary = false
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_primary_email_account_trigger
  BEFORE INSERT OR UPDATE ON email_accounts
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_primary_email_account();

COMMENT ON TABLE email_accounts IS 'User-connected email accounts for unified inbox';
COMMENT ON COLUMN email_accounts.provider IS 'Email provider (google, microsoft, imap)';
COMMENT ON COLUMN email_accounts.integration_id IS 'Optional link to integrations table';
