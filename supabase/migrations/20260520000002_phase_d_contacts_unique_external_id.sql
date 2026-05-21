-- ============================================================
-- MIGRATION: 20260520000002_phase_d_contacts_unique_external_id.sql
-- PURPOSE:   Add the unique index that
--            importSelectedContacts() and importSelectedLabels()
--            rely on for their ON CONFLICT (user_id, platform,
--            external_id) upserts. Without this, every import
--            attempt fails with PG 42P10 "there is no unique or
--            exclusion constraint matching the ON CONFLICT
--            specification".
--
-- INDEX ADDED on public.contacts:
--   (user_id, platform, external_id)  UNIQUE
--
-- DESIGN HISTORY:
--   v1 tried a PARTIAL unique index (WHERE platform IS NOT NULL
--   AND external_id IS NOT NULL AND external_id <> '') to skip
--   legacy seed rows without a backfill. Postgres allows partial
--   indexes for ON CONFLICT inference only when the upsert
--   includes the matching WHERE clause -- supabase-js's
--   .upsert({ onConflict: '...' }) does not, so the partial
--   index produced the same 42P10 at runtime. Reverted.
--
--   v2 (this file) backfills the legacy rows so a FULL unique
--   index is buildable. Backfills are non-destructive: empty
--   external_id values are replaced with the row's UUID
--   (id::text), and NULL platforms are tagged 'legacy'. The
--   underlying contact data is preserved verbatim; only the
--   import-idempotency key changes.
--
-- DATE:      2026-05-20
-- SAFE:      UPDATEs on a small table, then CREATE UNIQUE INDEX.
--            Brief AccessShare lock; no rewrite.
-- ROLLBACK:
--   DROP INDEX IF EXISTS public.contacts_user_platform_external_uniq;
--   (backfilled values stay -- safer than re-zeroing)
-- ============================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Backfill: legacy seed rows with empty external_id get their UUID
-- as external_id so the (user_id, platform, external_id) triple is
-- unique per row. Non-destructive; preserves all contact data.
UPDATE public.contacts
SET external_id = id::text
WHERE external_id IS NULL OR external_id = '';

-- Backfill NULL platforms (legacy rows pre-dating the platform
-- contract). The importer always sets a non-NULL platform, so this
-- only touches manually-added rows.
UPDATE public.contacts
SET platform = 'legacy'
WHERE platform IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS contacts_user_platform_external_uniq
  ON public.contacts (user_id, platform, external_id);

COMMENT ON INDEX public.contacts_user_platform_external_uniq IS
  'Idempotency key for contact imports. Targets the ON CONFLICT '
  'clause in googleContactsService.importSelectedContacts() and '
  'importSelectedLabels(). Full (not partial) index so supabase-js '
  'ON CONFLICT inference works without an explicit WHERE in the '
  'upsert call. Legacy rows are backfilled in the same migration.';

COMMIT;
