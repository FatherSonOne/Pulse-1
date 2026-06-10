-- Slack Channels Grounding (Integration C) · P8 §1.3 — reactions.
--
-- Reactions arrive as separate reaction_added / reaction_removed Slack events (not message events).
-- Stored on the message row as metadata.reactions = { "<emoji>": ["<reactor_slack_id>", ...] } — a
-- per-emoji SET of reactor ids, so a Slack retry can't double-count (add is a no-op when present) and
-- remove is exact. No side table. Both RPCs service_role-only (the edge fn calls them); the auth.uid()
-- guard is defense-in-depth. The table is already REPLICA IDENTITY FULL (§1.2) so these UPDATEs
-- broadcast the new metadata to the open thread via realtime.
--
-- Applied live via MCP on 2026-06-10 (project ucaeuszgoihoyrvhewxk); this file mirrors that.
-- NOTE: go-live requires adding reaction_added/reaction_removed to the Slack app's bot event
-- subscriptions + the reactions:read scope + reinstall (dashboard-only; not in this repo).

CREATE OR REPLACE FUNCTION public.add_slack_channel_reaction(
  p_owner_pulse_id uuid, p_team_id text, p_slack_channel_id text, p_slack_ts text, p_emoji text, p_reactor text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','extensions','pg_temp'
AS $function$
DECLARE v_thread uuid; v_msg uuid; v_meta jsonb; v_reactions jsonb; v_arr jsonb;
BEGIN
  IF p_owner_pulse_id IS NULL OR p_team_id IS NULL OR p_slack_channel_id IS NULL
     OR p_slack_ts IS NULL OR p_emoji IS NULL OR p_reactor IS NULL THEN
    RAISE EXCEPTION 'add_slack_channel_reaction: owner, team, channel, ts, emoji and reactor are required';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_owner_pulse_id THEN
    RAISE EXCEPTION 'forbidden: caller must be the owner' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT id INTO v_thread FROM public.slack_channel_threads
    WHERE owner_pulse_id = p_owner_pulse_id AND slack_team_id = p_team_id AND slack_channel_id = p_slack_channel_id;
  IF v_thread IS NULL THEN RETURN NULL; END IF;
  SELECT id, metadata INTO v_msg, v_meta FROM public.slack_channel_messages
    WHERE thread_id = v_thread AND slack_ts = p_slack_ts;
  IF v_msg IS NULL THEN RETURN NULL; END IF;
  v_reactions := COALESCE(v_meta->'reactions', '{}'::jsonb);
  v_arr := COALESCE(v_reactions->p_emoji, '[]'::jsonb);
  IF NOT (v_arr @> to_jsonb(p_reactor)) THEN
    v_arr := v_arr || to_jsonb(p_reactor);  -- idempotent: a Slack retry won't double-add
  END IF;
  v_reactions := jsonb_set(v_reactions, ARRAY[p_emoji], v_arr, true);
  UPDATE public.slack_channel_messages
    SET metadata = jsonb_set(COALESCE(v_meta, '{}'::jsonb), '{reactions}', v_reactions, true)
    WHERE id = v_msg;
  RETURN v_msg;
END;
$function$;

CREATE OR REPLACE FUNCTION public.remove_slack_channel_reaction(
  p_owner_pulse_id uuid, p_team_id text, p_slack_channel_id text, p_slack_ts text, p_emoji text, p_reactor text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','extensions','pg_temp'
AS $function$
DECLARE v_thread uuid; v_msg uuid; v_meta jsonb; v_reactions jsonb; v_arr jsonb;
BEGIN
  IF p_owner_pulse_id IS NULL OR p_team_id IS NULL OR p_slack_channel_id IS NULL
     OR p_slack_ts IS NULL OR p_emoji IS NULL OR p_reactor IS NULL THEN
    RAISE EXCEPTION 'remove_slack_channel_reaction: owner, team, channel, ts, emoji and reactor are required';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_owner_pulse_id THEN
    RAISE EXCEPTION 'forbidden: caller must be the owner' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT id INTO v_thread FROM public.slack_channel_threads
    WHERE owner_pulse_id = p_owner_pulse_id AND slack_team_id = p_team_id AND slack_channel_id = p_slack_channel_id;
  IF v_thread IS NULL THEN RETURN NULL; END IF;
  SELECT id, metadata INTO v_msg, v_meta FROM public.slack_channel_messages
    WHERE thread_id = v_thread AND slack_ts = p_slack_ts;
  IF v_msg IS NULL THEN RETURN NULL; END IF;
  v_reactions := COALESCE(v_meta->'reactions', '{}'::jsonb);
  v_arr := COALESCE(v_reactions->p_emoji, '[]'::jsonb) - p_reactor;
  IF jsonb_array_length(v_arr) = 0 THEN
    v_reactions := v_reactions - p_emoji;  -- drop the emoji key when no reactors remain
  ELSE
    v_reactions := jsonb_set(v_reactions, ARRAY[p_emoji], v_arr, true);
  END IF;
  UPDATE public.slack_channel_messages
    SET metadata = jsonb_set(COALESCE(v_meta, '{}'::jsonb), '{reactions}', v_reactions, true)
    WHERE id = v_msg;
  RETURN v_msg;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.add_slack_channel_reaction(uuid,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.add_slack_channel_reaction(uuid,text,text,text,text,text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.remove_slack_channel_reaction(uuid,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.remove_slack_channel_reaction(uuid,text,text,text,text,text) TO service_role;
