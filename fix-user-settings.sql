-- ================================================
-- FIX: Create user_settings table in remote database
-- ================================================
-- Run this in your Supabase SQL Editor:
-- https://app.supabase.com/project/ucaeuszgoihoyrvhewxk/sql
-- ================================================

-- Drop existing table if corrupted (be careful with this in production!)
DROP TABLE IF EXISTS user_settings CASCADE;

-- Create user_settings table
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE user_settings IS 'Stores user application settings synced across devices';

-- Enable Row Level Security
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Create permissive policy (allows all operations for now)
-- You can tighten this later to only allow users to access their own settings
DROP POLICY IF EXISTS "Allow all user_settings" ON user_settings;
CREATE POLICY "Allow all user_settings" ON user_settings
    FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions to authenticated and anonymous users
GRANT ALL ON user_settings TO authenticated;
GRANT ALL ON user_settings TO anon;

-- Verify the table was created
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'user_settings'
ORDER BY ordinal_position;

-- Test query (should return empty result set, not an error)
SELECT * FROM user_settings LIMIT 1;
