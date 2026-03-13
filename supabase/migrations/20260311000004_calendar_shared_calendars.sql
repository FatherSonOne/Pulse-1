-- ============================================================
-- Migration: Shared / Team Calendars
-- ============================================================

-- ── team_calendars ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_calendars (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,                            -- NULL = personal shared calendar
  name         TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  description  TEXT,
  color        TEXT        NOT NULL DEFAULT '#f43f5e',
  created_by   TEXT        NOT NULL,            -- user_id of the owner
  is_public    BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── team_calendar_members ───────────────────────────────────
CREATE TABLE IF NOT EXISTS team_calendar_members (
  calendar_id UUID   NOT NULL REFERENCES team_calendars(id) ON DELETE CASCADE,
  user_id     TEXT   NOT NULL,
  role        TEXT   NOT NULL DEFAULT 'editor'
                CHECK (role IN ('owner', 'editor', 'viewer')),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (calendar_id, user_id)
);

-- ── Link calendar_events to a team calendar ─────────────────
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS team_calendar_id UUID
    REFERENCES team_calendars(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_team_calendar
  ON calendar_events(team_calendar_id)
  WHERE team_calendar_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_team_calendar_members_user
  ON team_calendar_members(user_id);

-- ── Row-Level Security ──────────────────────────────────────
ALTER TABLE team_calendars        ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_calendar_members ENABLE ROW LEVEL SECURITY;

-- Members can see calendars they belong to; public calendars are visible to all
CREATE POLICY "team_calendars_read"
  ON team_calendars FOR SELECT
  USING (
    is_public = true
    OR created_by = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM team_calendar_members m
      WHERE m.calendar_id = team_calendars.id
        AND m.user_id = auth.uid()::text
    )
  );

-- Only authenticated users can create a calendar (they become the owner)
CREATE POLICY "team_calendars_insert"
  ON team_calendars FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()::text
  );

-- Owner can update calendar metadata
CREATE POLICY "team_calendars_update"
  ON team_calendars FOR UPDATE
  USING (created_by = auth.uid()::text);

-- Owner can delete the calendar
CREATE POLICY "team_calendars_delete"
  ON team_calendars FOR DELETE
  USING (created_by = auth.uid()::text);

-- Members policy: members can read their own membership rows
CREATE POLICY "team_cal_members_read"
  ON team_calendar_members FOR SELECT
  USING (
    user_id = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM team_calendars tc
      WHERE tc.id = team_calendar_members.calendar_id
        AND tc.created_by = auth.uid()::text
    )
  );

-- Owner can add / remove members
CREATE POLICY "team_cal_members_insert"
  ON team_calendar_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_calendars tc
      WHERE tc.id = team_calendar_members.calendar_id
        AND tc.created_by = auth.uid()::text
    )
  );

CREATE POLICY "team_cal_members_delete"
  ON team_calendar_members FOR DELETE
  USING (
    user_id = auth.uid()::text          -- self-removal
    OR EXISTS (
      SELECT 1 FROM team_calendars tc
      WHERE tc.id = team_calendar_members.calendar_id
        AND tc.created_by = auth.uid()::text
    )
  );
