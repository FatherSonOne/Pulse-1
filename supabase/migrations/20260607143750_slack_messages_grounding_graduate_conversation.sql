-- Slack-Grounded Messages — P5 graduation flip (scope §10). Flips a transport='slack'
-- thread to a native Pulse DM once the counterpart joins Pulse, matched by email.
--
-- SAFETY: the real Pulse user is DERIVED internally from the conversation's verified
-- external_email (via resolve_pulse_user_by_email), NOT taken from the caller — so an
-- operator can't graft their slack thread's messages into an arbitrary stranger's view.
-- The owner/shadow split is read from the pulse_shadow auth-meta flag (and we assert the
-- owner is NOT itself a shadow); a JWT caller must be the owner participant. NOTE: on the
-- service-role path (auth.uid() NULL) the owner check is skipped by design — the v_real
-- != v_owner/v_shadow guards below are then the load-bearing self-merge protection and
-- must never be weakened.
--
-- The flip is a conditional MERGE (NOT a naive re-point): idx_pulse_conversations_unique_pair
-- forbids two conversations for the same (owner, real) pair.
--   CASE A (no native conv for (owner, real)): flip the shadow conv in place.
--   CASE B (a native conv exists): de-collide slack_ts (idx_pulse_messages_slack_ts_per_thread
--     is UNIQUE(thread_id, slack_ts) — a bare thread_id move would throw if the native thread
--     already holds an overlapping slack_ts; the colliding shadow rows are exact dup Slack
--     events, safe to drop), move the rest onto the native thread, recompute the native
--     roll-up + the owner's unread, then delete the emptied shadow conversation.
-- Persists contacts.pulse_user_id (upsert, so a missing/auto-created contact still records it).
-- Adversarial-reviewed; both cases incl. the slack_ts-overlap collision dry-run-rollback PASS.

CREATE OR REPLACE FUNCTION public.graduate_slack_conversation(p_shadow_conversation_id uuid)
RETURNS uuid               -- the surviving (native) conversation id
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_u1 uuid; v_u2 uuid; v_transport text; v_ext_slack text; v_ext_email text; v_ext_name text;
  v_shadow uuid; v_owner uuid; v_real uuid; v_native uuid; v_last uuid;
BEGIN
  SELECT user1_id, user2_id, transport, external_slack_user_id, external_email, external_display_name
    INTO v_u1, v_u2, v_transport, v_ext_slack, v_ext_email, v_ext_name
  FROM public.pulse_conversations WHERE id = p_shadow_conversation_id;

  IF v_u1 IS NULL THEN RAISE EXCEPTION 'graduate: conversation not found'; END IF;
  IF v_transport IS DISTINCT FROM 'slack' THEN
    RETURN p_shadow_conversation_id;            -- already native / nothing to do
  END IF;

  -- Identify the shadow (pulse_shadow auth-meta flag) and the owner (the other participant);
  -- assert exactly one shadow so a shadow can never be treated as the owner.
  SELECT id INTO v_shadow FROM auth.users
    WHERE id IN (v_u1, v_u2) AND raw_user_meta_data->>'pulse_shadow' = 'true' LIMIT 1;
  IF v_shadow IS NULL THEN RAISE EXCEPTION 'graduate: no shadow participant'; END IF;
  v_owner := CASE WHEN v_u1 = v_shadow THEN v_u2 ELSE v_u1 END;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_owner AND raw_user_meta_data->>'pulse_shadow' = 'true') THEN
    RAISE EXCEPTION 'graduate: both participants are shadows';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> v_owner THEN
    RAISE EXCEPTION 'forbidden: caller is not the thread owner' USING ERRCODE = '42501';
  END IF;

  -- Derive the real counterpart from the verified email match (never client-supplied).
  v_real := public.resolve_pulse_user_by_email(v_ext_email);
  IF v_real IS NULL THEN
    RAISE EXCEPTION 'graduate: no unambiguous Pulse user matches the contact email (cannot graduate)';
  END IF;
  IF v_real = v_owner OR v_real = v_shadow THEN
    RAISE EXCEPTION 'graduate: resolved user is invalid for this thread';
  END IF;

  SELECT id INTO v_native FROM public.pulse_conversations
    WHERE user1_id = LEAST(v_owner, v_real) AND user2_id = GREATEST(v_owner, v_real)
      AND id <> p_shadow_conversation_id;

  IF v_native IS NULL THEN
    -- CASE A — flip in place
    UPDATE public.pulse_messages
      SET sender_id    = CASE WHEN sender_id    = v_shadow THEN v_real ELSE sender_id END,
          recipient_id = CASE WHEN recipient_id = v_shadow THEN v_real ELSE recipient_id END,
          updated_at = now()
      WHERE thread_id = p_shadow_conversation_id AND (sender_id = v_shadow OR recipient_id = v_shadow);

    UPDATE public.pulse_conversations
      SET user1_id = LEAST(v_owner, v_real),
          user2_id = GREATEST(v_owner, v_real),
          transport = 'pulse',
          external_slack_user_id = NULL, external_email = NULL, external_display_name = NULL,
          updated_at = now()
      WHERE id = p_shadow_conversation_id;
  ELSE
    -- CASE B — merge into the existing native conversation, delete the shadow conv.
    -- De-collide first: drop shadow rows whose slack_ts already exists on the native thread
    -- (exact duplicate Slack events) so the thread_id move can't violate the unique index.
    DELETE FROM public.pulse_messages sm
      WHERE sm.thread_id = p_shadow_conversation_id
        AND sm.metadata->>'slack_ts' IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.pulse_messages nm
          WHERE nm.thread_id = v_native AND nm.metadata->>'slack_ts' = sm.metadata->>'slack_ts'
        );

    UPDATE public.pulse_messages
      SET thread_id    = v_native,
          sender_id    = CASE WHEN sender_id    = v_shadow THEN v_real ELSE sender_id END,
          recipient_id = CASE WHEN recipient_id = v_shadow THEN v_real ELSE recipient_id END,
          updated_at = now()
      WHERE thread_id = p_shadow_conversation_id;

    -- Drop the shadow conv's last_message_id FK before delete (it points at a moved row).
    UPDATE public.pulse_conversations SET last_message_id = NULL WHERE id = p_shadow_conversation_id;
    DELETE FROM public.pulse_conversations WHERE id = p_shadow_conversation_id;

    -- Recompute the surviving native conversation's roll-up + the owner's unread count
    -- (the merged-in shadow thread can carry unread inbound that would otherwise be lost).
    SELECT id INTO v_last FROM public.pulse_messages
      WHERE thread_id = v_native AND is_deleted = false
      ORDER BY created_at DESC LIMIT 1;
    UPDATE public.pulse_conversations
      SET last_message_id      = v_last,
          last_message_at      = (SELECT created_at FROM public.pulse_messages WHERE id = v_last),
          last_message_preview = (SELECT LEFT(content, 100) FROM public.pulse_messages WHERE id = v_last),
          user1_unread_count   = CASE WHEN user1_id = v_owner
                                   THEN (SELECT count(*) FROM public.pulse_messages
                                          WHERE thread_id = v_native AND recipient_id = v_owner
                                            AND is_read = false AND is_deleted = false)
                                   ELSE user1_unread_count END,
          user2_unread_count   = CASE WHEN user2_id = v_owner
                                   THEN (SELECT count(*) FROM public.pulse_messages
                                          WHERE thread_id = v_native AND recipient_id = v_owner
                                            AND is_read = false AND is_deleted = false)
                                   ELSE user2_unread_count END,
          updated_at = now()
      WHERE id = v_native;
  END IF;

  -- Persist the graduation on the contact (upsert so a missing/auto-created row still records
  -- it; the (user_id, platform, external_id) unique index is the natural key — external_id is
  -- the sender slack id for L3 auto-created contacts). Skipped if the conv has no slack id.
  IF v_ext_slack IS NOT NULL THEN
    INSERT INTO public.contacts (user_id, name, email, slack_user_id, platform, contact_type, external_id, pulse_user_id)
    VALUES (v_owner::text, COALESCE(NULLIF(v_ext_name, ''), v_ext_slack), COALESCE(v_ext_email, ''),
            v_ext_slack, 'slack', 'external', v_ext_slack, v_real)
    ON CONFLICT (user_id, platform, external_id)
      DO UPDATE SET pulse_user_id = EXCLUDED.pulse_user_id, updated_at = now();
  END IF;

  RETURN COALESCE(v_native, p_shadow_conversation_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.graduate_slack_conversation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.graduate_slack_conversation(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.graduate_slack_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.graduate_slack_conversation(uuid) TO service_role;
