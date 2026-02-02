-- ================================================
-- VERIFY: API Access and Test the Endpoint
-- ================================================
-- Run these queries to verify the table is accessible
-- ================================================

-- 1. Verify table is in the public schema and exposed to PostgREST
SELECT
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE tablename = 'user_settings';

-- 2. Check if the table is included in the API schema
SELECT
    table_schema,
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'user_settings';

-- 3. Verify all columns exist
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_settings'
ORDER BY ordinal_position;

-- 4. Check current RLS policies
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'user_settings';

-- 5. Insert a test record for the current user
-- Replace 'feedaa8d-1f48-4ad1-b757-11c7b79b7510' with your actual user ID
INSERT INTO public.user_settings (user_id, settings)
VALUES (
    'feedaa8d-1f48-4ad1-b757-11c7b79b7510',
    '{"test": true}'::jsonb
)
ON CONFLICT (user_id) DO UPDATE
SET settings = EXCLUDED.settings,
    updated_at = NOW();

-- 6. Verify the record exists
SELECT * FROM public.user_settings
WHERE user_id = 'feedaa8d-1f48-4ad1-b757-11c7b79b7510';

-- 7. Test the exact query the app is trying to run
SELECT settings, updated_at
FROM public.user_settings
WHERE user_id = 'feedaa8d-1f48-4ad1-b757-11c7b79b7510';
