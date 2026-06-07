-- Slack-Grounded Messages — P5 adversarial-review fixes (2026-06-07). The 3-lens review of
-- the graduation MERGE surfaced these beyond the graduate fn itself (which was fixed in
-- 20260607143750 before its first apply):
--  (MED) resolve_pulse_user_by_email was an authenticated email->auth-uuid enumeration oracle
--        + LIMIT-1 over the merely-partial unique email index (excludes SSO) => arbitrary
--        wrong-person match. Fix: a JWT caller may only resolve emails they already hold as a
--        contact (oracle close); refuse (NULL) unless EXACTLY one Pulse user matches (ambiguity).
--  (HIGH durability) inbound ingest had no "already graduated" short-circuit, so a post-
--        graduation Slack DM re-minted the shadow + forked a NEW slack thread beside the native
--        one (silently un-graduating). Fix: if contacts.pulse_user_id is set for the sender,
--        route the inbound into the NATIVE (owner, real) conversation as the real user.
-- Comprehensive dry-run-rollback PASS incl. the slack_ts-overlap collision + post-graduation
-- routing (no_new_shadow, postgrad_in_native, postgrad_sender=real).

CREATE OR REPLACE FUNCTION public.resolve_pulse_user_by_email(p_email text)
RETURNS uuid
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE v_id uuid; v_count int;
BEGIN
  IF p_email IS NULL OR p_email = '' THEN RETURN NULL; END IF;

  -- Oracle close: an authenticated caller may only resolve emails they already hold as a
  -- contact (exactly the graduation use-case) — not probe arbitrary emails for existence.
  -- (auth.uid() NULL = trusted service-role path, e.g. the inbound router.)
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.contacts c WHERE c.user_id = auth.uid()::text AND lower(c.email) = lower(p_email)
  ) THEN
    RETURN NULL;
  END IF;

  -- Ambiguity guard: auth.users.email is only partial-unique (WHERE is_sso_user=false), so
  -- duplicates are possible — never merge on a coin flip. Resolve only an UNAMBIGUOUS match.
  SELECT count(DISTINCT au.id) INTO v_count
    FROM auth.users au JOIN public.pulse_users pu ON pu.auth_user_id = au.id
    WHERE lower(au.email) = lower(p_email) AND pu.is_bot IS NOT TRUE
      AND (auth.uid() IS NULL OR au.id <> auth.uid());
  IF v_count <> 1 THEN RETURN NULL; END IF;

  SELECT au.id INTO v_id
    FROM auth.users au JOIN public.pulse_users pu ON pu.auth_user_id = au.id
    WHERE lower(au.email) = lower(p_email) AND pu.is_bot IS NOT TRUE
      AND (auth.uid() IS NULL OR au.id <> auth.uid())
    LIMIT 1;
  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_pulse_user_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_pulse_user_by_email(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolve_pulse_user_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_pulse_user_by_email(text) TO service_role;

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
  v_sender    uuid;   -- the message's sender participant (shadow, or the real user if graduated)
  v_conv      uuid;
  v_msg       uuid;
  v_graduated uuid;
BEGIN
  IF p_owner_pulse_id IS NULL OR p_team_id IS NULL OR p_sender_slack_id IS NULL THEN
    RAISE EXCEPTION 'ingest_slack_inbound_message: owner, team and sender are required';
  END IF;

  -- Graduation-aware routing: if this Slack sender already graduated to a real Pulse user,
  -- deliver into the NATIVE (owner, real) thread as that user — never re-mint a shadow (which
  -- would fork a parallel slack thread and silently un-graduate the relationship).
  SELECT pulse_user_id INTO v_graduated FROM public.contacts
    WHERE user_id = p_owner_pulse_id::text AND slack_user_id = p_sender_slack_id
      AND pulse_user_id IS NOT NULL
    LIMIT 1;

  IF v_graduated IS NOT NULL THEN
    v_sender := v_graduated;
    v_conv   := public.get_or_create_conversation(p_owner_pulse_id, v_graduated);
  ELSE
    v_sender := public.ensure_slack_shadow_user(p_team_id, p_sender_slack_id, p_email, p_display_name);
    v_conv   := public.get_or_create_slack_conversation(p_owner_pulse_id, v_sender, p_sender_slack_id, p_email, p_display_name);
  END IF;

  IF p_slack_ts IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.pulse_messages WHERE thread_id = v_conv AND metadata->>'slack_ts' = p_slack_ts
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.pulse_messages (sender_id, recipient_id, thread_id, content, content_type, metadata)
  VALUES (v_sender, p_owner_pulse_id, v_conv, COALESCE(p_text, ''), 'text',
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

  -- L3 auto-create only on the non-graduated (shadow) path; a graduated sender already has a
  -- contact carrying pulse_user_id. external_id = sender slack id (unique key) — see P3 fixes.
  IF v_graduated IS NULL THEN
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
  END IF;

  RETURN v_msg;
END;
$function$;

REVOKE ALL ON FUNCTION public.ingest_slack_inbound_message(uuid,text,text,text,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ingest_slack_inbound_message(uuid,text,text,text,text,text,text,text) FROM anon;
REVOKE ALL ON FUNCTION public.ingest_slack_inbound_message(uuid,text,text,text,text,text,text,text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_slack_inbound_message(uuid,text,text,text,text,text,text,text) TO service_role;
