-- ================================================
-- User Settings Table - Secure Setup
-- ================================================
-- Creates user_settings table with proper RLS policies
-- Each user can only access their own settings
-- ================================================

-- Step 1: Drop existing table if it exists (use with caution in production!)
DROP TABLE IF EXISTS public.user_settings CASCADE;

-- Step 2: Create table in PUBLIC schema
CREATE TABLE public.user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 3: Add table comment
COMMENT ON TABLE public.user_settings IS 'User application settings synced across devices';

-- Step 4: Create index for faster lookups
CREATE INDEX idx_user_settings_user_id ON public.user_settings(user_id);

-- Step 5: Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Step 6: Drop all existing policies (clean slate)
DROP POLICY IF EXISTS "Allow all user_settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can create own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can delete own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.user_settings;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.user_settings;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.user_settings;

-- Step 7: Create secure RLS policies (users can only access their own settings)

-- SELECT: Users can only read their own settings
CREATE POLICY "Users can view own settings"
ON public.user_settings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- INSERT: Users can only create settings for themselves
CREATE POLICY "Users can create own settings"
ON public.user_settings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can only update their own settings
CREATE POLICY "Users can update own settings"
ON public.user_settings
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can delete their own settings (optional, usually not needed)
CREATE POLICY "Users can delete own settings"
ON public.user_settings
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Step 8: Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;

-- Step 9: Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 10: Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_user_settings_timestamp ON public.user_settings;
CREATE TRIGGER update_user_settings_timestamp
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_user_settings_updated_at();

-- ================================================
-- Verification Queries
-- ================================================

-- Verify table creation
SELECT
    'Table Info' as check_type,
    tablename,
    tableowner,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'user_settings';

-- Verify RLS policies
SELECT
    'RLS Policies' as check_type,
    policyname,
    roles,
    cmd as command,
    qual as using_expression,
    with_check as check_expression
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'user_settings';

-- Verify indexes
SELECT
    'Indexes' as check_type,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'user_settings';

-- Test query (should return empty set, not error)
SELECT 'Data Test' as check_type, COUNT(*) as row_count
FROM public.user_settings;
