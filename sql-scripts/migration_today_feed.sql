-- ============================================
-- TODAY FEED ITEMS TABLE
-- Stores AI-generated daily relationship action items for each user.
-- Part of: Contacts Reimagined — Phase 1
-- Run date: 2026-02-18
-- ============================================

-- Enable uuid extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== TABLE ====================

CREATE TABLE IF NOT EXISTS today_feed_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL,
    contact_name VARCHAR(255),
    item_type VARCHAR(50) NOT NULL,
    priority INTEGER DEFAULT 5,
    title VARCHAR(500) NOT NULL,
    subtitle TEXT,
    ai_draft_message TEXT,
    suggested_action VARCHAR(50) NOT NULL,
    suggested_channel VARCHAR(50),
    expires_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active',
    snoozed_until TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_today_feed_user_status
    ON today_feed_items(user_id, status);

CREATE INDEX IF NOT EXISTS idx_today_feed_user_date
    ON today_feed_items(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_today_feed_priority
    ON today_feed_items(user_id, priority ASC, created_at DESC)
    WHERE status = 'active';

-- ==================== ROW-LEVEL SECURITY ====================

ALTER TABLE today_feed_items ENABLE ROW LEVEL SECURITY;

-- Users can only see their own feed items
CREATE POLICY IF NOT EXISTS "today_feed_items_user_select"
    ON today_feed_items
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "today_feed_items_user_insert"
    ON today_feed_items
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "today_feed_items_user_update"
    ON today_feed_items
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "today_feed_items_user_delete"
    ON today_feed_items
    FOR DELETE
    USING (auth.uid() = user_id);

-- ==================== CLEANUP FUNCTION ====================
-- Auto-expire items older than 7 days to keep the table clean.
-- Call this via a scheduled Supabase Edge Function or pg_cron.

CREATE OR REPLACE FUNCTION cleanup_expired_feed_items()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM today_feed_items
  WHERE
    (status = 'dismissed' OR status = 'completed')
    AND created_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
