-- ============================================
-- CONTACT CIRCLES TABLES
-- Network visualization circles + membership.
-- Part of: Contacts Reimagined — Phase 3
-- Run date: 2026-02-19
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== CIRCLES TABLE ====================

CREATE TABLE IF NOT EXISTS contact_circles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT '#6366f1',
    icon VARCHAR(50),
    source VARCHAR(20) DEFAULT 'manual',  -- 'auto' | 'manual'
    health_score REAL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== CIRCLE MEMBERS TABLE ====================

CREATE TABLE IF NOT EXISTS contact_circle_members (
    circle_id UUID NOT NULL REFERENCES contact_circles(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (circle_id, contact_id)
);

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_circles_user
    ON contact_circles(user_id);

CREATE INDEX IF NOT EXISTS idx_circle_members_contact
    ON contact_circle_members(contact_id);

CREATE INDEX IF NOT EXISTS idx_circle_members_circle
    ON contact_circle_members(circle_id);

-- ==================== ROW-LEVEL SECURITY ====================

ALTER TABLE contact_circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_circle_members ENABLE ROW LEVEL SECURITY;

-- Users can only access their own circles
CREATE POLICY IF NOT EXISTS "circles_user_select"
    ON contact_circles FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "circles_user_insert"
    ON contact_circles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "circles_user_update"
    ON contact_circles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "circles_user_delete"
    ON contact_circles FOR DELETE USING (auth.uid() = user_id);

-- Members: accessible if user owns the parent circle
CREATE POLICY IF NOT EXISTS "circle_members_user_select"
    ON contact_circle_members FOR SELECT
    USING (
        circle_id IN (
            SELECT id FROM contact_circles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "circle_members_user_insert"
    ON contact_circle_members FOR INSERT
    WITH CHECK (
        circle_id IN (
            SELECT id FROM contact_circles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "circle_members_user_delete"
    ON contact_circle_members FOR DELETE
    USING (
        circle_id IN (
            SELECT id FROM contact_circles WHERE user_id = auth.uid()
        )
    );

-- ==================== UPDATED_AT TRIGGER ====================

CREATE OR REPLACE FUNCTION update_circle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contact_circles_updated_at ON contact_circles;
CREATE TRIGGER contact_circles_updated_at
    BEFORE UPDATE ON contact_circles
    FOR EACH ROW EXECUTE FUNCTION update_circle_updated_at();

-- ==================== HEALTH SCORE HELPER ====================
-- Recalculate a circle's health score from its members' relationship scores.
-- Call: SELECT recalculate_circle_health('<circle_uuid>');

CREATE OR REPLACE FUNCTION recalculate_circle_health(p_circle_id UUID)
RETURNS REAL AS $$
DECLARE
    avg_score REAL;
BEGIN
    -- This join assumes relationship_profiles table exists with relationship_score
    SELECT AVG(rp.relationship_score)
    INTO avg_score
    FROM contact_circle_members ccm
    JOIN relationship_profiles rp ON rp.id::text = ccm.contact_id::text
    WHERE ccm.circle_id = p_circle_id;

    UPDATE contact_circles
    SET health_score = COALESCE(avg_score, NULL),
        updated_at = NOW()
    WHERE id = p_circle_id;

    RETURN COALESCE(avg_score, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
