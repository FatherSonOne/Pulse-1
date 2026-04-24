-- ============================================
-- DASHBOARD MISSING TABLES
-- Creates two tables that the Pulse Dashboard (TodayView) queries on every load.
-- Without these, each dashboard load emits 404s:
--   - POST /rest/v1/today_feed_items ... → 404
--   - POST /rest/v1/contact_goals    ... → 404
--
-- Source-of-truth definitions were previously staged in /sql-scripts/ but never
-- promoted into supabase/migrations/. This migration promotes them.
--
-- Part of: Contacts Reimagined — Phases 1 & 4
-- Run date: 2026-04-23
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. TODAY FEED ITEMS
--    Stores AI-generated daily relationship action items for each user.
--    Consumed by src/services/todayFeedService.ts → TodayView.tsx
-- ============================================================================

CREATE TABLE IF NOT EXISTS today_feed_items (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contact_id        UUID NOT NULL,
    contact_name      VARCHAR(255),
    item_type         VARCHAR(50) NOT NULL,
    priority          INTEGER DEFAULT 5,
    title             VARCHAR(500) NOT NULL,
    subtitle          TEXT,
    ai_draft_message  TEXT,
    suggested_action  VARCHAR(50) NOT NULL,
    suggested_channel VARCHAR(50),
    expires_at        TIMESTAMP WITH TIME ZONE,
    status            VARCHAR(20) DEFAULT 'active',
    snoozed_until     TIMESTAMP WITH TIME ZONE,
    completed_at      TIMESTAMP WITH TIME ZONE,
    metadata          JSONB,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes matching dashboard query patterns
--   .eq('user_id', ...).eq('status', 'active').order('priority').order('created_at')
CREATE INDEX IF NOT EXISTS idx_today_feed_user_status
    ON today_feed_items(user_id, status);

CREATE INDEX IF NOT EXISTS idx_today_feed_user_date
    ON today_feed_items(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_today_feed_priority
    ON today_feed_items(user_id, priority ASC, created_at DESC)
    WHERE status = 'active';

-- Row-Level Security: users only see their own feed items
ALTER TABLE today_feed_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "today_feed_items_user_select" ON today_feed_items;
CREATE POLICY "today_feed_items_user_select"
    ON today_feed_items
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "today_feed_items_user_insert" ON today_feed_items;
CREATE POLICY "today_feed_items_user_insert"
    ON today_feed_items
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "today_feed_items_user_update" ON today_feed_items;
CREATE POLICY "today_feed_items_user_update"
    ON today_feed_items
    FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "today_feed_items_user_delete" ON today_feed_items;
CREATE POLICY "today_feed_items_user_delete"
    ON today_feed_items
    FOR DELETE
    USING (auth.uid() = user_id);

-- Cleanup helper: auto-expire dismissed/completed items older than 7 days.
-- Intended to be invoked via pg_cron or an Edge Function on a schedule.
CREATE OR REPLACE FUNCTION cleanup_expired_feed_items()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM today_feed_items
    WHERE (status = 'dismissed' OR status = 'completed')
      AND created_at < NOW() - INTERVAL '7 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 2. CONTACT GOALS
--    Keep-in-touch goals + relationship autopilot settings.
--    Consumed by src/services/contactGoalService.ts →
--      TodayView.tsx, ContactDetail.tsx, ContactGoalModal.tsx,
--      RelationshipAutopilotToggle.tsx
-- ============================================================================

CREATE TABLE IF NOT EXISTS contact_goals (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contact_id         TEXT NOT NULL,             -- app contact UUID (may be local)
    contact_email      TEXT NOT NULL,             -- for profile matching
    frequency          VARCHAR(20) NOT NULL DEFAULT 'monthly',
        -- 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually'
    channel            VARCHAR(20) NOT NULL DEFAULT 'any',
        -- 'message' | 'call' | 'meeting' | 'email' | 'any'
    notes              TEXT,                      -- optional reminder shown in Today feed
    autopilot_enabled  BOOLEAN NOT NULL DEFAULT false,
    next_action_at     TIMESTAMP WITH TIME ZONE NOT NULL,
    last_completed_at  TIMESTAMP WITH TIME ZONE,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- One goal per contact per user (matches sbUpsertGoal onConflict target)
    UNIQUE (user_id, contact_id)
);

-- Indexes matching dashboard query patterns
--   .eq('user_id', ...).order('next_action_at', ascending: true)
CREATE INDEX IF NOT EXISTS idx_contact_goals_user
    ON contact_goals(user_id);

CREATE INDEX IF NOT EXISTS idx_contact_goals_next_action
    ON contact_goals(user_id, next_action_at)
    WHERE autopilot_enabled = true;

CREATE INDEX IF NOT EXISTS idx_contact_goals_contact
    ON contact_goals(contact_id);

-- Row-Level Security
ALTER TABLE contact_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "goals_user_select" ON contact_goals;
CREATE POLICY "goals_user_select"
    ON contact_goals FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "goals_user_insert" ON contact_goals;
CREATE POLICY "goals_user_insert"
    ON contact_goals FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "goals_user_update" ON contact_goals;
CREATE POLICY "goals_user_update"
    ON contact_goals FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "goals_user_delete" ON contact_goals;
CREATE POLICY "goals_user_delete"
    ON contact_goals FOR DELETE USING (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_contact_goal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contact_goals_updated_at ON contact_goals;
CREATE TRIGGER contact_goals_updated_at
    BEFORE UPDATE ON contact_goals
    FOR EACH ROW EXECUTE FUNCTION update_contact_goal_updated_at();

-- Helper: returns all autopilot goals that are past their next_action_at
CREATE OR REPLACE FUNCTION get_due_autopilot_goals(p_user_id UUID)
RETURNS SETOF contact_goals AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM contact_goals
    WHERE user_id = p_user_id
      AND autopilot_enabled = true
      AND next_action_at <= NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: mark a goal complete and advance next_action_at based on frequency
CREATE OR REPLACE FUNCTION advance_contact_goal(p_goal_id UUID)
RETURNS void AS $$
DECLARE
    v_frequency VARCHAR(20);
    v_days      INT;
BEGIN
    SELECT frequency INTO v_frequency FROM contact_goals WHERE id = p_goal_id;

    v_days := CASE v_frequency
        WHEN 'weekly'    THEN 7
        WHEN 'biweekly'  THEN 14
        WHEN 'monthly'   THEN 30
        WHEN 'quarterly' THEN 90
        WHEN 'annually'  THEN 365
        ELSE 30
    END;

    UPDATE contact_goals
    SET last_completed_at = NOW(),
        next_action_at    = NOW() + (v_days * INTERVAL '1 day'),
        updated_at        = NOW()
    WHERE id = p_goal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
