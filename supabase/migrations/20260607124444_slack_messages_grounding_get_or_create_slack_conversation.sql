-- Slack-Grounded Messages — get/create a transport='slack' conversation (scope §4/§9).
-- The core get_or_create_conversation(user_a,user_b) only ever makes transport='pulse'
-- rows; a Slack thread needs transport='slack' + conversation-level external identity.
-- This is the shared seam for BOTH outbound (P2b, called as the operator over the send
-- endpoint's service-role / then send_pulse_message reuses the row by pair) and inbound
-- (P3 slack-events edge fn, service-role). Idempotent on the (pulse_user, shadow) pair;
-- COALESCE-fills external identity when a later event resolves a name/email the first
-- send lacked. Dry-run-rollback verified PASS 2026-06-07.

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
  -- Client calls pass a JWT (auth.uid() = the Pulse user); the slack-events edge fn
  -- calls as service-role (auth.uid() IS NULL). Permit either: a JWT caller must be
  -- the Pulse-user side (never the shadow); a null uid is the trusted service role.
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
    ) RETURNING id INTO conv_id;
  ELSE
    -- Reaffirm transport='slack' + fill external identity when newly known (a later
    -- inbound may resolve a name the first send lacked); COALESCE never nulls a value.
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

-- Authenticated may create a slack conversation where THEY are the pulse-user side
-- (the auth.uid() guard enforces this — same model as get_or_create_conversation);
-- service_role drives the inbound path.
REVOKE ALL ON FUNCTION public.get_or_create_slack_conversation(uuid,uuid,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_or_create_slack_conversation(uuid,uuid,text,text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_slack_conversation(uuid,uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_slack_conversation(uuid,uuid,text,text,text) TO service_role;
