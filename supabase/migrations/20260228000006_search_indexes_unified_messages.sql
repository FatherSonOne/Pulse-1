-- Migration: 20260228000006_search_indexes_unified_messages.sql
-- PURPOSE: Add TSVECTOR + GIN index to unified_messages.
--          Uses GENERATED ALWAYS AS STORED — no trigger or backfill UPDATE needed,
--          so the pre-existing update_updated_at_column() trigger is never invoked.
-- NOTE: The table already has a plain-text 'searchable_content' generated column.
--       We add 'search_vector' as a TSVECTOR computed from the same base columns.
-- RELATES TO: SEARCH-AUDIT-2026-02-27 Phase 2, Rank 2 CRITICAL bottleneck

BEGIN;

ALTER TABLE unified_messages
  ADD COLUMN IF NOT EXISTS search_vector TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('english',
      COALESCE(content, '') || ' ' ||
      COALESCE(sender_name, '') || ' ' ||
      COALESCE(channel_name, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_unified_messages_search
  ON unified_messages USING GIN(search_vector);

COMMIT;
