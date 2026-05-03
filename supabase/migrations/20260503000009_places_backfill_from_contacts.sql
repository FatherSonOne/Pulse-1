-- ============================================================
-- Migration: Backfill places + entity_places from contacts
--
-- For every contact with a home or work lat/lng, create one
-- corresponding place record and link it via entity_places.
-- Idempotent: re-running won't duplicate (NOT EXISTS guard).
--
-- The original contacts.home_lat/home_lng/work_lat/work_lng columns
-- are preserved. The application reads from places when available
-- and falls back to the contact columns during the rollout window.
-- A future cleanup migration can drop the columns once the new
-- schema has been the source of truth long enough.
-- ============================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Home locations
-- ---------------------------------------------------------------------------

WITH new_home_places AS (
  INSERT INTO public.places (owner_user_id, lat, lng, address, name, type)
  SELECT
    c.user_id::text,
    c.home_lat,
    c.home_lng,
    c.home_address,
    'Home',
    'home'
  FROM public.contacts c
  WHERE c.home_lat IS NOT NULL
    AND c.home_lng IS NOT NULL
    -- Skip contacts that already have a home place attached
    AND NOT EXISTS (
      SELECT 1 FROM public.entity_places ep
      WHERE ep.entity_type = 'contact'
        AND ep.entity_id = c.id::text
        AND ep.role = 'home'
    )
  RETURNING id, owner_user_id, lat, lng
)
INSERT INTO public.entity_places (entity_type, entity_id, place_id, role)
SELECT
  'contact',
  c.id::text,
  np.id,
  'home'
FROM public.contacts c
JOIN new_home_places np
  ON np.owner_user_id = c.user_id::text
 AND np.lat = c.home_lat
 AND np.lng = c.home_lng;

-- ---------------------------------------------------------------------------
-- 2. Work locations
-- ---------------------------------------------------------------------------

WITH new_work_places AS (
  INSERT INTO public.places (owner_user_id, lat, lng, address, name, type)
  SELECT
    c.user_id::text,
    c.work_lat,
    c.work_lng,
    c.work_address,
    'Work',
    'work'
  FROM public.contacts c
  WHERE c.work_lat IS NOT NULL
    AND c.work_lng IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.entity_places ep
      WHERE ep.entity_type = 'contact'
        AND ep.entity_id = c.id::text
        AND ep.role = 'work'
    )
  RETURNING id, owner_user_id, lat, lng
)
INSERT INTO public.entity_places (entity_type, entity_id, place_id, role)
SELECT
  'contact',
  c.id::text,
  np.id,
  'work'
FROM public.contacts c
JOIN new_work_places np
  ON np.owner_user_id = c.user_id::text
 AND np.lat = c.work_lat
 AND np.lng = c.work_lng;

COMMIT;
