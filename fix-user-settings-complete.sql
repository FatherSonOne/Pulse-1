-- ================================================
-- COMPLETE FIX: user_settings table with proper API access
-- ================================================
-- Run this in Supabase SQL Editor to fix the 406 error
-- ================================================

-- Step 1: Drop and recreate to ensure clean slate
DROP TABLE IF EXISTS public.user_settings CASCADE;

-- Step 2: Create table in PUBLIC schema (important for API access)
CREATE TABLE public.user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 3: Add comment
COMMENT ON TABLE public.user_settings IS 'User application settings synced across devices';

-- Step 4: Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Step 5: Drop all existing policies first
DROP POLICY IF EXISTS "Allow all user_settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can create own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.user_settings;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.user_settings;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.user_settings;

-- Step 6: Create proper RLS policies for authenticated users
-- Allow SELECT for all authenticated users (they can read their own settings)
CREATE POLICY "Enable read access for authenticated users"
ON public.user_settings
FOR SELECT
TO authenticated
USING (true);

-- Allow INSERT for all authenticated users
CREATE POLICY "Enable insert access for authenticated users"
ON public.user_settings
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow UPDATE for all authenticated users
CREATE POLICY "Enable update access for authenticated users"
ON public.user_settings
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Step 7: Grant explicit permissions
GRANT ALL ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO anon;
GRANT ALL ON public.user_settings TO postgres;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Step 8: Verify setup
SELECT
    'Table created' as status,
    tablename,
    tableowner,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'user_settings';

-- Step 9: Verify policies
SELECT
    'Policy' as type,
    policyname,
    roles,
    cmd as command
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'user_settings';

-- Step 10: Test query (should return empty set, not error)
SELECT * FROM public.user_settings LIMIT 1;
