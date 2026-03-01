-- Migration: 20260228000007_search_indexes_emails.sql
-- PURPOSE: Add TSVECTOR + GIN index to emails.
--          Uses GENERATED ALWAYS AS STORED — no trigger or backfill UPDATE needed,
--          so the pre-existing update_updated_at_column() trigger is never invoked.
--          Body is capped at 64KB (left(..., 65536)) to cap index entry size.
-- RELATES TO: SEARCH-AUDIT-2026-02-27 Phase 2, Rank 1 CRITICAL bottleneck

BEGIN;

ALTER TABLE emails
  ADD COLUMN IF NOT EXISTS search_vector TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('english',
      COALESCE(subject, '') || ' ' ||
      COALESCE(from_address, '') || ' ' ||
      COALESCE(snippet, '') || ' ' ||
      left(COALESCE(body, ''), 65536)
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_emails_search
  ON emails USING GIN(search_vector);

COMMIT;
