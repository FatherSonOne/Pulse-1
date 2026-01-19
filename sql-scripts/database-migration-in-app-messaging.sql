-- =====================================================
-- IN-APP MESSAGING SYSTEM - DATABASE MIGRATION
-- OneSignal-style event-based messaging for Pulse
-- =====================================================

-- Table 1: In-App Messages (Campaign/Template Definition)
-- This table stores the message templates that admins create
CREATE TABLE IF NOT EXISTS in_app_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  cta_text TEXT, -- Call-to-action button text (optional)
  cta_url TEXT, -- Where the CTA button should navigate (optional)

  -- Triggering & Targeting
  trigger_event TEXT NOT NULL, -- e.g., 'user_signup', 'first_message_sent', 'no_activity_24h'
  target_segment TEXT NOT NULL DEFAULT 'all', -- 'all', 'new_users', 'active_teams', 'dormant_users', 'custom'
  segment_filter JSONB, -- Custom filtering criteria (e.g., {"days_since_signup": "< 7"})

  -- Scheduling
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  active BOOLEAN DEFAULT true,

  -- Display Settings
  priority INTEGER DEFAULT 50, -- 0-100, higher = shown first if multiple messages match
  max_displays_per_user INTEGER DEFAULT 1, -- How many times can a user see this message
  auto_dismiss_seconds INTEGER DEFAULT 8, -- Auto-dismiss after N seconds

  -- Metadata
  created_by TEXT NOT NULL, -- User ID of admin who created
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_priority CHECK (priority >= 0 AND priority <= 100),
  CONSTRAINT valid_auto_dismiss CHECK (auto_dismiss_seconds >= 3 AND auto_dismiss_seconds <= 60)
);

-- Index for faster message lookup by trigger event
CREATE INDEX IF NOT EXISTS idx_in_app_messages_trigger_event ON in_app_messages(trigger_event);
CREATE INDEX IF NOT EXISTS idx_in_app_messages_active ON in_app_messages(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_in_app_messages_schedule ON in_app_messages(start_date, end_date);

-- Table 2: Message Interactions (User Engagement Tracking)
-- Tracks every time a message is shown, clicked, or dismissed
CREATE TABLE IF NOT EXISTS message_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES in_app_messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,

  -- Interaction Type
  interaction_type TEXT NOT NULL, -- 'shown', 'clicked', 'cta_clicked', 'dismissed'

  -- Context
  trigger_event TEXT NOT NULL, -- What event triggered this display
  viewed_duration_seconds INTEGER, -- How long user viewed before dismissing

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB, -- Additional context (e.g., page URL, workspace ID, etc.)

  CONSTRAINT valid_interaction_type CHECK (interaction_type IN ('shown', 'clicked', 'cta_clicked', 'dismissed'))
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_message_interactions_message_id ON message_interactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_interactions_user_id ON message_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_message_interactions_type ON message_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_message_interactions_created_at ON message_interactions(created_at);

-- Table 3: User Retention Cohorts (For Measuring Message Impact)
-- Tracks user retention to correlate with message engagement
CREATE TABLE IF NOT EXISTS user_retention_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  cohort_date DATE NOT NULL, -- The date the user signed up

  -- Retention Flags
  returned_day_1 BOOLEAN DEFAULT false,
  returned_day_7 BOOLEAN DEFAULT false,
  returned_day_30 BOOLEAN DEFAULT false,

  -- Message Engagement (for correlation)
  total_messages_seen INTEGER DEFAULT 0,
  total_messages_clicked INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, cohort_date)
);

-- Index for cohort analysis
CREATE INDEX IF NOT EXISTS idx_user_retention_cohorts_user_id ON user_retention_cohorts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_retention_cohorts_cohort_date ON user_retention_cohorts(cohort_date);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE in_app_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_retention_cohorts ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can do anything with messages
CREATE POLICY admin_all_in_app_messages ON in_app_messages
  FOR ALL
  USING (true); -- Replace with actual admin check: auth.jwt() ->> 'role' = 'admin'

-- Policy: Users can only read active messages (for display)
CREATE POLICY users_read_active_messages ON in_app_messages
  FOR SELECT
  USING (active = true AND (start_date IS NULL OR start_date <= NOW()) AND (end_date IS NULL OR end_date >= NOW()));

-- Policy: Users can insert their own interactions
CREATE POLICY users_insert_own_interactions ON message_interactions
  FOR INSERT
  WITH CHECK (true); -- In production, add: user_id = auth.uid()

-- Policy: Users can read their own interactions
CREATE POLICY users_read_own_interactions ON message_interactions
  FOR SELECT
  USING (true); -- In production, add: user_id = auth.uid()

-- Policy: Admins can read all interactions (for analytics)
CREATE POLICY admin_read_all_interactions ON message_interactions
  FOR SELECT
  USING (true); -- Replace with actual admin check

-- Policy: Users can read/update their own retention data
CREATE POLICY users_access_own_retention ON user_retention_cohorts
  FOR ALL
  USING (true); -- In production, add: user_id = auth.uid()

-- =====================================================
-- ANALYTICS FUNCTIONS
-- =====================================================

-- Function 1: Calculate message metrics
CREATE OR REPLACE FUNCTION get_message_metrics(message_uuid UUID)
RETURNS TABLE (
  total_shown BIGINT,
  total_clicked BIGINT,
  total_cta_clicked BIGINT,
  total_dismissed BIGINT,
  open_rate NUMERIC,
  click_rate NUMERIC,
  cta_conversion_rate NUMERIC,
  avg_view_duration NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE interaction_type = 'shown') AS total_shown,
    COUNT(*) FILTER (WHERE interaction_type = 'clicked') AS total_clicked,
    COUNT(*) FILTER (WHERE interaction_type = 'cta_clicked') AS total_cta_clicked,
    COUNT(*) FILTER (WHERE interaction_type = 'dismissed') AS total_dismissed,

    -- Open rate = (clicked OR cta_clicked) / shown
    CASE
      WHEN COUNT(*) FILTER (WHERE interaction_type = 'shown') > 0 THEN
        ROUND(
          (COUNT(DISTINCT user_id) FILTER (WHERE interaction_type IN ('clicked', 'cta_clicked'))::NUMERIC /
          COUNT(DISTINCT user_id) FILTER (WHERE interaction_type = 'shown')::NUMERIC) * 100,
          2
        )
      ELSE 0
    END AS open_rate,

    -- Click rate = clicked / shown
    CASE
      WHEN COUNT(*) FILTER (WHERE interaction_type = 'shown') > 0 THEN
        ROUND(
          (COUNT(*) FILTER (WHERE interaction_type = 'clicked')::NUMERIC /
          COUNT(*) FILTER (WHERE interaction_type = 'shown')::NUMERIC) * 100,
          2
        )
      ELSE 0
    END AS click_rate,

    -- CTA conversion = cta_clicked / shown
    CASE
      WHEN COUNT(*) FILTER (WHERE interaction_type = 'shown') > 0 THEN
        ROUND(
          (COUNT(*) FILTER (WHERE interaction_type = 'cta_clicked')::NUMERIC /
          COUNT(*) FILTER (WHERE interaction_type = 'shown')::NUMERIC) * 100,
          2
        )
      ELSE 0
    END AS cta_conversion_rate,

    -- Average view duration
    ROUND(AVG(viewed_duration_seconds) FILTER (WHERE viewed_duration_seconds IS NOT NULL), 2) AS avg_view_duration
  FROM message_interactions
  WHERE message_id = message_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function 2: Calculate retention impact by message engagement
CREATE OR REPLACE FUNCTION get_retention_by_engagement()
RETURNS TABLE (
  engagement_level TEXT,
  total_users BIGINT,
  day_1_retention_rate NUMERIC,
  day_7_retention_rate NUMERIC,
  day_30_retention_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN total_messages_clicked >= 3 THEN 'High Engagement'
      WHEN total_messages_clicked >= 1 THEN 'Medium Engagement'
      ELSE 'No Engagement'
    END AS engagement_level,
    COUNT(*) AS total_users,
    ROUND((COUNT(*) FILTER (WHERE returned_day_1 = true)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2) AS day_1_retention_rate,
    ROUND((COUNT(*) FILTER (WHERE returned_day_7 = true)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2) AS day_7_retention_rate,
    ROUND((COUNT(*) FILTER (WHERE returned_day_30 = true)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2) AS day_30_retention_rate
  FROM user_retention_cohorts
  GROUP BY engagement_level
  ORDER BY
    CASE engagement_level
      WHEN 'High Engagement' THEN 1
      WHEN 'Medium Engagement' THEN 2
      ELSE 3
    END;
END;
$$ LANGUAGE plpgsql;

-- Function 3: Calculate retention by message exposure (matches messageService.ts expectations)
CREATE OR REPLACE FUNCTION get_retention_by_message_exposure()
RETURNS TABLE (
  exposed_to_messages BOOLEAN,
  user_count BIGINT,
  day_1_retention NUMERIC,
  day_7_retention NUMERIC,
  day_30_retention NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (total_messages_seen > 0) AS exposed_to_messages,
    COUNT(*) AS user_count,
    ROUND((COUNT(*) FILTER (WHERE returned_day_1 = true)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2) AS day_1_retention,
    ROUND((COUNT(*) FILTER (WHERE returned_day_7 = true)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2) AS day_7_retention,
    ROUND((COUNT(*) FILTER (WHERE returned_day_30 = true)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2) AS day_30_retention
  FROM user_retention_cohorts
  GROUP BY exposed_to_messages
  ORDER BY exposed_to_messages DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER: Auto-update timestamp on in_app_messages
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_in_app_messages_updated_at
  BEFORE UPDATE ON in_app_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SEED DATA: Sample Messages for Testing
-- =====================================================

-- Message 1: Welcome new users
INSERT INTO in_app_messages (title, body, cta_text, cta_url, trigger_event, target_segment, priority, created_by)
VALUES (
  'Welcome to Pulse!',
  'Get started by sending your first message or creating a workspace.',
  'Send Message',
  '/messages',
  'user_signup',
  'new_users',
  90,
  'system'
) ON CONFLICT DO NOTHING;

-- Message 2: Encourage first message
INSERT INTO in_app_messages (title, body, cta_text, cta_url, trigger_event, target_segment, priority, max_displays_per_user, created_by)
VALUES (
  'Great! You sent your first message',
  'Invite 2 teammates to get the most from this workspace.',
  'Invite Team',
  '/settings',
  'first_message_sent',
  'new_users',
  80,
  1,
  'system'
) ON CONFLICT DO NOTHING;

-- Message 3: Re-engage dormant users
INSERT INTO in_app_messages (title, body, cta_text, cta_url, trigger_event, target_segment, priority, created_by)
VALUES (
  'We missed you!',
  'Check out what your team has been up to.',
  'View Updates',
  '/dashboard',
  'no_activity_24h',
  'dormant_users',
  70,
  'system'
) ON CONFLICT DO NOTHING;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Verify tables were created
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename IN ('in_app_messages', 'message_interactions', 'user_retention_cohorts');

-- Verify indexes were created
SELECT indexname, tablename
FROM pg_indexes
WHERE tablename IN ('in_app_messages', 'message_interactions', 'user_retention_cohorts');
