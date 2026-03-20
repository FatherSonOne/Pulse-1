-- ============================================================
-- Migration: Contact Map Locations
-- Adds geocoded lat/lng + location type to the contacts table.
-- Also creates contact_circles + contact_circle_members tables
-- that the code already references but hasn't been migrated yet.
-- ============================================================

-- 1. Add location columns to contacts
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS home_lat            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS home_lng            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS home_address        TEXT,
  ADD COLUMN IF NOT EXISTS work_lat            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS work_lng            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS work_address        TEXT,
  ADD COLUMN IF NOT EXISTS geo_accuracy        TEXT DEFAULT 'none'
    CHECK (geo_accuracy IN ('none', 'approximate', 'precise')),
  ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;

-- Index for geographic bounding-box queries
CREATE INDEX IF NOT EXISTS idx_contacts_home_latlng
  ON public.contacts (home_lat, home_lng)
  WHERE home_lat IS NOT NULL;

-- 2. Create contact_circles table (already referenced in code, not yet migrated)
CREATE TABLE IF NOT EXISTS public.contact_circles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT        NOT NULL,
  name         TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description  TEXT,
  color        TEXT        NOT NULL DEFAULT '#6366f1',
  icon         TEXT,
  source       TEXT        NOT NULL DEFAULT 'manual'
                 CHECK (source IN ('auto', 'manual')),
  health_score INT         CHECK (health_score BETWEEN 0 AND 100),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_circles_user
  ON public.contact_circles (user_id);

-- 3. Create contact_circle_members (join table)
-- contact_id is TEXT (not UUID FK) to support externally-sourced contacts
-- from Google Contacts / Vision CRM that may not have a UUID primary key
CREATE TABLE IF NOT EXISTS public.contact_circle_members (
  circle_id  UUID        NOT NULL REFERENCES public.contact_circles(id) ON DELETE CASCADE,
  contact_id TEXT        NOT NULL,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (circle_id, contact_id)
);

-- 4. RLS
ALTER TABLE public.contact_circles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_circle_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_contact_circles" ON public.contact_circles
  FOR ALL USING (user_id = auth.uid()::text);

CREATE POLICY "owner_circle_members" ON public.contact_circle_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.contact_circles c
      WHERE c.id = circle_id AND c.user_id = auth.uid()::text
    )
  );
