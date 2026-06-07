-- Slack-Grounded Messages — shadow auth.users mint guards (gates P2 + P3).
-- Prepend a pulse_shadow early-return to all 4 auth.users AFTER INSERT trigger fns so a
-- service-role shadow row (raw_user_meta_data->>'pulse_shadow' = 'true') fires ZERO onboarding
-- side effects: no workspace, no workspace_members, no pulse_users, no security_settings, no auto-join.
-- Real signups never set the flag (NULL = 'true' => not true) => completely unaffected.
-- Each fn's existing body + SET search_path is preserved verbatim; only the guard line is added.
-- Dry-run-rollback verified PASS 2026-06-07: shadow{ws:0 mem:0 pu:0 sec:0} normal{ws:1 mem:1 pu:1 sec:1}.
-- Scope: docs/SLACK_MESSAGES_GROUNDING_SCOPE_2026-06-06.md §3; handoff …_P2_HANDOFF_2026-06-07.md §3.

CREATE OR REPLACE FUNCTION public.auto_join_workspace_by_domain()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_domain       text;
  v_workspace_id uuid;
  v_max_users    integer;
  v_member_count integer;
BEGIN
  -- Pulse shadow rows (Slack-grounded Messages) are linkage stubs, not humans: skip onboarding side effects.
  IF NEW.raw_user_meta_data->>'pulse_shadow' = 'true' THEN RETURN NEW; END IF;

  IF new.email IS NULL OR new.email = '' THEN
    RETURN new;
  END IF;

  v_domain := lower(split_part(new.email, '@', 2));
  IF v_domain IS NULL OR v_domain = '' THEN
    RETURN new;
  END IF;

  FOR v_workspace_id IN
    SELECT id FROM public.workspaces
    WHERE auto_join_enabled = true AND lower(auto_join_domain) = v_domain AND deleted_at IS NULL
  LOOP
    SELECT max_users INTO v_max_users FROM public.entitlements WHERE workspace_id = v_workspace_id;
    IF v_max_users IS NOT NULL THEN
      SELECT count(*) INTO v_member_count FROM public.workspace_members WHERE workspace_id = v_workspace_id;
      IF v_member_count >= v_max_users THEN
        INSERT INTO public.billing_drift_log
          (workspace_id, source, expected_quantity, observed_quantity, error_message, metadata)
        VALUES
          (v_workspace_id, 'auto_join_domain', v_max_users, v_member_count,
           'auto-join blocked: workspace at member cap',
           jsonb_build_object('attempted_user_id', new.id, 'domain', v_domain));
        CONTINUE;
      END IF;
    END IF;
    INSERT INTO public.workspace_members (workspace_id, user_id, role, invited_by, joined_at)
    VALUES (v_workspace_id, new.id, 'member', null, now())
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  END LOOP;

  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.bootstrap_pulse_user_on_auth_insert()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
    -- Pulse shadow rows (Slack-grounded Messages) are linkage stubs, not humans: skip onboarding side effects.
    IF NEW.raw_user_meta_data->>'pulse_shadow' = 'true' THEN RETURN NEW; END IF;

    -- Best-effort: don't block auth signup if the bootstrap fails.
    BEGIN
        PERFORM public.ensure_pulse_user_for_auth(NEW.id);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'bootstrap_pulse_user_on_auth_insert failed for %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_default_security_settings()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
    -- Pulse shadow rows (Slack-grounded Messages) are linkage stubs, not humans: skip onboarding side effects.
    IF NEW.raw_user_meta_data->>'pulse_shadow' = 'true' THEN RETURN NEW; END IF;

    INSERT INTO public.security_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user_workspace()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
    v_workspace_id UUID;
    v_name         TEXT;
BEGIN
    -- Pulse shadow rows (Slack-grounded Messages) are linkage stubs, not humans: skip onboarding side effects.
    IF NEW.raw_user_meta_data->>'pulse_shadow' = 'true' THEN RETURN NEW; END IF;

    -- Derive a friendly workspace name from user metadata or email prefix
    v_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
        split_part(NEW.email, '@', 1)
    );

    INSERT INTO public.workspaces (name, owner_id)
    VALUES (v_name, NEW.id)
    RETURNING id INTO v_workspace_id;

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (v_workspace_id, NEW.id, 'owner');

    RETURN NEW;
END;
$function$;
