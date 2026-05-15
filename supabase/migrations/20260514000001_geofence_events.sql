-- ============================================================
-- Migration: geofence_events
--
-- Records enter/exit/approach events when a Pulse user's broadcasted
-- position crosses a geofenced place. Detection runs client-side from
-- locationService.startLocationBroadcast() and inserts here; surfacing
-- happens via today_feed_items + local notifications + toast.
--
-- A "geofenced" place is any row in `places` with geofence_radius_m
-- set. The same place can be attached to many entities via
-- entity_places, so this table optionally records the entity context
-- of the event (e.g. "you arrived at Acme HQ, which is contact X's work").
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.geofence_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id      UUID        NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,

  -- enter: crossed inside the radius from outside
  -- exit:  crossed outside the radius from inside
  -- approach: entered the 2x radius outer band while not yet inside
  event_type    TEXT        NOT NULL
                  CHECK (event_type IN ('enter', 'exit', 'approach')),

  -- Position that triggered the event
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  accuracy_m    DOUBLE PRECISION,
  -- Computed distance to the place center at fire time (meters)
  distance_m    DOUBLE PRECISION NOT NULL,

  -- Optional entity context — captured at fire time so the feed item
  -- can name the contact/task/decision without an extra round-trip.
  entity_type   TEXT
                  CHECK (entity_type IS NULL OR entity_type IN ('contact', 'task', 'decision', 'event', 'meeting')),
  entity_id     TEXT,

  -- Free-form payload for future expansion (e.g. speed, heading, weather)
  payload       JSONB       NOT NULL DEFAULT '{}'::jsonb,

  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Lifecycle: surfaced=true once a feed/notification has been emitted
  surfaced      BOOLEAN     NOT NULL DEFAULT FALSE,
  surfaced_at   TIMESTAMPTZ
);

-- Hot-path indexes:
--   * recent events per user (Today feed query)
--   * idempotency check per (user, place) for the "last state" cache
CREATE INDEX IF NOT EXISTS geofence_events_user_recent_idx
  ON public.geofence_events (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS geofence_events_user_place_idx
  ON public.geofence_events (user_id, place_id, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- RLS — only the subject user can read or insert their own events.
-- No update or delete from clients (events are append-only history).
-- Surfaced flag is the one mutable field; allow update of that column only.
-- ---------------------------------------------------------------------------

ALTER TABLE public.geofence_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS geofence_events_select ON public.geofence_events;
DROP POLICY IF EXISTS geofence_events_insert ON public.geofence_events;
DROP POLICY IF EXISTS geofence_events_update_surfaced ON public.geofence_events;

CREATE POLICY geofence_events_select ON public.geofence_events
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY geofence_events_insert ON public.geofence_events
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.places p
      WHERE p.id = geofence_events.place_id
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

CREATE POLICY geofence_events_update_surfaced ON public.geofence_events
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMIT;
