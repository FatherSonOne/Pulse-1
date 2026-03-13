-- Migration: pulse_video_rooms
-- Stores Daily.co room metadata, linked to calendar events, with recording/transcript storage

CREATE TABLE IF NOT EXISTS pulse_video_rooms (
  id                 UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  room_name          TEXT        NOT NULL UNIQUE,
  room_url           TEXT        NOT NULL,
  title              TEXT,
  calendar_event_id  UUID        REFERENCES calendar_events(id) ON DELETE SET NULL,
  created_by         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  started_at         TIMESTAMPTZ,
  ended_at           TIMESTAMPTZ,
  status             TEXT        NOT NULL DEFAULT 'waiting'
                                 CHECK (status IN ('waiting', 'active', 'recording', 'ended')),
  recording_id       TEXT,
  recording_url      TEXT,
  transcript         TEXT,
  summary            TEXT,
  duration_seconds   INTEGER
);

-- Index for quick lookup by event or creator
CREATE INDEX IF NOT EXISTS idx_pvr_calendar_event ON pulse_video_rooms (calendar_event_id);
CREATE INDEX IF NOT EXISTS idx_pvr_created_by     ON pulse_video_rooms (created_by, created_at DESC);

-- RLS
ALTER TABLE pulse_video_rooms ENABLE ROW LEVEL SECURITY;

-- Creator can do anything with their rooms
CREATE POLICY "owner_all" ON pulse_video_rooms
  FOR ALL USING (auth.uid() = created_by);

-- Any authenticated user can read rooms (needed to join via link)
CREATE POLICY "authenticated_read" ON pulse_video_rooms
  FOR SELECT USING (auth.role() = 'authenticated');
