-- ============================================
-- Auto-Sync Configuration Table
-- Stores user preferences for automatic syncing
-- ============================================

-- Create auto-sync config table
CREATE TABLE IF NOT EXISTS public.google_contacts_auto_sync_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,

  -- Configuration
  enabled BOOLEAN NOT NULL DEFAULT true,
  interval_hours INTEGER NOT NULL DEFAULT 24,

  -- Sync timing
  last_sync_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_auto_sync_config_user_id ON public.google_contacts_auto_sync_config(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_sync_config_next_sync ON public.google_contacts_auto_sync_config(next_sync_at) WHERE enabled = true;

-- Enable Row Level Security
ALTER TABLE public.google_contacts_auto_sync_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Service role can do anything"
  ON public.google_contacts_auto_sync_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_auto_sync_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_auto_sync_config_timestamp
  BEFORE UPDATE ON public.google_contacts_auto_sync_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_auto_sync_config_updated_at();

-- Grant permissions
GRANT ALL ON public.google_contacts_auto_sync_config TO service_role;

-- Add comment
COMMENT ON TABLE public.google_contacts_auto_sync_config IS 'User configuration for automatic Google Contacts syncing';
