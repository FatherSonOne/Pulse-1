-- ============================================
-- Add Sync Token for Incremental Syncing
-- Stores Google API sync token to only fetch changed contacts
-- ============================================

-- Add sync_token column to auto-sync config
ALTER TABLE public.google_contacts_auto_sync_config
ADD COLUMN IF NOT EXISTS sync_token TEXT;

-- Add comment
COMMENT ON COLUMN public.google_contacts_auto_sync_config.sync_token IS 'Google People API sync token for incremental syncing - only fetch changed contacts';

-- Create index for sync token lookups (optional but good practice)
CREATE INDEX IF NOT EXISTS idx_auto_sync_config_sync_token ON public.google_contacts_auto_sync_config(user_id, sync_token) WHERE sync_token IS NOT NULL;
