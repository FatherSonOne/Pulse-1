-- Fix contacts table - Add missing columns if they don't exist
-- This migration ensures the contacts table has all required columns

-- Add platform column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'platform'
  ) THEN
    ALTER TABLE contacts ADD COLUMN platform TEXT NOT NULL DEFAULT 'unknown';
    RAISE NOTICE 'Added platform column to contacts table';
  ELSE
    RAISE NOTICE 'platform column already exists in contacts table';
  END IF;
END $$;

-- Add external_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'external_id'
  ) THEN
    ALTER TABLE contacts ADD COLUMN external_id TEXT;
    RAISE NOTICE 'Added external_id column to contacts table';
  ELSE
    RAISE NOTICE 'external_id column already exists in contacts table';
  END IF;
END $$;

-- Add other potentially missing columns
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE contacts ADD COLUMN display_name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'company'
  ) THEN
    ALTER TABLE contacts ADD COLUMN company TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'role'
  ) THEN
    ALTER TABLE contacts ADD COLUMN role TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE contacts ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END $$;

-- Now safely create the indexes
CREATE INDEX IF NOT EXISTS idx_contacts_user_platform ON contacts(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_contacts_external_id ON contacts(external_id);

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'contacts_user_platform_external_id_key'
  ) THEN
    -- First ensure no duplicates exist
    DELETE FROM contacts a USING contacts b
    WHERE a.id > b.id 
      AND a.user_id = b.user_id 
      AND a.platform = b.platform 
      AND a.external_id = b.external_id;
    
    -- Add the unique constraint
    ALTER TABLE contacts 
      ADD CONSTRAINT contacts_user_platform_external_id_key 
      UNIQUE(user_id, platform, external_id);
    
    RAISE NOTICE 'Added unique constraint to contacts table';
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Could not add unique constraint: %', SQLERRM;
END $$;

-- Update any contacts with NULL external_id
UPDATE contacts 
SET external_id = COALESCE(external_id, email, phone, id::text)
WHERE external_id IS NULL;

COMMENT ON TABLE contacts IS 'Unified contacts across all platforms';
COMMENT ON COLUMN contacts.platform IS 'Platform source: gmail, slack, sms, etc';
COMMENT ON COLUMN contacts.external_id IS 'Platform-specific ID (Slack user ID, email, phone)';
