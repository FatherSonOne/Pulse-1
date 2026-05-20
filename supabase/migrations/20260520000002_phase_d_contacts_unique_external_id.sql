-- ============================================================
-- MIGRATION: 20260520000002_phase_d_contacts_unique_external_id.sql
-- PURPOSE:   Add the unique index that
--            importSelectedContacts() / importSelectedLabels() rely
--            on for their ON CONFLICT (user_id, platform,
--            external_id) upserts. The constraint was always
--            referenced in code but never materialized in the
--            cloud schema, so every import attempt failed with
--            PG 42P10 ("there is no unique or exclusion
--            constraint matching the ON CONFLICT specification").
--
-- INDEX ADDED on public.contacts:
--   (user_id, platform, external_id)  UNIQUE
--
-- DESIGN:
--   * Unique INDEX (not CONSTRAINT) is sufficient for ON CONFLICT
--     targeting and avoids triggering a table rewrite. Behaves
--     identically for the upsert path.
--   * PARTIAL index: only enforces uniqueness where platform is
--     non-NULL and external_id is non-NULL/non-empty. Pre-flight
--     surfaced 19 legacy rows with platform='unknown' and
--     external_id='' (manually-added rows pre-dating the import
--     contract), which would block a full-table unique index but
--     are not import targets and don't need idempotency
--     enforcement. The importer always sets a non-empty
--     platform+external_id, so its INSERT rows DO match the
--     predicate and ON CONFLICT resolves against this index as
--     expected.
--   * IF NOT EXISTS so re-runs are no-ops.
--
-- DATE:      2026-05-20
-- SAFE:      CREATE UNIQUE INDEX -- requires a brief AccessShare
--            lock plus the typical index-build cost. Statement
--            timeout left at the default; data set is small.
-- ROLLBACK:
--   DROP INDEX IF EXISTS public.contacts_user_platform_external_uniq;
-- ============================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE UNIQUE INDEX IF NOT EXISTS contacts_user_platform_external_uniq
  ON public.contacts (user_id, platform, external_id)
  WHERE platform IS NOT NULL AND external_id IS NOT NULL AND external_id <> '';

COMMENT ON INDEX public.contacts_user_platform_external_uniq IS
  'Idempotency key for contact imports. Targets the ON CONFLICT '
  'clause in googleContactsService.importSelectedContacts() and '
  'importSelectedLabels(). Partial: legacy rows with empty '
  'external_id are exempted (manually-added pre-Phase-A rows). '
  'The importer always sets a non-empty platform+external_id, so '
  'its inserts match the predicate and ON CONFLICT works.';

COMMIT;
