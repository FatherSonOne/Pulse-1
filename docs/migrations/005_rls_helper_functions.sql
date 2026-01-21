-- =====================================================
-- PHASE 7: ROW LEVEL SECURITY (RLS) - Helper Functions
-- File 5 of 5: Helper Functions for Complex RLS Policies
-- =====================================================
-- Purpose: Utility functions to simplify RLS policies and improve performance
-- Benefits: Reusable logic, better maintainability, optimized queries
-- Run Order: Execute FIFTH (optional but recommended)
-- =====================================================

-- FUNCTION CATEGORIES:
-- 1. Authentication & Authorization helpers
-- 2. Workspace & Room membership checks
-- 3. Audit & logging functions
-- 4. Data validation functions
-- 5. Performance optimization functions

-- =====================================================
-- 1. AUTHENTICATION & AUTHORIZATION HELPERS
-- =====================================================

-- Function: Get current user ID from JWT
CREATE OR REPLACE FUNCTION auth.current_user_id()
RETURNS TEXT
LANGUAGE SQL STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'sub',
    ''
  );
$$;

COMMENT ON FUNCTION auth.current_user_id() IS 'Returns the current user ID from JWT token. Returns empty string if not authenticated.';

-- Function: Check if current user is admin
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'admin',
    false
  );
$$;

COMMENT ON FUNCTION auth.is_admin() IS 'Returns true if current user has admin role in JWT claims.';

-- Function: Check if current user is moderator or admin
CREATE OR REPLACE FUNCTION auth.is_moderator()
RETURNS BOOLEAN
LANGUAGE SQL STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::json->>'role')::text IN ('admin', 'moderator'),
    false
  );
$$;

COMMENT ON FUNCTION auth.is_moderator() IS 'Returns true if current user has moderator or admin role.';

-- Function: Get user email from JWT
CREATE OR REPLACE FUNCTION auth.current_user_email()
RETURNS TEXT
LANGUAGE SQL STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'email',
    ''
  );
$$;

COMMENT ON FUNCTION auth.current_user_email() IS 'Returns the current user email from JWT token.';

-- =====================================================
-- 2. WORKSPACE & ROOM MEMBERSHIP CHECKS
-- =====================================================

-- Function: Check if user is workspace creator
CREATE OR REPLACE FUNCTION is_workspace_creator(workspace_uuid UUID, check_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM ephemeral_workspaces
    WHERE id = workspace_uuid
    AND created_by = check_user_id
  );
$$;

COMMENT ON FUNCTION is_workspace_creator(UUID, TEXT) IS 'Returns true if specified user created the workspace.';

-- Function: Check if user is workspace participant
CREATE OR REPLACE FUNCTION is_workspace_participant(workspace_uuid UUID, check_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_participants
    WHERE workspace_id = workspace_uuid
    AND user_id = check_user_id
    AND is_active = true
  );
$$;

COMMENT ON FUNCTION is_workspace_participant(UUID, TEXT) IS 'Returns true if user is an active participant in the workspace.';

-- Function: Check if user has workspace access (creator OR participant)
CREATE OR REPLACE FUNCTION has_workspace_access(workspace_uuid UUID, check_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT is_workspace_creator(workspace_uuid, check_user_id)
    OR is_workspace_participant(workspace_uuid, check_user_id);
$$;

COMMENT ON FUNCTION has_workspace_access(UUID, TEXT) IS 'Returns true if user is creator or active participant of workspace.';

-- Function: Check if user is voice room creator
CREATE OR REPLACE FUNCTION is_voice_room_creator(room_uuid UUID, check_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM voice_rooms
    WHERE id = room_uuid
    AND user_id = check_user_id
  );
$$;

COMMENT ON FUNCTION is_voice_room_creator(UUID, TEXT) IS 'Returns true if specified user created the voice room.';

-- Function: Check if user is voice room participant
CREATE OR REPLACE FUNCTION is_voice_room_participant(room_uuid UUID, check_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM voice_room_participants
    WHERE room_id = room_uuid
    AND user_id = check_user_id
  );
$$;

COMMENT ON FUNCTION is_voice_room_participant(UUID, TEXT) IS 'Returns true if user is in the voice room.';

-- Function: Check if user has voice room access
CREATE OR REPLACE FUNCTION has_voice_room_access(room_uuid UUID, check_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM voice_rooms
    WHERE id = room_uuid
    AND (
      is_private = false
      OR user_id = check_user_id
      OR is_voice_room_participant(room_uuid, check_user_id)
    )
  );
$$;

COMMENT ON FUNCTION has_voice_room_access(UUID, TEXT) IS 'Returns true if user can access voice room (public, creator, or participant).';

-- Function: Check if user owns thread
CREATE OR REPLACE FUNCTION owns_thread(thread_uuid UUID, check_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM threads
    WHERE id = thread_uuid
    AND user_id = check_user_id
  );
$$;

COMMENT ON FUNCTION owns_thread(UUID, TEXT) IS 'Returns true if user owns the thread.';

-- =====================================================
-- 3. AUDIT & LOGGING FUNCTIONS
-- =====================================================

-- Function: Log RLS policy violation (for debugging)
CREATE OR REPLACE FUNCTION log_rls_violation(
  table_name TEXT,
  operation TEXT,
  user_id TEXT,
  resource_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- In production, you might want to log to a separate audit table
  RAISE WARNING 'RLS Violation: User % attempted % on %.% (resource: %)',
    user_id, operation, 'public', table_name, resource_id;
END;
$$;

COMMENT ON FUNCTION log_rls_violation(TEXT, TEXT, TEXT, TEXT) IS 'Logs RLS policy violations for security auditing.';

-- =====================================================
-- 4. DATA VALIDATION FUNCTIONS
-- =====================================================

-- Function: Validate workspace is not expired
CREATE OR REPLACE FUNCTION workspace_is_active(workspace_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM ephemeral_workspaces
    WHERE id = workspace_uuid
    AND is_active = true
    AND expires_at > NOW()
  );
$$;

COMMENT ON FUNCTION workspace_is_active(UUID) IS 'Returns true if workspace is active and not expired.';

-- Function: Check if file upload is within user quota
CREATE OR REPLACE FUNCTION user_within_storage_quota(
  check_user_id TEXT,
  new_file_size BIGINT,
  max_quota BIGINT DEFAULT 10737418240 -- 10GB default
)
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT SUM(file_size) + new_file_size <= max_quota
      FROM file_uploads
      WHERE user_id::text = check_user_id
    ),
    true
  );
$$;

COMMENT ON FUNCTION user_within_storage_quota(TEXT, BIGINT, BIGINT) IS 'Returns true if adding new file would keep user within storage quota.';

-- Function: Check if backup name is unique for user
CREATE OR REPLACE FUNCTION backup_name_unique(
  check_user_id TEXT,
  backup_name TEXT,
  exclude_backup_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM backups
    WHERE user_id::text = check_user_id
    AND name = backup_name
    AND (exclude_backup_id IS NULL OR id != exclude_backup_id)
  );
$$;

COMMENT ON FUNCTION backup_name_unique(TEXT, TEXT, UUID) IS 'Returns true if backup name is unique for the user.';

-- =====================================================
-- 5. PERFORMANCE OPTIMIZATION FUNCTIONS
-- =====================================================

-- Function: Get user message count (cached for performance)
CREATE OR REPLACE FUNCTION get_user_message_count(check_user_id TEXT)
RETURNS BIGINT
LANGUAGE SQL STABLE
AS $$
  SELECT COUNT(*)
  FROM messages m
  JOIN threads t ON t.id = m.thread_id
  WHERE t.user_id = check_user_id;
$$;

COMMENT ON FUNCTION get_user_message_count(TEXT) IS 'Returns total message count for user across all threads.';

-- Function: Get user storage usage
CREATE OR REPLACE FUNCTION get_user_storage_usage(check_user_id TEXT)
RETURNS TABLE (
  total_files BIGINT,
  total_size BIGINT,
  total_size_formatted TEXT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    COUNT(*)::BIGINT as total_files,
    COALESCE(SUM(file_size), 0)::BIGINT as total_size,
    pg_size_pretty(COALESCE(SUM(file_size), 0)) as total_size_formatted
  FROM file_uploads
  WHERE user_id::text = check_user_id;
$$;

COMMENT ON FUNCTION get_user_storage_usage(TEXT) IS 'Returns storage statistics for user files.';

-- Function: Get workspace participant count
CREATE OR REPLACE FUNCTION get_workspace_participant_count(workspace_uuid UUID)
RETURNS INTEGER
LANGUAGE SQL STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM workspace_participants
  WHERE workspace_id = workspace_uuid
  AND is_active = true;
$$;

COMMENT ON FUNCTION get_workspace_participant_count(UUID) IS 'Returns count of active participants in workspace.';

-- Function: Get voice room participant count
CREATE OR REPLACE FUNCTION get_voice_room_participant_count(room_uuid UUID)
RETURNS INTEGER
LANGUAGE SQL STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM voice_room_participants
  WHERE room_id = room_uuid;
$$;

COMMENT ON FUNCTION get_voice_room_participant_count(UUID) IS 'Returns count of participants in voice room.';

-- =====================================================
-- 6. CLEANUP & MAINTENANCE FUNCTIONS
-- =====================================================

-- Function: Clean up expired workspaces
CREATE OR REPLACE FUNCTION cleanup_expired_workspaces()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Mark expired workspaces as inactive
  UPDATE ephemeral_workspaces
  SET is_active = false
  WHERE is_active = true
  AND expires_at <= NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Optionally delete very old expired workspaces (30+ days)
  DELETE FROM ephemeral_workspaces
  WHERE is_active = false
  AND expires_at <= NOW() - INTERVAL '30 days';

  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_expired_workspaces() IS 'Deactivates expired workspaces and deletes old ones. Returns count of deactivated workspaces.';

-- Function: Clean up old export jobs
CREATE OR REPLACE FUNCTION cleanup_old_export_jobs(days_to_keep INTEGER DEFAULT 7)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM export_jobs
  WHERE status IN ('completed', 'failed')
  AND created_at <= NOW() - (days_to_keep || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_old_export_jobs(INTEGER) IS 'Deletes completed/failed export jobs older than specified days. Returns count deleted.';

-- =====================================================
-- 7. AGGREGATION FUNCTIONS (For Analytics)
-- =====================================================

-- Function: Get user activity summary
CREATE OR REPLACE FUNCTION get_user_activity_summary(check_user_id TEXT)
RETURNS TABLE (
  message_count BIGINT,
  thread_count BIGINT,
  contact_count BIGINT,
  task_count BIGINT,
  completed_task_count BIGINT,
  voice_recording_count BIGINT,
  file_upload_count BIGINT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    (SELECT COUNT(*) FROM messages m JOIN threads t ON t.id = m.thread_id WHERE t.user_id = check_user_id) as message_count,
    (SELECT COUNT(*) FROM threads WHERE user_id = check_user_id) as thread_count,
    (SELECT COUNT(*) FROM contacts WHERE user_id = check_user_id) as contact_count,
    (SELECT COUNT(*) FROM tasks WHERE user_id = check_user_id) as task_count,
    (SELECT COUNT(*) FROM tasks WHERE user_id = check_user_id AND completed = true) as completed_task_count,
    (SELECT COUNT(*) FROM voxer_recordings WHERE user_id = check_user_id) as voice_recording_count,
    (SELECT COUNT(*) FROM file_uploads WHERE user_id::text = check_user_id) as file_upload_count;
$$;

COMMENT ON FUNCTION get_user_activity_summary(TEXT) IS 'Returns comprehensive activity statistics for a user.';

-- =====================================================
-- 8. SECURITY HELPER FUNCTIONS
-- =====================================================

-- Function: Check if user can delete resource (enhanced logging)
CREATE OR REPLACE FUNCTION can_delete_resource(
  table_name TEXT,
  resource_id UUID,
  check_user_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  resource_owner TEXT;
  can_delete BOOLEAN;
BEGIN
  -- This is a template function - customize per table
  -- For now, just check basic ownership
  can_delete := false;

  -- Log the attempt
  RAISE NOTICE 'Delete attempt: table=%, resource=%, user=%', table_name, resource_id, check_user_id;

  RETURN can_delete;
END;
$$;

COMMENT ON FUNCTION can_delete_resource(TEXT, UUID, TEXT) IS 'Template function for resource deletion authorization with logging.';

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION auth.current_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_moderator() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.current_user_email() TO authenticated;

GRANT EXECUTE ON FUNCTION is_workspace_creator(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION is_workspace_participant(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION has_workspace_access(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION is_voice_room_creator(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION is_voice_room_participant(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION has_voice_room_access(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION owns_thread(UUID, TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION workspace_is_active(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_within_storage_quota(TEXT, BIGINT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION backup_name_unique(TEXT, TEXT, UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION get_user_message_count(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_storage_usage(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_workspace_participant_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_voice_room_participant_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_activity_summary(TEXT) TO authenticated;

-- Admin-only functions
GRANT EXECUTE ON FUNCTION cleanup_expired_workspaces() TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_export_jobs(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION log_rls_violation(TEXT, TEXT, TEXT, TEXT) TO service_role;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- List all helper functions
SELECT
    n.nspname as schema,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type,
    CASE p.provolatile
        WHEN 'i' THEN 'IMMUTABLE'
        WHEN 's' THEN 'STABLE'
        WHEN 'v' THEN 'VOLATILE'
    END as volatility,
    obj_description(p.oid, 'pg_proc') as description
FROM pg_proc p
LEFT JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'auth')
AND p.proname IN (
    'current_user_id', 'is_admin', 'is_moderator', 'current_user_email',
    'is_workspace_creator', 'is_workspace_participant', 'has_workspace_access',
    'is_voice_room_creator', 'is_voice_room_participant', 'has_voice_room_access',
    'owns_thread', 'workspace_is_active', 'user_within_storage_quota',
    'backup_name_unique', 'get_user_message_count', 'get_user_storage_usage',
    'get_workspace_participant_count', 'get_voice_room_participant_count',
    'cleanup_expired_workspaces', 'cleanup_old_export_jobs',
    'log_rls_violation', 'get_user_activity_summary', 'can_delete_resource'
)
ORDER BY schema, function_name;

SELECT '✅ RLS helper functions created. All migration scripts complete!' as status;
