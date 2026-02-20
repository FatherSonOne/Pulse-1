-- ============================================
-- CONTACT GOALS TABLE
-- Keep-in-touch goals + relationship autopilot settings.
-- Part of: Contacts Reimagined — Phase 4
-- Run date: 2026-02-19
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== CONTACT GOALS TABLE ====================

CREATE TABLE IF NOT EXISTS contact_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contact_id TEXT NOT NULL,           -- app contact UUID (string, may be local)
    contact_email TEXT NOT NULL,        -- for profile matching
    frequency VARCHAR(20) NOT NULL DEFAULT 'monthly',
        -- 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually'
    channel VARCHAR(20) NOT NULL DEFAULT 'any',
        -- 'message' | 'call' | 'meeting' | 'email' | 'any'
    notes TEXT,                         -- optional reminder shown in Today feed
    autopilot_enabled BOOLEAN NOT NULL DEFAULT false,
    next_action_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- One goal per contact per user
    UNIQUE (user_id, contact_id)
);

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_contact_goals_user
    ON contact_goals(user_id);

CREATE INDEX IF NOT EXISTS idx_contact_goals_next_action
    ON contact_goals(user_id, next_action_at)
    WHERE autopilot_enabled = true;

CREATE INDEX IF NOT EXISTS idx_contact_goals_contact
    ON contact_goals(contact_id);

-- ==================== ROW-LEVEL SECURITY ====================

ALTER TABLE contact_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "goals_user_select"
    ON contact_goals FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "goals_user_insert"
    ON contact_goals FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "goals_user_update"
    ON contact_goals FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "goals_user_delete"
    ON contact_goals FOR DELETE USING (auth.uid() = user_id);

-- ==================== UPDATED_AT TRIGGER ====================

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

-- ==================== HELPER: GET DUE AUTOPILOT GOALS ====================
-- Returns all goals with autopilot enabled that are past their next_action_at.
-- Call: SELECT * FROM get_due_autopilot_goals('<user_uuid>');

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

-- ==================== HELPER: ADVANCE GOAL ====================
-- Marks a goal as done and calculates the next_action_at based on frequency.
-- Call: SELECT advance_contact_goal('<goal_uuid>');

CREATE OR REPLACE FUNCTION advance_contact_goal(p_goal_id UUID)
RETURNS void AS $$
DECLARE
    v_frequency VARCHAR(20);
    v_days INT;
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
    SET
        last_completed_at = NOW(),
        next_action_at = NOW() + (v_days * INTERVAL '1 day'),
        updated_at = NOW()
    WHERE id = p_goal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
