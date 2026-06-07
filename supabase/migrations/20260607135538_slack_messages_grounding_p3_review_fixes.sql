-- Slack-Grounded Messages — P3 adversarial-review fixes (2026-06-07).
-- Two real defects caught by the multi-lens review of the inbound path:
--  (HIGH) L3 contact auto-create dropped every sender after the first: the INSERT omitted
--         external_id (NOT NULL DEFAULT '' + UNIQUE(user_id,platform,external_id)), so a
--         2nd sender collided on (owner,'slack','') and was swallowed. Fix: external_id =
--         sender slack id + ON CONFLICT on the real unique index.
--  (MED)  get_or_create_slack_conversation SELECT-then-INSERT could lose a concurrent
--         first-contact inbound (no ON CONFLICT on idx_pulse_conversations_unique_pair →
--         unique_violation aborts the ingest, which acks 200 so Slack never retries). Fix:
--         ON CONFLICT on the unique-pair expression + re-select.
-- Two-distinct-sender dry-run-rollback verified PASS: contacts:2 msgs:2 convs:2 dup_skipped.

CREATE OR REPLACE FUNCTION public.get_or_create_slack_conversation(
  p_pulse_user_id         uuid,
  p_shadow_id             uuid,
  p_external_slack_user_id text DEFAULT NULL,
  p_external_email         text DEFAULT NULL,
  p_external_display_name  text DEFAULT NULL
) RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE conv_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_pulse_user_id THEN
    RAISE EXCEPTION 'forbidden: caller must be the pulse-user participant'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT id INTO conv_id FROM public.pulse_conversations
  WHERE user1_id = LEAST(p_pulse_user_id, p_shadow_id)
    AND user2_id = GREATEST(p_pulse_user_id, p_shadow_id);

  IF conv_id IS NULL THEN
    INSERT INTO public.pulse_conversations (
      user1_id, user2_id, transport,
      external_slack_user_id, external_email, external_display_name
    ) VALUES (
      LEAST(p_pulse_user_id, p_shadow_id), GREATEST(p_pulse_user_id, p_shadow_id), 'slack',
      p_external_slack_user_id, p_external_email, p_external_display_name
    )
    ON CONFLICT (LEAST(user1_id, user2_id), GREATEST(user1_id, user2_id)) DO NOTHING
    RETURNING id INTO conv_id;

    IF conv_id IS NULL THEN
      -- Lost a concurrent insert race (two inbound events from a never-seen sender at
      -- once); the row now exists — fetch it instead of aborting + losing the message.
      SELECT id INTO conv_id FROM public.pulse_conversations
      WHERE user1_id = LEAST(p_pulse_user_id, p_shadow_id)
        AND user2_id = GREATEST(p_pulse_user_id, p_shadow_id);
    END IF;
  ELSE
    UPDATE public.pulse_conversations SET
      transport = 'slack',
      external_slack_user_id = COALESCE(p_external_slack_user_id, external_slack_user_id),
      external_email = COALESCE(p_external_email, external_email),
      external_display_name = COALESCE(p_external_display_name, external_display_name),
      updated_at = NOW()
    WHERE id = conv_id;
  END IF;

  RETURN conv_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ingest_slack_inbound_message(
  p_owner_pulse_id  uuid,
  p_team_id         text,
  p_sender_slack_id text,
  p_text            text,
  p_slack_ts        text,
  p_slack_channel   text,
  p_email           text DEFAULT NULL,
  p_display_name    text DEFAULT NULL
) RETURNS uuid
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

  v_shadow := public.ensure_slack_shadow_user(p_team_id, p_sender_slack_id, p_email, p_display_name);
  v_conv   := public.get_or_create_slack_conversation(p_owner_pulse_id, v_shadow, p_sender_slack_id, p_email, p_display_name);

  IF p_slack_ts IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.pulse_messages WHERE thread_id = v_conv AND metadata->>'slack_ts' = p_slack_ts
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.pulse_messages (sender_id, recipient_id, thread_id, content, content_type, metadata)
  VALUES (v_shadow, p_owner_pulse_id, v_conv, COALESCE(p_text, ''), 'text',
          jsonb_build_object('transport','slack','slack_ts',p_slack_ts,'slack_channel',p_slack_channel))
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_msg;

  IF v_msg IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.pulse_conversations SET
    last_message_id      = v_msg,
    last_message_at      = now(),
    last_message_preview = LEFT(COALESCE(p_text, ''), 100),
    user1_unread_count   = CASE WHEN user1_id = p_owner_pulse_id THEN user1_unread_count + 1 ELSE user1_unread_count END,
    user2_unread_count   = CASE WHEN user2_id = p_owner_pulse_id THEN user2_unread_count + 1 ELSE user2_unread_count END,
    updated_at           = now()
  WHERE id = v_conv;

  -- L3: auto-create a contact for an unknown Slack sender. external_id MUST be the sender's
  -- slack id (not the '' default) or the contacts_user_platform_external_uniq index collides
  -- and silently drops every sender after the first. ON CONFLICT makes it race-safe.
  BEGIN
    INSERT INTO public.contacts (user_id, name, email, slack_user_id, platform, contact_type, external_id)
    VALUES (p_owner_pulse_id::text,
            COALESCE(NULLIF(p_display_name, ''), p_sender_slack_id),
            COALESCE(p_email, ''),
            p_sender_slack_id, 'slack', 'external', p_sender_slack_id)
    ON CONFLICT (user_id, platform, external_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'ingest_slack_inbound_message: contact auto-create failed (non-fatal): %', SQLERRM;
  END;

  RETURN v_msg;
END;
$function$;
