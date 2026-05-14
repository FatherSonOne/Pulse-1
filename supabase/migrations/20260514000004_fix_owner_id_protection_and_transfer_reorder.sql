-- ============================================================
-- MIGRATION: 20260514000004_fix_owner_id_protection_and_transfer_reorder.sql
-- PURPOSE:   Two corrections to 20260514000003:
--
--   A. The column-level REVOKE UPDATE (owner_id) was ineffective
--      because `authenticated` holds the table-level UPDATE grant
--      on public.workspaces, which dominates column-level REVOKEs.
--      `has_column_privilege('authenticated', 'public.workspaces',
--      'owner_id', 'UPDATE')` still returns true post-20260514000003.
--
--      Replacing the REVOKE with a BEFORE UPDATE row trigger that
--      raises when NEW.owner_id IS DISTINCT FROM OLD.owner_id and
--      the per-transaction GUC `app.allow_owner_id_change` is not
--      set.  Trigger-based protection is future-proof against
--      columns added later.
--
--   B. `transfer_workspace_ownership` (20260406000003) currently
--      demotes the old owner BEFORE promoting the new one, which
--      transiently leaves the workspace with zero owners.  That
--      now collides with workspace_members_protect_last_owner
--      (20260514000003).  Reordering to promote-then-demote keeps
--      the "at least one owner exists at all times" invariant
--      throughout the transaction.
--
-- ISSUE:     #39  (Pulse-1)
-- PLAN DOC:  docs/plans/2026-05-14-team-mgmt-audit-revisal.md  § A.3
-- ============================================================

BEGIN;

-- ── A. owner_id protection via BEFORE UPDATE trigger ───────────

CREATE OR REPLACE FUNCTION public.workspaces_protect_owner_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    IF current_setting('app.allow_owner_id_change', true) <> 'on' THEN
      RAISE EXCEPTION
        'direct UPDATE of workspaces.owner_id is forbidden; use public.transfer_workspace_ownership(workspace_id, new_owner_id)'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workspaces_protect_owner_id ON public.workspaces;

CREATE TRIGGER workspaces_protect_owner_id
BEFORE UPDATE ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.workspaces_protect_owner_id();


-- ── B. Reorder transfer_workspace_ownership + set bypass flag ─

CREATE OR REPLACE FUNCTION public.transfer_workspace_ownership(
  p_workspace_id UUID,
  p_new_owner_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_current_role TEXT;
  v_new_member_exists BOOLEAN;
BEGIN
  -- Verify caller is the current owner
  SELECT role INTO v_current_role
    FROM workspace_members
   WHERE workspace_id = p_workspace_id AND user_id = v_caller;

  IF v_current_role IS NULL OR v_current_role <> 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the current owner can transfer ownership');
  END IF;

  -- Verify new owner is a member
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = p_new_owner_id
  ) INTO v_new_member_exists;

  IF NOT v_new_member_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target user is not a member of this workspace');
  END IF;

  -- Can't transfer to yourself
  IF v_caller = p_new_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are already the owner');
  END IF;

  -- Promote the new owner FIRST so the workspace never has zero owners.
  -- workspace_members_protect_last_owner sees count(remaining owners)=1 (the
  -- one we just promoted) when we later demote the previous owner, so the
  -- "at least one owner exists" invariant holds throughout this transaction.
  UPDATE workspace_members SET role = 'owner'
   WHERE workspace_id = p_workspace_id AND user_id = p_new_owner_id;

  UPDATE workspace_members SET role = 'admin'
   WHERE workspace_id = p_workspace_id AND user_id = v_caller;

  -- Allow this single owner_id mutation past the new workspaces_protect_owner_id
  -- trigger.  is_local=true so the GUC auto-resets at COMMIT/ROLLBACK.
  PERFORM set_config('app.allow_owner_id_change', 'on', true);

  UPDATE workspaces SET owner_id = p_new_owner_id, updated_at = now()
   WHERE id = p_workspace_id;

  -- Audit
  PERFORM write_workspace_audit(
    p_workspace_id, v_caller, 'ownership.transferred',
    p_new_owner_id::text,
    jsonb_build_object('previous_owner', v_caller)
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_workspace_ownership(UUID, UUID) TO authenticated;

COMMIT;

-- ── Post-deploy verification ────────────────────────────────────
--
-- 1. New trigger present:
--      SELECT trigger_name FROM information_schema.triggers
--      WHERE event_object_schema='public' AND event_object_table='workspaces'
--        AND trigger_name='workspaces_protect_owner_id';
--      -- expect: 1 row
--
-- 2. Behavioural: direct UPDATE of owner_id (as authenticated) → rejected.
--      UPDATE workspaces SET owner_id = '<self>' WHERE id = '<ws>';
--      -- expect: ERROR  direct UPDATE of workspaces.owner_id is forbidden …
--
-- 3. Behavioural: legitimate transfer via RPC → succeeds, owner_id updated.
--      SELECT public.transfer_workspace_ownership('<test_ws>', '<test_member>');
--      -- expect: {"success": true}
