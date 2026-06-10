-- Slack Channels Grounding (Integration C) · P8 §3 — channel history backfill RPC.
--
-- A sibling of ingest_slack_channel_message that derives created_at from the Slack ts so
-- imported HISTORY orders correctly in the created_at-ordered mirror render. The live ingest
-- RPC hardcodes created_at = now() (correct for go-forward ingest, wrong for older history),
-- and is left BYTE-FOR-BYTE untouched here. service_role-only (the authed server route
-- POST /api/slack/channel-backfill calls it); the auth.uid() guard is defense-in-depth.
--
-- Applied live via MCP on 2026-06-10 (project ucaeuszgoihoyrvhewxk); this file mirrors that
-- so a fresh replay reproduces the same service-role-only function.

CREATE OR REPLACE FUNCTION public.backfill_slack_channel_message(
  p_owner_pulse_id uuid, p_team_id text, p_slack_channel_id text, p_channel_name text,
  p_is_private boolean, p_sender_slack_id text, p_text text, p_slack_ts text,
  p_slack_thread_ts text DEFAULT NULL, p_email text DEFAULT NULL, p_display_name text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','extensions','pg_temp'
AS $function$
DECLARE
  v_thread uuid;
  v_shadow uuid;
  v_msg uuid;
  v_created timestamptz;
BEGIN
  IF p_owner_pulse_id IS NULL OR p_team_id IS NULL OR p_slack_channel_id IS NULL OR p_sender_slack_id IS NULL THEN
    RAISE EXCEPTION 'backfill_slack_channel_message: owner, team, channel and sender are required';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_owner_pulse_id THEN
    RAISE EXCEPTION 'forbidden: caller must be the owner' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_thread := public.get_or_create_slack_channel_thread(
    p_owner_pulse_id, p_team_id, p_slack_channel_id, p_channel_name, COALESCE(p_is_private, false));

  -- Idempotent: re-running (or overlap with already-landed go-forward rows) is a no-op.
  IF p_slack_ts IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.slack_channel_messages WHERE thread_id = v_thread AND slack_ts = p_slack_ts
  ) THEN
    RETURN NULL;
  END IF;

  v_shadow := public.ensure_slack_shadow_user(p_team_id, p_sender_slack_id, p_email, p_display_name);

  -- Real Slack post time = epoch seconds before the dot in the ts. Fall back to now() if the
  -- ts is malformed so a bad value can never abort the import.
  BEGIN
    v_created := to_timestamp(split_part(p_slack_ts, '.', 1)::bigint);
  EXCEPTION WHEN others THEN
    v_created := now();
  END;

  INSERT INTO public.slack_channel_messages
    (thread_id, sender_shadow_id, sender_slack_id, sender_name, content, is_outgoing, slack_ts, slack_thread_ts, metadata, created_at)
  VALUES
    (v_thread, v_shadow, p_sender_slack_id, COALESCE(NULLIF(p_display_name, ''), p_sender_slack_id),
     COALESCE(p_text, ''), false, p_slack_ts, p_slack_thread_ts,
     jsonb_build_object('transport','slack_channel','slack_ts',p_slack_ts,'slack_channel',p_slack_channel_id,'backfill',true),
     v_created)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_msg;

  IF v_msg IS NULL THEN RETURN NULL; END IF;

  -- Only ADVANCE last_message_at — a backfill of OLDER messages must never drag a channel's
  -- recency backwards (which would mis-sort the channel list).
  UPDATE public.slack_channel_threads
    SET last_message_at = GREATEST(COALESCE(last_message_at, v_created), v_created)
    WHERE id = v_thread;

  RETURN v_msg;
END;
$function$;

-- Lock to service_role only (match the live ingest RPC's ACL). Supabase's default schema
-- privileges grant EXECUTE to anon+authenticated; revoke so the shadow-minting RPC is reachable
-- ONLY via the authed server route's service-role client.
REVOKE EXECUTE ON FUNCTION public.backfill_slack_channel_message(uuid,text,text,text,boolean,text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_slack_channel_message(uuid,text,text,text,boolean,text,text,text,text,text,text) TO service_role;
