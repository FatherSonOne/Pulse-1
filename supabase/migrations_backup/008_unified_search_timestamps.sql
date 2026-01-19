-- ============================================
-- UNIFIED SEARCH - TIMESTAMP ENHANCEMENTS
-- Ensure all tables have proper timestamps and indexes for unified search
-- ============================================

-- Ensure all message-related tables have timestamps
-- Most already have them, but we'll add indexes and ensure consistency

-- Add timestamp index to voxer_recordings if not exists (already has recorded_at)
CREATE INDEX IF NOT EXISTS idx_voxer_recordings_timestamp ON voxer_recordings(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_voxer_recordings_user_timestamp ON voxer_recordings(user_id, recorded_at DESC);

-- Ensure emails has proper timestamp index
CREATE INDEX IF NOT EXISTS idx_emails_user_date ON emails(user_id, date DESC);

-- Ensure sms_messages has proper timestamp index
CREATE INDEX IF NOT EXISTS idx_sms_messages_user_timestamp ON sms_messages(conversation_id, timestamp DESC);

-- Ensure tasks has proper timestamp indexes
CREATE INDEX IF NOT EXISTS idx_tasks_user_created ON tasks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_user_due_date ON tasks(user_id, due_date DESC NULLS LAST);

-- Ensure calendar_events has proper timestamp index
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_start ON calendar_events(user_id, start_time DESC);

-- Ensure threads has proper timestamp index
CREATE INDEX IF NOT EXISTS idx_threads_user_updated ON threads(user_id, updated_at DESC);

-- Ensure contacts has proper timestamp index
CREATE INDEX IF NOT EXISTS idx_contacts_user_updated ON contacts(user_id, updated_at DESC);

-- Add full-text search indexes for better search performance
-- Note: These require pg_trgm extension for trigram matching

-- Enable pg_trgm extension for better text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN indexes for full-text search on key text fields
CREATE INDEX IF NOT EXISTS idx_unified_messages_content_gin ON unified_messages USING gin(content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_unified_messages_sender_gin ON unified_messages USING gin(sender_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_emails_subject_gin ON emails USING gin(subject gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_emails_body_gin ON emails USING gin(body gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_messages_text_gin ON messages USING gin(text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_voxer_transcript_gin ON voxer_recordings USING gin(transcript gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_tasks_title_gin ON tasks USING gin(title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contacts_name_gin ON contacts USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_email_gin ON contacts USING gin(email gin_trgm_ops);

-- Add searchable content column to unified_messages if not exists
-- This helps with better search ranking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'unified_messages' AND column_name = 'searchable_content'
  ) THEN
    ALTER TABLE unified_messages ADD COLUMN searchable_content TEXT GENERATED ALWAYS AS (
      COALESCE(content, '') || ' ' || 
      COALESCE(sender_name, '') || ' ' || 
      COALESCE(channel_name, '')
    ) STORED;
    
    CREATE INDEX idx_unified_messages_searchable_gin ON unified_messages USING gin(searchable_content gin_trgm_ops);
  END IF;
END $$;

-- Create a view for unified search results (optional, for complex queries)
CREATE OR REPLACE VIEW unified_search_view AS
SELECT 
  'unified_message'::text AS result_type,
  id::text,
  user_id,
  COALESCE(channel_name, sender_name, source) AS title,
  content,
  timestamp AS result_timestamp,
  source,
  sender_name AS sender,
  sender_email,
  '{}'::jsonb AS metadata
FROM unified_messages
WHERE user_id IS NOT NULL

UNION ALL

SELECT 
  'email'::text AS result_type,
  id::text,
  user_id,
  subject AS title,
  COALESCE(body, snippet, '') AS content,
  date AS result_timestamp,
  'email'::text AS source,
  from_address AS sender,
  from_address AS sender_email,
  jsonb_build_object(
    'folder', folder,
    'labels', labels,
    'thread_id', thread_id
  ) AS metadata
FROM emails
WHERE user_id IS NOT NULL

UNION ALL

SELECT 
  'vox'::text AS result_type,
  id::text,
  user_id,
  COALESCE(title, 'Vox: ' || contact_name) AS title,
  COALESCE(transcript, '') AS content,
  recorded_at AS result_timestamp,
  'voxer'::text AS source,
  contact_name AS sender,
  NULL::text AS sender_email,
  jsonb_build_object(
    'duration', duration,
    'is_outgoing', is_outgoing,
    'contact_id', contact_id
  ) AS metadata
FROM voxer_recordings
WHERE user_id IS NOT NULL

UNION ALL

SELECT 
  'task'::text AS result_type,
  id::text,
  user_id,
  title,
  '' AS content,
  created_at AS result_timestamp,
  'pulse'::text AS source,
  NULL::text AS sender,
  NULL::text AS sender_email,
  jsonb_build_object(
    'completed', completed,
    'due_date', due_date,
    'priority', priority
  ) AS metadata
FROM tasks
WHERE user_id IS NOT NULL;

-- Create index on the view columns (if supported by your PostgreSQL version)
-- Note: Materialized views might be better for performance

COMMENT ON VIEW unified_search_view IS 'Unified view of all searchable content for Pulse search functionality';