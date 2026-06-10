-- Slack Channels Grounding (Integration C) · P8 §1.2 — edits & deletes fidelity.
--
-- Soft-delete + edit-in-place for mirrored channel messages, driven by the slack-events edge fn's
-- new message_changed / message_deleted branches. Both RPCs are service_role-only (the edge fn
-- calls them); the auth.uid() guard is defense-in-depth. REPLICA IDENTITY FULL so UPDATE realtime
-- payloads carry the new content/flags to the open thread (default PK-only identity would not).
--
-- Applied live via MCP on 2026-06-10 (project ucaeuszgoihoyrvhewxk); this file mirrors that.

ALTER TABLE public.slack_channel_messages
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.slack_channel_messages REPLICA IDENTITY FULL;

-- Edit-in-place: edits keep the same slack_ts, so this UPDATEs the existing row (never inserts).
-- A no-op when the message isn't mirrored (e.g. edited before the bot joined) or already deleted.
CREATE OR REPLACE FUNCTION public.edit_slack_channel_message(
  p_owner_pulse_id uuid, p_team_id text, p_slack_channel_id text, p_slack_ts text, p_text text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','extensions','pg_temp'
AS $function$
DECLARE v_thread uuid; v_msg uuid;
BEGIN
  IF p_owner_pulse_id IS NULL OR p_team_id IS NULL OR p_slack_channel_id IS NULL OR p_slack_ts IS NULL THEN
    RAISE EXCEPTION 'edit_slack_channel_message: owner, team, channel and ts are required';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_owner_pulse_id THEN
    RAISE EXCEPTION 'forbidden: caller must be the owner' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT id INTO v_thread FROM public.slack_channel_threads
    WHERE owner_pulse_id = p_owner_pulse_id AND slack_team_id = p_team_id AND slack_channel_id = p_slack_channel_id;
  IF v_thread IS NULL THEN RETURN NULL; END IF;
  UPDATE public.slack_channel_messages
    SET content = COALESCE(p_text, ''), edited_at = now()
    WHERE thread_id = v_thread AND slack_ts = p_slack_ts AND deleted_at IS NULL
    RETURNING id INTO v_msg;
  RETURN v_msg;
END;
$function$;

-- Soft-delete (tombstone): keep the row, stamp deleted_at; the UI renders "message deleted".
-- Keeps the (thread_id, slack_ts) partial-unique intact (no row removed).
CREATE OR REPLACE FUNCTION public.tombstone_slack_channel_message(
  p_owner_pulse_id uuid, p_team_id text, p_slack_channel_id text, p_slack_ts text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','extensions','pg_temp'
AS $function$
DECLARE v_thread uuid; v_msg uuid;
BEGIN
  IF p_owner_pulse_id IS NULL OR p_team_id IS NULL OR p_slack_channel_id IS NULL OR p_slack_ts IS NULL THEN
    RAISE EXCEPTION 'tombstone_slack_channel_message: owner, team, channel and ts are required';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_owner_pulse_id THEN
    RAISE EXCEPTION 'forbidden: caller must be the owner' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT id INTO v_thread FROM public.slack_channel_threads
    WHERE owner_pulse_id = p_owner_pulse_id AND slack_team_id = p_team_id AND slack_channel_id = p_slack_channel_id;
  IF v_thread IS NULL THEN RETURN NULL; END IF;
  UPDATE public.slack_channel_messages
    SET deleted_at = now()
    WHERE thread_id = v_thread AND slack_ts = p_slack_ts AND deleted_at IS NULL
    RETURNING id INTO v_msg;
  RETURN v_msg;
END;
$function$;

-- Lock both to service_role only (match the other channel RPCs).
REVOKE EXECUTE ON FUNCTION public.edit_slack_channel_message(uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.edit_slack_channel_message(uuid,text,text,text,text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.tombstone_slack_channel_message(uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.tombstone_slack_channel_message(uuid,text,text,text) TO service_role;
