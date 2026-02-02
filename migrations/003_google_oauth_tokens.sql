-- ============================================
-- Google OAuth Tokens Table
-- Stores Google OAuth tokens for users to access Google Contacts API
-- ============================================

-- Create the OAuth tokens table
CREATE TABLE IF NOT EXISTS public.google_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  expiry_date BIGINT,
  scope TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_google_oauth_tokens_user_id ON public.google_oauth_tokens(user_id);

-- Enable Row Level Security
ALTER TABLE public.google_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Allow users to read their own tokens
CREATE POLICY "Users can view their own tokens"
  ON public.google_oauth_tokens
  FOR SELECT
  USING (user_id = auth.uid()::text);

-- Allow users to insert/update their own tokens
CREATE POLICY "Users can manage their own tokens"
  ON public.google_oauth_tokens
  FOR ALL
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- Allow service role to bypass RLS (for API operations)
CREATE POLICY "Service role can do anything with tokens"
  ON public.google_oauth_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_google_oauth_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_google_oauth_tokens_updated_at
  BEFORE UPDATE ON public.google_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_google_oauth_tokens_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_oauth_tokens TO authenticated;
GRANT ALL ON public.google_oauth_tokens TO service_role;

-- Add comment
COMMENT ON TABLE public.google_oauth_tokens IS 'Stores Google OAuth access and refresh tokens for Google Contacts API access';
