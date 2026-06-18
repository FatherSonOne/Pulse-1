-- Migration: meeting breakout rooms (persisted, host-owned)
--
-- Backs the Meetings → Breakout Rooms feature (operator decision D3: persist
-- assignments to a table in v1, rather than ephemeral app-message-only state).
-- See docs/MEETINGS_BREAKOUT_ROOMS_HANDOFF_2026-06-18.md.
--
-- Scope / RLS rationale:
--   * The host (the meeting's pulse_video_rooms.created_by) is the source of
--     truth and the ONLY writer/reader of these rows — RLS mirrors the
--     pulse_video_rooms `owner_all` shape (auth.uid() = host_user_id).
--   * The realtime participant MOVE travels over Daily app-messages (works for
--     every participant, including guests). These tables are the DURABLE record
--     + host-side reconnect resilience, not the transport.
--   * Per-participant self-read RLS is intentionally deferred (P7): it would key
--     on the Daily participant `user_id`, which the handoff (§8) flags as not yet
--     confirmed to be the Supabase auth uid for GUEST participants. Until that
--     2-browser smoke test confirms it, keying RLS on it would be guesswork.
--
-- Ground-truth verified before writing (CLAUDE.md schema-first rule):
--   pulse_video_rooms.room_name  TEXT NOT NULL UNIQUE  (FK target)
--   pulse_video_rooms.created_by UUID NOT NULL REFERENCES auth.users(id)
--   (migration 20260312000001_pulse_video_rooms.sql)

-- One row per host-started breakout session within a live meeting.
CREATE TABLE IF NOT EXISTS public.meeting_breakout_sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Parent meeting, keyed on the Daily room name the client already holds.
  main_room_name  TEXT        NOT NULL REFERENCES public.pulse_video_rooms(room_name) ON DELETE CASCADE,
  -- The host who started the breakout (= the meeting's created_by).
  host_user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status          TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'ended')),
  -- Epoch wall-clock when the breakout auto-recalls (null = no timer).
  ends_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ
);

-- One row per participant assigned to a sub-room for a given session.
CREATE TABLE IF NOT EXISTS public.meeting_breakout_assignments (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id             UUID        NOT NULL REFERENCES public.meeting_breakout_sessions(id) ON DELETE CASCADE,
  -- Daily session_id (stable for a connection) — the assignment key.
  participant_session_id TEXT        NOT NULL,
  -- Supabase auth uid if known; best-effort, nullable (NOT used for RLS — see header).
  participant_user_id    UUID,
  -- Snapshot of the display name at assignment time (audit / host UI).
  participant_name       TEXT,
  sub_room_name          TEXT        NOT NULL,
  sub_room_url           TEXT        NOT NULL,
  state                  TEXT        NOT NULL DEFAULT 'assigned'
                                     CHECK (state IN ('assigned', 'moved', 'returned')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mbs_main_room ON public.meeting_breakout_sessions (main_room_name, status);
CREATE INDEX IF NOT EXISTS idx_mba_session   ON public.meeting_breakout_assignments (session_id);

-- RLS (DB security baseline: every public table RLS-on).
ALTER TABLE public.meeting_breakout_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_breakout_assignments ENABLE ROW LEVEL SECURITY;

-- Host owns the breakout session record (mirror of pulse_video_rooms owner_all).
CREATE POLICY "host_all" ON public.meeting_breakout_sessions
  FOR ALL
  USING (auth.uid() = host_user_id)
  WITH CHECK (auth.uid() = host_user_id);

-- Assignments inherit ownership from the parent session's host.
CREATE POLICY "host_all" ON public.meeting_breakout_assignments
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.meeting_breakout_sessions s
    WHERE s.id = session_id AND s.host_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.meeting_breakout_sessions s
    WHERE s.id = session_id AND s.host_user_id = auth.uid()
  ));
