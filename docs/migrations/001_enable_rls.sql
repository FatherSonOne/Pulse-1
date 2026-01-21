-- =====================================================
-- PHASE 7: ROW LEVEL SECURITY (RLS) - Enable RLS
-- File 1 of 5: Enable RLS on All Tables
-- =====================================================
-- Purpose: Enable Row Level Security on all user-scoped tables
-- Security Model: Database-level user isolation with auth.uid()
-- Run Order: Execute FIRST before creating policies
-- =====================================================

-- CRITICAL: This script enables RLS but DOES NOT create policies
-- After running this script, users will have NO ACCESS until policies are created
-- Run scripts 002-003 immediately after to restore access with proper security

-- =====================================================
-- 1. CORE USER DATA TABLES
-- =====================================================

-- Contacts: User's personal/business contacts
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Calendar Events: User's calendar events
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Tasks: User's tasks and assignments
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. MESSAGING & COMMUNICATION TABLES
-- =====================================================

-- Threads: User's conversation threads
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;

-- Messages: Messages within threads (cascades from threads)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Unified Messages: Aggregated messages from all sources
ALTER TABLE unified_messages ENABLE ROW LEVEL SECURITY;

-- SMS Conversations: SMS conversation threads
ALTER TABLE sms_conversations ENABLE ROW LEVEL SECURITY;

-- SMS Messages: Individual SMS messages
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3. EMAIL & COMMUNICATION PLATFORM INTEGRATION
-- =====================================================

-- Emails: User's email messages
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

-- Slack Channels: User's Slack channel connections
ALTER TABLE slack_channels ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. VOICE & AUDIO FEATURES
-- =====================================================

-- Voxer Recordings: User's voice recordings
ALTER TABLE voxer_recordings ENABLE ROW LEVEL SECURITY;

-- Voice Rooms: User-created voice chat rooms
ALTER TABLE voice_rooms ENABLE ROW LEVEL SECURITY;

-- Voice Room Participants: Participants in voice rooms
ALTER TABLE voice_room_participants ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5. ARCHIVES & KNOWLEDGE BASE
-- =====================================================

-- Archives: User's archived content
ALTER TABLE archives ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 6. GOALS & OUTCOMES TRACKING
-- =====================================================

-- Outcomes: User's outcome objectives
ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY;

-- Key Results: Metrics for outcomes (cascades from outcomes)
ALTER TABLE key_results ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 7. AI LAB & WORKFLOWS
-- =====================================================

-- AI Lab Workflows: User's custom AI workflows
ALTER TABLE ai_lab_workflows ENABLE ROW LEVEL SECURITY;

-- AI Lab Templates: User's AI prompt templates
ALTER TABLE ai_lab_templates ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 8. IN-APP MESSAGING SYSTEM
-- =====================================================

-- In-App Messages: Admin-created messages (special policy needed)
ALTER TABLE in_app_messages ENABLE ROW LEVEL SECURITY;

-- Message Interactions: User interactions with in-app messages
ALTER TABLE message_interactions ENABLE ROW LEVEL SECURITY;

-- User Retention Cohorts: User retention analytics
ALTER TABLE user_retention_cohorts ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 9. FILE STORAGE & MANAGEMENT (Phase 6.3)
-- =====================================================

-- File Uploads: User-uploaded files
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 10. BACKUP & SYNC (Phase 6.3)
-- =====================================================

-- Backups: User's data backups
ALTER TABLE backups ENABLE ROW LEVEL SECURITY;

-- Sync Devices: User's registered sync devices
ALTER TABLE sync_devices ENABLE ROW LEVEL SECURITY;

-- Backup Settings: User's backup preferences
ALTER TABLE backup_settings ENABLE ROW LEVEL SECURITY;

-- Sync Settings: User's sync preferences
ALTER TABLE sync_settings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 11. EXPORT JOBS (Phase 6.3)
-- =====================================================

-- Export Jobs: User's data export jobs
ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 12. EPHEMERAL WORKSPACES & E2EE CHAT
-- =====================================================

-- Ephemeral Workspaces: Temporary encrypted workspaces
ALTER TABLE ephemeral_workspaces ENABLE ROW LEVEL SECURITY;

-- Chat Messages: Encrypted chat messages in workspaces
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Workspace Participants: Workspace membership
ALTER TABLE workspace_participants ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- IMPORTANT NOTES
-- =====================================================
--
-- 1. IMMEDIATE ACCESS RESTRICTION:
--    After enabling RLS, ALL queries will be blocked until policies are created.
--    Existing "Allow all access" policies will be dropped and replaced with secure policies.
--
-- 2. AUTHENTICATION REQUIREMENT:
--    All policies use auth.uid() to identify the current user from JWT token.
--    Ensure Supabase Auth is properly configured before enabling RLS.
--
-- 3. SERVICE ROLE BYPASS:
--    Service role key bypasses RLS for backend operations.
--    Never expose service role key to clients.
--
-- 4. POLICY APPLICATION ORDER:
--    - SELECT policies: Control read access
--    - INSERT policies: Control create access
--    - UPDATE policies: Control modify access
--    - DELETE policies: Control remove access
--
-- 5. PERFORMANCE CONSIDERATIONS:
--    RLS policies add query overhead. Proper indexes (see 004_performance_indexes.sql)
--    are critical for maintaining performance.
--
-- 6. TESTING RECOMMENDATIONS:
--    Test with multiple user accounts to verify isolation.
--    Use service role for admin operations.
--    Monitor query performance after enabling RLS.
--
-- =====================================================
-- DROP EXISTING PERMISSIVE POLICIES
-- =====================================================
-- These "Allow all access" policies were created for development
-- They will be replaced with proper security policies in 002-003

DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all existing policies that allow unrestricted access
    FOR r IN (
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
        AND policyname = 'Allow all access'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
            r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================
-- Run this to verify RLS is enabled on all tables

SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
    'contacts', 'calendar_events', 'tasks', 'threads', 'messages',
    'unified_messages', 'sms_conversations', 'sms_messages', 'emails',
    'slack_channels', 'voxer_recordings', 'voice_rooms', 'voice_room_participants',
    'archives', 'outcomes', 'key_results', 'ai_lab_workflows', 'ai_lab_templates',
    'in_app_messages', 'message_interactions', 'user_retention_cohorts',
    'file_uploads', 'backups', 'sync_devices', 'backup_settings', 'sync_settings',
    'export_jobs', 'ephemeral_workspaces', 'chat_messages', 'workspace_participants'
)
ORDER BY tablename;

-- Expected result: All tables should show rls_enabled = true

SELECT '✅ RLS enabled on all tables. CRITICAL: Run 002_user_policies.sql IMMEDIATELY to restore access.' as status;
