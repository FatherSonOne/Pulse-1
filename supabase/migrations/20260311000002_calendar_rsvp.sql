-- ============================================================
-- Migration: Event RSVP / Attendance Tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS event_rsvp (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id       TEXT,                               -- NULL if external invitee (email only)
  email         TEXT        NOT NULL,
  name          TEXT,
  status        TEXT        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'declined', 'maybe')),
  responded_at  TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure one RSVP row per (event, email) pair
CREATE UNIQUE INDEX IF NOT EXISTS uidx_event_rsvp_event_email
  ON event_rsvp(event_id, email);

-- Fast look-ups by event
CREATE INDEX IF NOT EXISTS idx_event_rsvp_event_id
  ON event_rsvp(event_id);

-- Fast look-ups by user
CREATE INDEX IF NOT EXISTS idx_event_rsvp_user_id
  ON event_rsvp(user_id)
  WHERE user_id IS NOT NULL;

-- ── Row-Level Security ──────────────────────────────────────
ALTER TABLE event_rsvp ENABLE ROW LEVEL SECURITY;

-- Invitees can read their own RSVP
CREATE POLICY "rsvp_read_own"
  ON event_rsvp FOR SELECT
  USING (
    user_id = auth.uid()::text
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Invitees can update their own RSVP (to respond)
CREATE POLICY "rsvp_update_own"
  ON event_rsvp FOR UPDATE
  USING (
    user_id = auth.uid()::text
    OR email = (SELECT email FROM auth.users WHERE id = auth.users.id)
  );

-- Event organiser can read all RSVPs for their event
CREATE POLICY "rsvp_read_as_organiser"
  ON event_rsvp FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM calendar_events ce
      WHERE ce.id = event_rsvp.event_id
        AND ce.user_id = auth.uid()::text
    )
  );

-- Event organiser can insert RSVP rows (when sending invites)
CREATE POLICY "rsvp_insert_as_organiser"
  ON event_rsvp FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM calendar_events ce
      WHERE ce.id = event_rsvp.event_id
        AND ce.user_id = auth.uid()::text
    )
  );

-- Event organiser can delete RSVP rows (remove an invitee)
CREATE POLICY "rsvp_delete_as_organiser"
  ON event_rsvp FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM calendar_events ce
      WHERE ce.id = event_rsvp.event_id
        AND ce.user_id = auth.uid()::text
    )
  );
