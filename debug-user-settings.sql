-- ================================================
-- DEBUG: Check user_settings table configuration
-- ================================================
-- Run this in Supabase SQL Editor to diagnose the 406 error
-- ================================================

-- 1. Check if table exists in public schema
SELECT schemaname, tablename, tableowner
FROM pg_tables
WHERE tablename = 'user_settings';

-- 2. Check RLS status
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'user_settings';

-- 3. Check all policies on the table
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'user_settings';

-- 4. Check table permissions
SELECT
    grantee,
    privilege_type
FROM information_schema.table_privileges
WHERE table_name = 'user_settings'
ORDER BY grantee, privilege_type;

-- 5. Test a simple select (should work if policies are correct)
SELECT COUNT(*) as record_count FROM user_settings;

-- 6. Check if postgrest can see the table
SELECT * FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'user_settings';
