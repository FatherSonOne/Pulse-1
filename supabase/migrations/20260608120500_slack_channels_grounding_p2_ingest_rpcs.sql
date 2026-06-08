-- Slack Channels Grounding (Integration C) · P2 — sibling ingest RPCs
--
-- NEW functions for channel ingest. These are SIBLINGS of the DM ingest RPCs,
-- NEVER edits to them: get_or_create_slack_conversation / ingest_slack_inbound_message
-- / graduate_slack_conversation are hard-baked to (owner, single-shadow) DM pairing
-- and graduation is undefined for N senders.
--
-- Reuse: ensure_slack_shadow_user(team, slack_user, email, display_name) verbatim
-- per author (channel authors are still individual Slack people → one shadow each).
-- Dedup mirrors the DM path: EXISTS pre-check + ON CONFLICT DO NOTHING backstopped
-- by idx_slack_channel_messages_ts_per_thread (partial unique on non-null slack_ts).
--
-- v1 decision: NO L3 contact auto-create for channel authors (channels don't
-- graduate, and a busy channel would flood Contacts). Authors are attributed via
-- sender_shadow_id + sender_name on each message row.
--
-- Security: SECURITY DEFINER + pinned search_path (DB security baseline); auth.uid()
-- owner-guard (a client can't ingest into another user's mirror); EXECUTE revoked
-- from public/anon/authenticated and granted only to service_role (the slack-events
-- edge fn in P3 is the sole caller).
--
-- Dry-run-rollback validated (RPCs compile + functionally pass: ingest creates a
-- message, dedup returns NULL on duplicate slack_ts, 1 row + 1 author shadow), then
-- applied once (CLAUDE.md §4).

CREATE OR REPLACE FUNCTION public.get_or_create_slack_channel_thread(
  p_owner_pulse_id uuid,
  p_team_id text,
  p_slack_channel_id text,
  p_channel_name text DEFAULT NULL,
  p_is_private boolean DEFAULT false
) RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'extensions', 'pg_temp'
AS $fn$
DECLARE v_thread uuid;
BEGIN
  IF p_owner_pulse_id IS NULL OR p_team_id IS NULL OR p_slack_channel_id IS NULL THEN
    RAISE EXCEPTION 'get_or_create_slack_channel_thread: owner, team and channel are required';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_owner_pulse_id THEN
    RAISE EXCEPTION 'forbidden: caller must be the owner' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT id INTO v_thread FROM public.slack_channel_threads
    WHERE owner_pulse_id = p_owner_pulse_id
      AND slack_team_id = p_team_id
      AND slack_channel_id = p_slack_channel_id;

  IF v_thread IS NULL THEN
    INSERT INTO public.slack_channel_threads (owner_pulse_id, slack_team_id, slack_channel_id, channel_name, is_private)
    VALUES (p_owner_pulse_id, p_team_id, p_slack_channel_id, p_channel_name, COALESCE(p_is_private, false))
    ON CONFLICT (owner_pulse_id, slack_team_id, slack_channel_id) DO NOTHING
    RETURNING id INTO v_thread;

    IF v_thread IS NULL THEN
      -- lost a concurrent insert race; the row now exists — fetch it
      SELECT id INTO v_thread FROM public.slack_channel_threads
        WHERE owner_pulse_id = p_owner_pulse_id
          AND slack_team_id = p_team_id
          AND slack_channel_id = p_slack_channel_id;
    END IF;
  ELSIF p_channel_name IS NOT NULL THEN
    -- keep the display label fresh
    UPDATE public.slack_channel_threads SET channel_name = p_channel_name
      WHERE id = v_thread AND channel_name IS DISTINCT FROM p_channel_name;
  END IF;

  RETURN v_thread;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.ingest_slack_channel_message(
  p_owner_pulse_id uuid,
  p_team_id text,
  p_slack_channel_id text,
  p_channel_name text,
  p_is_private boolean,
  p_sender_slack_id text,
  p_text text,
  p_slack_ts text,
  p_slack_thread_ts text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_display_name text DEFAULT NULL
) RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'extensions', 'pg_temp'
AS $fn$
DECLARE
  v_thread uuid;
  v_shadow uuid;
  v_msg uuid;
BEGIN
  IF p_owner_pulse_id IS NULL OR p_team_id IS NULL OR p_slack_channel_id IS NULL OR p_sender_slack_id IS NULL THEN
    RAISE EXCEPTION 'ingest_slack_channel_message: owner, team, channel and sender are required';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_owner_pulse_id THEN
    RAISE EXCEPTION 'forbidden: caller must be the owner' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_thread := public.get_or_create_slack_channel_thread(
    p_owner_pulse_id, p_team_id, p_slack_channel_id, p_channel_name, COALESCE(p_is_private, false));

  -- idempotent re-delivery: skip if this slack_ts already landed in this thread
  IF p_slack_ts IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.slack_channel_messages WHERE thread_id = v_thread AND slack_ts = p_slack_ts
  ) THEN
    RETURN NULL;
  END IF;

  -- one shadow auth.users row per author (display-only senders, D6)
  v_shadow := public.ensure_slack_shadow_user(p_team_id, p_sender_slack_id, p_email, p_display_name);

  INSERT INTO public.slack_channel_messages
    (thread_id, sender_shadow_id, sender_slack_id, sender_name, content, is_outgoing, slack_ts, slack_thread_ts, metadata)
  VALUES
    (v_thread, v_shadow, p_sender_slack_id, COALESCE(NULLIF(p_display_name, ''), p_sender_slack_id),
     COALESCE(p_text, ''), false, p_slack_ts, p_slack_thread_ts,
     jsonb_build_object('transport', 'slack_channel', 'slack_ts', p_slack_ts, 'slack_channel', p_slack_channel_id))
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_msg;

  IF v_msg IS NULL THEN
    -- lost the dedup race (concurrent identical slack_ts); treat as duplicate
    RETURN NULL;
  END IF;

  UPDATE public.slack_channel_threads SET last_message_at = now() WHERE id = v_thread;

  RETURN v_msg;
END;
$fn$;

-- Service-role only: the slack-events edge fn (P3) is the sole caller.
REVOKE EXECUTE ON FUNCTION public.get_or_create_slack_channel_thread(uuid, text, text, text, boolean)
  FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ingest_slack_channel_message(uuid, text, text, text, boolean, text, text, text, text, text, text)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_slack_channel_thread(uuid, text, text, text, boolean)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.ingest_slack_channel_message(uuid, text, text, text, boolean, text, text, text, text, text, text)
  TO service_role;
