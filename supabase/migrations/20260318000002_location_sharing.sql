-- ============================================================
-- Migration: Real-Time Location Sharing
-- Creates user_locations (live GPS position per Pulse user)
-- and location_share_consents (bilateral opt-in).
-- ============================================================

-- 1. user_locations: stores last known live position for a Pulse user
CREATE TABLE IF NOT EXISTS public.user_locations (
  user_id        UUID             PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  lat            DOUBLE PRECISION NOT NULL,
  lng            DOUBLE PRECISION NOT NULL,
  accuracy_m     REAL,
  heading        REAL,      -- degrees 0-360
  speed_kmh      REAL,
  location_label TEXT,      -- 'home', 'work', 'traveling', or NULL
  is_sharing     BOOLEAN    NOT NULL DEFAULT false,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_locations_sharing
  ON public.user_locations (user_id)
  WHERE is_sharing = true;

-- 2. location_share_consents: bilateral opt-in
--    viewer_user_id can see subject_user_id's location when is_granted = true
CREATE TABLE IF NOT EXISTS public.location_share_consents (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewer_user_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_granted       BOOLEAN     NOT NULL DEFAULT false,
  share_level      TEXT        NOT NULL DEFAULT 'precise'
    CHECK (share_level IN ('precise', 'approximate', 'city_only')),
  expires_at       TIMESTAMPTZ,  -- NULL = indefinite
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subject_user_id, viewer_user_id)
);

-- 3. RLS
ALTER TABLE public.user_locations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_share_consents ENABLE ROW LEVEL SECURITY;

-- User can read/write their own location row
CREATE POLICY "own_location" ON public.user_locations
  FOR ALL USING (user_id = auth.uid());

-- User can read locations they have consent to view
CREATE POLICY "consented_location_read" ON public.user_locations
  FOR SELECT USING (
    is_sharing = true AND EXISTS (
      SELECT 1 FROM public.location_share_consents c
      WHERE c.subject_user_id = user_id
        AND c.viewer_user_id = auth.uid()
        AND c.is_granted = true
        AND (c.expires_at IS NULL OR c.expires_at > NOW())
    )
  );

CREATE POLICY "own_consents" ON public.location_share_consents
  FOR ALL USING (subject_user_id = auth.uid() OR viewer_user_id = auth.uid());
