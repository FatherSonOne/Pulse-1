-- ================================================
-- Data Export and Privacy Management
-- ================================================
-- Created: 2026-02-06
-- Phase: Privacy Dashboard - Data Export & Deletion
-- ================================================

-- ==================== Data Exports Table ====================
-- Tracks user data export requests and download history
CREATE TABLE IF NOT EXISTS data_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  export_type TEXT NOT NULL CHECK (export_type IN (
    'full_export',
    'emails_only',
    'contacts_only',
    'calendar_only',
    'settings_only',
    'messages_only'
  )),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'processing',
    'completed',
    'failed',
    'expired'
  )),
  file_size_bytes BIGINT,
  file_url TEXT,
  storage_path TEXT, -- Path in Supabase Storage
  expires_at TIMESTAMPTZ NOT NULL, -- Auto-delete after 30 days
  downloaded_at TIMESTAMPTZ,
  download_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional export metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_data_exports_user_id ON data_exports(user_id);
CREATE INDEX IF NOT EXISTS idx_data_exports_status ON data_exports(status);
CREATE INDEX IF NOT EXISTS idx_data_exports_created_at ON data_exports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_exports_expires_at ON data_exports(expires_at);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_data_exports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER data_exports_updated_at
  BEFORE UPDATE ON data_exports
  FOR EACH ROW
  EXECUTE FUNCTION update_data_exports_updated_at();

-- Enable Row Level Security
ALTER TABLE data_exports ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can only see their own exports
CREATE POLICY "Users can view their own exports"
  ON data_exports
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own exports"
  ON data_exports
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own exports"
  ON data_exports
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own exports"
  ON data_exports
  FOR DELETE
  USING (auth.uid() = user_id);

-- Comments for documentation
COMMENT ON TABLE data_exports IS 'Tracks user data export requests and download history';
COMMENT ON COLUMN data_exports.export_type IS 'Type of data export (full, emails, contacts, etc.)';
COMMENT ON COLUMN data_exports.status IS 'Export status (pending, processing, completed, failed, expired)';
COMMENT ON COLUMN data_exports.file_size_bytes IS 'Size of export file in bytes';
COMMENT ON COLUMN data_exports.file_url IS 'Signed URL for downloading export (temporary)';
COMMENT ON COLUMN data_exports.storage_path IS 'Path to file in Supabase Storage';
COMMENT ON COLUMN data_exports.expires_at IS 'Expiration date (auto-delete after 30 days)';
COMMENT ON COLUMN data_exports.download_count IS 'Number of times export was downloaded';

-- ==================== Data Deletion Requests Table ====================
-- Tracks user data deletion requests and confirmation workflow
CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  deletion_type TEXT NOT NULL CHECK (deletion_type IN (
    'full_account',
    'activity_logs',
    'messages',
    'emails',
    'contacts',
    'calendar'
  )),
  status TEXT NOT NULL DEFAULT 'pending_confirmation' CHECK (status IN (
    'pending_confirmation',
    'confirmed',
    'processing',
    'completed',
    'cancelled',
    'failed'
  )),
  confirmation_token UUID DEFAULT gen_random_uuid(),
  confirmation_sent_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  items_deleted_count INTEGER DEFAULT 0,
  error_message TEXT,
  ip_address INET, -- Track IP for security audit
  user_agent TEXT, -- Track user agent for security audit
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_user_id ON data_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_status ON data_deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_confirmation_token ON data_deletion_requests(confirmation_token);
CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_created_at ON data_deletion_requests(created_at DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_data_deletion_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER data_deletion_requests_updated_at
  BEFORE UPDATE ON data_deletion_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_data_deletion_requests_updated_at();

-- Enable Row Level Security
ALTER TABLE data_deletion_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can only see their own deletion requests
CREATE POLICY "Users can view their own deletion requests"
  ON data_deletion_requests
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own deletion requests"
  ON data_deletion_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own deletion requests"
  ON data_deletion_requests
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Comments for documentation
COMMENT ON TABLE data_deletion_requests IS 'Tracks user data deletion requests with confirmation workflow';
COMMENT ON COLUMN data_deletion_requests.deletion_type IS 'Type of data to delete (full_account, activity_logs, etc.)';
COMMENT ON COLUMN data_deletion_requests.status IS 'Deletion request status with confirmation workflow';
COMMENT ON COLUMN data_deletion_requests.confirmation_token IS 'Unique token for email confirmation';
COMMENT ON COLUMN data_deletion_requests.items_deleted_count IS 'Number of items deleted (for tracking)';

-- ==================== Activity Logs Table ====================
-- Tracks all user activity for privacy audit trail
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'login',
    'logout',
    'data_export',
    'data_deletion',
    'settings_change',
    'email_sent',
    'email_read',
    'contact_created',
    'contact_updated',
    'calendar_event_created',
    'calendar_event_updated',
    'oauth_connected',
    'oauth_disconnected'
  )),
  action_detail TEXT,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type ON activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can only see their own activity logs
CREATE POLICY "Users can view their own activity logs"
  ON activity_logs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity logs"
  ON activity_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Comments for documentation
COMMENT ON TABLE activity_logs IS 'Tracks all user activity for privacy audit trail';
COMMENT ON COLUMN activity_logs.action_type IS 'Type of action performed (login, data_export, etc.)';
COMMENT ON COLUMN activity_logs.ip_address IS 'IP address from which action was performed';
COMMENT ON COLUMN activity_logs.user_agent IS 'User agent string for device tracking';

-- ==================== Cleanup Functions ====================

-- Function to clean up expired data exports
CREATE OR REPLACE FUNCTION cleanup_expired_exports()
RETURNS void AS $$
BEGIN
  -- Mark exports as expired
  UPDATE data_exports
  SET status = 'expired'
  WHERE expires_at < NOW()
    AND status NOT IN ('expired', 'failed');

  -- Log cleanup
  RAISE NOTICE 'Cleaned up expired data exports';
END;
$$ LANGUAGE plpgsql;

-- Function to auto-delete old activity logs (GDPR compliance)
CREATE OR REPLACE FUNCTION cleanup_old_activity_logs(retention_days INTEGER DEFAULT 90)
RETURNS void AS $$
BEGIN
  DELETE FROM activity_logs
  WHERE created_at < NOW() - (retention_days || ' days')::interval;

  RAISE NOTICE 'Cleaned up activity logs older than % days', retention_days;
END;
$$ LANGUAGE plpgsql;

-- ==================== Storage Bucket for Exports ====================
-- Note: This creates a storage bucket for data exports
-- Run this manually in Supabase Dashboard > Storage or via supabase CLI

-- Insert storage bucket (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('data-exports', 'data-exports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for data exports bucket
-- Users can only upload/download/delete their own exports
CREATE POLICY "Users can upload their own exports"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'data-exports'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can download their own exports"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'data-exports'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own exports"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'data-exports'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ==================== Verification Queries ====================

-- Verify tables created
SELECT
  'Tables' as check_type,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('data_exports', 'data_deletion_requests', 'activity_logs')
ORDER BY tablename;

-- Verify RLS policies
SELECT
  'RLS Policies' as check_type,
  tablename,
  policyname,
  cmd as command
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('data_exports', 'data_deletion_requests', 'activity_logs')
ORDER BY tablename, policyname;

-- Verify storage bucket
SELECT
  'Storage Bucket' as check_type,
  id,
  name,
  public
FROM storage.buckets
WHERE id = 'data-exports';
