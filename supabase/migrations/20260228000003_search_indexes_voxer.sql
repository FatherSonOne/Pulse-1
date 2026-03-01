-- Migration: 20260228000003_search_indexes_voxer.sql
-- PURPOSE: Add TSVECTOR full-text search + GIN index to voxer_recordings.
--          Indexes title, transcript, and contact_name (all three on this table).
-- RELATES TO: SEARCH-AUDIT-2026-02-27 Phase 2, Rank 5 bottleneck

BEGIN;

ALTER TABLE voxer_recordings
  ADD COLUMN IF NOT EXISTS search_vector TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(title, '') || ' ' ||
      coalesce(transcript, '') || ' ' ||
      coalesce(contact_name, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_voxer_recordings_search
  ON voxer_recordings USING GIN(search_vector);

COMMIT;
