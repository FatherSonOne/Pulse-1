-- =====================================================================
-- Migration: drop legacy contacts.{home,work}_lat/lng/address columns
--
-- Tracking: issue #35.
--
-- ⚠️  DO NOT APPLY YET. This migration is staged for a future cutover.
--
-- ---------------------------------------------------------------------
-- Background
-- ---------------------------------------------------------------------
-- The universal Place schema landed in 20260503000008/9. Since then
-- saveContactLocation has dual-written: legacy contact columns + the
-- new places + entity_places shape. The legacy columns remained
-- authoritative as a fallback during rollout; the new schema is the
-- forward-looking source of truth.
--
-- This migration removes the legacy columns. Once applied, every
-- consumer must read locations through getPlacesForEntity (or
-- equivalent) — no fallback exists after the columns are gone.
--
-- ---------------------------------------------------------------------
-- Rollout sequence — do NOT apply this migration until ALL of the below
-- have been confirmed:
-- ---------------------------------------------------------------------
--   1. Place schema has been authoritative in production for ≥ 2 weeks
--      (counting from when 20260503000008/9 shipped, 2026-05-03).
--   2. Every code path that previously read from
--      contacts.home_lat / home_lng / home_address /
--      contacts.work_lat / work_lng / work_address has been migrated
--      to read via getPlacesForEntity('contact', contactId) or by
--      joining on entity_places + places. Confirm with a repo grep:
--          rg "homeLat|homeLng|homeAddress|workLat|workLng|workAddress" \
--             src/ --type ts
--      The only remaining writes should be in locationService for the
--      dual-write itself — and even those should be removed in the same
--      PR that ships this migration.
--   3. Audit logs (Supabase Logs Explorer or pg_stat_statements over a
--      7-day window) confirm zero SELECTs that reference any of the
--      six legacy columns. If any read remains, fix it before applying.
--   4. Backfill audit: confirm there are zero contact rows with a
--      legacy lat/lng but no matching entity_places row. The pre-flight
--      check below enforces this, but run it manually first against a
--      clone:
--          SELECT c.id
--          FROM contacts c
--          WHERE (c.home_lat IS NOT NULL AND NOT EXISTS (
--                   SELECT 1 FROM entity_places ep
--                   WHERE ep.entity_type = 'contact'
--                     AND ep.entity_id = c.id
--                     AND ep.role = 'home'))
--             OR (c.work_lat IS NOT NULL AND NOT EXISTS (
--                   SELECT 1 FROM entity_places ep
--                   WHERE ep.entity_type = 'contact'
--                     AND ep.entity_id = c.id
--                     AND ep.role = 'work'));
--      Should return zero rows.
--
-- ---------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------
-- Once dropped, the legacy columns can be re-added with ALTER TABLE
-- ADD COLUMN, but the data they once held cannot be recovered from this
-- migration alone (it lives in places + entity_places). If you need to
-- roll back, take a `pg_dump` of the contacts table BEFORE applying.
--
-- ---------------------------------------------------------------------
-- Migration body
-- ---------------------------------------------------------------------

BEGIN;

-- Pre-flight: abort if any contact has a legacy lat/lng without a
-- matching entity_places row. The dual-write should have prevented
-- this; if it didn't, we'd lose data on column drop.
DO $$
DECLARE
  orphan_count INT;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM public.contacts c
  WHERE (c.home_lat IS NOT NULL AND NOT EXISTS (
           SELECT 1 FROM public.entity_places ep
           WHERE ep.entity_type = 'contact'
             AND ep.entity_id   = c.id
             AND ep.role        = 'home'))
     OR (c.work_lat IS NOT NULL AND NOT EXISTS (
           SELECT 1 FROM public.entity_places ep
           WHERE ep.entity_type = 'contact'
             AND ep.entity_id   = c.id
             AND ep.role        = 'work'));

  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'ABORT: % contacts still reference legacy lat/lng with no entity_places mirror. Run the backfill (20260503000009) and fix the dual-write before dropping columns.',
      orphan_count;
  END IF;
END $$;

ALTER TABLE public.contacts DROP COLUMN IF EXISTS home_lat;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS home_lng;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS home_address;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS work_lat;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS work_lng;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS work_address;

-- Note: geo_accuracy and location_updated_at on contacts are intentionally
-- NOT dropped here. They aggregate cross-place state for a contact and have
-- usages outside the spatial layer. If a follow-up cleanup is desired,
-- track it as a separate migration with its own audit window.

COMMIT;
