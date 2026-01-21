-- =====================================================
-- PHASE 7: ROW LEVEL SECURITY (RLS) - Performance Indexes
-- File 4 of 5: Indexes for RLS Policy Performance
-- =====================================================
-- Purpose: Create indexes to optimize RLS policy evaluation
-- Impact: Prevent performance degradation from RLS overhead
-- Run Order: Execute FOURTH after all policies are created
-- =====================================================

-- CRITICAL PERFORMANCE NOTES:
-- 1. RLS policies add subqueries to EVERY query
-- 2. Without proper indexes, RLS can cause 10-100x slowdown
-- 3. These indexes optimize the most common RLS policy checks
-- 4. Monitor query performance after enabling RLS
-- 5. Use EXPLAIN ANALYZE to identify slow queries

-- =====================================================
-- STRATEGY: Index Optimization for RLS
-- =====================================================
-- 1. Index all user_id columns (primary RLS filter)
-- 2. Index foreign keys used in policy EXISTS clauses
-- 3. Index commonly filtered columns (is_active, status, etc.)
-- 4. Create composite indexes for multi-column checks
-- 5. Add partial indexes for common WHERE conditions

-- =====================================================
-- 1. USER_ID INDEXES (Primary RLS Filter)
-- =====================================================
-- These are CRITICAL for all user-owned table policies

-- Most tables already have user_id indexes from schema creation
-- Verify and create any missing ones

-- Contacts
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);

-- Calendar Events
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);

-- Tasks
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id) WHERE assignee_id IS NOT NULL;

-- Threads
CREATE INDEX IF NOT EXISTS idx_threads_user_id ON threads(user_id);

-- Unified Messages
CREATE INDEX IF NOT EXISTS idx_unified_messages_user_id ON unified_messages(user_id);

-- SMS Conversations
CREATE INDEX IF NOT EXISTS idx_sms_conversations_user_id ON sms_conversations(user_id);

-- Emails
CREATE INDEX IF NOT EXISTS idx_emails_user_id ON emails(user_id);

-- Slack Channels
CREATE INDEX IF NOT EXISTS idx_slack_channels_user_id ON slack_channels(user_id);

-- Voxer Recordings
CREATE INDEX IF NOT EXISTS idx_voxer_recordings_user_id ON voxer_recordings(user_id);

-- Voice Rooms
CREATE INDEX IF NOT EXISTS idx_voice_rooms_user_id ON voice_rooms(user_id);

-- Archives
CREATE INDEX IF NOT EXISTS idx_archives_user_id ON archives(user_id);

-- Outcomes
CREATE INDEX IF NOT EXISTS idx_outcomes_user_id ON outcomes(user_id);

-- AI Lab Workflows
CREATE INDEX IF NOT EXISTS idx_ai_lab_workflows_user_id ON ai_lab_workflows(user_id);

-- AI Lab Templates
CREATE INDEX IF NOT EXISTS idx_ai_lab_templates_user_id ON ai_lab_templates(user_id);

-- Message Interactions
CREATE INDEX IF NOT EXISTS idx_message_interactions_user_id ON message_interactions(user_id);

-- User Retention Cohorts
CREATE INDEX IF NOT EXISTS idx_user_retention_cohorts_user_id ON user_retention_cohorts(user_id);

-- File Uploads
CREATE INDEX IF NOT EXISTS idx_file_uploads_user_id ON file_uploads(user_id);

-- Backups
CREATE INDEX IF NOT EXISTS idx_backups_user_id ON backups(user_id);

-- Sync Devices
CREATE INDEX IF NOT EXISTS idx_sync_devices_user_id ON sync_devices(user_id);

-- Export Jobs
CREATE INDEX IF NOT EXISTS idx_export_jobs_user_id ON export_jobs(user_id);

-- =====================================================
-- 2. FOREIGN KEY INDEXES (Policy EXISTS Clauses)
-- =====================================================
-- Optimize JOIN-based policy checks

-- Messages -> Threads lookup (CRITICAL for performance)
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);

-- SMS Messages -> SMS Conversations lookup
CREATE INDEX IF NOT EXISTS idx_sms_messages_conversation_id ON sms_messages(conversation_id);

-- Key Results -> Outcomes lookup
CREATE INDEX IF NOT EXISTS idx_key_results_outcome_id ON key_results(outcome_id);

-- Voice Room Participants -> Voice Rooms lookup
CREATE INDEX IF NOT EXISTS idx_voice_room_participants_room_id ON voice_room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_voice_room_participants_user_id ON voice_room_participants(user_id);

-- Chat Messages -> Ephemeral Workspaces lookup
CREATE INDEX IF NOT EXISTS idx_chat_messages_workspace_id ON chat_messages(workspace_id);

-- Workspace Participants -> Workspaces lookup
CREATE INDEX IF NOT EXISTS idx_workspace_participants_workspace_id ON workspace_participants(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_participants_user_id ON workspace_participants(user_id);

-- Message Interactions -> In-App Messages lookup
CREATE INDEX IF NOT EXISTS idx_message_interactions_message_id ON message_interactions(message_id);

-- =====================================================
-- 3. COMPOSITE INDEXES (Multi-Column Policy Checks)
-- =====================================================
-- Optimize policies that check multiple columns together

-- Voice Room Participants: (room_id, user_id) for membership checks
CREATE INDEX IF NOT EXISTS idx_voice_room_participants_room_user
ON voice_room_participants(room_id, user_id);

-- Workspace Participants: (workspace_id, user_id, is_active)
CREATE INDEX IF NOT EXISTS idx_workspace_participants_workspace_user_active
ON workspace_participants(workspace_id, user_id, is_active);

-- Tasks: (user_id, completed) for active task queries
CREATE INDEX IF NOT EXISTS idx_tasks_user_completed
ON tasks(user_id, completed);

-- Tasks: (assignee_id, completed) for assigned task queries
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_completed
ON tasks(assignee_id, completed) WHERE assignee_id IS NOT NULL;

-- Unified Messages: (user_id, is_read) for unread message queries
CREATE INDEX IF NOT EXISTS idx_unified_messages_user_read
ON unified_messages(user_id, is_read);

-- Emails: (user_id, folder, read) for inbox queries
CREATE INDEX IF NOT EXISTS idx_emails_user_folder_read
ON emails(user_id, folder, read);

-- Backups: (user_id, status) for active backup queries
CREATE INDEX IF NOT EXISTS idx_backups_user_status
ON backups(user_id, status);

-- Export Jobs: (user_id, status) for pending export queries
CREATE INDEX IF NOT EXISTS idx_export_jobs_user_status
ON export_jobs(user_id, status);

-- =====================================================
-- 4. PARTIAL INDEXES (Filtered Conditions)
-- =====================================================
-- Optimize common WHERE clauses in policies

-- Voice Rooms: Only public rooms (frequently queried)
CREATE INDEX IF NOT EXISTS idx_voice_rooms_public
ON voice_rooms(is_private) WHERE is_private = false;

-- Ephemeral Workspaces: Only active workspaces
CREATE INDEX IF NOT EXISTS idx_ephemeral_workspaces_active
ON ephemeral_workspaces(is_active, created_by) WHERE is_active = true;

-- Workspace Participants: Only active participants
CREATE INDEX IF NOT EXISTS idx_workspace_participants_active
ON workspace_participants(workspace_id, user_id) WHERE is_active = true;

-- In-App Messages: Only active messages
CREATE INDEX IF NOT EXISTS idx_in_app_messages_active
ON in_app_messages(active, start_date, end_date) WHERE active = true;

-- Tasks: Only incomplete tasks
CREATE INDEX IF NOT EXISTS idx_tasks_incomplete
ON tasks(user_id, due_date) WHERE completed = false;

-- Unified Messages: Only unread messages
CREATE INDEX IF NOT EXISTS idx_unified_messages_unread
ON unified_messages(user_id, timestamp) WHERE is_read = false;

-- Emails: Only inbox emails
CREATE INDEX IF NOT EXISTS idx_emails_inbox
ON emails(user_id, date) WHERE folder = 'inbox';

-- =====================================================
-- 5. TIMESTAMP INDEXES (Pagination & Sorting)
-- =====================================================
-- Optimize ORDER BY and pagination queries

-- Messages: (thread_id, timestamp) for chronological ordering
CREATE INDEX IF NOT EXISTS idx_messages_thread_timestamp
ON messages(thread_id, timestamp DESC);

-- Unified Messages: (user_id, timestamp) for timeline views
CREATE INDEX IF NOT EXISTS idx_unified_messages_user_timestamp
ON unified_messages(user_id, timestamp DESC);

-- SMS Messages: (conversation_id, timestamp) for chat history
CREATE INDEX IF NOT EXISTS idx_sms_messages_conversation_timestamp
ON sms_messages(conversation_id, timestamp DESC);

-- Chat Messages: (workspace_id, created_at) for workspace chat
CREATE INDEX IF NOT EXISTS idx_chat_messages_workspace_created
ON chat_messages(workspace_id, created_at DESC);

-- Voxer Recordings: (user_id, recorded_at) for recording list
CREATE INDEX IF NOT EXISTS idx_voxer_recordings_user_recorded
ON voxer_recordings(user_id, recorded_at DESC);

-- Archives: (user_id, date) for archive timeline
CREATE INDEX IF NOT EXISTS idx_archives_user_date
ON archives(user_id, date DESC);

-- Calendar Events: (user_id, start_time) for calendar views
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_start
ON calendar_events(user_id, start_time);

-- =====================================================
-- 6. SPECIALIZED INDEXES (Feature-Specific)
-- =====================================================

-- Tasks: Due date for overdue task queries
CREATE INDEX IF NOT EXISTS idx_tasks_due_date
ON tasks(due_date) WHERE due_date IS NOT NULL AND completed = false;

-- Contacts: Email for lookup
CREATE INDEX IF NOT EXISTS idx_contacts_email
ON contacts(email);

-- Contacts: (user_id, source) for sync filtering
CREATE INDEX IF NOT EXISTS idx_contacts_user_source
ON contacts(user_id, source);

-- Voice Rooms: Category for filtering
CREATE INDEX IF NOT EXISTS idx_voice_rooms_category
ON voice_rooms(category) WHERE category IS NOT NULL;

-- File Uploads: (user_id, file_category) for file browsing
CREATE INDEX IF NOT EXISTS idx_file_uploads_user_category
ON file_uploads(user_id, file_category);

-- Sync Devices: (user_id, status) for sync status checks
CREATE INDEX IF NOT EXISTS idx_sync_devices_user_status
ON sync_devices(user_id, status);

-- Ephemeral Workspaces: expires_at for cleanup jobs
CREATE INDEX IF NOT EXISTS idx_ephemeral_workspaces_expires
ON ephemeral_workspaces(expires_at) WHERE is_active = true;

-- =====================================================
-- 7. FUNCTION-BASED INDEXES (Advanced Optimization)
-- =====================================================

-- User Retention Cohorts: cohort_date for analytics
CREATE INDEX IF NOT EXISTS idx_user_retention_cohorts_cohort_date
ON user_retention_cohorts(cohort_date);

-- In-App Messages: (trigger_event, active) for event matching
CREATE INDEX IF NOT EXISTS idx_in_app_messages_trigger_active
ON in_app_messages(trigger_event, active) WHERE active = true;

-- =====================================================
-- 8. TEXT SEARCH INDEXES (Optional - for search features)
-- =====================================================
-- Enable full-text search if needed

-- Messages: Full-text search on message content
-- CREATE INDEX IF NOT EXISTS idx_messages_text_search
-- ON messages USING gin(to_tsvector('english', text));

-- Contacts: Full-text search on name
-- CREATE INDEX IF NOT EXISTS idx_contacts_name_search
-- ON contacts USING gin(to_tsvector('english', name));

-- Archives: Full-text search on content
-- CREATE INDEX IF NOT EXISTS idx_archives_content_search
-- ON archives USING gin(to_tsvector('english', content));

-- =====================================================
-- STATISTICS UPDATE
-- =====================================================
-- Ensure PostgreSQL has accurate statistics for query planning

ANALYZE contacts;
ANALYZE calendar_events;
ANALYZE tasks;
ANALYZE threads;
ANALYZE messages;
ANALYZE unified_messages;
ANALYZE sms_conversations;
ANALYZE sms_messages;
ANALYZE emails;
ANALYZE slack_channels;
ANALYZE voxer_recordings;
ANALYZE voice_rooms;
ANALYZE voice_room_participants;
ANALYZE archives;
ANALYZE outcomes;
ANALYZE key_results;
ANALYZE ai_lab_workflows;
ANALYZE ai_lab_templates;
ANALYZE in_app_messages;
ANALYZE message_interactions;
ANALYZE user_retention_cohorts;
ANALYZE file_uploads;
ANALYZE backups;
ANALYZE sync_devices;
ANALYZE backup_settings;
ANALYZE sync_settings;
ANALYZE export_jobs;
ANALYZE ephemeral_workspaces;
ANALYZE chat_messages;
ANALYZE workspace_participants;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check all indexes on user-scoped tables
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND (
    indexname LIKE '%user_id%'
    OR indexname LIKE '%thread_id%'
    OR indexname LIKE '%workspace_id%'
    OR indexname LIKE '%room_id%'
)
ORDER BY tablename, indexname;

-- Check index sizes
SELECT
    schemaname,
    tablename,
    COUNT(*) as index_count,
    pg_size_pretty(SUM(pg_relation_size(indexrelid))) as total_index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY SUM(pg_relation_size(indexrelid)) DESC;

-- Check for missing indexes on foreign keys
SELECT
    c.conrelid::regclass AS table_name,
    a.attname AS column_name,
    c.confrelid::regclass AS referenced_table
FROM pg_constraint c
JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
WHERE c.contype = 'f'
AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid
    AND a.attnum = ANY(i.indkey)
)
ORDER BY table_name;

SELECT '✅ Performance indexes created. Continue with 005_rls_helper_functions.sql' as status;
