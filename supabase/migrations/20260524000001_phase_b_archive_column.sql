-- ============================================================
-- MIGRATION: 20260524000001_phase_b_archive_column.sql
-- PURPOSE:   Add soft-archive support for contacts. Phase B Q1.
--            archived_at = NULL      -> active row (default views)
--            archived_at IS NOT NULL -> hidden from default views,
--            recoverable via "View archived" toggle in the UI.
--
-- DESIGN:
--   * Schema-only addition. No data backfill.
--   * Hiding is enforced at the APPLICATION LAYER, not RLS — the UI's
--     "View archived" toggle must remain functional. Adding
--     `archived_at IS NULL` to the contacts RLS USING clause would
--     make archived rows unreachable.
--   * Archived rows still count toward billing quota (provisional;
--     revisit when quota cron job ships).
--
-- DATE:      2026-05-24
-- SAFE:      ADD COLUMN with no DEFAULT and no NOT NULL — no table
--            rewrite on PG13+; metadata-only DDL.
-- ROLLBACK:
--   DROP INDEX  IF EXISTS public.idx_contacts_archived;
--   ALTER TABLE public.contacts DROP COLUMN IF EXISTS archived_at;
-- ============================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_archived
  ON public.contacts (archived_at)
  WHERE archived_at IS NOT NULL;

COMMENT ON COLUMN public.contacts.archived_at IS
  'Soft-archive timestamp. NULL = active (default view). Non-NULL = '
  'hidden from default listings, recoverable via UI toggle. Hiding is '
  'enforced at the application layer (dataService.getContacts adds '
  'WHERE archived_at IS NULL); NOT in RLS so the View Archived toggle '
  'can still SELECT the row. Phase A import_source convention applies — '
  'legacy NULL rows are treated as active. Archived rows DO count toward '
  'workspace billing quota (provisional, Phase B Q1 CHECKPOINT).';

COMMIT;
