-- ============================================
-- ADMIN RLS POLICIES
-- Secures admin tables with role-based access
-- ============================================

-- Ensure admin tables exist (idempotent)
CREATE TABLE IF NOT EXISTS admin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  allow_new_registrations BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  maintenance_mode BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT,
  target_id UUID,
  target_name TEXT,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON admin_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor ON admin_activity_logs(actor_id);

-- Ensure user_profiles has role and status columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'user_profiles' AND column_name = 'role') THEN
    ALTER TABLE user_profiles ADD COLUMN role TEXT DEFAULT 'user';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'user_profiles' AND column_name = 'status') THEN
    ALTER TABLE user_profiles ADD COLUMN status TEXT DEFAULT 'active';
  END IF;
END $$;

-- Enable RLS
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activity_logs ENABLE ROW LEVEL SECURITY;

-- Admin settings: only admins can access
DROP POLICY IF EXISTS admin_settings_policy ON admin_settings;
CREATE POLICY admin_settings_policy ON admin_settings
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- Activity logs: admins/moderators read all, others read own
DROP POLICY IF EXISTS activity_logs_read_policy ON admin_activity_logs;
CREATE POLICY activity_logs_read_policy ON admin_activity_logs
FOR SELECT USING (
  actor_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role IN ('admin', 'moderator')
  )
);

-- Activity logs: any authenticated user can insert (for audit trail)
DROP POLICY IF EXISTS activity_logs_insert_policy ON admin_activity_logs;
CREATE POLICY activity_logs_insert_policy ON admin_activity_logs
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);

-- Protect user_profiles role/status updates: only admins or self
DROP POLICY IF EXISTS user_profiles_admin_update ON user_profiles;
CREATE POLICY user_profiles_admin_update ON user_profiles
FOR UPDATE USING (
  auth.uid() = id OR
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
);
