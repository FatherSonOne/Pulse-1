-- Confidential Emails: confidential-mode metadata for sent emails.
-- Applied to live pulse-chat 2026-06-01 (WI-6, email repair plan).
-- Consumer: src/services/confidentialEmailService.ts (EmailComposerModal:366),
-- which was already wired but erroring because this table did not exist.
-- search_path pinned on the trigger fn per the 2026-05-31 DB security baseline
-- (avoids a function_search_path_mutable advisor). Forward-migrated from
-- supabase/migrations_backup/20260114_confidential_emails.sql (+ the pin).
--
-- NOTE: this stores confidential METADATA only. There is no recipient-side
-- enforcement of forward/copy/print/download or passcode gating — those would
-- require a secure-link render path that does not exist yet.

CREATE TABLE IF NOT EXISTS confidential_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email_id TEXT REFERENCES cached_emails(id) ON DELETE SET NULL,
  thread_id TEXT,
  expires_at TIMESTAMPTZ,
  require_passcode BOOLEAN DEFAULT false,
  passcode_hash TEXT,
  disable_forward BOOLEAN DEFAULT true,
  disable_copy BOOLEAN DEFAULT true,
  disable_print BOOLEAN DEFAULT true,
  disable_download BOOLEAN DEFAULT true,
  revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_confidential_emails_user ON confidential_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_confidential_emails_email ON confidential_emails(email_id);
CREATE INDEX IF NOT EXISTS idx_confidential_emails_expires ON confidential_emails(expires_at);
CREATE INDEX IF NOT EXISTS idx_confidential_emails_revoked ON confidential_emails(user_id, revoked);

ALTER TABLE confidential_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own confidential emails" ON confidential_emails
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own confidential emails" ON confidential_emails
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own confidential emails" ON confidential_emails
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own confidential emails" ON confidential_emails
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_confidential_emails_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $func$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$func$;

CREATE TRIGGER confidential_emails_updated_at
  BEFORE UPDATE ON confidential_emails
  FOR EACH ROW
  EXECUTE FUNCTION update_confidential_emails_updated_at();

COMMENT ON TABLE confidential_emails IS 'Confidential mode metadata for emails';
