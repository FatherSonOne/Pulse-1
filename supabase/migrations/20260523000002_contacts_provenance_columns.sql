-- ============================================================
-- MIGRATION: 20260523000002_contacts_provenance_columns.sql
-- PURPOSE:   Schema-only provenance for contacts. Adds import_source
--            + import_label so future filters (Phase B bulk ops,
--            re-import diffing, label-based dashboards) have a
--            structural foothold. No UI consumption in Phase A.
--
-- COLUMNS ADDED to public.contacts:
--   import_source text     — 'google' | 'microsoft' | 'manual' | NULL
--   import_label  text[]   — array of bare contactGroups IDs (Google)
--                            or category strings (Outlook); NULL for non-imported
--
-- Q-5 DECISION: legacy rows are NOT backfilled. import_source remains NULL
--               for all pre-existing rows. Phase A consumer rule:
--               import_source IS NOT NULL means imported via the labelled
--               flow; everything else is opaque.
--
-- DATE:      2026-05-23
-- SAFE:      ADD COLUMN with no DEFAULT and no NOT NULL — no table rewrite
--            on PG13+; metadata-only DDL.
-- ROLLBACK:
--   ALTER TABLE public.contacts DROP COLUMN IF EXISTS import_source;
--   ALTER TABLE public.contacts DROP COLUMN IF EXISTS import_label;
--   DROP INDEX  IF EXISTS public.idx_contacts_import_source;
-- ============================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS import_source text,
  ADD COLUMN IF NOT EXISTS import_label  text[];

CREATE INDEX IF NOT EXISTS idx_contacts_import_source
  ON public.contacts (import_source)
  WHERE import_source IS NOT NULL;

COMMENT ON COLUMN public.contacts.import_source IS
  'Provenance of the row. Phase A: schema-only; populated on write by '
  'importSelectedLabels(). Legacy rows intentionally NULL. Phase B may add '
  'a CHECK constraint via NOT VALID + VALIDATE CONSTRAINT.';

COMMENT ON COLUMN public.contacts.import_label IS
  'Bare contactGroups ID (Google, e.g. "12345" not "contactGroups/12345") or '
  'Outlook category string. Array because a People row can belong to '
  'multiple groups. NULL for non-imported (manual/legacy) rows. '
  'Never strip "{", "}", "#" from any name field per guardrail #1.';

COMMIT;
