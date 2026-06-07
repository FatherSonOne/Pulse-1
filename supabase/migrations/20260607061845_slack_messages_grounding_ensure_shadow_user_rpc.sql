-- Slack-Grounded Messages — service-role shadow auth.users mint (scope §3/§7).
-- Mints (idempotently) the deterministic shadow auth.users row a Slack counterpart
-- needs to occupy a participant slot in pulse_conversations/pulse_messages (all 4
-- participant cols FK -> auth.users). The row is email-less (auth.users.email is
-- UNIQUE for non-SSO users -> would collide if the real person ever signs up; the
-- Slack email lives in raw_user_meta_data.external_email + pulse_conversations.
-- external_email instead) and carries raw_user_meta_data.pulse_shadow=true, which
-- the 4 auth.users onboarding triggers skip (migration 20260607061411) so it fires
-- ZERO side effects. Called by server.js (P2 send) and the slack-events edge fn (P3).
-- SECURITY DEFINER + service_role-only EXECUTE: this can mint auth users, so it must
-- never be reachable by anon/authenticated. Dry-run-rollback verified PASS 2026-06-07.

CREATE OR REPLACE FUNCTION public.ensure_slack_shadow_user(
  p_team_id       text,
  p_slack_user_id text,
  p_email         text DEFAULT NULL,
  p_display_name  text DEFAULT NULL
) RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  -- Fixed namespace for Pulse Slack shadow identities. DO NOT CHANGE: it anchors the
  -- deterministic uuidv5 so the same Slack person always maps to the same shadow row.
  v_namespace constant uuid := 'a1d5e9c2-7b34-4f6a-9c8d-5e2f1b0a3c4d';
  v_id uuid;
BEGIN
  IF p_team_id IS NULL OR p_slack_user_id IS NULL THEN
    RAISE EXCEPTION 'ensure_slack_shadow_user: team_id and slack_user_id are required';
  END IF;

  v_id := extensions.uuid_generate_v5(v_namespace, 'slack:' || p_team_id || ':' || p_slack_user_id);

  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    v_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    NULL,  -- email-less by design (see header)
    '{"provider":"slack_shadow","providers":["slack_shadow"]}'::jsonb,
    jsonb_strip_nulls(jsonb_build_object(
      'pulse_shadow',           true,
      'external_slack_user_id', p_slack_user_id,
      'external_slack_team_id', p_team_id,
      'external_email',         p_email,
      'external_display_name',  p_display_name
    )),
    now(), now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN v_id;
END;
$function$;

-- Lock it down: only the service role (server.js / edge fn) may mint shadow users.
REVOKE ALL ON FUNCTION public.ensure_slack_shadow_user(text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_slack_shadow_user(text,text,text,text) FROM anon;
REVOKE ALL ON FUNCTION public.ensure_slack_shadow_user(text,text,text,text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_slack_shadow_user(text,text,text,text) TO service_role;
