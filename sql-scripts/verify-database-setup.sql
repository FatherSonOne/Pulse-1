-- =====================================================
-- VERIFICATION SCRIPT FOR IN-APP MESSAGING DATABASE
-- Run this to check if your database is properly set up
-- =====================================================

-- Check 1: Verify all tables exist
SELECT
  'Tables Check' as check_type,
  COUNT(*) as found,
  3 as expected,
  CASE WHEN COUNT(*) = 3 THEN '✓ PASS' ELSE '✗ FAIL' END as status
FROM pg_tables
WHERE tablename IN ('in_app_messages', 'message_interactions', 'user_retention_cohorts');

-- Check 2: Verify table structure for in_app_messages
SELECT
  'in_app_messages columns' as check_type,
  COUNT(*) as found,
  18 as expected,
  CASE WHEN COUNT(*) >= 18 THEN '✓ PASS' ELSE '✗ FAIL' END as status
FROM information_schema.columns
WHERE table_name = 'in_app_messages';

-- Check 3: Verify indexes exist
SELECT
  'Indexes Check' as check_type,
  COUNT(*) as found,
  CASE WHEN COUNT(*) >= 8 THEN '✓ PASS' ELSE '✗ FAIL' END as status
FROM pg_indexes
WHERE tablename IN ('in_app_messages', 'message_interactions', 'user_retention_cohorts');

-- Check 4: Verify RLS is enabled
SELECT
  'RLS Check' as check_type,
  COUNT(*) as found,
  3 as expected,
  CASE WHEN COUNT(*) = 3 THEN '✓ PASS' ELSE '✗ FAIL' END as status
FROM pg_tables
WHERE tablename IN ('in_app_messages', 'message_interactions', 'user_retention_cohorts')
  AND rowsecurity = true;

-- Check 5: Verify analytics functions exist
SELECT
  'Functions Check' as check_type,
  COUNT(*) as found,
  2 as expected,
  CASE WHEN COUNT(*) >= 2 THEN '✓ PASS' ELSE '✗ FAIL' END as status
FROM pg_proc
WHERE proname IN ('get_message_metrics', 'get_retention_by_engagement');

-- Check 6: Count existing messages
SELECT
  'Sample Messages' as check_type,
  COUNT(*) as found,
  CASE WHEN COUNT(*) > 0 THEN '✓ HAS DATA' ELSE '⚠ NO DATA' END as status
FROM in_app_messages;

-- Check 7: List all existing messages
SELECT
  id,
  title,
  trigger_event,
  target_segment,
  active,
  created_at
FROM in_app_messages
ORDER BY priority DESC, created_at DESC;

-- =====================================================
-- SUMMARY
-- =====================================================
-- If all checks show ✓ PASS, your database is ready!
-- If any checks fail, you may need to run cleanup and re-migrate
