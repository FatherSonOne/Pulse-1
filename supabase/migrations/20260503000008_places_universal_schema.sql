-- ============================================================
-- Migration: Universal Place schema
--
-- Purpose
--   Today, location lives as property-soup on the contacts table
--   (home_lat/home_lng/work_lat/work_lng). To grow Map into a
--   cross-section spatial layer (Tasks-on-map, Decisions-with-place,
--   Calendar-with-route, Search-by-geo, team coordination), location
--   needs to be a first-class entity that any record can attach to.
--
-- Adds two tables:
--
--   places         — universal location record (lat/lng/address/etc.)
--   entity_places  — many-to-many join: any entity (contact, task,
--                    decision, event) can reference any place in any
--                    role (home, work, venue, site, completion_geofence).
--
-- This migration is non-destructive:
--   * The existing contacts.home_lat/home_lng/work_lat/work_lng
--     columns are untouched. The locationService keeps reading them
--     as a fallback during the transition.
--   * Backfill is a separate companion migration (run after this).
--
-- Ownership model
--   Mirrors the existing contacts/contact_circles pattern: personal
--   places are owned via user_id::text (no auth.users FK because
--   contact_id can also reference external Google/Vision IDs, and
--   contacts.user_id was already TEXT). Workspace-shared places set
--   workspace_id to a UUID; RLS lets all workspace members read.
-- ============================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. places
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.places (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id       TEXT        NOT NULL,
  workspace_id        UUID        REFERENCES public.workspaces(id) ON DELETE CASCADE,

  -- Geometry
  lat                 DOUBLE PRECISION NOT NULL,
  lng                 DOUBLE PRECISION NOT NULL,
  address             TEXT,

  -- Identity
  name                TEXT,
  type                TEXT        NOT NULL DEFAULT 'custom'
                        CHECK (type IN ('home', 'work', 'site', 'venue', 'meeting', 'custom')),
  color               TEXT,

  -- Optional geofence (in meters). When set, geofence events fire on enter/exit.
  geofence_radius_m   INTEGER     CHECK (geofence_radius_m IS NULL OR geofence_radius_m BETWEEN 10 AND 50000),

  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Color hex format (#rgb / #rrggbb / null)
ALTER TABLE public.places
  DROP CONSTRAINT IF EXISTS places_color_check;
ALTER TABLE public.places
  ADD CONSTRAINT places_color_check
  CHECK (color IS NULL OR color ~ '^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$');

-- Lat/lng plausibility
ALTER TABLE public.places
  DROP CONSTRAINT IF EXISTS places_latlng_range;
ALTER TABLE public.places
  ADD CONSTRAINT places_latlng_range
  CHECK (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180);

-- Indexes for the two dominant query shapes:
--   * "all my places" (personal scope)
--   * "all workspace places" (team scope)
--   * "places within bounds" (map viewport)
CREATE INDEX IF NOT EXISTS places_owner_idx
  ON public.places (owner_user_id) WHERE workspace_id IS NULL;

CREATE INDEX IF NOT EXISTS places_workspace_idx
  ON public.places (workspace_id) WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS places_latlng_idx
  ON public.places (lat, lng);

-- ---------------------------------------------------------------------------
-- 2. entity_places (universal join)
--    entity_id is TEXT (not UUID) to remain compatible with externally-sourced
--    contact IDs (Google Contacts, Vision CRM) and any future entity that
--    doesn't use UUIDs natively.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.entity_places (
  entity_type   TEXT        NOT NULL
                  CHECK (entity_type IN ('contact', 'task', 'decision', 'event', 'meeting')),
  entity_id     TEXT        NOT NULL,
  place_id      UUID        NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  role          TEXT        NOT NULL DEFAULT 'primary'
                  CHECK (role IN ('home', 'work', 'venue', 'site', 'meeting_point', 'completion_geofence', 'primary')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (entity_type, entity_id, place_id, role)
);

CREATE INDEX IF NOT EXISTS entity_places_entity_idx
  ON public.entity_places (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS entity_places_place_idx
  ON public.entity_places (place_id);

-- ---------------------------------------------------------------------------
-- 3. updated_at trigger for places
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_places_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_places_updated_at ON public.places;
CREATE TRIGGER trg_places_updated_at
  BEFORE UPDATE ON public.places
  FOR EACH ROW
  EXECUTE FUNCTION public.set_places_updated_at();

-- ---------------------------------------------------------------------------
-- 4. RLS — places
--   Personal place (workspace_id IS NULL): owner can SELECT/INSERT/UPDATE/DELETE
--   Workspace place (workspace_id IS NOT NULL):
--     * SELECT: any workspace member
--     * INSERT/UPDATE/DELETE: owner OR workspace owner/admin
-- ---------------------------------------------------------------------------

ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS places_select ON public.places;
DROP POLICY IF EXISTS places_insert ON public.places;
DROP POLICY IF EXISTS places_update ON public.places;
DROP POLICY IF EXISTS places_delete ON public.places;

CREATE POLICY places_select ON public.places
  FOR SELECT
  USING (
    -- Personal places visible to their owner
    (workspace_id IS NULL AND owner_user_id = auth.uid()::text)
    OR
    -- Workspace places visible to all workspace members
    (workspace_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = places.workspace_id
        AND wm.user_id = auth.uid()
    ))
  );

CREATE POLICY places_insert ON public.places
  FOR INSERT
  WITH CHECK (
    -- Personal: only the owner can insert their own
    (workspace_id IS NULL AND owner_user_id = auth.uid()::text)
    OR
    -- Workspace: any member can add a workspace place; ownership tracks user
    (workspace_id IS NOT NULL
      AND owner_user_id = auth.uid()::text
      AND EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = places.workspace_id
          AND wm.user_id = auth.uid()
      ))
  );

CREATE POLICY places_update ON public.places
  FOR UPDATE
  USING (
    (workspace_id IS NULL AND owner_user_id = auth.uid()::text)
    OR
    (workspace_id IS NOT NULL AND (
      owner_user_id = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = places.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.role IN ('owner', 'admin')
      )
    ))
  );

CREATE POLICY places_delete ON public.places
  FOR DELETE
  USING (
    (workspace_id IS NULL AND owner_user_id = auth.uid()::text)
    OR
    (workspace_id IS NOT NULL AND (
      owner_user_id = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = places.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.role IN ('owner', 'admin')
      )
    ))
  );

-- ---------------------------------------------------------------------------
-- 5. RLS — entity_places
--   Visible / writable iff the parent place is visible / writable.
--   No separate per-entity check: if you can see the place, you can see
--   what it's attached to. (Future: add per-entity_type checks if a task
--   attached to a place should only be visible to task-readers.)
-- ---------------------------------------------------------------------------

ALTER TABLE public.entity_places ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS entity_places_select ON public.entity_places;
DROP POLICY IF EXISTS entity_places_insert ON public.entity_places;
DROP POLICY IF EXISTS entity_places_delete ON public.entity_places;

CREATE POLICY entity_places_select ON public.entity_places
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.places p
      WHERE p.id = entity_places.place_id
        AND (
          (p.workspace_id IS NULL AND p.owner_user_id = auth.uid()::text)
          OR (p.workspace_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = p.workspace_id
              AND wm.user_id = auth.uid()
          ))
        )
    )
  );

CREATE POLICY entity_places_insert ON public.entity_places
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.places p
      WHERE p.id = entity_places.place_id
        AND (
          (p.workspace_id IS NULL AND p.owner_user_id = auth.uid()::text)
          OR (p.workspace_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = p.workspace_id
              AND wm.user_id = auth.uid()
          ))
        )
    )
  );

CREATE POLICY entity_places_delete ON public.entity_places
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.places p
      WHERE p.id = entity_places.place_id
        AND (
          (p.workspace_id IS NULL AND p.owner_user_id = auth.uid()::text)
          OR (p.workspace_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = p.workspace_id
              AND wm.user_id = auth.uid()
              AND wm.role IN ('owner', 'admin')
          ))
        )
    )
  );

COMMIT;
