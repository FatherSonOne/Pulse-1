-- ============================================================
-- Migration: Booking Pages (Calendly-style public scheduling)
-- ============================================================

-- ── booking_pages ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS booking_pages (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              TEXT        NOT NULL,
  slug                 TEXT        UNIQUE NOT NULL
                         CHECK (slug ~ '^[a-z0-9-]{3,60}$'),
  title                TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  description          TEXT,
  duration_minutes     INT         NOT NULL DEFAULT 30
                         CHECK (duration_minutes IN (15,30,45,60,90,120)),
  buffer_before        INT         NOT NULL DEFAULT 0,
  buffer_after         INT         NOT NULL DEFAULT 0,
  availability_windows JSONB,      -- [{day:1,start:'09:00',end:'17:00'}, ...]
  timezone             TEXT        NOT NULL DEFAULT 'local',
  video_type           TEXT        NOT NULL DEFAULT 'pulse'
                         CHECK (video_type IN ('pulse','zoom','meet','teams','none')),
  is_active            BOOLEAN     NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── booking_requests ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS booking_requests (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id        UUID        NOT NULL REFERENCES booking_pages(id) ON DELETE CASCADE,
  booker_name    TEXT        NOT NULL,
  booker_email   TEXT        NOT NULL,
  booker_notes   TEXT,
  proposed_start TIMESTAMPTZ NOT NULL,
  proposed_end   TIMESTAMPTZ NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','confirmed','cancelled')),
  event_id       UUID        REFERENCES calendar_events(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_pages_user    ON booking_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_booking_pages_slug    ON booking_pages(slug);
CREATE INDEX IF NOT EXISTS idx_booking_requests_page ON booking_requests(page_id);

-- ── Row-Level Security ──────────────────────────────────────
ALTER TABLE booking_pages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY;

-- Booking pages: owner can read/write their own
CREATE POLICY "booking_pages_owner"
  ON booking_pages FOR ALL
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- Public read for active pages (for the public booking route — no auth)
CREATE POLICY "booking_pages_public_read"
  ON booking_pages FOR SELECT
  USING (is_active = true);

-- Booking requests: owner of the page can read all requests
CREATE POLICY "booking_requests_owner_read"
  ON booking_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM booking_pages bp
      WHERE bp.id = booking_requests.page_id
        AND bp.user_id = auth.uid()::text
    )
  );

-- Anyone can insert a booking request (public booking flow)
CREATE POLICY "booking_requests_public_insert"
  ON booking_requests FOR INSERT
  WITH CHECK (true);

-- Owner can update request status (confirm / cancel)
CREATE POLICY "booking_requests_owner_update"
  ON booking_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM booking_pages bp
      WHERE bp.id = booking_requests.page_id
        AND bp.user_id = auth.uid()::text
    )
  );
