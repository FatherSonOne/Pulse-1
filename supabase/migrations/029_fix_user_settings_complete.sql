-- =============================================================================
-- FIX: user_settings table for settingsService compatibility
-- =============================================================================
-- This migration completely rebuilds the user_settings table to match
-- the schema expected by src/services/settingsService.ts
--
-- Expected columns:
--   - id: UUID (primary key)
--   - user_id: UUID (unique, references auth.users)
--   - settings: JSONB (stores all user settings as a single object)
--   - created_at: TIMESTAMPTZ
--   - updated_at: TIMESTAMPTZ
--
-- Run this in Supabase SQL Editor to fix 406 (Not Acceptable) errors
-- =============================================================================

-- Step 1: Drop existing table and all dependencies
-- ================================================
-- Drop all RLS policies first
DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can create own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can delete own settings" ON user_settings;
DROP POLICY IF EXISTS "Allow all user_settings" ON user_settings;
DROP POLICY IF EXISTS "user_settings_select_policy" ON user_settings;
DROP POLICY IF EXISTS "user_settings_insert_policy" ON user_settings;
DROP POLICY IF EXISTS "user_settings_update_policy" ON user_settings;
DROP POLICY IF EXISTS "user_settings_delete_policy" ON user_settings;

-- Drop existing indexes
DROP INDEX IF EXISTS idx_user_settings_user_id;
DROP INDEX IF EXISTS idx_user_settings_settings;
DROP INDEX IF EXISTS idx_user_settings_updated_at;

-- Drop the table completely (confirmed no important data)
DROP TABLE IF EXISTS user_settings CASCADE;


-- Step 2: Create the table with correct schema
-- ============================================
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add table comment
COMMENT ON TABLE user_settings IS 'Stores user preferences and settings synced across devices';
COMMENT ON COLUMN user_settings.user_id IS 'References the authenticated user';
COMMENT ON COLUMN user_settings.settings IS 'JSONB object containing all user settings';
COMMENT ON COLUMN user_settings.updated_at IS 'Timestamp of last settings update, used for sync conflict resolution';


-- Step 3: Create indexes for performance
-- ======================================
-- Index on user_id for fast lookups (already unique constraint, but explicit for clarity)
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- GIN index on settings JSONB for querying within settings object
CREATE INDEX idx_user_settings_settings ON user_settings USING GIN(settings);

-- Index on updated_at for sync queries
CREATE INDEX idx_user_settings_updated_at ON user_settings(updated_at DESC);


-- Step 4: Enable Row Level Security
-- =================================
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owner as well (extra security)
ALTER TABLE user_settings FORCE ROW LEVEL SECURITY;


-- Step 5: Create RLS Policies
-- ===========================
-- Users can only view their own settings
CREATE POLICY "Users can view own settings"
    ON user_settings
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can only insert their own settings
CREATE POLICY "Users can create own settings"
    ON user_settings
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can only update their own settings
CREATE POLICY "Users can update own settings"
    ON user_settings
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own settings
CREATE POLICY "Users can delete own settings"
    ON user_settings
    FOR DELETE
    USING (auth.uid() = user_id);


-- Step 6: Grant permissions to authenticated users
-- ================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON user_settings TO authenticated;

-- Anon users should NOT have access to user settings
REVOKE ALL ON user_settings FROM anon;


-- Step 7: Create trigger for automatic updated_at
-- ================================================
-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_user_settings_updated_at ON user_settings;

-- Create the trigger
CREATE TRIGGER trigger_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_user_settings_updated_at();


-- Step 8: Create helper function for upsert operations
-- ====================================================
-- This function handles the upsert logic used by settingsService
CREATE OR REPLACE FUNCTION upsert_user_settings(
    p_user_id UUID,
    p_settings JSONB
)
RETURNS user_settings AS $$
DECLARE
    result user_settings;
BEGIN
    INSERT INTO user_settings (user_id, settings, updated_at)
    VALUES (p_user_id, p_settings, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
        settings = p_settings,
        updated_at = NOW()
    RETURNING * INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION upsert_user_settings(UUID, JSONB) TO authenticated;


-- Step 9: Verify the table structure
-- ==================================
-- This SELECT will fail if the table wasn't created correctly
DO $$
DECLARE
    col_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_settings'
      AND column_name IN ('id', 'user_id', 'settings', 'created_at', 'updated_at');

    IF col_count != 5 THEN
        RAISE EXCEPTION 'user_settings table verification failed: expected 5 columns, found %', col_count;
    END IF;

    RAISE NOTICE 'SUCCESS: user_settings table created with all required columns';
END $$;


-- =============================================================================
-- VERIFICATION QUERY (run separately to confirm)
-- =============================================================================
-- After running this migration, execute this to verify:
--
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'user_settings'
-- ORDER BY ordinal_position;
--
-- Expected output:
-- | column_name | data_type                | is_nullable | column_default          |
-- |-------------|--------------------------|-------------|-------------------------|
-- | id          | uuid                     | NO          | gen_random_uuid()       |
-- | user_id     | uuid                     | NO          |                         |
-- | settings    | jsonb                    | NO          | '{}'::jsonb             |
-- | created_at  | timestamp with time zone | NO          | now()                   |
-- | updated_at  | timestamp with time zone | NO          | now()                   |
-- =============================================================================
