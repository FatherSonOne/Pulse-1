-- Migration 008: Add auto-labeling configuration
-- Adds auto_label_enabled column to track if user wants automatic labeling in Google Contacts

ALTER TABLE public.google_contacts_auto_sync_config
ADD COLUMN IF NOT EXISTS auto_label_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.google_contacts_auto_sync_config.auto_label_enabled IS
  'Whether to automatically add "Logos Vision" label to synced contacts in Google Contacts';

-- Add column to store the Google Contact Group resource name (label ID)
ALTER TABLE public.google_contacts_auto_sync_config
ADD COLUMN IF NOT EXISTS logos_vision_label_resource_name TEXT;

COMMENT ON COLUMN public.google_contacts_auto_sync_config.logos_vision_label_resource_name IS
  'Google Contact Group resource name for "Logos Vision" label (e.g., contactGroups/abc123)';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_auto_sync_config_auto_label
  ON public.google_contacts_auto_sync_config(user_id, auto_label_enabled)
  WHERE auto_label_enabled = true;
