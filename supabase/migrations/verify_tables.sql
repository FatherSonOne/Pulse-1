-- ================================================
-- Verification Script: Check Privacy Dashboard Tables
-- ================================================
-- Run this after applying migrations to verify everything is set up correctly

-- Check which tables exist
SELECT
  table_name,
  CASE
    WHEN table_name IN ('activity_logs', 'security_alerts', 'security_settings')
      THEN '✅ Activity Logs Migration'
    WHEN table_name = 'user_sessions'
      THEN '✅ Session Management Migration'
    WHEN table_name IN ('data_exports', 'data_deletion_requests')
      THEN '✅ Data Export & Privacy Migration'
    WHEN table_name IN ('data_retention_policies', 'data_cleanup_logs', 'oauth_connected_apps')
      THEN '✅ Data Retention & OAuth Migration'
    ELSE 'Other'
  END as migration_source
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'activity_logs',
  'security_alerts',
  'security_settings',
  'user_sessions',
  'data_exports',
  'data_deletion_requests',
  'data_retention_policies',
  'data_cleanup_logs',
  'oauth_connected_apps'
)
ORDER BY migration_source, table_name;

-- Count RLS policies
SELECT
  schemaname,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
  'activity_logs',
  'security_alerts',
  'security_settings',
  'user_sessions',
  'data_exports',
  'data_deletion_requests',
  'data_retention_policies',
  'oauth_connected_apps'
)
GROUP BY schemaname, tablename
ORDER BY tablename;

-- Check indexes (for performance)
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN (
  'activity_logs',
  'security_alerts',
  'security_settings',
  'user_sessions',
  'data_exports',
  'data_retention_policies',
  'oauth_connected_apps'
)
ORDER BY tablename, indexname;

-- Summary
SELECT
  'Tables Created' as metric,
  COUNT(DISTINCT table_name) as count,
  '9 expected' as expected
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'activity_logs',
  'security_alerts',
  'security_settings',
  'user_sessions',
  'data_exports',
  'data_deletion_requests',
  'data_retention_policies',
  'data_cleanup_logs',
  'oauth_connected_apps'
)

UNION ALL

SELECT
  'RLS Policies Created' as metric,
  COUNT(*) as count,
  '18+ expected' as expected
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
  'activity_logs',
  'security_alerts',
  'security_settings',
  'user_sessions',
  'data_exports',
  'data_deletion_requests',
  'data_retention_policies',
  'oauth_connected_apps'
)

UNION ALL

SELECT
  'Performance Indexes' as metric,
  COUNT(*) as count,
  '15+ expected' as expected
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN (
  'activity_logs',
  'security_alerts',
  'security_settings',
  'user_sessions',
  'data_exports',
  'data_retention_policies',
  'oauth_connected_apps'
);
