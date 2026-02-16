-- Migration: PWA Push Subscriptions
-- Created: 2026-02-09
-- Purpose: Store Web Push notification subscriptions for PWA

-- ============================================
-- Push Subscriptions Table
-- ============================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  device_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one subscription per user per endpoint
  CONSTRAINT unique_user_endpoint UNIQUE (user_id, endpoint)
);

-- Indexes for performance
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);
CREATE INDEX idx_push_subscriptions_is_active ON push_subscriptions(is_active);

-- Enable Row Level Security
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see and manage their own subscriptions
CREATE POLICY "Users can view own push subscriptions"
  ON push_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push subscriptions"
  ON push_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push subscriptions"
  ON push_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own push subscriptions"
  ON push_subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- PWA Settings Table
-- ============================================

CREATE TABLE IF NOT EXISTS pwa_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (admin only)
ALTER TABLE pwa_settings ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Admins can manage PWA settings"
  ON pwa_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Insert default VAPID public key placeholder
INSERT INTO pwa_settings (key, value, description)
VALUES (
  'vapid_public_key',
  'REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY',
  'VAPID public key for Web Push notifications'
)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- Functions
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_push_subscription_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
CREATE TRIGGER update_push_subscriptions_timestamp
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_push_subscription_timestamp();

-- Function to cleanup inactive subscriptions (run periodically)
CREATE OR REPLACE FUNCTION cleanup_inactive_push_subscriptions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete subscriptions inactive for 90+ days
  DELETE FROM push_subscriptions
  WHERE is_active = false
    AND updated_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE push_subscriptions IS 'Stores Web Push notification subscriptions for PWA users';
COMMENT ON COLUMN push_subscriptions.endpoint IS 'Push service endpoint URL';
COMMENT ON COLUMN push_subscriptions.p256dh_key IS 'Public key for message encryption';
COMMENT ON COLUMN push_subscriptions.auth_key IS 'Authentication secret';
COMMENT ON COLUMN push_subscriptions.user_agent IS 'Browser/device user agent string';
COMMENT ON COLUMN push_subscriptions.is_active IS 'Whether subscription is currently active';
COMMENT ON COLUMN push_subscriptions.last_used_at IS 'Last time notification was sent to this subscription';

COMMENT ON TABLE pwa_settings IS 'Global PWA configuration settings';

-- ============================================
-- Grant permissions
-- ============================================

-- Grant authenticated users access to their subscriptions
GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions TO authenticated;
-- Note: No sequence grant needed as id uses uuid_generate_v4() function, not a sequence

-- Grant authenticated users read access to settings
GRANT SELECT ON pwa_settings TO authenticated;

-- ============================================
-- Sample queries for testing
-- ============================================

/*
-- View all push subscriptions for current user
SELECT * FROM push_subscriptions
WHERE user_id = auth.uid()
ORDER BY created_at DESC;

-- Count active subscriptions per user
SELECT user_id, COUNT(*) as subscription_count
FROM push_subscriptions
WHERE is_active = true
GROUP BY user_id;

-- Cleanup old inactive subscriptions
SELECT cleanup_inactive_push_subscriptions();

-- Get VAPID public key
SELECT value FROM pwa_settings WHERE key = 'vapid_public_key';
*/
