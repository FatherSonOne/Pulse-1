-- File Uploads and Storage Quotas Migration
-- Creates tables for file upload tracking and user storage quotas

-- File Uploads Table
CREATE TABLE IF NOT EXISTS file_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES threads(id) ON DELETE SET NULL,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  file_category TEXT DEFAULT 'other',
  public_url TEXT,
  thumbnail_url TEXT,
  virus_scan_status TEXT DEFAULT 'pending',
  virus_scan_result JSONB,
  metadata JSONB DEFAULT '{}',
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for file_uploads
CREATE INDEX IF NOT EXISTS idx_file_uploads_user_id ON file_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_thread_id ON file_uploads(thread_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_message_id ON file_uploads(message_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_file_category ON file_uploads(file_category);
CREATE INDEX IF NOT EXISTS idx_file_uploads_uploaded_at ON file_uploads(uploaded_at DESC);

-- Storage Quotas Table
CREATE TABLE IF NOT EXISTS storage_quotas (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_bytes_used BIGINT DEFAULT 0,
  quota_bytes BIGINT DEFAULT 1073741824, -- 1GB default
  file_count INTEGER DEFAULT 0,
  last_calculated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for storage_quotas
CREATE INDEX IF NOT EXISTS idx_storage_quotas_user_id ON storage_quotas(user_id);

-- RLS Policies for file_uploads
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own file uploads"
  ON file_uploads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own file uploads"
  ON file_uploads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own file uploads"
  ON file_uploads FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own file uploads"
  ON file_uploads FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for storage_quotas
ALTER TABLE storage_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own storage quota"
  ON storage_quotas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own storage quota"
  ON storage_quotas FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to update storage quota on file upload
CREATE OR REPLACE FUNCTION update_storage_quota_on_upload()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO storage_quotas (user_id, total_bytes_used, file_count, last_calculated_at)
  VALUES (NEW.user_id, NEW.file_size, 1, now())
  ON CONFLICT (user_id) DO UPDATE SET
    total_bytes_used = storage_quotas.total_bytes_used + NEW.file_size,
    file_count = storage_quotas.file_count + 1,
    last_calculated_at = now(),
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update storage quota on file delete
CREATE OR REPLACE FUNCTION update_storage_quota_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE storage_quotas SET
    total_bytes_used = GREATEST(0, total_bytes_used - OLD.file_size),
    file_count = GREATEST(0, file_count - 1),
    last_calculated_at = now(),
    updated_at = now()
  WHERE user_id = OLD.user_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for automatic quota updates
DROP TRIGGER IF EXISTS trigger_update_quota_on_upload ON file_uploads;
CREATE TRIGGER trigger_update_quota_on_upload
  AFTER INSERT ON file_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_storage_quota_on_upload();

DROP TRIGGER IF EXISTS trigger_update_quota_on_delete ON file_uploads;
CREATE TRIGGER trigger_update_quota_on_delete
  AFTER DELETE ON file_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_storage_quota_on_delete();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON file_uploads TO authenticated;
GRANT SELECT, UPDATE ON storage_quotas TO authenticated;
