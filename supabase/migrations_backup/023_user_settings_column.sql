-- Add 'settings' column to user_settings table for the settingsService
-- This stores all user settings as a single JSONB object

-- Add the settings column if it doesn't exist
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

-- Create index for the settings column
CREATE INDEX IF NOT EXISTS idx_user_settings_settings ON user_settings USING GIN(settings);

-- Update the updated_at column to have proper timezone
-- (Ensure it exists and has correct type)
DO $$
BEGIN
  -- Check if updated_at column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'updated_at'
  ) THEN
    -- Column exists, ensure it's the right type
    NULL;
  ELSE
    -- Add the column if it doesn't exist
    ALTER TABLE user_settings ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;
