-- Migration: Vacation Responder
-- Created: 2026-01-14
-- Description: Automatic out-of-office responses

CREATE TABLE IF NOT EXISTS vacation_responder (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  enabled BOOLEAN DEFAULT false,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  subject TEXT NOT NULL,
  message_html TEXT NOT NULL,
  message_text TEXT NOT NULL,
  only_contacts BOOLEAN DEFAULT false,
  only_first_email BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT vacation_responder_date_range CHECK (end_date >= start_date),
  CONSTRAINT unique_vacation_responder_per_user UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_vacation_responder_user ON vacation_responder(user_id);
CREATE INDEX IF NOT EXISTS idx_vacation_responder_enabled ON vacation_responder(user_id, enabled) WHERE enabled = true;

ALTER TABLE vacation_responder ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own vacation responder"
  ON vacation_responder
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own vacation responder"
  ON vacation_responder
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vacation responder"
  ON vacation_responder
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own vacation responder"
  ON vacation_responder
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_vacation_responder_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vacation_responder_updated_at
  BEFORE UPDATE ON vacation_responder
  FOR EACH ROW
  EXECUTE FUNCTION update_vacation_responder_updated_at();

COMMENT ON TABLE vacation_responder IS 'Auto-reply configuration for out-of-office responses';
COMMENT ON COLUMN vacation_responder.only_contacts IS 'Only send replies to contacts';
COMMENT ON COLUMN vacation_responder.only_first_email IS 'Only send one reply per sender during the period';
