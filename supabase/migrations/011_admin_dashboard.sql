-- Admin Dashboard Database Schema
-- Tables for admin user management, settings, activity logs, and in-app messages

-- ============================================
-- ADMIN SETTINGS TABLE
-- Global admin settings for the application
-- ============================================
CREATE TABLE IF NOT EXISTS admin_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  allow_new_registrations BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  maintenance_mode BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ADMIN ACTIVITY LOGS TABLE
-- Track admin actions for audit purposes
-- ============================================
CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT,
  target_id UUID,
  target_name TEXT,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for activity log queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON admin_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor ON admin_activity_logs(actor_id);

-- ============================================
-- IN-APP MESSAGES TABLE
-- Messages that can be shown to users based on events/segments
-- ============================================
CREATE TABLE IF NOT EXISTS in_app_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  cta_text TEXT,
  cta_url TEXT,
  trigger_event TEXT NOT NULL,
  target_segment TEXT NOT NULL DEFAULT 'all',
  segment_filter JSONB,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  max_displays_per_user INTEGER DEFAULT 1,
  auto_dismiss_seconds INTEGER DEFAULT 8,
  position TEXT DEFAULT 'bottom-right',
  style_type TEXT DEFAULT 'info',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for message queries
CREATE INDEX IF NOT EXISTS idx_messages_active ON in_app_messages(active, priority DESC);
CREATE INDEX IF NOT EXISTS idx_messages_trigger ON in_app_messages(trigger_event);
CREATE INDEX IF NOT EXISTS idx_messages_dates ON in_app_messages(start_date, end_date);

-- ============================================
-- MESSAGE INTERACTIONS TABLE
-- Track user interactions with in-app messages
-- ============================================
CREATE TABLE IF NOT EXISTS message_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES in_app_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  shown_at TIMESTAMPTZ NOT NULL,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  triggered_by TEXT,
  user_segment TEXT,
  session_id TEXT,
  page_url TEXT,
  device_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for interaction queries
CREATE INDEX IF NOT EXISTS idx_interactions_message ON message_interactions(message_id);
CREATE INDEX IF NOT EXISTS idx_interactions_user ON message_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_interactions_shown ON message_interactions(shown_at DESC);

-- ============================================
-- USER RETENTION COHORTS TABLE
-- Track user retention for analytics
-- ============================================
CREATE TABLE IF NOT EXISTS user_retention_cohorts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  cohort_date DATE NOT NULL,
  returned_day_1 BOOLEAN DEFAULT false,
  returned_day_7 BOOLEAN DEFAULT false,
  returned_day_30 BOOLEAN DEFAULT false,
  messages_seen_count INTEGER DEFAULT 0,
  messages_clicked_count INTEGER DEFAULT 0,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for cohort queries
CREATE INDEX IF NOT EXISTS idx_cohorts_user ON user_retention_cohorts(user_id);
CREATE INDEX IF NOT EXISTS idx_cohorts_date ON user_retention_cohorts(cohort_date);

-- ============================================
-- ADD ADMIN COLUMNS TO USER_PROFILES
-- ============================================
DO $$
BEGIN
  -- Add role column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'user_profiles' AND column_name = 'role') THEN
    ALTER TABLE user_profiles ADD COLUMN role TEXT DEFAULT 'user';
  END IF;

  -- Add status column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'user_profiles' AND column_name = 'status') THEN
    ALTER TABLE user_profiles ADD COLUMN status TEXT DEFAULT 'active';
  END IF;

  -- Add messages_count column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'user_profiles' AND column_name = 'messages_count') THEN
    ALTER TABLE user_profiles ADD COLUMN messages_count INTEGER DEFAULT 0;
  END IF;

  -- Add groups_count column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'user_profiles' AND column_name = 'groups_count') THEN
    ALTER TABLE user_profiles ADD COLUMN groups_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to get message metrics
CREATE OR REPLACE FUNCTION get_message_metrics(message_uuid UUID)
RETURNS TABLE (
  total_shown BIGINT,
  total_opened BIGINT,
  total_clicked BIGINT,
  total_dismissed BIGINT,
  open_rate NUMERIC,
  click_rate NUMERIC,
  avg_time_to_action INTERVAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_shown,
    COUNT(opened_at)::BIGINT AS total_opened,
    COUNT(clicked_at)::BIGINT AS total_clicked,
    COUNT(dismissed_at)::BIGINT AS total_dismissed,
    CASE
      WHEN COUNT(*) > 0 THEN ROUND((COUNT(opened_at)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
      ELSE 0
    END AS open_rate,
    CASE
      WHEN COUNT(*) > 0 THEN ROUND((COUNT(clicked_at)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
      ELSE 0
    END AS click_rate,
    AVG(COALESCE(clicked_at, dismissed_at) - shown_at) AS avg_time_to_action
  FROM message_interactions
  WHERE message_id = message_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to get retention by message exposure
CREATE OR REPLACE FUNCTION get_retention_by_message_exposure()
RETURNS TABLE (
  exposed_to_messages BOOLEAN,
  day_1_retention NUMERIC,
  day_7_retention NUMERIC,
  day_30_retention NUMERIC,
  user_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (urc.messages_seen_count > 0) AS exposed_to_messages,
    ROUND((SUM(CASE WHEN urc.returned_day_1 THEN 1 ELSE 0 END)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2) AS day_1_retention,
    ROUND((SUM(CASE WHEN urc.returned_day_7 THEN 1 ELSE 0 END)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2) AS day_7_retention,
    ROUND((SUM(CASE WHEN urc.returned_day_30 THEN 1 ELSE 0 END)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2) AS day_30_retention,
    COUNT(*)::BIGINT AS user_count
  FROM user_retention_cohorts urc
  GROUP BY (urc.messages_seen_count > 0);
END;
$$ LANGUAGE plpgsql;

-- Function to increment messages seen count
CREATE OR REPLACE FUNCTION increment_messages_seen(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE user_retention_cohorts
  SET messages_seen_count = messages_seen_count + 1,
      last_seen_at = NOW()
  WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to increment messages clicked count
CREATE OR REPLACE FUNCTION increment_messages_clicked(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE user_retention_cohorts
  SET messages_clicked_count = messages_clicked_count + 1,
      last_seen_at = NOW()
  WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all admin tables
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE in_app_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_retention_cohorts ENABLE ROW LEVEL SECURITY;

-- Admin settings: Only admins can access
CREATE POLICY admin_settings_policy ON admin_settings
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- Activity logs: Admins can read all, others can read their own
CREATE POLICY activity_logs_read_policy ON admin_activity_logs
FOR SELECT USING (
  actor_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role IN ('admin', 'moderator')
  )
);

CREATE POLICY activity_logs_insert_policy ON admin_activity_logs
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);

-- In-app messages: Admins can manage, all users can read active messages
CREATE POLICY messages_read_policy ON in_app_messages
FOR SELECT USING (
  active = true OR
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

CREATE POLICY messages_write_policy ON in_app_messages
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- Message interactions: Users can only access their own
CREATE POLICY interactions_policy ON message_interactions
FOR ALL USING (user_id = auth.uid());

-- Retention cohorts: Users can only access their own
CREATE POLICY cohorts_policy ON user_retention_cohorts
FOR ALL USING (user_id = auth.uid());

-- ============================================
-- TRIGGERS
-- ============================================

-- Update timestamps trigger for admin_settings
CREATE TRIGGER update_admin_settings_updated_at
BEFORE UPDATE ON admin_settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update timestamps trigger for in_app_messages
CREATE TRIGGER update_in_app_messages_updated_at
BEFORE UPDATE ON in_app_messages
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
