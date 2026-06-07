-- Slack-Grounded Messages — P3 inbound ingest (scope §9). Called by the slack-events
-- edge fn (service-role) to atomically land an incoming Slack DM as a pulse_messages
-- row that broadcasts live to the operator's open thread (both pulse_* tables are in
-- supabase_realtime). Dry-run-rollback verified PASS 2026-06-07.

-- Bulletproof de-dup backstop: no two messages in the same thread may share a slack_ts.
-- Outbound rows (P2b) carry no slack_ts in metadata, so they're excluded from the index.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pulse_messages_slack_ts_per_thread
  ON public.pulse_messages (thread_id, (metadata->>'slack_ts'))
  WHERE (metadata->>'slack_ts') IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ingest_slack_inbound_message(
  p_owner_pulse_id  uuid,
  p_team_id         text,
  p_sender_slack_id text,
  p_text            text,
  p_slack_ts        text,
  p_slack_channel   text,
  p_email           text DEFAULT NULL,
  p_display_name    text DEFAULT NULL
) RETURNS uuid               -- the new message id, or NULL when deduped
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_shadow uuid;
  v_conv   uuid;
  v_msg    uuid;
BEGIN
  IF p_owner_pulse_id IS NULL OR p_team_id IS NULL OR p_sender_slack_id IS NULL THEN
    RAISE EXCEPTION 'ingest_slack_inbound_message: owner, team and sender are required';
  END IF;

  -- Idempotent shadow recipient + slack conversation (the senders are the shadows).
  v_shadow := public.ensure_slack_shadow_user(p_team_id, p_sender_slack_id, p_email, p_display_name);
  v_conv   := public.get_or_create_slack_conversation(p_owner_pulse_id, v_shadow, p_sender_slack_id, p_email, p_display_name);

  -- De-dup (Slack retries the same event): same slack_ts already in this thread?
  IF p_slack_ts IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.pulse_messages WHERE thread_id = v_conv AND metadata->>'slack_ts' = p_slack_ts
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.pulse_messages (sender_id, recipient_id, thread_id, content, content_type, metadata)
  VALUES (v_shadow, p_owner_pulse_id, v_conv, COALESCE(p_text, ''), 'text',
          jsonb_build_object('transport','slack','slack_ts',p_slack_ts,'slack_channel',p_slack_channel))
  ON CONFLICT DO NOTHING               -- backstopped by idx_pulse_messages_slack_ts_per_thread (race)
  RETURNING id INTO v_msg;

  IF v_msg IS NULL THEN
    RETURN NULL;                        -- lost a concurrent race; already ingested
  END IF;

  UPDATE public.pulse_conversations SET
    last_message_id      = v_msg,
    last_message_at      = now(),
    last_message_preview = LEFT(COALESCE(p_text, ''), 100),
    user1_unread_count   = CASE WHEN user1_id = p_owner_pulse_id THEN user1_unread_count + 1 ELSE user1_unread_count END,
    user2_unread_count   = CASE WHEN user2_id = p_owner_pulse_id THEN user2_unread_count + 1 ELSE user2_unread_count END,
    updated_at           = now()
  WHERE id = v_conv;

  -- L3: best-effort auto-create a contact for an unknown Slack sender so they appear in
  -- Contacts + can graduate later. NEVER blocks the message ingest (the thread renders
  -- from pulse_conversations, not contacts). contacts.email is NOT NULL → fall back to ''.
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM public.contacts WHERE user_id = p_owner_pulse_id::text AND slack_user_id = p_sender_slack_id
    ) THEN
      INSERT INTO public.contacts (user_id, name, email, slack_user_id, platform, contact_type)
      VALUES (p_owner_pulse_id::text,
              COALESCE(NULLIF(p_display_name, ''), p_sender_slack_id),
              COALESCE(p_email, ''),
              p_sender_slack_id, 'slack', 'external');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'ingest_slack_inbound_message: contact auto-create failed (non-fatal): %', SQLERRM;
  END;

  RETURN v_msg;
END;
$function$;

-- Service-role only: this writes arbitrary messages on behalf of any user.
REVOKE ALL ON FUNCTION public.ingest_slack_inbound_message(uuid,text,text,text,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ingest_slack_inbound_message(uuid,text,text,text,text,text,text,text) FROM anon;
REVOKE ALL ON FUNCTION public.ingest_slack_inbound_message(uuid,text,text,text,text,text,text,text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_slack_inbound_message(uuid,text,text,text,text,text,text,text) TO service_role;
