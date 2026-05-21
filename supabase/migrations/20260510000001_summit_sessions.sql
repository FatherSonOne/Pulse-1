-- Summit session persistence
--
-- Stores recent Summit (voice 1-on-1) sessions per workspace member so a user
-- can pick up where they left off across devices. Until this lands, Summit
-- writes to localStorage only (capped at 12 per browser).
--
-- The client treats Supabase as the source of truth and uses localStorage as
-- a sync read cache. Inserts go to both places; reads prefer Supabase but
-- fall back to localStorage when offline / RLS-rejected.
--
-- The full session record (notes + artifacts) lives in a `data jsonb` column
-- to avoid a wider schema for what is fundamentally a session blob with
-- searchable metadata pulled out for indexing.

CREATE TABLE IF NOT EXISTS public.summit_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL,
  user_id         uuid NOT NULL,
  -- session window
  started_at      timestamptz NOT NULL,
  ended_at        timestamptz NOT NULL,
  duration_sec    integer NOT NULL CHECK (duration_sec >= 0),
  -- searchable metadata pulled out of `data` for filters / order
  capture_count   integer NOT NULL DEFAULT 0,
  artifact_count  integer NOT NULL DEFAULT 0,
  takeaway        text,
  last_line       text,
  -- full record: notes[], artifacts{}, etc — exact shape mirrors the TS
  -- VoiceSessionRecord interface in voiceSessionStore.ts.
  data            jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- audit
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Most queries are "give me my recent sessions in this workspace, newest first"
CREATE INDEX IF NOT EXISTS summit_sessions_user_recent_idx
  ON public.summit_sessions (user_id, ended_at DESC);

CREATE INDEX IF NOT EXISTS summit_sessions_workspace_recent_idx
  ON public.summit_sessions (workspace_id, ended_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.summit_sessions_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS summit_sessions_updated_at ON public.summit_sessions;
CREATE TRIGGER summit_sessions_updated_at
  BEFORE UPDATE ON public.summit_sessions
  FOR EACH ROW EXECUTE FUNCTION public.summit_sessions_set_updated_at();

-- RLS
ALTER TABLE public.summit_sessions ENABLE ROW LEVEL SECURITY;

-- A user only sees their own sessions, scoped to a workspace they belong to.
-- We require both user_id = auth.uid() AND workspace access — Summit sessions
-- are personal even within a shared workspace.
CREATE POLICY summit_sessions_select ON public.summit_sessions
  FOR SELECT USING (
    user_id = auth.uid()
    AND public.user_has_workspace_access(workspace_id)
  );

CREATE POLICY summit_sessions_insert ON public.summit_sessions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND public.user_has_workspace_access(workspace_id)
  );

CREATE POLICY summit_sessions_update ON public.summit_sessions
  FOR UPDATE
  USING (user_id = auth.uid() AND public.user_has_workspace_access(workspace_id))
  WITH CHECK (user_id = auth.uid() AND public.user_has_workspace_access(workspace_id));

CREATE POLICY summit_sessions_delete ON public.summit_sessions
  FOR DELETE USING (
    user_id = auth.uid()
    AND public.user_has_workspace_access(workspace_id)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.summit_sessions TO authenticated;

COMMENT ON TABLE public.summit_sessions IS
  'Voice 1-on-1 session records (Summit). Written by the Summit component on disconnect. Personal to the user, scoped to a workspace.';
