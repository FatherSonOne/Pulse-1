-- Migration: calendar_event_status
-- Adds a status column to calendar_events (tentative / confirmed / cancelled)

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS event_status TEXT
    CHECK (event_status IN ('tentative', 'confirmed', 'cancelled'))
    DEFAULT 'confirmed';

-- Index for filtering/display
CREATE INDEX IF NOT EXISTS idx_calendar_events_status
  ON calendar_events (user_id, event_status);

-- RLS inherits existing calendar_events policies; no new policies needed.
