-- Migration: 20260228000004_search_indexes_archives.sql
-- PURPOSE: Add TSVECTOR + GIN index to archives table.
--          Also adds a separate GIN index on the tags[] array for array containment queries.
--          Content is truncated at 64KB to prevent indexing oversized documents.
-- RELATES TO: SEARCH-AUDIT-2026-02-27 Phase 2, Rank 6 bottleneck

BEGIN;

-- TSVECTOR for title + content (content capped at 64KB)
ALTER TABLE archives
  ADD COLUMN IF NOT EXISTS search_vector TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(title, '') || ' ' ||
      left(coalesce(content, ''), 65536)
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_archives_search
  ON archives USING GIN(search_vector);

-- Separate GIN index for tags[] array containment and overlap queries
-- This enables fast .overlaps('tags', [...]) and .cs('tags', [...]) queries
CREATE INDEX IF NOT EXISTS idx_archives_tags
  ON archives USING GIN(tags);

COMMIT;
