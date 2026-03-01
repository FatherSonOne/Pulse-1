-- Migration: 20260228000005_search_indexes_contacts.sql
-- PURPOSE: Add TSVECTOR + GIN index to contacts table.
--          Indexes name, email, company, notes for full-text search.
-- RELATES TO: SEARCH-AUDIT-2026-02-27 Phase 2, LOW priority but easy win

BEGIN;

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS search_vector TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(name, '') || ' ' ||
      coalesce(email, '') || ' ' ||
      coalesce(company, '') || ' ' ||
      coalesce(notes, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_contacts_search
  ON contacts USING GIN(search_vector);

COMMIT;
