-- 20260307000002_email_segments_unique.sql
-- Prevent duplicate segment names per user (race condition protection on first seed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_segments_user_name
  ON email_segments(user_id, name);
