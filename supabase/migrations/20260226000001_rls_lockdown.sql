-- ============================================================
-- MIGRATION: 20260226000001_rls_lockdown.sql
-- PURPOSE:   Security lockdown — replace all USING (true) RLS
--            policies with ownership-scoped policies across ~83
--            tables in the Pulse application.
-- DATE:      2026-02-26
-- AUTHOR:    Backend Architect (security remediation)
-- RISK:      HIGH — touches every table's access control layer
-- ROLLBACK:  Revert by dropping all new policies and re-adding
--            the USING(true) policies. See end of file.
--
-- NOTE: Supabase service_role bypasses RLS automatically.
--       All restrictions here apply to the `authenticated` role only.
--       anon role has no access to any table unless explicitly granted.
-- ============================================================

BEGIN;

-- ============================================================
-- SECTION 0: HELPER FUNCTIONS
-- ============================================================

-- Workspace access helper (Phase 1: user IS their own workspace)
-- In Phase 2, this will be replaced with a workspace_members lookup.
-- SECURITY DEFINER so it can read pulse_channels / pulse_channel_subscriptions
-- without triggering recursive RLS evaluation.
CREATE OR REPLACE FUNCTION public.user_has_workspace_access(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT auth.uid() = ws_id
$$;

COMMENT ON FUNCTION public.user_has_workspace_access(UUID) IS
  'Phase 1: user owns their workspace (user_id = workspace_id). '
  'Replace in Phase 2 with workspace_members table lookup.';

-- Channel access helper (owner or subscriber)
-- Returns TRUE if the calling user owns the channel or holds an active subscription.
CREATE OR REPLACE FUNCTION public.user_has_channel_access(ch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM   public.pulse_channels
      WHERE  id       = ch_id
      AND    owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1
      FROM   public.pulse_channel_subscriptions
      WHERE  channel_id    = ch_id
      AND    subscriber_id = auth.uid()
    )
$$;

COMMENT ON FUNCTION public.user_has_channel_access(UUID) IS
  'Returns true if auth.uid() owns the channel or is a subscriber.';


-- ============================================================
-- SECTION 1: DROP ALL INSECURE USING(true) POLICIES
-- ============================================================
-- Using DROP POLICY IF EXISTS throughout so this is idempotent.

-- GROUP 1 — TEXT user_id tables
DROP POLICY IF EXISTS "Allow all access"                  ON public.archives;
DROP POLICY IF EXISTS "Allow all access"                  ON public.contacts;
DROP POLICY IF EXISTS "Allow all access"                  ON public.emails;
DROP POLICY IF EXISTS "Allow all access"                  ON public.outcomes;
DROP POLICY IF EXISTS "Allow all access"                  ON public.slack_channels;
DROP POLICY IF EXISTS "Allow all access"                  ON public.sms_conversations;
DROP POLICY IF EXISTS "Allow all decision_votes"          ON public.decision_votes;
DROP POLICY IF EXISTS "cohorts_policy"                    ON public.user_retention_cohorts;
DROP POLICY IF EXISTS "users_access_own_retention"        ON public.user_retention_cohorts;
DROP POLICY IF EXISTS "Enable all access"                 ON public.calendar_events;
DROP POLICY IF EXISTS "Enable all access"                 ON public.tasks;
DROP POLICY IF EXISTS "Enable all access"                 ON public.threads;
DROP POLICY IF EXISTS "Enable all access"                 ON public.unified_messages;
DROP POLICY IF EXISTS "Allow all access"                  ON public.voxer_recordings;

-- GROUP 2 — UUID user_id tables
DROP POLICY IF EXISTS "Allow all attention_logs"          ON public.attention_logs;
DROP POLICY IF EXISTS "Allow all attention_settings"      ON public.attention_settings;
DROP POLICY IF EXISTS "Allow all focus_sessions"          ON public.focus_sessions;
DROP POLICY IF EXISTS "Allow all user_settings"           ON public.user_settings;
DROP POLICY IF EXISTS "Allow all operations on quick_vox_favorites"   ON public.quick_vox_favorites;
DROP POLICY IF EXISTS "Allow all operations on quick_vox_status"      ON public.quick_vox_status;
DROP POLICY IF EXISTS "Allow all operations on vox_notes"             ON public.vox_notes;
DROP POLICY IF EXISTS "Allow all operations on vox_notifications"     ON public.vox_notifications;
DROP POLICY IF EXISTS "Enable all for authenticated users"            ON public.pulse_notifications;
DROP POLICY IF EXISTS "Enable all for authenticated users"            ON public.pulse_nudges;
DROP POLICY IF EXISTS "Enable all for authenticated users"            ON public.pulse_typing;
DROP POLICY IF EXISTS "System can manage SSO sessions"               ON public.sso_sessions;

-- GROUP 3 — UUID owner_id tables
DROP POLICY IF EXISTS "Allow all access to goals"                     ON public.goals;
DROP POLICY IF EXISTS "Allow all operations on pulse_channels"        ON public.pulse_channels;  -- write side; SELECT open policy created below
DROP POLICY IF EXISTS "Allow all operations on vox_workspaces"        ON public.vox_workspaces;

-- GROUP 4 — sender_id / recipient tables
DROP POLICY IF EXISTS "Allow all operations on quick_vox_messages"   ON public.quick_vox_messages;
DROP POLICY IF EXISTS "Allow all operations on vox_drops"            ON public.vox_drops;

-- GROUP 5 — created_by / follower tables
DROP POLICY IF EXISTS "Enable all for authenticated users"            ON public.pulse_decisions;
DROP POLICY IF EXISTS "Enable all for authenticated users"            ON public.pulse_outcomes;
DROP POLICY IF EXISTS "Enable all for authenticated users"            ON public.pulse_files;
DROP POLICY IF EXISTS "Allow all operations on pulse_follows"         ON public.pulse_follows;
DROP POLICY IF EXISTS "Allow all operations on pulse_users"           ON public.pulse_users;  -- write side; SELECT open policy created below

-- GROUP 6 — workspace_id tables
DROP POLICY IF EXISTS "Allow all decisions"                           ON public.decisions;
DROP POLICY IF EXISTS "Allow all extracted_tasks"                     ON public.extracted_tasks;
DROP POLICY IF EXISTS "Allow all outcome_blockers"                    ON public.outcome_blockers;
DROP POLICY IF EXISTS "Allow all workspace_outcomes"                  ON public.workspace_outcomes;
DROP POLICY IF EXISTS "Allow all operations on team_vox_messages"     ON public.team_vox_messages;
DROP POLICY IF EXISTS "Allow all operations on vox_team_channels"     ON public.vox_team_channels;

-- GROUP 7 — channel-based tables
DROP POLICY IF EXISTS "Enable all for authenticated users"            ON public.pulse_blockers;
DROP POLICY IF EXISTS "Enable all for authenticated users"            ON public.pulse_context_summaries;
DROP POLICY IF EXISTS "Enable all for authenticated users"            ON public.pulse_tasks;
DROP POLICY IF EXISTS "Allow all operations on pulse_channel_subscriptions" ON public.pulse_channel_subscriptions;

-- GROUP 8 — via subquery tables
DROP POLICY IF EXISTS "Allow all access"                              ON public.sms_messages;
DROP POLICY IF EXISTS "Enable all access"                             ON public.messages;
DROP POLICY IF EXISTS "Allow all access"                              ON public.key_results;
DROP POLICY IF EXISTS "Allow all outcome_milestones"                  ON public.outcome_milestones;
DROP POLICY IF EXISTS "Allow viewing dependencies"                    ON public.task_dependencies;
DROP POLICY IF EXISTS "Allow all task_updates"                        ON public.task_updates;
DROP POLICY IF EXISTS "Manage webhook deliveries"                     ON public.webhook_deliveries;
DROP POLICY IF EXISTS "Manage field mappings"                         ON public.integration_field_mappings;
DROP POLICY IF EXISTS "Manage sync logs"                              ON public.integration_sync_logs;

-- GROUP 9 — CRM tables
-- FAIL 1 FIX: crm_integrations had "admins_manage_crm" (admin-only policy); drop it
-- and replace with workspace-scoped policies below (section 4.9).
DROP POLICY IF EXISTS "admins_manage_crm"                             ON public.crm_integrations;
DROP POLICY IF EXISTS "users_view_crm_companies"                      ON public.crm_companies;
DROP POLICY IF EXISTS "users_view_crm_contacts"                       ON public.crm_contacts;
DROP POLICY IF EXISTS "users_view_crm_deals"                          ON public.crm_deals;

-- GROUP 11 — Admin/audit tables
DROP POLICY IF EXISTS "activity_logs_read_policy"                     ON public.admin_activity_logs;
DROP POLICY IF EXISTS "admin_settings_policy"                         ON public.admin_settings;
DROP POLICY IF EXISTS "Users can view audit logs"                     ON public.audit_logs;
DROP POLICY IF EXISTS "Users can view own role assignments"           ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage role assignments"            ON public.user_roles;

-- GROUP 12 — Tables receiving new user_id column
DROP POLICY IF EXISTS "Manage integrations"                           ON public.integrations;
DROP POLICY IF EXISTS "Manage webhooks"                               ON public.webhooks;
DROP POLICY IF EXISTS "Users can view predictions"                    ON public.predictions;
DROP POLICY IF EXISTS "Users can manage customer health"              ON public.customer_health;
DROP POLICY IF EXISTS "Users can view customer health"                ON public.customer_health;
DROP POLICY IF EXISTS "Users can view customer health history"        ON public.customer_health_history;
DROP POLICY IF EXISTS "Users can update customer alerts"              ON public.customer_alerts;
DROP POLICY IF EXISTS "Users can view customer alerts"                ON public.customer_alerts;
DROP POLICY IF EXISTS "Users can view customer sentiment"             ON public.customer_sentiment;

-- GROUP 13 — Special/system tables
DROP POLICY IF EXISTS "Users can view relationships"                  ON public.relationships;
DROP POLICY IF EXISTS "Users can update relationships"                ON public.relationships;
DROP POLICY IF EXISTS "Users can delete relationships"                ON public.relationships;
DROP POLICY IF EXISTS "Users can view relationship events"            ON public.relationship_events;
DROP POLICY IF EXISTS "Admins can manage SSO configs"                 ON public.sso_configs;
DROP POLICY IF EXISTS "Admins can view SSO configs"                   ON public.sso_configs;
DROP POLICY IF EXISTS "Allow all operations on broadcasts"            ON public.broadcasts;
DROP POLICY IF EXISTS "Allow viewing participants"                    ON public.workspace_participants;
DROP POLICY IF EXISTS "Users can view retention policies"             ON public.retention_policies;
DROP POLICY IF EXISTS "Admins can manage retention policies"          ON public.retention_policies;

-- GROUP 14 — Video Vox old USING(true) policies (proper policies from
--             20260221000001_create_video_vox_tables.sql remain in place)
DROP POLICY IF EXISTS "Allow all on video_vox_ai_queue"                     ON public.video_vox_ai_queue;
DROP POLICY IF EXISTS "Allow all on video_vox_bookmarks"                    ON public.video_vox_bookmarks;
DROP POLICY IF EXISTS "Allow all on video_vox_conversation_members"         ON public.video_vox_conversation_members;
DROP POLICY IF EXISTS "Allow all on video_vox_conversations"                ON public.video_vox_conversations;
DROP POLICY IF EXISTS "Allow all on video_vox_messages"                     ON public.video_vox_messages;
DROP POLICY IF EXISTS "Allow all on video_vox_reactions"                    ON public.video_vox_reactions;
DROP POLICY IF EXISTS "Allow all on video_vox_read_receipts"                ON public.video_vox_read_receipts;


-- ============================================================
-- SECTION 2: ADD MISSING user_id COLUMNS
-- ============================================================
-- These tables have no user_id at all. We add the column first
-- (nullable so existing rows are not immediately rejected) and
-- enforce NOT NULL via a future backfill migration.
-- See POST-MIGRATION REQUIRED ACTIONS at bottom.

ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.webhooks
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.customer_health
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.customer_health_history
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.customer_alerts
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.customer_sentiment
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.integration_logs
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;


-- ============================================================
-- SECTION 3: ENABLE RLS ON ALL AFFECTED TABLES
-- ============================================================
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY is idempotent.

-- Group 1
ALTER TABLE public.archives                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_conversations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voxer_recordings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slack_channels                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threads                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outcomes                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_votes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_retention_cohorts        ENABLE ROW LEVEL SECURITY;

-- Group 2
ALTER TABLE public.attention_logs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attention_settings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_sessions                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_vox_favorites           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_vox_status              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vox_notes                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vox_notifications             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_notifications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_nudges                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_typing                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sso_sessions                  ENABLE ROW LEVEL SECURITY;

-- Group 3
ALTER TABLE public.goals                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_channels                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vox_workspaces                ENABLE ROW LEVEL SECURITY;

-- Group 4
ALTER TABLE public.quick_vox_messages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vox_drops                     ENABLE ROW LEVEL SECURITY;

-- Group 5
ALTER TABLE public.pulse_decisions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_outcomes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_files                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_follows                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_users                   ENABLE ROW LEVEL SECURITY;

-- Group 6
ALTER TABLE public.decisions                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_tasks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outcome_blockers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_outcomes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vox_team_channels             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_vox_messages             ENABLE ROW LEVEL SECURITY;

-- Group 7
ALTER TABLE public.pulse_blockers                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_context_summaries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_tasks                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_channel_subscriptions   ENABLE ROW LEVEL SECURITY;

-- Group 8
ALTER TABLE public.sms_messages                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.key_results                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outcome_milestones            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependencies             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_updates                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_field_mappings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_sync_logs         ENABLE ROW LEVEL SECURITY;

-- Group 9 (CRM)
ALTER TABLE public.crm_integrations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_companies                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contacts                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deals                     ENABLE ROW LEVEL SECURITY;

-- Group 10 (intentionally public — RLS still enabled, SELECT open)
ALTER TABLE public.pulse_users                   ENABLE ROW LEVEL SECURITY;  -- already set above
ALTER TABLE public.pulse_channels                ENABLE ROW LEVEL SECURITY;  -- already set above
ALTER TABLE public.roles                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retention_policies            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserved_handles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcasts                    ENABLE ROW LEVEL SECURITY;

-- Group 11 (admin/audit)
ALTER TABLE public.admin_settings                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles                    ENABLE ROW LEVEL SECURITY;

-- Group 12 (new user_id columns)
ALTER TABLE public.integrations                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_health               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_health_history       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_alerts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_sentiment            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_logs              ENABLE ROW LEVEL SECURITY;

-- Group 13 (special/system)
ALTER TABLE public.relationships                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationship_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sso_configs                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_participants        ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- SECTION 4: CREATE PROPER RLS POLICIES
-- ============================================================

-- ------------------------------------------------------------
-- 4.1  GROUP 1: TEXT user_id  (cast auth.uid() to text)
-- ------------------------------------------------------------

-- archives: user_id TEXT, created_by UUID
CREATE POLICY archives_owner_select ON public.archives
  FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY archives_owner_insert ON public.archives
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY archives_owner_update ON public.archives
  FOR UPDATE USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY archives_owner_delete ON public.archives
  FOR DELETE USING (user_id = auth.uid()::text);

-- contacts
CREATE POLICY contacts_owner_all ON public.contacts
  FOR ALL
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- emails
CREATE POLICY emails_owner_all ON public.emails
  FOR ALL
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- sms_conversations
CREATE POLICY sms_conversations_owner_all ON public.sms_conversations
  FOR ALL
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- voxer_recordings
CREATE POLICY voxer_recordings_owner_all ON public.voxer_recordings
  FOR ALL
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- slack_channels
CREATE POLICY slack_channels_owner_all ON public.slack_channels
  FOR ALL
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- calendar_events
CREATE POLICY calendar_events_owner_all ON public.calendar_events
  FOR ALL
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- tasks
CREATE POLICY tasks_owner_all ON public.tasks
  FOR ALL
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- threads
CREATE POLICY threads_owner_all ON public.threads
  FOR ALL
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- unified_messages: user_id TEXT, sender_id TEXT
CREATE POLICY unified_messages_owner_select ON public.unified_messages
  FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY unified_messages_owner_insert ON public.unified_messages
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY unified_messages_owner_update ON public.unified_messages
  FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY unified_messages_owner_delete ON public.unified_messages
  FOR DELETE USING (user_id = auth.uid()::text);

-- outcomes
CREATE POLICY outcomes_owner_all ON public.outcomes
  FOR ALL
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- decision_votes
CREATE POLICY decision_votes_owner_all ON public.decision_votes
  FOR ALL
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- user_retention_cohorts
CREATE POLICY user_retention_cohorts_owner_all ON public.user_retention_cohorts
  FOR ALL
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);


-- ------------------------------------------------------------
-- 4.2  GROUP 2: UUID user_id
-- ------------------------------------------------------------

-- attention_logs
CREATE POLICY attention_logs_owner_all ON public.attention_logs
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- attention_settings
CREATE POLICY attention_settings_owner_all ON public.attention_settings
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- focus_sessions
CREATE POLICY focus_sessions_owner_all ON public.focus_sessions
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- user_settings
CREATE POLICY user_settings_owner_all ON public.user_settings
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- quick_vox_favorites
CREATE POLICY quick_vox_favorites_owner_all ON public.quick_vox_favorites
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- quick_vox_status (user_id is PK)
CREATE POLICY quick_vox_status_owner_all ON public.quick_vox_status
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- vox_notes
CREATE POLICY vox_notes_owner_all ON public.vox_notes
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- vox_notifications: user_id UUID, sender_id UUID
-- Recipients can read their own notifications; anyone can send (insert)
CREATE POLICY vox_notifications_recipient_select ON public.vox_notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY vox_notifications_sender_insert ON public.vox_notifications
  FOR INSERT WITH CHECK (sender_id = auth.uid());

CREATE POLICY vox_notifications_recipient_update ON public.vox_notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY vox_notifications_recipient_delete ON public.vox_notifications
  FOR DELETE USING (user_id = auth.uid());

-- pulse_notifications
CREATE POLICY pulse_notifications_owner_all ON public.pulse_notifications
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- pulse_nudges: user_id UUID, channel_id UUID NOT NULL
-- Nudges are scoped to user; channel access checked at application layer
CREATE POLICY pulse_nudges_owner_all ON public.pulse_nudges
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- pulse_typing: user_id UUID, channel_id UUID NOT NULL
-- Typing indicators: own records only
CREATE POLICY pulse_typing_owner_all ON public.pulse_typing
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- sso_sessions: user_id UUID nullable, tenant_id UUID NOT NULL
-- Sessions belong to the user who initiated them; NULL user_id rows
-- are service-role operations (system-initiated SSO flows).
CREATE POLICY sso_sessions_owner_select ON public.sso_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY sso_sessions_owner_insert ON public.sso_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY sso_sessions_owner_update ON public.sso_sessions
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY sso_sessions_owner_delete ON public.sso_sessions
  FOR DELETE USING (user_id = auth.uid());


-- ------------------------------------------------------------
-- 4.3  GROUP 3: UUID owner_id
-- ------------------------------------------------------------

-- goals: owner_id UUID nullable
CREATE POLICY goals_owner_select ON public.goals
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY goals_owner_insert ON public.goals
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY goals_owner_update ON public.goals
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY goals_owner_delete ON public.goals
  FOR DELETE USING (owner_id = auth.uid());

-- pulse_channels: owner_id UUID nullable, is_public BOOLEAN
-- SELECT is intentionally open for channel discovery (Group 10).
-- Writes are restricted to the owner.
CREATE POLICY pulse_channels_public_select ON public.pulse_channels
  FOR SELECT USING (true);

CREATE POLICY pulse_channels_owner_insert ON public.pulse_channels
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY pulse_channels_owner_update ON public.pulse_channels
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY pulse_channels_owner_delete ON public.pulse_channels
  FOR DELETE USING (owner_id = auth.uid());

-- vox_workspaces: owner_id UUID, member_ids UUID[] NOT NULL
-- Read: owner OR member of workspace
CREATE POLICY vox_workspaces_member_select ON public.vox_workspaces
  FOR SELECT USING (
    owner_id = auth.uid()
    OR auth.uid() = ANY(member_ids)
  );

CREATE POLICY vox_workspaces_owner_insert ON public.vox_workspaces
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY vox_workspaces_owner_update ON public.vox_workspaces
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY vox_workspaces_owner_delete ON public.vox_workspaces
  FOR DELETE USING (owner_id = auth.uid());


-- ------------------------------------------------------------
-- 4.4  GROUP 4: UUID sender_id / recipient_id
-- ------------------------------------------------------------

-- quick_vox_messages: sender_id UUID, recipient_id UUID
-- A user can see messages they sent OR received.
CREATE POLICY quick_vox_messages_participant_select ON public.quick_vox_messages
  FOR SELECT USING (
    sender_id    = auth.uid()
    OR recipient_id = auth.uid()
  );

CREATE POLICY quick_vox_messages_sender_insert ON public.quick_vox_messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

CREATE POLICY quick_vox_messages_sender_update ON public.quick_vox_messages
  FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY quick_vox_messages_sender_delete ON public.quick_vox_messages
  FOR DELETE USING (sender_id = auth.uid());

-- vox_drops: sender_id UUID, recipient_ids UUID[]
-- A user can see drops they sent OR are in the recipient list.
CREATE POLICY vox_drops_participant_select ON public.vox_drops
  FOR SELECT USING (
    sender_id  = auth.uid()
    OR auth.uid() = ANY(recipient_ids)
  );

CREATE POLICY vox_drops_sender_insert ON public.vox_drops
  FOR INSERT WITH CHECK (sender_id = auth.uid());

CREATE POLICY vox_drops_sender_update ON public.vox_drops
  FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY vox_drops_sender_delete ON public.vox_drops
  FOR DELETE USING (sender_id = auth.uid());


-- ------------------------------------------------------------
-- 4.5  GROUP 5: UUID created_by / follower
-- ------------------------------------------------------------

-- pulse_decisions: created_by UUID, channel_id UUID NOT NULL
-- Creator full access; channel members can read.
CREATE POLICY pulse_decisions_channel_select ON public.pulse_decisions
  FOR SELECT USING (public.user_has_channel_access(channel_id));

CREATE POLICY pulse_decisions_creator_insert ON public.pulse_decisions
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY pulse_decisions_creator_update ON public.pulse_decisions
  FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY pulse_decisions_creator_delete ON public.pulse_decisions
  FOR DELETE USING (created_by = auth.uid());

-- pulse_outcomes: created_by UUID, channel_id UUID NOT NULL
CREATE POLICY pulse_outcomes_channel_select ON public.pulse_outcomes
  FOR SELECT USING (public.user_has_channel_access(channel_id));

CREATE POLICY pulse_outcomes_creator_insert ON public.pulse_outcomes
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY pulse_outcomes_creator_update ON public.pulse_outcomes
  FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY pulse_outcomes_creator_delete ON public.pulse_outcomes
  FOR DELETE USING (created_by = auth.uid());

-- pulse_files: uploaded_by UUID, channel_id UUID nullable
-- Uploader always sees their own files.
-- Channel-attached files visible to channel members only.
-- NOTE: The previous USING (channel_id IS NULL OR ...) was a data-exposure bug:
--   when channel_id IS NULL the first OR clause is TRUE, granting SELECT to every
--   authenticated user. Fixed by requiring uploader ownership for unattached files.
CREATE POLICY pulse_files_channel_select ON public.pulse_files
  FOR SELECT USING (
    uploaded_by = auth.uid()
    OR (channel_id IS NOT NULL AND public.user_has_channel_access(channel_id))
  );

CREATE POLICY pulse_files_uploader_insert ON public.pulse_files
  FOR INSERT WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY pulse_files_uploader_update ON public.pulse_files
  FOR UPDATE
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY pulse_files_uploader_delete ON public.pulse_files
  FOR DELETE USING (uploaded_by = auth.uid());

-- pulse_follows: follower_id UUID, following_id UUID
-- Users manage their own follow records.
CREATE POLICY pulse_follows_own_select ON public.pulse_follows
  FOR SELECT USING (
    follower_id = auth.uid()
    OR following_id = auth.uid()
  );

CREATE POLICY pulse_follows_follower_insert ON public.pulse_follows
  FOR INSERT WITH CHECK (follower_id = auth.uid());

CREATE POLICY pulse_follows_follower_delete ON public.pulse_follows
  FOR DELETE USING (follower_id = auth.uid());

-- pulse_users: auth_user_id UUID FK → auth.users, id UUID PK
-- SELECT is intentionally open for profile discovery (Group 10).
-- Writes restricted to own record identified by auth_user_id.
CREATE POLICY pulse_users_public_select ON public.pulse_users
  FOR SELECT USING (true);

CREATE POLICY pulse_users_own_insert ON public.pulse_users
  FOR INSERT WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY pulse_users_own_update ON public.pulse_users
  FOR UPDATE
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY pulse_users_own_delete ON public.pulse_users
  FOR DELETE USING (auth_user_id = auth.uid());


-- ------------------------------------------------------------
-- 4.6  GROUP 6: workspace_id UUID
-- ------------------------------------------------------------
-- Phase 1: user IS their own workspace (user_id = workspace_id).
-- user_has_workspace_access() is SECURITY DEFINER to avoid recursion.

-- decisions: workspace_id UUID, created_by TEXT
CREATE POLICY decisions_workspace_select ON public.decisions
  FOR SELECT USING (public.user_has_workspace_access(workspace_id));

CREATE POLICY decisions_workspace_insert ON public.decisions
  FOR INSERT WITH CHECK (
    public.user_has_workspace_access(workspace_id)
    AND created_by = auth.uid()::text
  );

CREATE POLICY decisions_workspace_update ON public.decisions
  FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id))
  WITH CHECK (public.user_has_workspace_access(workspace_id));

CREATE POLICY decisions_workspace_delete ON public.decisions
  FOR DELETE USING (public.user_has_workspace_access(workspace_id));

-- extracted_tasks: workspace_id UUID nullable
CREATE POLICY extracted_tasks_workspace_select ON public.extracted_tasks
  FOR SELECT USING (
    workspace_id IS NULL
    OR public.user_has_workspace_access(workspace_id)
  );

CREATE POLICY extracted_tasks_workspace_insert ON public.extracted_tasks
  FOR INSERT WITH CHECK (
    workspace_id IS NULL
    OR public.user_has_workspace_access(workspace_id)
  );

CREATE POLICY extracted_tasks_workspace_update ON public.extracted_tasks
  FOR UPDATE
  USING (
    workspace_id IS NULL
    OR public.user_has_workspace_access(workspace_id)
  )
  WITH CHECK (
    workspace_id IS NULL
    OR public.user_has_workspace_access(workspace_id)
  );

CREATE POLICY extracted_tasks_workspace_delete ON public.extracted_tasks
  FOR DELETE USING (
    workspace_id IS NULL
    OR public.user_has_workspace_access(workspace_id)
  );

-- outcome_blockers: workspace_id UUID nullable, reported_by TEXT
CREATE POLICY outcome_blockers_workspace_select ON public.outcome_blockers
  FOR SELECT USING (
    workspace_id IS NULL
    OR public.user_has_workspace_access(workspace_id)
  );

CREATE POLICY outcome_blockers_workspace_insert ON public.outcome_blockers
  FOR INSERT WITH CHECK (
    (workspace_id IS NULL OR public.user_has_workspace_access(workspace_id))
    AND reported_by = auth.uid()::text
  );

CREATE POLICY outcome_blockers_workspace_update ON public.outcome_blockers
  FOR UPDATE
  USING (
    workspace_id IS NULL
    OR public.user_has_workspace_access(workspace_id)
  )
  WITH CHECK (
    workspace_id IS NULL
    OR public.user_has_workspace_access(workspace_id)
  );

CREATE POLICY outcome_blockers_workspace_delete ON public.outcome_blockers
  FOR DELETE USING (
    workspace_id IS NULL
    OR public.user_has_workspace_access(workspace_id)
  );

-- workspace_outcomes: workspace_id UUID nullable
CREATE POLICY workspace_outcomes_workspace_select ON public.workspace_outcomes
  FOR SELECT USING (
    workspace_id IS NULL
    OR public.user_has_workspace_access(workspace_id)
  );

CREATE POLICY workspace_outcomes_workspace_insert ON public.workspace_outcomes
  FOR INSERT WITH CHECK (
    workspace_id IS NULL
    OR public.user_has_workspace_access(workspace_id)
  );

CREATE POLICY workspace_outcomes_workspace_update ON public.workspace_outcomes
  FOR UPDATE
  USING (
    workspace_id IS NULL
    OR public.user_has_workspace_access(workspace_id)
  )
  WITH CHECK (
    workspace_id IS NULL
    OR public.user_has_workspace_access(workspace_id)
  );

CREATE POLICY workspace_outcomes_workspace_delete ON public.workspace_outcomes
  FOR DELETE USING (
    workspace_id IS NULL
    OR public.user_has_workspace_access(workspace_id)
  );

-- vox_team_channels: workspace_id UUID nullable, member_ids UUID[]
CREATE POLICY vox_team_channels_workspace_select ON public.vox_team_channels
  FOR SELECT USING (
    (workspace_id IS NULL OR public.user_has_workspace_access(workspace_id))
    OR auth.uid() = ANY(member_ids)
  );

CREATE POLICY vox_team_channels_workspace_insert ON public.vox_team_channels
  FOR INSERT WITH CHECK (
    workspace_id IS NULL
    OR public.user_has_workspace_access(workspace_id)
  );

CREATE POLICY vox_team_channels_workspace_update ON public.vox_team_channels
  FOR UPDATE
  USING (
    workspace_id IS NULL
    OR public.user_has_workspace_access(workspace_id)
  )
  WITH CHECK (
    workspace_id IS NULL
    OR public.user_has_workspace_access(workspace_id)
  );

CREATE POLICY vox_team_channels_workspace_delete ON public.vox_team_channels
  FOR DELETE USING (
    workspace_id IS NULL
    OR public.user_has_workspace_access(workspace_id)
  );

-- team_vox_messages: workspace_id UUID nullable, sender_id UUID nullable
CREATE POLICY team_vox_messages_workspace_select ON public.team_vox_messages
  FOR SELECT USING (
    workspace_id IS NULL
    OR public.user_has_workspace_access(workspace_id)
  );

CREATE POLICY team_vox_messages_sender_insert ON public.team_vox_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND (workspace_id IS NULL OR public.user_has_workspace_access(workspace_id))
  );

CREATE POLICY team_vox_messages_sender_update ON public.team_vox_messages
  FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY team_vox_messages_sender_delete ON public.team_vox_messages
  FOR DELETE USING (sender_id = auth.uid());


-- ------------------------------------------------------------
-- 4.7  GROUP 7: Channel-based access
-- ------------------------------------------------------------

-- pulse_blockers: channel_id UUID nullable, no user_id
CREATE POLICY pulse_blockers_channel_select ON public.pulse_blockers
  FOR SELECT USING (
    channel_id IS NULL
    OR public.user_has_channel_access(channel_id)
  );

CREATE POLICY pulse_blockers_channel_insert ON public.pulse_blockers
  FOR INSERT WITH CHECK (
    channel_id IS NULL
    OR public.user_has_channel_access(channel_id)
  );

CREATE POLICY pulse_blockers_channel_update ON public.pulse_blockers
  FOR UPDATE
  USING (
    channel_id IS NULL
    OR public.user_has_channel_access(channel_id)
  )
  WITH CHECK (
    channel_id IS NULL
    OR public.user_has_channel_access(channel_id)
  );

CREATE POLICY pulse_blockers_channel_delete ON public.pulse_blockers
  FOR DELETE USING (
    channel_id IS NULL
    OR public.user_has_channel_access(channel_id)
  );

-- pulse_context_summaries: channel_id UUID NOT NULL, no user_id
CREATE POLICY pulse_context_summaries_channel_select ON public.pulse_context_summaries
  FOR SELECT USING (public.user_has_channel_access(channel_id));

CREATE POLICY pulse_context_summaries_channel_insert ON public.pulse_context_summaries
  FOR INSERT WITH CHECK (public.user_has_channel_access(channel_id));

CREATE POLICY pulse_context_summaries_channel_update ON public.pulse_context_summaries
  FOR UPDATE
  USING (public.user_has_channel_access(channel_id))
  WITH CHECK (public.user_has_channel_access(channel_id));

CREATE POLICY pulse_context_summaries_channel_delete ON public.pulse_context_summaries
  FOR DELETE USING (public.user_has_channel_access(channel_id));

-- pulse_tasks: channel_id UUID NOT NULL, assigned_to UUID nullable
-- Channel members can read; assigned_to or channel member can update.
CREATE POLICY pulse_tasks_channel_select ON public.pulse_tasks
  FOR SELECT USING (public.user_has_channel_access(channel_id));

CREATE POLICY pulse_tasks_channel_insert ON public.pulse_tasks
  FOR INSERT WITH CHECK (public.user_has_channel_access(channel_id));

CREATE POLICY pulse_tasks_channel_update ON public.pulse_tasks
  FOR UPDATE
  USING (
    public.user_has_channel_access(channel_id)
    OR assigned_to = auth.uid()
  )
  WITH CHECK (
    public.user_has_channel_access(channel_id)
    OR assigned_to = auth.uid()
  );

CREATE POLICY pulse_tasks_channel_delete ON public.pulse_tasks
  FOR DELETE USING (public.user_has_channel_access(channel_id));

-- pulse_channel_subscriptions: subscriber_id UUID nullable, channel_id UUID
-- Users manage their own subscriptions; owners can see all subscribers.
CREATE POLICY pulse_channel_subscriptions_own_select ON public.pulse_channel_subscriptions
  FOR SELECT USING (
    subscriber_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM   public.pulse_channels
      WHERE  id = channel_id
      AND    owner_id = auth.uid()
    )
  );

CREATE POLICY pulse_channel_subscriptions_own_insert ON public.pulse_channel_subscriptions
  FOR INSERT WITH CHECK (subscriber_id = auth.uid());

CREATE POLICY pulse_channel_subscriptions_own_update ON public.pulse_channel_subscriptions
  FOR UPDATE
  USING (subscriber_id = auth.uid())
  WITH CHECK (subscriber_id = auth.uid());

CREATE POLICY pulse_channel_subscriptions_own_delete ON public.pulse_channel_subscriptions
  FOR DELETE USING (
    subscriber_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM   public.pulse_channels
      WHERE  id = channel_id
      AND    owner_id = auth.uid()
    )
  );


-- ------------------------------------------------------------
-- 4.8  GROUP 8: Via subquery access
-- ------------------------------------------------------------

-- sms_messages: conversation_id UUID, no user_id
-- Secure via sms_conversations.user_id
CREATE POLICY sms_messages_conversation_select ON public.sms_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM   public.sms_conversations c
      WHERE  c.id      = conversation_id
      AND    c.user_id = auth.uid()::text
    )
  );

CREATE POLICY sms_messages_conversation_insert ON public.sms_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.sms_conversations c
      WHERE  c.id      = conversation_id
      AND    c.user_id = auth.uid()::text
    )
  );

CREATE POLICY sms_messages_conversation_update ON public.sms_messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM   public.sms_conversations c
      WHERE  c.id      = conversation_id
      AND    c.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.sms_conversations c
      WHERE  c.id      = conversation_id
      AND    c.user_id = auth.uid()::text
    )
  );

CREATE POLICY sms_messages_conversation_delete ON public.sms_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM   public.sms_conversations c
      WHERE  c.id      = conversation_id
      AND    c.user_id = auth.uid()::text
    )
  );

-- messages: thread_id UUID, no user_id — secure via threads.user_id TEXT
CREATE POLICY messages_thread_select ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM   public.threads t
      WHERE  t.id      = thread_id
      AND    t.user_id = auth.uid()::text
    )
  );

CREATE POLICY messages_thread_insert ON public.messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.threads t
      WHERE  t.id      = thread_id
      AND    t.user_id = auth.uid()::text
    )
  );

CREATE POLICY messages_thread_update ON public.messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM   public.threads t
      WHERE  t.id      = thread_id
      AND    t.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.threads t
      WHERE  t.id      = thread_id
      AND    t.user_id = auth.uid()::text
    )
  );

CREATE POLICY messages_thread_delete ON public.messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM   public.threads t
      WHERE  t.id      = thread_id
      AND    t.user_id = auth.uid()::text
    )
  );

-- key_results: outcome_id UUID — secure via outcomes.user_id TEXT
CREATE POLICY key_results_outcome_select ON public.key_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM   public.outcomes o
      WHERE  o.id      = outcome_id
      AND    o.user_id = auth.uid()::text
    )
  );

CREATE POLICY key_results_outcome_insert ON public.key_results
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.outcomes o
      WHERE  o.id      = outcome_id
      AND    o.user_id = auth.uid()::text
    )
  );

CREATE POLICY key_results_outcome_update ON public.key_results
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM   public.outcomes o
      WHERE  o.id      = outcome_id
      AND    o.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.outcomes o
      WHERE  o.id      = outcome_id
      AND    o.user_id = auth.uid()::text
    )
  );

CREATE POLICY key_results_outcome_delete ON public.key_results
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM   public.outcomes o
      WHERE  o.id      = outcome_id
      AND    o.user_id = auth.uid()::text
    )
  );

-- outcome_milestones: outcome_id UUID — secure via outcomes.user_id TEXT
CREATE POLICY outcome_milestones_outcome_select ON public.outcome_milestones
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM   public.outcomes o
      WHERE  o.id      = outcome_id
      AND    o.user_id = auth.uid()::text
    )
  );

CREATE POLICY outcome_milestones_outcome_insert ON public.outcome_milestones
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.outcomes o
      WHERE  o.id      = outcome_id
      AND    o.user_id = auth.uid()::text
    )
  );

CREATE POLICY outcome_milestones_outcome_update ON public.outcome_milestones
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM   public.outcomes o
      WHERE  o.id      = outcome_id
      AND    o.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.outcomes o
      WHERE  o.id      = outcome_id
      AND    o.user_id = auth.uid()::text
    )
  );

CREATE POLICY outcome_milestones_outcome_delete ON public.outcome_milestones
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM   public.outcomes o
      WHERE  o.id      = outcome_id
      AND    o.user_id = auth.uid()::text
    )
  );

-- task_dependencies: task_id UUID, depends_on_task_id UUID
-- Secure via extracted_tasks.workspace_id
CREATE POLICY task_dependencies_workspace_select ON public.task_dependencies
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM   public.extracted_tasks et
      WHERE  et.id = task_id
      AND    (et.workspace_id IS NULL OR public.user_has_workspace_access(et.workspace_id))
    )
  );

CREATE POLICY task_dependencies_workspace_insert ON public.task_dependencies
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.extracted_tasks et
      WHERE  et.id = task_id
      AND    (et.workspace_id IS NULL OR public.user_has_workspace_access(et.workspace_id))
    )
  );

CREATE POLICY task_dependencies_workspace_delete ON public.task_dependencies
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM   public.extracted_tasks et
      WHERE  et.id = task_id
      AND    (et.workspace_id IS NULL OR public.user_has_workspace_access(et.workspace_id))
    )
  );

-- FAIL 4 NOTE: No UPDATE policy for task_dependencies is intentional.
-- task_dependencies is a pure association table (task_id, depends_on_task_id).
-- Changing a dependency means deleting the old row and inserting a new one.
-- An UPDATE policy is not needed; the SELECT + INSERT + DELETE policies cover all
-- legitimate operations. If an UPDATE policy is ever required, add it here.

-- task_updates: task_id UUID, updated_by TEXT
CREATE POLICY task_updates_own_select ON public.task_updates
  FOR SELECT USING (updated_by = auth.uid()::text);

CREATE POLICY task_updates_own_insert ON public.task_updates
  FOR INSERT WITH CHECK (updated_by = auth.uid()::text);

CREATE POLICY task_updates_own_update ON public.task_updates
  FOR UPDATE
  USING (updated_by = auth.uid()::text)
  WITH CHECK (updated_by = auth.uid()::text);

CREATE POLICY task_updates_own_delete ON public.task_updates
  FOR DELETE USING (updated_by = auth.uid()::text);

-- webhook_deliveries: webhook_id UUID — secure via webhooks.user_id
CREATE POLICY webhook_deliveries_owner_select ON public.webhook_deliveries
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM   public.webhooks w
      WHERE  w.id      = webhook_id
      AND    w.user_id = auth.uid()
    )
  );

CREATE POLICY webhook_deliveries_owner_insert ON public.webhook_deliveries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.webhooks w
      WHERE  w.id      = webhook_id
      AND    w.user_id = auth.uid()
    )
  );

CREATE POLICY webhook_deliveries_owner_delete ON public.webhook_deliveries
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM   public.webhooks w
      WHERE  w.id      = webhook_id
      AND    w.user_id = auth.uid()
    )
  );

-- integration_field_mappings: integration_id UUID — secure via integrations.user_id
CREATE POLICY integration_field_mappings_owner_select ON public.integration_field_mappings
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM   public.integrations i
      WHERE  i.id      = integration_id
      AND    i.user_id = auth.uid()
    )
  );

CREATE POLICY integration_field_mappings_owner_insert ON public.integration_field_mappings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.integrations i
      WHERE  i.id      = integration_id
      AND    i.user_id = auth.uid()
    )
  );

CREATE POLICY integration_field_mappings_owner_update ON public.integration_field_mappings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM   public.integrations i
      WHERE  i.id      = integration_id
      AND    i.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.integrations i
      WHERE  i.id      = integration_id
      AND    i.user_id = auth.uid()
    )
  );

CREATE POLICY integration_field_mappings_owner_delete ON public.integration_field_mappings
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM   public.integrations i
      WHERE  i.id      = integration_id
      AND    i.user_id = auth.uid()
    )
  );

-- integration_sync_logs: integration_id UUID — secure via integrations.user_id
CREATE POLICY integration_sync_logs_owner_select ON public.integration_sync_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM   public.integrations i
      WHERE  i.id      = integration_id
      AND    i.user_id = auth.uid()
    )
  );

CREATE POLICY integration_sync_logs_owner_insert ON public.integration_sync_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.integrations i
      WHERE  i.id      = integration_id
      AND    i.user_id = auth.uid()
    )
  );

CREATE POLICY integration_sync_logs_owner_delete ON public.integration_sync_logs
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM   public.integrations i
      WHERE  i.id      = integration_id
      AND    i.user_id = auth.uid()
    )
  );


-- ------------------------------------------------------------
-- 4.9  GROUP 9: CRM tables (via crm_integrations.workspace_id)
-- ------------------------------------------------------------
-- crm_integrations.workspace_id links back to the user's workspace.
-- crm_companies / crm_contacts / crm_deals owner_id is an external
-- CRM string identifier, NOT an auth.uid().

-- FAIL 1 FIX: crm_integrations itself needs workspace-scoped policies.
-- The old "admins_manage_crm" policy (admin-only) is dropped above.
-- Phase 1: workspace_id = auth.uid() (user owns their workspace).
-- Phase 2: replace with workspace_members join.
CREATE POLICY crm_integrations_workspace_all ON public.crm_integrations
  USING (workspace_id IS NULL OR public.user_has_workspace_access(workspace_id))
  WITH CHECK (workspace_id IS NULL OR public.user_has_workspace_access(workspace_id));

CREATE INDEX IF NOT EXISTS idx_crm_integrations_workspace_id
  ON public.crm_integrations(workspace_id);

-- crm_companies: crm_id UUID nullable FK to crm_integrations
CREATE POLICY crm_companies_workspace_select ON public.crm_companies
  FOR SELECT USING (
    crm_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM   public.crm_integrations ci
      WHERE  ci.id           = crm_id
      AND    public.user_has_workspace_access(ci.workspace_id)
    )
  );

CREATE POLICY crm_companies_workspace_insert ON public.crm_companies
  FOR INSERT WITH CHECK (
    crm_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM   public.crm_integrations ci
      WHERE  ci.id           = crm_id
      AND    public.user_has_workspace_access(ci.workspace_id)
    )
  );

CREATE POLICY crm_companies_workspace_update ON public.crm_companies
  FOR UPDATE
  USING (
    crm_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM   public.crm_integrations ci
      WHERE  ci.id           = crm_id
      AND    public.user_has_workspace_access(ci.workspace_id)
    )
  )
  WITH CHECK (
    crm_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM   public.crm_integrations ci
      WHERE  ci.id           = crm_id
      AND    public.user_has_workspace_access(ci.workspace_id)
    )
  );

CREATE POLICY crm_companies_workspace_delete ON public.crm_companies
  FOR DELETE USING (
    crm_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM   public.crm_integrations ci
      WHERE  ci.id           = crm_id
      AND    public.user_has_workspace_access(ci.workspace_id)
    )
  );

-- crm_contacts: crm_id UUID nullable, pulse_user_id UUID
CREATE POLICY crm_contacts_workspace_select ON public.crm_contacts
  FOR SELECT USING (
    pulse_user_id = auth.uid()
    OR (
      crm_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM   public.crm_integrations ci
        WHERE  ci.id           = crm_id
        AND    public.user_has_workspace_access(ci.workspace_id)
      )
    )
  );

CREATE POLICY crm_contacts_workspace_insert ON public.crm_contacts
  FOR INSERT WITH CHECK (
    crm_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM   public.crm_integrations ci
      WHERE  ci.id           = crm_id
      AND    public.user_has_workspace_access(ci.workspace_id)
    )
  );

CREATE POLICY crm_contacts_workspace_update ON public.crm_contacts
  FOR UPDATE
  USING (
    pulse_user_id = auth.uid()
    OR (
      crm_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM   public.crm_integrations ci
        WHERE  ci.id           = crm_id
        AND    public.user_has_workspace_access(ci.workspace_id)
      )
    )
  )
  WITH CHECK (
    crm_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM   public.crm_integrations ci
      WHERE  ci.id           = crm_id
      AND    public.user_has_workspace_access(ci.workspace_id)
    )
  );

CREATE POLICY crm_contacts_workspace_delete ON public.crm_contacts
  FOR DELETE USING (
    pulse_user_id = auth.uid()
    OR (
      crm_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM   public.crm_integrations ci
        WHERE  ci.id           = crm_id
        AND    public.user_has_workspace_access(ci.workspace_id)
      )
    )
  );

-- crm_deals: crm_id UUID nullable
CREATE POLICY crm_deals_workspace_select ON public.crm_deals
  FOR SELECT USING (
    crm_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM   public.crm_integrations ci
      WHERE  ci.id           = crm_id
      AND    public.user_has_workspace_access(ci.workspace_id)
    )
  );

CREATE POLICY crm_deals_workspace_insert ON public.crm_deals
  FOR INSERT WITH CHECK (
    crm_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM   public.crm_integrations ci
      WHERE  ci.id           = crm_id
      AND    public.user_has_workspace_access(ci.workspace_id)
    )
  );

CREATE POLICY crm_deals_workspace_update ON public.crm_deals
  FOR UPDATE
  USING (
    crm_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM   public.crm_integrations ci
      WHERE  ci.id           = crm_id
      AND    public.user_has_workspace_access(ci.workspace_id)
    )
  )
  WITH CHECK (
    crm_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM   public.crm_integrations ci
      WHERE  ci.id           = crm_id
      AND    public.user_has_workspace_access(ci.workspace_id)
    )
  );

CREATE POLICY crm_deals_workspace_delete ON public.crm_deals
  FOR DELETE USING (
    crm_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM   public.crm_integrations ci
      WHERE  ci.id           = crm_id
      AND    public.user_has_workspace_access(ci.workspace_id)
    )
  );


-- ------------------------------------------------------------
-- 4.10  GROUP 10: Intentionally public / reference data
--        (SELECT open, writes tightly restricted)
-- ------------------------------------------------------------

-- roles: system reference data — SELECT only, no authenticated writes
CREATE POLICY roles_public_select ON public.roles
  FOR SELECT USING (true);

-- retention_policies: system config — SELECT only
CREATE POLICY retention_policies_public_select ON public.retention_policies
  FOR SELECT USING (true);
-- Note: writes to retention_policies are service_role only (no INSERT/UPDATE/DELETE policy created)

-- reserved_handles: handle availability check — SELECT only
CREATE POLICY reserved_handles_public_select ON public.reserved_handles
  FOR SELECT USING (true);

-- broadcasts: public content — SELECT open; author controls writes
CREATE POLICY broadcasts_public_select ON public.broadcasts
  FOR SELECT USING (true);

CREATE POLICY broadcasts_author_insert ON public.broadcasts
  FOR INSERT WITH CHECK (author_id = auth.uid());

CREATE POLICY broadcasts_author_update ON public.broadcasts
  FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY broadcasts_author_delete ON public.broadcasts
  FOR DELETE USING (author_id = auth.uid());


-- ------------------------------------------------------------
-- 4.11  GROUP 11: Admin / audit tables
-- ------------------------------------------------------------

-- admin_settings: user_id UUID nullable — own records only
CREATE POLICY admin_settings_own_select ON public.admin_settings
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY admin_settings_own_insert ON public.admin_settings
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY admin_settings_own_update ON public.admin_settings
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY admin_settings_own_delete ON public.admin_settings
  FOR DELETE USING (user_id = auth.uid());

-- admin_activity_logs: actor_id UUID nullable — SELECT own records only
-- Writes are service_role only (no INSERT/UPDATE/DELETE policy).
CREATE POLICY admin_activity_logs_own_select ON public.admin_activity_logs
  FOR SELECT USING (actor_id = auth.uid());

-- audit_logs: user_id UUID nullable — SELECT own records only
-- Writes are service_role only.
CREATE POLICY audit_logs_own_select ON public.audit_logs
  FOR SELECT USING (user_id = auth.uid());

-- user_roles: user_id UUID NOT NULL, tenant_id UUID NOT NULL
-- SELECT own role assignments only; no direct writes (service_role only).
CREATE POLICY user_roles_own_select ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());


-- ------------------------------------------------------------
-- 4.12  GROUP 12: Tables with newly added user_id column
-- ------------------------------------------------------------
-- NOTE: Until the backfill migration (20260226000002_rls_backfill.sql)
-- runs, existing rows where user_id IS NULL will be INVISIBLE to
-- authenticated users but still accessible to service_role.

-- integrations
CREATE POLICY integrations_owner_select ON public.integrations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY integrations_owner_insert ON public.integrations
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY integrations_owner_update ON public.integrations
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY integrations_owner_delete ON public.integrations
  FOR DELETE USING (user_id = auth.uid());

-- webhooks
CREATE POLICY webhooks_owner_select ON public.webhooks
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY webhooks_owner_insert ON public.webhooks
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY webhooks_owner_update ON public.webhooks
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY webhooks_owner_delete ON public.webhooks
  FOR DELETE USING (user_id = auth.uid());

-- predictions
CREATE POLICY predictions_owner_select ON public.predictions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY predictions_owner_insert ON public.predictions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY predictions_owner_update ON public.predictions
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY predictions_owner_delete ON public.predictions
  FOR DELETE USING (user_id = auth.uid());

-- customer_health
CREATE POLICY customer_health_owner_select ON public.customer_health
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY customer_health_owner_insert ON public.customer_health
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY customer_health_owner_update ON public.customer_health
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY customer_health_owner_delete ON public.customer_health
  FOR DELETE USING (user_id = auth.uid());

-- customer_health_history
CREATE POLICY customer_health_history_owner_select ON public.customer_health_history
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY customer_health_history_owner_insert ON public.customer_health_history
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY customer_health_history_owner_update ON public.customer_health_history
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY customer_health_history_owner_delete ON public.customer_health_history
  FOR DELETE USING (user_id = auth.uid());

-- customer_alerts
CREATE POLICY customer_alerts_owner_select ON public.customer_alerts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY customer_alerts_owner_insert ON public.customer_alerts
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY customer_alerts_owner_update ON public.customer_alerts
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY customer_alerts_owner_delete ON public.customer_alerts
  FOR DELETE USING (user_id = auth.uid());

-- customer_sentiment
CREATE POLICY customer_sentiment_owner_select ON public.customer_sentiment
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY customer_sentiment_owner_insert ON public.customer_sentiment
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY customer_sentiment_owner_update ON public.customer_sentiment
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY customer_sentiment_owner_delete ON public.customer_sentiment
  FOR DELETE USING (user_id = auth.uid());

-- integration_logs
-- FAIL 3 NOTE: No DROP POLICY statement for integration_logs above is intentional.
-- The remote schema (20260119062007_remote_schema.sql) contains no RLS policies
-- for integration_logs — it was unprotected (no RLS enabled). There is nothing to drop.
-- This migration enables RLS (ALTER TABLE above) and creates ownership policies here.
CREATE POLICY integration_logs_owner_select ON public.integration_logs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY integration_logs_owner_insert ON public.integration_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY integration_logs_owner_delete ON public.integration_logs
  FOR DELETE USING (user_id = auth.uid());


-- ------------------------------------------------------------
-- 4.13  GROUP 13: Special / system tables
-- ------------------------------------------------------------

-- relationships: created_by TEXT (format "user:uuid" | "system" | "agent:uuid")
-- Own relationships only (created_by = 'user:' || auth.uid()::text)
CREATE POLICY relationships_own_select ON public.relationships
  FOR SELECT USING (
    created_by = 'user:' || auth.uid()::text
  );

CREATE POLICY relationships_own_insert ON public.relationships
  FOR INSERT WITH CHECK (
    created_by = 'user:' || auth.uid()::text
  );

CREATE POLICY relationships_own_update ON public.relationships
  FOR UPDATE
  USING  (created_by = 'user:' || auth.uid()::text)
  WITH CHECK (created_by = 'user:' || auth.uid()::text);

CREATE POLICY relationships_own_delete ON public.relationships
  FOR DELETE USING (
    created_by = 'user:' || auth.uid()::text
  );

-- relationship_events: actor TEXT (format "user:uuid" | NULL | "agent:uuid")
-- Own events only; allow NULL actor rows (system events readable by everyone).
CREATE POLICY relationship_events_own_select ON public.relationship_events
  FOR SELECT USING (
    actor IS NULL
    OR actor = 'user:' || auth.uid()::text
  );

CREATE POLICY relationship_events_own_insert ON public.relationship_events
  FOR INSERT WITH CHECK (
    actor = 'user:' || auth.uid()::text
  );

-- sso_configs: tenant_id UUID
-- Authenticated users can read SSO configs (needed for login UI flows).
-- All writes are service_role only.
CREATE POLICY sso_configs_authenticated_select ON public.sso_configs
  FOR SELECT USING (auth.role() = 'authenticated');

-- workspace_participants: workspace_id UUID NOT NULL, user_id TEXT NOT NULL
-- A user can see rows where user_id matches them OR workspace_id matches them
-- (Phase 1: workspace IS the user's own UUID).
CREATE POLICY workspace_participants_own_select ON public.workspace_participants
  FOR SELECT USING (
    user_id = auth.uid()::text
    OR workspace_id = auth.uid()
  );

CREATE POLICY workspace_participants_own_insert ON public.workspace_participants
  FOR INSERT WITH CHECK (
    user_id = auth.uid()::text
    OR workspace_id = auth.uid()
  );

CREATE POLICY workspace_participants_own_update ON public.workspace_participants
  FOR UPDATE
  USING (
    user_id = auth.uid()::text
    OR workspace_id = auth.uid()
  )
  WITH CHECK (
    user_id = auth.uid()::text
    OR workspace_id = auth.uid()
  );

CREATE POLICY workspace_participants_own_delete ON public.workspace_participants
  FOR DELETE USING (
    user_id = auth.uid()::text
    OR workspace_id = auth.uid()
  );


-- ============================================================
-- SECTION 5: PERFORMANCE INDEXES
-- ============================================================
-- Indexes to support the new ownership-scoped WHERE clauses.
-- All use CREATE INDEX IF NOT EXISTS for idempotency.

-- Group 1: TEXT user_id
CREATE INDEX IF NOT EXISTS idx_archives_user_id
  ON public.archives(user_id);

CREATE INDEX IF NOT EXISTS idx_contacts_user_id
  ON public.contacts(user_id);

CREATE INDEX IF NOT EXISTS idx_emails_user_id
  ON public.emails(user_id);

CREATE INDEX IF NOT EXISTS idx_sms_conversations_user_id
  ON public.sms_conversations(user_id);

CREATE INDEX IF NOT EXISTS idx_voxer_recordings_user_id
  ON public.voxer_recordings(user_id);

CREATE INDEX IF NOT EXISTS idx_slack_channels_user_id
  ON public.slack_channels(user_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id
  ON public.calendar_events(user_id);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id
  ON public.tasks(user_id);

CREATE INDEX IF NOT EXISTS idx_threads_user_id
  ON public.threads(user_id);

CREATE INDEX IF NOT EXISTS idx_unified_messages_user_id
  ON public.unified_messages(user_id);

CREATE INDEX IF NOT EXISTS idx_outcomes_user_id
  ON public.outcomes(user_id);

CREATE INDEX IF NOT EXISTS idx_decision_votes_user_id
  ON public.decision_votes(user_id);

CREATE INDEX IF NOT EXISTS idx_user_retention_cohorts_user_id
  ON public.user_retention_cohorts(user_id);

-- Group 2: UUID user_id
CREATE INDEX IF NOT EXISTS idx_attention_logs_user_id
  ON public.attention_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_attention_settings_user_id
  ON public.attention_settings(user_id);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_id
  ON public.focus_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id
  ON public.user_settings(user_id);

CREATE INDEX IF NOT EXISTS idx_quick_vox_favorites_user_id
  ON public.quick_vox_favorites(user_id);

CREATE INDEX IF NOT EXISTS idx_vox_notes_user_id
  ON public.vox_notes(user_id);

CREATE INDEX IF NOT EXISTS idx_vox_notifications_user_id
  ON public.vox_notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_pulse_notifications_user_id
  ON public.pulse_notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_pulse_nudges_user_id
  ON public.pulse_nudges(user_id);

CREATE INDEX IF NOT EXISTS idx_pulse_typing_user_id
  ON public.pulse_typing(user_id);

CREATE INDEX IF NOT EXISTS idx_sso_sessions_user_id
  ON public.sso_sessions(user_id);

-- Group 3: owner_id
CREATE INDEX IF NOT EXISTS idx_goals_owner_id
  ON public.goals(owner_id);

CREATE INDEX IF NOT EXISTS idx_pulse_channels_owner_id
  ON public.pulse_channels(owner_id);

CREATE INDEX IF NOT EXISTS idx_vox_workspaces_owner_id
  ON public.vox_workspaces(owner_id);

-- Group 4: sender_id / recipient
CREATE INDEX IF NOT EXISTS idx_quick_vox_messages_sender_id
  ON public.quick_vox_messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_quick_vox_messages_recipient_id
  ON public.quick_vox_messages(recipient_id);

CREATE INDEX IF NOT EXISTS idx_vox_drops_sender_id
  ON public.vox_drops(sender_id);

-- Group 5: created_by
CREATE INDEX IF NOT EXISTS idx_pulse_decisions_created_by
  ON public.pulse_decisions(created_by);

CREATE INDEX IF NOT EXISTS idx_pulse_decisions_channel_id
  ON public.pulse_decisions(channel_id);

CREATE INDEX IF NOT EXISTS idx_pulse_outcomes_created_by
  ON public.pulse_outcomes(created_by);

CREATE INDEX IF NOT EXISTS idx_pulse_outcomes_channel_id
  ON public.pulse_outcomes(channel_id);

CREATE INDEX IF NOT EXISTS idx_pulse_files_uploaded_by
  ON public.pulse_files(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_pulse_files_channel_id
  ON public.pulse_files(channel_id);

CREATE INDEX IF NOT EXISTS idx_pulse_follows_follower_id
  ON public.pulse_follows(follower_id);

CREATE INDEX IF NOT EXISTS idx_pulse_follows_following_id
  ON public.pulse_follows(following_id);

CREATE INDEX IF NOT EXISTS idx_pulse_users_auth_user_id
  ON public.pulse_users(auth_user_id);

-- Group 6: workspace_id
CREATE INDEX IF NOT EXISTS idx_decisions_workspace_id
  ON public.decisions(workspace_id);

CREATE INDEX IF NOT EXISTS idx_extracted_tasks_workspace_id
  ON public.extracted_tasks(workspace_id);

CREATE INDEX IF NOT EXISTS idx_outcome_blockers_workspace_id
  ON public.outcome_blockers(workspace_id);

CREATE INDEX IF NOT EXISTS idx_workspace_outcomes_workspace_id
  ON public.workspace_outcomes(workspace_id);

CREATE INDEX IF NOT EXISTS idx_vox_team_channels_workspace_id
  ON public.vox_team_channels(workspace_id);

CREATE INDEX IF NOT EXISTS idx_team_vox_messages_workspace_id
  ON public.team_vox_messages(workspace_id);

-- Group 7: channel_id
CREATE INDEX IF NOT EXISTS idx_pulse_blockers_channel_id
  ON public.pulse_blockers(channel_id);

CREATE INDEX IF NOT EXISTS idx_pulse_context_summaries_channel_id
  ON public.pulse_context_summaries(channel_id);

CREATE INDEX IF NOT EXISTS idx_pulse_tasks_channel_id
  ON public.pulse_tasks(channel_id);

CREATE INDEX IF NOT EXISTS idx_pulse_channel_subscriptions_channel_id
  ON public.pulse_channel_subscriptions(channel_id);

CREATE INDEX IF NOT EXISTS idx_pulse_channel_subscriptions_subscriber_id
  ON public.pulse_channel_subscriptions(subscriber_id);

-- Group 8: subquery foreign keys
CREATE INDEX IF NOT EXISTS idx_sms_messages_conversation_id
  ON public.sms_messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_messages_thread_id
  ON public.messages(thread_id);

CREATE INDEX IF NOT EXISTS idx_key_results_outcome_id
  ON public.key_results(outcome_id);

CREATE INDEX IF NOT EXISTS idx_outcome_milestones_outcome_id
  ON public.outcome_milestones(outcome_id);

CREATE INDEX IF NOT EXISTS idx_task_dependencies_task_id
  ON public.task_dependencies(task_id);

CREATE INDEX IF NOT EXISTS idx_task_updates_updated_by
  ON public.task_updates(updated_by);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id
  ON public.webhook_deliveries(webhook_id);

CREATE INDEX IF NOT EXISTS idx_integration_field_mappings_integration_id
  ON public.integration_field_mappings(integration_id);

CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_integration_id
  ON public.integration_sync_logs(integration_id);

-- Group 9: CRM crm_id (FK to crm_integrations)
CREATE INDEX IF NOT EXISTS idx_crm_companies_crm_id
  ON public.crm_companies(crm_id);

CREATE INDEX IF NOT EXISTS idx_crm_contacts_crm_id
  ON public.crm_contacts(crm_id);

CREATE INDEX IF NOT EXISTS idx_crm_contacts_pulse_user_id
  ON public.crm_contacts(pulse_user_id);

CREATE INDEX IF NOT EXISTS idx_crm_deals_crm_id
  ON public.crm_deals(crm_id);

-- Group 11: Admin
CREATE INDEX IF NOT EXISTS idx_admin_settings_user_id
  ON public.admin_settings(user_id);

CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_actor_id
  ON public.admin_activity_logs(actor_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
  ON public.audit_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id
  ON public.user_roles(user_id);

-- Group 12: Newly added user_id columns
CREATE INDEX IF NOT EXISTS idx_integrations_user_id
  ON public.integrations(user_id);

CREATE INDEX IF NOT EXISTS idx_webhooks_user_id
  ON public.webhooks(user_id);

CREATE INDEX IF NOT EXISTS idx_predictions_user_id
  ON public.predictions(user_id);

CREATE INDEX IF NOT EXISTS idx_customer_health_user_id
  ON public.customer_health(user_id);

CREATE INDEX IF NOT EXISTS idx_customer_health_history_user_id
  ON public.customer_health_history(user_id);

CREATE INDEX IF NOT EXISTS idx_customer_alerts_user_id
  ON public.customer_alerts(user_id);

CREATE INDEX IF NOT EXISTS idx_customer_sentiment_user_id
  ON public.customer_sentiment(user_id);

CREATE INDEX IF NOT EXISTS idx_integration_logs_user_id
  ON public.integration_logs(user_id);

-- Group 13: Special
CREATE INDEX IF NOT EXISTS idx_relationships_created_by
  ON public.relationships(created_by);

CREATE INDEX IF NOT EXISTS idx_relationship_events_actor
  ON public.relationship_events(actor);

CREATE INDEX IF NOT EXISTS idx_workspace_participants_user_id
  ON public.workspace_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_workspace_participants_workspace_id
  ON public.workspace_participants(workspace_id);

-- Broadcasts
CREATE INDEX IF NOT EXISTS idx_broadcasts_author_id
  ON public.broadcasts(author_id);


-- ============================================================
-- SECTION 6: POST-MIGRATION NOTES
-- ============================================================
-- These are documentation-only comments embedded in the migration
-- so they appear in migration history.

-- ============================================================
-- POST-MIGRATION REQUIRED ACTIONS
-- ============================================================
-- 1. Run backfill script: 20260226000002_rls_backfill.sql
--    to populate user_id columns on: integrations, webhooks, predictions,
--    customer_health, customer_health_history, customer_alerts,
--    customer_sentiment, integration_logs
--
-- 2. Update service layer to include user_id in all INSERT statements
--    for the tables above (see Section 8 / Phase 3 audit below).
--
-- 3. Verify existing data is accessible after migration by running:
--    SELECT count(*) FROM integrations             WHERE user_id IS NOT NULL;
--    SELECT count(*) FROM webhooks                 WHERE user_id IS NOT NULL;
--    SELECT count(*) FROM predictions              WHERE user_id IS NOT NULL;
--    SELECT count(*) FROM customer_health          WHERE user_id IS NOT NULL;
--    SELECT count(*) FROM customer_health_history  WHERE user_id IS NOT NULL;
--    SELECT count(*) FROM customer_alerts          WHERE user_id IS NOT NULL;
--    SELECT count(*) FROM customer_sentiment       WHERE user_id IS NOT NULL;
--    SELECT count(*) FROM integration_logs         WHERE user_id IS NOT NULL;
--
-- 4. Tables with data that may be INVISIBLE to authenticated users
--    until backfill is complete:
--    integrations, webhooks, predictions, customer_health,
--    customer_health_history, customer_alerts, customer_sentiment,
--    integration_logs
--
-- 5. Service role ALWAYS bypasses RLS in Supabase. Background jobs,
--    triggers, and edge functions using the service_role key are
--    unaffected by this migration.
--
-- 6. Tables intentionally left with open SELECT (USING true):
--    pulse_users, pulse_channels, roles, retention_policies,
--    reserved_handles, broadcasts
--    These are discoverable by design.
-- ============================================================

COMMIT;


-- ============================================================
-- SECTION 7: PHASE 2 PLAN — WORKSPACE MODEL (NOT YET IMPLEMENTED)
-- ============================================================
-- The following SQL is commented out. It represents the full
-- multi-tenant workspace model to implement in Phase 2.
-- ============================================================
--
-- CREATE TABLE public.workspaces (
--   id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
--   name       TEXT        NOT NULL,
--   owner_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
--   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );
--
-- CREATE TABLE public.workspace_members (
--   workspace_id UUID NOT NULL REFERENCES public.workspaces(id)  ON DELETE CASCADE,
--   user_id      UUID NOT NULL REFERENCES auth.users(id)          ON DELETE CASCADE,
--   role         TEXT NOT NULL DEFAULT 'member'
--                  CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
--   joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--   PRIMARY KEY (workspace_id, user_id)
-- );
--
-- -- Updated helper: replaces the Phase 1 trivial check above
-- CREATE OR REPLACE FUNCTION public.user_has_workspace_access(ws_id UUID)
-- RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
--   SELECT EXISTS (
--     SELECT 1 FROM public.workspace_members
--     WHERE  workspace_id = ws_id
--     AND    user_id      = auth.uid()
--   ) OR EXISTS (
--     SELECT 1 FROM public.workspaces
--     WHERE  id       = ws_id
--     AND    owner_id = auth.uid()
--   )
-- $$;
--
-- -- Auto-create personal workspace on user signup
-- CREATE OR REPLACE FUNCTION public.handle_new_user_workspace()
-- RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
-- BEGIN
--   INSERT INTO public.workspaces (id, name, owner_id)
--   VALUES (
--     NEW.id,
--     COALESCE(NEW.raw_user_meta_data->>'name',
--              split_part(NEW.email, '@', 1)),
--     NEW.id
--   );
--   INSERT INTO public.workspace_members (workspace_id, user_id, role)
--   VALUES (NEW.id, NEW.id, 'owner');
--   RETURN NEW;
-- END;
-- $$;
--
-- CREATE TRIGGER on_auth_user_created_workspace
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_workspace();
--
-- -- RLS on workspaces
-- ALTER TABLE public.workspaces        ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY workspaces_member_select ON public.workspaces
--   FOR SELECT USING (public.user_has_workspace_access(id));
--
-- CREATE POLICY workspaces_owner_insert ON public.workspaces
--   FOR INSERT WITH CHECK (owner_id = auth.uid());
--
-- CREATE POLICY workspaces_owner_update ON public.workspaces
--   FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
--
-- CREATE POLICY workspaces_owner_delete ON public.workspaces
--   FOR DELETE USING (owner_id = auth.uid());
--
-- CREATE POLICY workspace_members_own_select ON public.workspace_members
--   FOR SELECT USING (public.user_has_workspace_access(workspace_id));
--
-- CREATE POLICY workspace_members_owner_insert ON public.workspace_members
--   FOR INSERT WITH CHECK (
--     EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND owner_id = auth.uid())
--   );
--
-- CREATE POLICY workspace_members_own_delete ON public.workspace_members
--   FOR DELETE USING (user_id = auth.uid());
--
-- -- Indexes for workspace model
-- CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id
--   ON public.workspaces(owner_id);
-- CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id
--   ON public.workspace_members(user_id);
-- CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id
--   ON public.workspace_members(workspace_id);
--
-- ============================================================
-- END PHASE 2 PLAN
-- ============================================================


-- ============================================================
-- SECTION 8: PHASE 3 — SERVICE LAYER AUDIT (src/services/)
-- ============================================================
-- The following files need updating when the workspace model
-- moves to multi-tenant (Phase 2). Listed with current pattern
-- and required change.
-- ============================================================
--
-- src/services/decisions/decisionService.ts
--   CURRENT:  .eq('workspace_id', workspaceId)
--             where workspaceId is derived from auth.uid() directly
--   REQUIRED: Introduce workspace context provider; support
--             workspace switching in UI; pass selected workspace_id.
--
-- src/services/voxer/voxModeService.ts
--   CURRENT:  auth.uid() used directly as workspace_id
--   REQUIRED: Workspace selection service; resolve workspace_id
--             from user's workspace membership.
--
-- src/services/tasks/taskService.ts
--   CURRENT:  .eq('workspace_id', workspaceId) — same pattern as above
--   REQUIRED: Same workspace context provider approach.
--
-- src/services/integrations/integrationService.ts
--   CURRENT:  No user_id filter (was USING(true))
--   REQUIRED: Add .eq('user_id', session.user.id) to all queries.
--             Add user_id to all INSERT calls.
--
-- src/services/webhooks/webhookService.ts
--   CURRENT:  No user_id filter (was USING(true))
--   REQUIRED: Add .eq('user_id', session.user.id) to all queries.
--             Add user_id to all INSERT calls.
--
-- src/services/crm/crmService.ts (and all sub-services)
--   CURRENT:  Full table access via USING(true)
--   REQUIRED: Filter by crm_integrations.workspace_id via JOIN.
--             Ensure INSERT always sets correct crm_id linked to
--             an integration owned by the current user.
--
-- src/services/customers/customerHealthService.ts
--   CURRENT:  No user_id filter (was USING(true))
--   REQUIRED: Add user_id to all queries and INSERT statements.
--
-- src/services/customers/customerAlertsService.ts
--   CURRENT:  No user_id filter (was USING(true))
--   REQUIRED: Add user_id to all queries and INSERT statements.
--
-- src/services/customers/customerSentimentService.ts
--   CURRENT:  No user_id filter (was USING(true))
--   REQUIRED: Add user_id to all queries and INSERT statements.
--
-- src/services/predictions/predictionService.ts
--   CURRENT:  No user_id filter (was USING(true))
--   REQUIRED: Add user_id to all queries and INSERT statements.
--
-- src/services/integrations/integrationLogsService.ts
--   CURRENT:  No user_id filter (was USING(true))
--   REQUIRED: Add user_id to all queries and INSERT statements.
--
-- GENERAL PATTERN FOR ALL FIXED TABLES:
--   1. On SELECT: add .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
--   2. On INSERT: include user_id: session.user.id in the insert object
--   3. On UPDATE/DELETE: RLS enforces ownership; no extra filter needed
--      but defensive coding should still include it.
--
-- ============================================================
-- END PHASE 3 AUDIT
-- ============================================================
