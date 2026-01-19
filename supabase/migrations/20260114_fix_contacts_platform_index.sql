-- Migration: Fix contacts.platform index creation
-- Created: 2026-01-14
-- Description: Ensure contacts.platform exists before creating index

DO $$
BEGIN
  -- Add platform column if missing (existing contacts table)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'platform'
  ) THEN
    ALTER TABLE contacts ADD COLUMN platform TEXT NOT NULL DEFAULT 'unknown';
  END IF;
END $$;

-- Create index only if column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'platform'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_contacts_user_platform ON contacts(user_id, platform);
  END IF;
END $$;

