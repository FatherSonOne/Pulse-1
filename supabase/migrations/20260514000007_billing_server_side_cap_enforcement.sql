-- ============================================================
-- MIGRATION: 20260514000007_billing_server_side_cap_enforcement.sql
-- PURPOSE:   Phase 2 of #40 — server-side enforcement of per-workspace
--            member caps inside the two membership entry points that
--            currently bypass the client-side check:
--
--   1. accept_workspace_invite RPC — no cap check today; 10 parallel
--      accepts on a workspace 1-under-cap all succeed and the workspace
--      lands over-cap.
--   2. auto_join_workspace_by_domain trigger — fires on auth.users
--      INSERT; no cap check today; a domain match silently inserts
--      regardless of how many members the workspace already has.
--
--            Both now consult public.entitlements.max_users for the
--            workspace.  NULL max_users = unlimited (no enforcement).
--            Missing entitlements row = unlimited (defensive default;
--            blocking acceptance would be worse than over-counting).
--
--            On bounce, auto_join queues a billing_drift_log entry
--            (source='auto_join_domain') so admins can see who hit the
--            cap.  accept_workspace_invite returns the standard
--            {success:false, error:'workspace_at_capacity'} JSON so the
--            UI can show a clear message.
--
-- ISSUE:     #40  (Pulse-1)  — Phase 2 of 2
-- PLAN DOC:  docs/plans/2026-05-14-team-mgmt-audit-revisal.md  § B
-- ============================================================

BEGIN;

-- ── accept_workspace_invite: add cap re-check before INSERT ─────

CREATE OR REPLACE FUNCTION public.accept_workspace_invite(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_invite       public.workspace_invites%ROWTYPE;
  v_user_id      UUID;
  v_user_email   TEXT;
  v_max_users    INTEGER;
  v_member_count INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT lower(email) INTO v_user_email FROM auth.users WHERE id = v_user_id;
  IF v_user_email IS NULL OR v_user_email = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authenticated user has no email on file');
  END IF;

  -- Lock the invite row so concurrent accepts on the same token serialize.
  SELECT * INTO v_invite FROM public.workspace_invites WHERE token = p_token FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite not found or already used');
  END IF;
  IF v_invite.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite has already been accepted');
  END IF;
  IF v_invite.expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite has expired');
  END IF;
  IF v_invite.email IS NULL OR lower(v_invite.email) IS DISTINCT FROM v_user_email THEN
    RETURN jsonb_build_object('success', false,
      'error', 'Invite was sent to a different email address. Sign in with the invited email to accept.');
  END IF;

  -- ── Cap re-check ─────────────────────────────────────────────
  -- Read the workspace's max_users from entitlements.  NULL or missing
  -- means unlimited.  This serializes against concurrent accepts because
  -- the invite row is locked above; the member count read here is
  -- accurate at the moment of insert.
  SELECT max_users INTO v_max_users
  FROM   public.entitlements
  WHERE  workspace_id = v_invite.workspace_id;

  IF v_max_users IS NOT NULL THEN
    SELECT count(*) INTO v_member_count
    FROM   public.workspace_members
    WHERE  workspace_id = v_invite.workspace_id;

    IF v_member_count >= v_max_users THEN
      RETURN jsonb_build_object(
        'success', false,
        'error',   'workspace_at_capacity',
        'message', format('This workspace is at its member cap (%s / %s). Ask an admin to upgrade the plan.',
                          v_member_count, v_max_users)
      );
    END IF;
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, invited_by)
  VALUES (v_invite.workspace_id, v_user_id, v_invite.role, v_invite.invited_by)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  UPDATE public.workspace_invites SET accepted_at = NOW() WHERE id = v_invite.id;

  RETURN jsonb_build_object('success', true,
    'workspace_id', v_invite.workspace_id::text, 'role', v_invite.role);
END;
$$;


-- ── auto_join_workspace_by_domain: skip + log when over cap ─────

CREATE OR REPLACE FUNCTION public.auto_join_workspace_by_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_domain       text;
  v_workspace_id uuid;
  v_max_users    integer;
  v_member_count integer;
BEGIN
  IF new.email IS NULL OR new.email = '' THEN
    RETURN new;
  END IF;

  v_domain := lower(split_part(new.email, '@', 2));
  IF v_domain IS NULL OR v_domain = '' THEN
    RETURN new;
  END IF;

  FOR v_workspace_id IN
    SELECT id
    FROM   public.workspaces
    WHERE  auto_join_enabled = true
      AND  lower(auto_join_domain) = v_domain
      AND  deleted_at IS NULL
  LOOP
    -- Cap check per matching workspace.  NULL or missing entitlements
    -- = unlimited.  When over cap, skip silently for this workspace
    -- AND record a billing_drift_log row so an admin can see the bounce.
    SELECT max_users INTO v_max_users
    FROM   public.entitlements
    WHERE  workspace_id = v_workspace_id;

    IF v_max_users IS NOT NULL THEN
      SELECT count(*) INTO v_member_count
      FROM   public.workspace_members
      WHERE  workspace_id = v_workspace_id;

      IF v_member_count >= v_max_users THEN
        -- Don't raise — that would block the auth.users INSERT and
        -- break the entire signup.  Skip + log.
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
$$;


COMMIT;

-- ── Post-deploy verification (run manually) ─────────────────────
--
-- 1. Function definitions updated:
--      SELECT pg_get_functiondef(p.oid)
--      FROM   pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--      WHERE  n.nspname='public'
--        AND  p.proname IN ('accept_workspace_invite','auto_join_workspace_by_domain');
--      -- expect: both bodies reference v_max_users + entitlements
--
-- 2. Behavioural smoke (run as authenticated test user with a valid invite
--    to a workspace at cap):
--      SELECT public.accept_workspace_invite('<token>');
--      -- expect: {"success": false, "error": "workspace_at_capacity", "message": "…N / N…"}
--
-- 3. Behavioural smoke (set entitlements.max_users = current_count for a
--    test workspace with auto_join enabled, then create a new auth user
--    with the matching domain):
--      INSERT INTO auth.users (id, email, …) VALUES (…, 'newuser@example.com', …);
--      SELECT count(*) FROM public.workspace_members WHERE workspace_id = '<test_ws>';
--      -- expect: count unchanged
--      SELECT source, error_message FROM public.billing_drift_log
--      WHERE  workspace_id = '<test_ws>' AND source = 'auto_join_domain'
--      ORDER  BY detected_at DESC LIMIT 1;
--      -- expect: one row with 'auto-join blocked: workspace at member cap'
