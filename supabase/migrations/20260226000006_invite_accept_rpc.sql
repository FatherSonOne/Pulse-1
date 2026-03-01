-- ============================================================
-- MIGRATION: 20260226000006_invite_accept_rpc.sql
-- PURPOSE:   Safe invite acceptance via SECURITY DEFINER RPC.
--
--            When a user accepts a workspace invite, they need to INSERT
--            into workspace_members for a workspace they don't yet belong to.
--            The existing workspace_members_insert policy only allows existing
--            admins/owners or the bootstrap path (workspace owner). Neither
--            applies to an invited non-owner.
--
--            Fix: a SECURITY DEFINER function validates the invite, inserts
--            the member row as the table owner (bypassing RLS), and marks the
--            invite accepted — all atomically.
--
-- DATE:      2026-02-26
-- DEPENDS:   20260226000005_fix_workspace_bootstrap.sql
-- SAFE:      Idempotent via CREATE OR REPLACE
-- ============================================================

BEGIN;

-- ============================================================
-- accept_workspace_invite(p_token)
--
-- Called by authenticated clients via supabase.rpc('accept_workspace_invite', { p_token })
-- Returns JSONB: { success, workspace_id, role } on success
--               { success: false, error } on failure
-- ============================================================

CREATE OR REPLACE FUNCTION public.accept_workspace_invite(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_invite  public.workspace_invites%ROWTYPE;
  v_user_id UUID;
BEGIN
  -- Require authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Look up the invite by token
  SELECT * INTO v_invite
  FROM public.workspace_invites
  WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite not found or already used');
  END IF;

  -- Validate state
  IF v_invite.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite has already been accepted');
  END IF;

  IF v_invite.expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite has expired');
  END IF;

  -- Insert member row — ON CONFLICT DO NOTHING so re-accepts are idempotent
  INSERT INTO public.workspace_members (workspace_id, user_id, role, invited_by)
  VALUES (v_invite.workspace_id, v_user_id, v_invite.role, v_invite.invited_by)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  -- Mark invite accepted
  UPDATE public.workspace_invites
  SET accepted_at = NOW()
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'success',      true,
    'workspace_id', v_invite.workspace_id::text,
    'role',         v_invite.role
  );
END;
$$;

COMMENT ON FUNCTION public.accept_workspace_invite(TEXT) IS
  'Validates a workspace invite token and adds the calling user as a member. '
  'SECURITY DEFINER so the insert bypasses RLS on workspace_members.';

-- Grant execute to authenticated users only
REVOKE ALL ON FUNCTION public.accept_workspace_invite(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.accept_workspace_invite(TEXT) TO authenticated;

COMMIT;
