-- ============================================================
-- MIGRATION: 20260520000001_phase_d_contact_type_column.sql
-- PURPOSE:   Phase D adds per-contact Pulse-taxonomy assignment in
--            the rebuilt ConnectContactsModal (Stage > Tag > Confirm).
--            The Tag step lets the operator pick one of:
--            team | client | lead | partner | vendor | volunteer |
--            network | other. The selection is persisted on the
--            contact row so the taxonomy survives import and is
--            queryable by smart-list / saved-filter predicates.
--
-- COLUMN ADDED to public.contacts:
--   contact_type text  -- one of the values above; NULL for legacy
--                        rows imported before Phase D
--
-- DESIGN:
--   * Schema-only. Legacy rows intentionally NULL. The application
--     layer (ContactsRedesigned filters, smart lists) treats NULL
--     as "uncategorized" without crashing.
--   * No CHECK constraint yet -- TypeScript's ContactType union is
--     the canonical guard on write. A NOT VALID + VALIDATE
--     CONSTRAINT pair can be added in Phase E if needed.
--
-- DATE:      2026-05-20
-- SAFE:      ADD COLUMN with no DEFAULT and no NOT NULL -- no table
--            rewrite on PG13+; metadata-only DDL.
-- ROLLBACK:
--   DROP INDEX  IF EXISTS public.idx_contacts_contact_type;
--   ALTER TABLE public.contacts DROP COLUMN IF EXISTS contact_type;
-- ============================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS contact_type text NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_contact_type
  ON public.contacts (contact_type)
  WHERE contact_type IS NOT NULL;

COMMENT ON COLUMN public.contacts.contact_type IS
  'Pulse-taxonomy classification picked by the operator in the '
  'ConnectContactsModal Tag step. One of: team, client, lead, '
  'partner, vendor, volunteer, network, other. NULL for rows '
  'imported before Phase D (treated as "uncategorized" at the '
  'application layer). Canonical type lives in src/types.ts as '
  'the ContactType union.';

COMMIT;
