-- Session Management Custom Table
-- This migration creates a custom user_sessions table for advanced multi-device session tracking
-- Run this migration if you want to track sessions across multiple devices beyond what Supabase Auth provides

-- ============================================
-- Drop existing tables if they exist (for clean reinstall)
-- ============================================

DROP TABLE IF EXISTS user_sessions CASCADE;

-- ============================================
-- Create user_sessions table
-- ============================================

CREATE TABLE user_sessions (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User reference (foreign key to auth.users)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Session identification
  access_token_prefix VARCHAR(16) NOT NULL,  -- First 16 chars of access token (for identification)
  refresh_token_prefix VARCHAR(16),          -- First 16 chars of refresh token
  session_hash VARCHAR(64),                  -- SHA-256 hash of full session token (for verification)

  -- Device information
  device_name VARCHAR(255),                  -- e.g., "Windows PC", "iPhone 15 Pro"
  device_type VARCHAR(50),                   -- e.g., "desktop", "mobile", "tablet"
  browser_name VARCHAR(255),                 -- e.g., "Chrome 131", "Safari"
  os_name VARCHAR(100),                      -- e.g., "Windows 11", "iOS 17"
  user_agent TEXT,                           -- Full user agent string

  -- Location information
  ip_address INET,                           -- IPv4 or IPv6 address
  location VARCHAR(255),                     -- e.g., "New York, United States"
  city VARCHAR(100),
  country VARCHAR(100),
  country_code VARCHAR(2),
  timezone VARCHAR(100),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),

  -- Session metadata
  is_active BOOLEAN DEFAULT true,            -- Whether session is currently active
  is_current BOOLEAN DEFAULT false,          -- Whether this is the current session

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,

  -- Revocation metadata
  revoked_by_user_id UUID REFERENCES auth.users(id),
  revocation_reason VARCHAR(255),

  -- Security metadata
  trusted BOOLEAN DEFAULT false,             -- Whether this is a trusted device
  mfa_verified BOOLEAN DEFAULT false,        -- Whether MFA was verified for this session

  -- Custom metadata (JSONB for flexible data)
  metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================
-- Create indexes for performance
-- ============================================

-- Index for user queries (most common)
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);

-- Index for active sessions
CREATE INDEX idx_user_sessions_active ON user_sessions(user_id, is_active) WHERE is_active = true;

-- Index for current session lookup
CREATE INDEX idx_user_sessions_current ON user_sessions(user_id, is_current) WHERE is_current = true;

-- Index for session token lookup
CREATE INDEX idx_user_sessions_token_prefix ON user_sessions(access_token_prefix);

-- Index for session expiration cleanup
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at) WHERE is_active = true;

-- Index for IP-based queries
CREATE INDEX idx_user_sessions_ip ON user_sessions(ip_address);

-- Index for location-based queries
CREATE INDEX idx_user_sessions_location ON user_sessions(country_code, city);

-- Index for recent activity
CREATE INDEX idx_user_sessions_last_active ON user_sessions(user_id, last_active_at DESC);

-- ============================================
-- Enable Row Level Security (RLS)
-- ============================================

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Create RLS Policies
-- ============================================

-- Policy: Users can view their own sessions
CREATE POLICY "Users can view own sessions"
  ON user_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own sessions
CREATE POLICY "Users can insert own sessions"
  ON user_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own sessions
CREATE POLICY "Users can update own sessions"
  ON user_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own sessions (revoke)
CREATE POLICY "Users can delete own sessions"
  ON user_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Create helper functions
-- ============================================

-- Function to automatically update last_active_at timestamp
CREATE OR REPLACE FUNCTION update_session_last_active()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_active_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_active_at on any update
CREATE TRIGGER trigger_update_session_last_active
  BEFORE UPDATE ON user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_session_last_active();

-- Function to automatically expire old sessions
CREATE OR REPLACE FUNCTION expire_old_sessions()
RETURNS void AS $$
BEGIN
  UPDATE user_sessions
  SET is_active = false,
      revoked_at = NOW(),
      revocation_reason = 'Expired'
  WHERE is_active = true
    AND expires_at IS NOT NULL
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to revoke all other sessions for a user
CREATE OR REPLACE FUNCTION revoke_other_sessions(
  p_user_id UUID,
  p_current_session_id UUID
)
RETURNS void AS $$
BEGIN
  UPDATE user_sessions
  SET is_active = false,
      revoked_at = NOW(),
      revocation_reason = 'Revoked by user (sign out all other devices)'
  WHERE user_id = p_user_id
    AND id != p_current_session_id
    AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get active session count for a user
CREATE OR REPLACE FUNCTION get_active_session_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM user_sessions
    WHERE user_id = p_user_id
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark current session
CREATE OR REPLACE FUNCTION mark_current_session(
  p_user_id UUID,
  p_session_id UUID
)
RETURNS void AS $$
BEGIN
  -- Unmark all other sessions as current
  UPDATE user_sessions
  SET is_current = false
  WHERE user_id = p_user_id;

  -- Mark specified session as current
  UPDATE user_sessions
  SET is_current = true
  WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Create automated cleanup job (cron-like)
-- ============================================

-- Note: This requires pg_cron extension
-- Install: CREATE EXTENSION IF NOT EXISTS pg_cron;
-- Schedule job to run daily at 2 AM
-- SELECT cron.schedule('expire-old-sessions', '0 2 * * *', 'SELECT expire_old_sessions();');

-- Alternative: Create a function that can be called manually or via Edge Function
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS TABLE (
  expired_count INTEGER,
  deleted_count INTEGER
) AS $$
DECLARE
  v_expired_count INTEGER;
  v_deleted_count INTEGER;
BEGIN
  -- Expire sessions past their expiration date
  UPDATE user_sessions
  SET is_active = false,
      revoked_at = NOW(),
      revocation_reason = 'Expired'
  WHERE is_active = true
    AND expires_at IS NOT NULL
    AND expires_at < NOW();

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;

  -- Delete sessions older than 90 days (configurable)
  DELETE FROM user_sessions
  WHERE revoked_at IS NOT NULL
    AND revoked_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN QUERY SELECT v_expired_count, v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Create views for common queries
-- ============================================

-- View: Active sessions summary
CREATE OR REPLACE VIEW active_sessions_summary AS
SELECT
  user_id,
  COUNT(*) as active_session_count,
  MAX(last_active_at) as most_recent_activity,
  ARRAY_AGG(DISTINCT device_type ORDER BY device_type) as device_types,
  ARRAY_AGG(DISTINCT country ORDER BY country) as countries
FROM user_sessions
WHERE is_active = true
GROUP BY user_id;

-- View: User's current active sessions
CREATE OR REPLACE VIEW user_active_sessions AS
SELECT
  id,
  user_id,
  device_name,
  device_type,
  browser_name,
  os_name,
  location,
  ip_address,
  is_current,
  created_at,
  last_active_at,
  expires_at,
  trusted,
  mfa_verified
FROM user_sessions
WHERE is_active = true
ORDER BY last_active_at DESC;

-- ============================================
-- Insert sample documentation
-- ============================================

COMMENT ON TABLE user_sessions IS 'Tracks user sessions across multiple devices for enhanced security and session management';
COMMENT ON COLUMN user_sessions.access_token_prefix IS 'First 16 characters of access token for session identification';
COMMENT ON COLUMN user_sessions.session_hash IS 'SHA-256 hash of full session token for verification';
COMMENT ON COLUMN user_sessions.is_active IS 'Whether the session is currently active';
COMMENT ON COLUMN user_sessions.is_current IS 'Whether this is the current/primary session for the user';
COMMENT ON COLUMN user_sessions.trusted IS 'Whether this device has been marked as trusted';
COMMENT ON COLUMN user_sessions.mfa_verified IS 'Whether MFA was verified when creating this session';

-- ============================================
-- Grant permissions
-- ============================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON user_sessions TO authenticated;
GRANT SELECT ON active_sessions_summary TO authenticated;
GRANT SELECT ON user_active_sessions TO authenticated;

-- ============================================
-- Migration complete
-- ============================================

-- Verify table creation
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'user_sessions') THEN
    RAISE NOTICE 'Table user_sessions created successfully';
  ELSE
    RAISE EXCEPTION 'Failed to create user_sessions table';
  END IF;
END $$;

-- Output success message
SELECT 'Session management table created successfully' AS status;
