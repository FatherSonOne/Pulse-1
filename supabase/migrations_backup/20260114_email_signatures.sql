-- Migration: Email Signatures
-- Created: 2026-01-14
-- Description: Add support for custom email signatures with rich text formatting

-- Create email_signatures table
CREATE TABLE IF NOT EXISTS email_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  content_html TEXT NOT NULL,
  content_text TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_email_signatures_user_id ON email_signatures(user_id);
CREATE INDEX idx_email_signatures_default ON email_signatures(user_id, is_default) WHERE is_default = true;

-- Enable Row Level Security
ALTER TABLE email_signatures ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own signatures
CREATE POLICY "Users can view own signatures"
  ON email_signatures
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own signatures
CREATE POLICY "Users can create own signatures"
  ON email_signatures
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own signatures
CREATE POLICY "Users can update own signatures"
  ON email_signatures
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own signatures
CREATE POLICY "Users can delete own signatures"
  ON email_signatures
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_signature_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER email_signatures_updated_at
  BEFORE UPDATE ON email_signatures
  FOR EACH ROW
  EXECUTE FUNCTION update_email_signature_updated_at();

-- Function to ensure only one default signature per user
CREATE OR REPLACE FUNCTION ensure_single_default_signature()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting this signature as default
  IF NEW.is_default = true THEN
    -- Unset all other default signatures for this user
    UPDATE email_signatures
    SET is_default = false
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain single default signature
CREATE TRIGGER ensure_single_default_signature_trigger
  BEFORE INSERT OR UPDATE ON email_signatures
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_signature();

-- Add comments for documentation
COMMENT ON TABLE email_signatures IS 'Stores user email signatures with rich text formatting';
COMMENT ON COLUMN email_signatures.id IS 'Unique signature identifier';
COMMENT ON COLUMN email_signatures.user_id IS 'Reference to auth.users';
COMMENT ON COLUMN email_signatures.name IS 'User-friendly name for the signature';
COMMENT ON COLUMN email_signatures.content_html IS 'HTML formatted signature content';
COMMENT ON COLUMN email_signatures.content_text IS 'Plain text version of signature';
COMMENT ON COLUMN email_signatures.is_default IS 'Whether this is the default signature for new emails';
COMMENT ON COLUMN email_signatures.created_at IS 'Timestamp when signature was created';
COMMENT ON COLUMN email_signatures.updated_at IS 'Timestamp when signature was last modified';
