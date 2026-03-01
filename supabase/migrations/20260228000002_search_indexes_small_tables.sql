-- Migration: 20260228000002_search_indexes_small_tables.sql
-- PURPOSE: Add TSVECTOR full-text search columns + GIN indexes to 5 small tables.
--          Uses GENERATED ALWAYS AS STORED — no trigger needed, auto-maintained.
-- TABLES: tasks, sms_messages, calendar_events, threads, logos_notes
-- RELATES TO: SEARCH-AUDIT-2026-02-27 Phase 2 Performance Bottlenecks

BEGIN;

-- ============================================================
-- tasks
-- ============================================================
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS search_vector TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_tasks_search
  ON tasks USING GIN(search_vector);

-- ============================================================
-- sms_messages  (only 'text' column is on this table;
--                contact_name lives on the joined sms_conversations)
-- ============================================================
ALTER TABLE sms_messages
  ADD COLUMN IF NOT EXISTS search_vector TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(text, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_sms_messages_search
  ON sms_messages USING GIN(search_vector);

-- ============================================================
-- calendar_events
-- ============================================================
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS search_vector TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(title, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(location, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_calendar_events_search
  ON calendar_events USING GIN(search_vector);

-- ============================================================
-- threads
-- ============================================================
ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS search_vector TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(contact_name, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_threads_search
  ON threads USING GIN(search_vector);

-- ============================================================
-- logos_notes
-- ============================================================
ALTER TABLE logos_notes
  ADD COLUMN IF NOT EXISTS search_vector TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(content, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_logos_notes_search
  ON logos_notes USING GIN(search_vector);

COMMIT;
