-- =====================================================
-- IN-APP MESSAGING SYSTEM - IDEMPOTENT DATABASE MIGRATION
-- Safe to run multiple times - won't create duplicates
-- =====================================================

-- Table 1: In-App Messages (Campaign/Template Definition)
CREATE TABLE IF NOT EXISTS in_app_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  cta_text TEXT,
  cta_url TEXT,
  trigger_event TEXT NOT NULL,
  target_segment TEXT NOT NULL DEFAULT 'all',
  segment_filter JSONB,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 50,
  max_displays_per_user INTEGER DEFAULT 1,
  auto_dismiss_seconds INTEGER DEFAULT 8,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_priority CHECK (priority >= 0 AND priority <= 100),
  CONSTRAINT valid_auto_dismiss CHECK (auto_dismiss_seconds >= 3 AND auto_dismiss_seconds <= 60)
);

-- Indexes for in_app_messages
CREATE INDEX IF NOT EXISTS idx_in_app_messages_trigger_event ON in_app_messages(trigger_event);
CREATE INDEX IF NOT EXISTS idx_in_app_messages_active ON in_app_messages(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_in_app_messages_schedule ON in_app_messages(start_date, end_date);

-- Table 2: Message Interactions
CREATE TABLE IF NOT EXISTS message_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES in_app_messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  interaction_type TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  viewed_duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB,
  CONSTRAINT valid_interaction_type CHECK (interaction_type IN ('shown', 'clicked', 'cta_clicked', 'dismissed'))
);

-- Indexes for message_interactions
CREATE INDEX IF NOT EXISTS idx_message_interactions_message_id ON message_interactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_interactions_user_id ON message_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_message_interactions_type ON message_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_message_interactions_created_at ON message_interactions(created_at);

-- Table 3: User Retention Cohorts
CREATE TABLE IF NOT EXISTS user_retention_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  cohort_date DATE NOT NULL,
  returned_day_1 BOOLEAN DEFAULT false,
  returned_day_7 BOOLEAN DEFAULT false,
  returned_day_30 BOOLEAN DEFAULT false,
  total_messages_seen INTEGER DEFAULT 0,
  total_messages_clicked INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, cohort_date)
);

-- Indexes for user_retention_cohorts
CREATE INDEX IF NOT EXISTS idx_user_retention_cohorts_user_id ON user_retention_cohorts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_retention_cohorts_cohort_date ON user_retention_cohorts(cohort_date);

-- Enable RLS
ALTER TABLE in_app_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_retention_cohorts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to make idempotent)
DROP POLICY IF EXISTS admin_all_in_app_messages ON in_app_messages;
DROP POLICY IF EXISTS users_read_active_messages ON in_app_messages;
DROP POLICY IF EXISTS users_insert_own_interactions ON message_interactions;
DROP POLICY IF EXISTS users_read_own_interactions ON message_interactions;
DROP POLICY IF EXISTS admin_read_all_interactions ON message_interactions;
DROP POLICY IF EXISTS users_access_own_retention ON user_retention_cohorts;

-- Recreate policies
CREATE POLICY admin_all_in_app_messages ON in_app_messages FOR ALL USING (true);
CREATE POLICY users_read_active_messages ON in_app_messages FOR SELECT USING (active = true AND (start_date IS NULL OR start_date <= NOW()) AND (end_date IS NULL OR end_date >= NOW()));
CREATE POLICY users_insert_own_interactions ON message_interactions FOR INSERT WITH CHECK (true);
CREATE POLICY users_read_own_interactions ON message_interactions FOR SELECT USING (true);
CREATE POLICY admin_read_all_interactions ON message_interactions FOR SELECT USING (true);
CREATE POLICY users_access_own_retention ON user_retention_cohorts FOR ALL USING (true);

-- Analytics Function 1: Message Metrics
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
    CASE
      WHEN COUNT(*) FILTER (WHERE interaction_type = 'shown') > 0 THEN
        ROUND((COUNT(DISTINCT user_id) FILTER (WHERE interaction_type IN ('clicked', 'cta_clicked'))::NUMERIC / COUNT(DISTINCT user_id) FILTER (WHERE interaction_type = 'shown')::NUMERIC) * 100, 2)
      ELSE 0
    END AS open_rate,
    CASE
      WHEN COUNT(*) FILTER (WHERE interaction_type = 'shown') > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE interaction_type = 'clicked')::NUMERIC / COUNT(*) FILTER (WHERE interaction_type = 'shown')::NUMERIC) * 100, 2)
      ELSE 0
    END AS click_rate,
    CASE
      WHEN COUNT(*) FILTER (WHERE interaction_type = 'shown') > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE interaction_type = 'cta_clicked')::NUMERIC / COUNT(*) FILTER (WHERE interaction_type = 'shown')::NUMERIC) * 100, 2)
      ELSE 0
    END AS cta_conversion_rate,
    ROUND(AVG(viewed_duration_seconds) FILTER (WHERE viewed_duration_seconds IS NOT NULL), 2) AS avg_view_duration
  FROM message_interactions
  WHERE message_id = message_uuid;
END;
$$ LANGUAGE plpgsql;

-- Analytics Function 2: Retention by Engagement
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
  ORDER BY CASE engagement_level WHEN 'High Engagement' THEN 1 WHEN 'Medium Engagement' THEN 2 ELSE 3 END;
END;
$$ LANGUAGE plpgsql;

-- Auto-update trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_in_app_messages_updated_at ON in_app_messages;
CREATE TRIGGER update_in_app_messages_updated_at
  BEFORE UPDATE ON in_app_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed sample messages (only if table is empty)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM in_app_messages) THEN
    INSERT INTO in_app_messages (title, body, cta_text, cta_url, trigger_event, target_segment, priority, created_by)
    VALUES
      ('Welcome to Pulse!', 'Get started by sending your first message or creating a workspace.', 'Send Message', '/messages', 'user_signup', 'new_users', 90, 'system'),
      ('Great! You sent your first message', 'Invite 2 teammates to get the most from this workspace.', 'Invite Team', '/settings', 'first_message_sent', 'new_users', 80, 'system'),
      ('We missed you!', 'Check out what your team has been up to.', 'View Updates', '/dashboard', 'no_activity_24h', 'dormant_users', 70, 'system');
  END IF;
END $$;

-- Verification
SELECT 'Migration Complete!' as status, COUNT(*) as message_count FROM in_app_messages;
