-- Migration 009: Add bidirectional sync fields
-- Adds fields to relationship_profiles to track sync with Google Contacts

-- Add column to store Google Contact resource name
ALTER TABLE public.relationship_profiles
ADD COLUMN IF NOT EXISTS google_resource_name TEXT;

COMMENT ON COLUMN public.relationship_profiles.google_resource_name IS
  'Google People API resource name (e.g., people/c123456) for this contact';

-- Add column to track if contact has been synced to Google
ALTER TABLE public.relationship_profiles
ADD COLUMN IF NOT EXISTS synced_to_google BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.relationship_profiles.synced_to_google IS
  'Whether this contact has been pushed to Google Contacts';

-- Add column to track last sync to Google
ALTER TABLE public.relationship_profiles
ADD COLUMN IF NOT EXISTS last_synced_to_google_at TIMESTAMPTZ;

COMMENT ON COLUMN public.relationship_profiles.last_synced_to_google_at IS
  'Timestamp of last successful push to Google Contacts';

-- Add column to track sync direction
ALTER TABLE public.relationship_profiles
ADD COLUMN IF NOT EXISTS sync_direction TEXT DEFAULT 'from_google';

COMMENT ON COLUMN public.relationship_profiles.sync_direction IS
  'Sync direction: "from_google" (imported from Google), "to_google" (created in Logos Vision), "bidirectional" (synced both ways)';

-- Create index for finding contacts that need to be synced to Google
CREATE INDEX IF NOT EXISTS idx_relationship_profiles_needs_google_sync
  ON public.relationship_profiles(user_id, synced_to_google, updated_at)
  WHERE synced_to_google = false OR synced_to_google IS NULL;

-- Create index for finding contacts by Google resource name
CREATE INDEX IF NOT EXISTS idx_relationship_profiles_google_resource_name
  ON public.relationship_profiles(google_resource_name)
  WHERE google_resource_name IS NOT NULL;
