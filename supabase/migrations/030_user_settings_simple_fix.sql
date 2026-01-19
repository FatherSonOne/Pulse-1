-- SIMPLE FIX: user_settings table
-- Run this in Supabase SQL Editor

-- Drop everything related to user_settings
DROP TABLE IF EXISTS user_settings CASCADE;

-- Create fresh table WITHOUT auth.users reference (to avoid FK issues)
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS with permissive policy for now
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all user_settings" ON user_settings
    FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON user_settings TO authenticated;
GRANT ALL ON user_settings TO anon;

-- Verify
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'user_settings' ORDER BY ordinal_position;
