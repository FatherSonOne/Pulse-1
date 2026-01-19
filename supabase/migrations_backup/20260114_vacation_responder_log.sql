-- Migration: Vacation Responder Log
-- Created: 2026-01-14
-- Description: Track auto-replies sent by vacation responder

CREATE TABLE IF NOT EXISTS vacation_responder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  responder_id UUID REFERENCES vacation_responder(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  recipient_email TEXT NOT NULL,
  original_email_id TEXT, -- cached_emails.id if available
  sent_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vacation_responder_log_user ON vacation_responder_log(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_vacation_responder_log_recipient ON vacation_responder_log(user_id, lower(recipient_email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_vacation_responder_log_unique
  ON vacation_responder_log(user_id, lower(recipient_email), responder_id);

ALTER TABLE vacation_responder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own vacation responder logs"
  ON vacation_responder_log
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vacation responder logs"
  ON vacation_responder_log
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE vacation_responder_log IS 'Tracks auto-replies sent by vacation responder';
COMMENT ON COLUMN vacation_responder_log.recipient_email IS 'Recipient email address';
COMMENT ON COLUMN vacation_responder_log.original_email_id IS 'Cached email ID that triggered the reply';
