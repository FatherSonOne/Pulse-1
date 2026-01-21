-- =====================================================
-- PHASE 7: ROW LEVEL SECURITY (RLS) - User-Owned Policies
-- File 2 of 5: Policies for User-Owned Tables
-- =====================================================
-- Purpose: Create RLS policies for tables where users own all their data
-- Security Model: user_id = auth.uid() for complete isolation
-- Run Order: Execute SECOND after enabling RLS
-- =====================================================

-- SECURITY MODEL: User-Owned Tables
-- - Users can only access rows where user_id matches their auth.uid()
-- - Complete data isolation between users
-- - No cross-user access unless explicitly granted via workspace policies
-- - Service role bypasses RLS for admin operations

-- =====================================================
-- HELPER FUNCTION: Get Current User ID
-- =====================================================

CREATE OR REPLACE FUNCTION auth.current_user_id()
RETURNS TEXT
LANGUAGE SQL STABLE
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'sub',
    ''
  );
$$;

-- =====================================================
-- 1. CONTACTS - User's Personal/Business Contacts
-- =====================================================

-- Policy: Users can view their own contacts
CREATE POLICY "Users can view own contacts"
ON contacts
FOR SELECT
USING (user_id = auth.current_user_id());

-- Policy: Users can insert their own contacts
CREATE POLICY "Users can insert own contacts"
ON contacts
FOR INSERT
WITH CHECK (user_id = auth.current_user_id());

-- Policy: Users can update their own contacts
CREATE POLICY "Users can update own contacts"
ON contacts
FOR UPDATE
USING (user_id = auth.current_user_id())
WITH CHECK (user_id = auth.current_user_id());

-- Policy: Users can delete their own contacts
CREATE POLICY "Users can delete own contacts"
ON contacts
FOR DELETE
USING (user_id = auth.current_user_id());

-- =====================================================
-- 2. CALENDAR EVENTS - User's Calendar
-- =====================================================

CREATE POLICY "Users can view own calendar events"
ON calendar_events
FOR SELECT
USING (user_id = auth.current_user_id());

CREATE POLICY "Users can insert own calendar events"
ON calendar_events
FOR INSERT
WITH CHECK (user_id = auth.current_user_id());

CREATE POLICY "Users can update own calendar events"
ON calendar_events
FOR UPDATE
USING (user_id = auth.current_user_id())
WITH CHECK (user_id = auth.current_user_id());

CREATE POLICY "Users can delete own calendar events"
ON calendar_events
FOR DELETE
USING (user_id = auth.current_user_id());

-- =====================================================
-- 3. TASKS - User's Tasks (includes workspace tasks)
-- =====================================================

-- Policy: Users can view tasks they created OR are assigned to
CREATE POLICY "Users can view own or assigned tasks"
ON tasks
FOR SELECT
USING (
  user_id = auth.current_user_id()
  OR assignee_id = auth.current_user_id()
);

-- Policy: Users can insert their own tasks
CREATE POLICY "Users can insert own tasks"
ON tasks
FOR INSERT
WITH CHECK (user_id = auth.current_user_id());

-- Policy: Users can update tasks they created or are assigned to
CREATE POLICY "Users can update own or assigned tasks"
ON tasks
FOR UPDATE
USING (
  user_id = auth.current_user_id()
  OR assignee_id = auth.current_user_id()
)
WITH CHECK (user_id = auth.current_user_id());

-- Policy: Users can only delete tasks they created
CREATE POLICY "Users can delete own tasks"
ON tasks
FOR DELETE
USING (user_id = auth.current_user_id());

-- =====================================================
-- 4. THREADS - User's Conversation Threads
-- =====================================================

CREATE POLICY "Users can view own threads"
ON threads
FOR SELECT
USING (user_id = auth.current_user_id());

CREATE POLICY "Users can insert own threads"
ON threads
FOR INSERT
WITH CHECK (user_id = auth.current_user_id());

CREATE POLICY "Users can update own threads"
ON threads
FOR UPDATE
USING (user_id = auth.current_user_id())
WITH CHECK (user_id = auth.current_user_id());

CREATE POLICY "Users can delete own threads"
ON threads
FOR DELETE
USING (user_id = auth.current_user_id());

-- =====================================================
-- 5. MESSAGES - Messages in Threads
-- =====================================================

-- Policy: Users can view messages in their threads
CREATE POLICY "Users can view messages in own threads"
ON messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM threads
    WHERE threads.id = messages.thread_id
    AND threads.user_id = auth.current_user_id()
  )
);

-- Policy: Users can insert messages in their threads
CREATE POLICY "Users can insert messages in own threads"
ON messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM threads
    WHERE threads.id = messages.thread_id
    AND threads.user_id = auth.current_user_id()
  )
);

-- Policy: Users can update messages in their threads
CREATE POLICY "Users can update messages in own threads"
ON messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM threads
    WHERE threads.id = messages.thread_id
    AND threads.user_id = auth.current_user_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM threads
    WHERE threads.id = messages.thread_id
    AND threads.user_id = auth.current_user_id()
  )
);

-- Policy: Users can delete messages in their threads
CREATE POLICY "Users can delete messages in own threads"
ON messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM threads
    WHERE threads.id = messages.thread_id
    AND threads.user_id = auth.current_user_id()
  )
);

-- =====================================================
-- 6. UNIFIED MESSAGES - Aggregated Messages
-- =====================================================

CREATE POLICY "Users can view own unified messages"
ON unified_messages
FOR SELECT
USING (user_id = auth.current_user_id());

CREATE POLICY "Users can insert own unified messages"
ON unified_messages
FOR INSERT
WITH CHECK (user_id = auth.current_user_id());

CREATE POLICY "Users can update own unified messages"
ON unified_messages
FOR UPDATE
USING (user_id = auth.current_user_id())
WITH CHECK (user_id = auth.current_user_id());

CREATE POLICY "Users can delete own unified messages"
ON unified_messages
FOR DELETE
USING (user_id = auth.current_user_id());

-- =====================================================
-- 7. SMS CONVERSATIONS - SMS Threads
-- =====================================================

CREATE POLICY "Users can view own sms conversations"
ON sms_conversations
FOR SELECT
USING (user_id = auth.current_user_id());

CREATE POLICY "Users can insert own sms conversations"
ON sms_conversations
FOR INSERT
WITH CHECK (user_id = auth.current_user_id());

CREATE POLICY "Users can update own sms conversations"
ON sms_conversations
FOR UPDATE
USING (user_id = auth.current_user_id())
WITH CHECK (user_id = auth.current_user_id());

CREATE POLICY "Users can delete own sms conversations"
ON sms_conversations
FOR DELETE
USING (user_id = auth.current_user_id());

-- =====================================================
-- 8. SMS MESSAGES - Individual SMS Messages
-- =====================================================

CREATE POLICY "Users can view sms messages in own conversations"
ON sms_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM sms_conversations
    WHERE sms_conversations.id = sms_messages.conversation_id
    AND sms_conversations.user_id = auth.current_user_id()
  )
);

CREATE POLICY "Users can insert sms messages in own conversations"
ON sms_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sms_conversations
    WHERE sms_conversations.id = sms_messages.conversation_id
    AND sms_conversations.user_id = auth.current_user_id()
  )
);

CREATE POLICY "Users can update sms messages in own conversations"
ON sms_messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM sms_conversations
    WHERE sms_conversations.id = sms_messages.conversation_id
    AND sms_conversations.user_id = auth.current_user_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sms_conversations
    WHERE sms_conversations.id = sms_messages.conversation_id
    AND sms_conversations.user_id = auth.current_user_id()
  )
);

CREATE POLICY "Users can delete sms messages in own conversations"
ON sms_messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM sms_conversations
    WHERE sms_conversations.id = sms_messages.conversation_id
    AND sms_conversations.user_id = auth.current_user_id()
  )
);

-- =====================================================
-- 9. EMAILS - User's Email Messages
-- =====================================================

CREATE POLICY "Users can view own emails"
ON emails
FOR SELECT
USING (user_id = auth.current_user_id());

CREATE POLICY "Users can insert own emails"
ON emails
FOR INSERT
WITH CHECK (user_id = auth.current_user_id());

CREATE POLICY "Users can update own emails"
ON emails
FOR UPDATE
USING (user_id = auth.current_user_id())
WITH CHECK (user_id = auth.current_user_id());

CREATE POLICY "Users can delete own emails"
ON emails
FOR DELETE
USING (user_id = auth.current_user_id());

-- =====================================================
-- 10. SLACK CHANNELS - Slack Integrations
-- =====================================================

CREATE POLICY "Users can view own slack channels"
ON slack_channels
FOR SELECT
USING (user_id = auth.current_user_id());

CREATE POLICY "Users can insert own slack channels"
ON slack_channels
FOR INSERT
WITH CHECK (user_id = auth.current_user_id());

CREATE POLICY "Users can update own slack channels"
ON slack_channels
FOR UPDATE
USING (user_id = auth.current_user_id())
WITH CHECK (user_id = auth.current_user_id());

CREATE POLICY "Users can delete own slack channels"
ON slack_channels
FOR DELETE
USING (user_id = auth.current_user_id());

-- =====================================================
-- 11. VOXER RECORDINGS - Voice Recordings
-- =====================================================

CREATE POLICY "Users can view own voxer recordings"
ON voxer_recordings
FOR SELECT
USING (user_id = auth.current_user_id());

CREATE POLICY "Users can insert own voxer recordings"
ON voxer_recordings
FOR INSERT
WITH CHECK (user_id = auth.current_user_id());

CREATE POLICY "Users can update own voxer recordings"
ON voxer_recordings
FOR UPDATE
USING (user_id = auth.current_user_id())
WITH CHECK (user_id = auth.current_user_id());

CREATE POLICY "Users can delete own voxer recordings"
ON voxer_recordings
FOR DELETE
USING (user_id = auth.current_user_id());

-- =====================================================
-- 12. ARCHIVES - User's Archived Content
-- =====================================================

CREATE POLICY "Users can view own archives"
ON archives
FOR SELECT
USING (user_id = auth.current_user_id());

CREATE POLICY "Users can insert own archives"
ON archives
FOR INSERT
WITH CHECK (user_id = auth.current_user_id());

CREATE POLICY "Users can update own archives"
ON archives
FOR UPDATE
USING (user_id = auth.current_user_id())
WITH CHECK (user_id = auth.current_user_id());

CREATE POLICY "Users can delete own archives"
ON archives
FOR DELETE
USING (user_id = auth.current_user_id());

-- =====================================================
-- 13. OUTCOMES - User's Outcome Objectives
-- =====================================================

CREATE POLICY "Users can view own outcomes"
ON outcomes
FOR SELECT
USING (user_id = auth.current_user_id());

CREATE POLICY "Users can insert own outcomes"
ON outcomes
FOR INSERT
WITH CHECK (user_id = auth.current_user_id());

CREATE POLICY "Users can update own outcomes"
ON outcomes
FOR UPDATE
USING (user_id = auth.current_user_id())
WITH CHECK (user_id = auth.current_user_id());

CREATE POLICY "Users can delete own outcomes"
ON outcomes
FOR DELETE
USING (user_id = auth.current_user_id());

-- =====================================================
-- 14. KEY RESULTS - Outcome Metrics
-- =====================================================

CREATE POLICY "Users can view key results for own outcomes"
ON key_results
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM outcomes
    WHERE outcomes.id = key_results.outcome_id
    AND outcomes.user_id = auth.current_user_id()
  )
);

CREATE POLICY "Users can insert key results for own outcomes"
ON key_results
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM outcomes
    WHERE outcomes.id = key_results.outcome_id
    AND outcomes.user_id = auth.current_user_id()
  )
);

CREATE POLICY "Users can update key results for own outcomes"
ON key_results
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM outcomes
    WHERE outcomes.id = key_results.outcome_id
    AND outcomes.user_id = auth.current_user_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM outcomes
    WHERE outcomes.id = key_results.outcome_id
    AND outcomes.user_id = auth.current_user_id()
  )
);

CREATE POLICY "Users can delete key results for own outcomes"
ON key_results
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM outcomes
    WHERE outcomes.id = key_results.outcome_id
    AND outcomes.user_id = auth.current_user_id()
  )
);

-- =====================================================
-- 15. AI LAB WORKFLOWS - Custom AI Workflows
-- =====================================================

CREATE POLICY "Users can view own ai workflows"
ON ai_lab_workflows
FOR SELECT
USING (user_id = auth.current_user_id());

CREATE POLICY "Users can insert own ai workflows"
ON ai_lab_workflows
FOR INSERT
WITH CHECK (user_id = auth.current_user_id());

CREATE POLICY "Users can update own ai workflows"
ON ai_lab_workflows
FOR UPDATE
USING (user_id = auth.current_user_id())
WITH CHECK (user_id = auth.current_user_id());

CREATE POLICY "Users can delete own ai workflows"
ON ai_lab_workflows
FOR DELETE
USING (user_id = auth.current_user_id());

-- =====================================================
-- 16. AI LAB TEMPLATES - AI Prompt Templates
-- =====================================================

CREATE POLICY "Users can view own ai templates"
ON ai_lab_templates
FOR SELECT
USING (user_id = auth.current_user_id());

CREATE POLICY "Users can insert own ai templates"
ON ai_lab_templates
FOR INSERT
WITH CHECK (user_id = auth.current_user_id());

CREATE POLICY "Users can update own ai templates"
ON ai_lab_templates
FOR UPDATE
USING (user_id = auth.current_user_id())
WITH CHECK (user_id = auth.current_user_id());

CREATE POLICY "Users can delete own ai templates"
ON ai_lab_templates
FOR DELETE
USING (user_id = auth.current_user_id());

-- =====================================================
-- 17. MESSAGE INTERACTIONS - In-App Message Analytics
-- =====================================================

-- Users can view their own interactions
CREATE POLICY "Users can view own message interactions"
ON message_interactions
FOR SELECT
USING (user_id = auth.current_user_id());

-- Users can insert their own interactions
CREATE POLICY "Users can insert own message interactions"
ON message_interactions
FOR INSERT
WITH CHECK (user_id = auth.current_user_id());

-- No update or delete - interactions are immutable for analytics

-- =====================================================
-- 18. USER RETENTION COHORTS - Retention Analytics
-- =====================================================

CREATE POLICY "Users can view own retention data"
ON user_retention_cohorts
FOR SELECT
USING (user_id = auth.current_user_id());

CREATE POLICY "Users can insert own retention data"
ON user_retention_cohorts
FOR INSERT
WITH CHECK (user_id = auth.current_user_id());

CREATE POLICY "Users can update own retention data"
ON user_retention_cohorts
FOR UPDATE
USING (user_id = auth.current_user_id())
WITH CHECK (user_id = auth.current_user_id());

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================

SELECT
    schemaname,
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
    'contacts', 'calendar_events', 'tasks', 'threads', 'messages',
    'unified_messages', 'sms_conversations', 'sms_messages', 'emails',
    'slack_channels', 'voxer_recordings', 'archives', 'outcomes',
    'key_results', 'ai_lab_workflows', 'ai_lab_templates',
    'message_interactions', 'user_retention_cohorts'
)
GROUP BY schemaname, tablename
ORDER BY tablename;

SELECT '✅ User-owned policies created. Continue with 003_workspace_policies.sql' as status;
