-- Slack-Grounded Messages — P5 graduation trigger (scope §10). Global email -> Pulse-user
-- resolver (un-gated, unlike workspace-scoped discover_pulse_users): given a Slack contact's
-- email, return the matching real Pulse user's auth id so a slack thread can graduate to
-- native. Filters is_bot. Excludes the caller (you don't graduate a thread to yourself).
-- Read-only/STABLE. EXECUTE = authenticated (the graduation prompt) + service_role (future
-- inbound-routing); anon is revoked so it isn't an open email-enumeration oracle.
CREATE OR REPLACE FUNCTION public.resolve_pulse_user_by_email(p_email text)
RETURNS uuid
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE v_id uuid;
BEGIN
  IF p_email IS NULL OR p_email = '' THEN RETURN NULL; END IF;
  SELECT au.id INTO v_id
  FROM auth.users au
  JOIN public.pulse_users pu ON pu.auth_user_id = au.id
  WHERE lower(au.email) = lower(p_email)
    AND pu.is_bot IS NOT TRUE
    AND (auth.uid() IS NULL OR au.id <> auth.uid())   -- never resolve to the caller
  LIMIT 1;
  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_pulse_user_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_pulse_user_by_email(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolve_pulse_user_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_pulse_user_by_email(text) TO service_role;
