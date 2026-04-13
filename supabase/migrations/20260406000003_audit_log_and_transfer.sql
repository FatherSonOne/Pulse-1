-- Migration: Workspace audit log + ownership transfer RPC

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Audit log table
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.workspace_audit_log (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_id    UUID NOT NULL,
  action      TEXT NOT NULL,          -- e.g. 'workspace.created', 'member.added', 'role.changed'
  target_id   TEXT,                   -- user_id or invite email affected (nullable for workspace-level actions)
  metadata    JSONB DEFAULT '{}',     -- extra context (old_role, new_role, etc.)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_workspace ON public.workspace_audit_log (workspace_id, created_at DESC);
CREATE INDEX idx_audit_log_actor     ON public.workspace_audit_log (actor_id);

ALTER TABLE public.workspace_audit_log ENABLE ROW LEVEL SECURITY;

-- Workspace admins can read audit logs
CREATE POLICY "admins_read_audit_log"
  ON public.workspace_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_audit_log.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

-- Only service role / RPCs can write audit logs (not direct user inserts)
CREATE POLICY "service_role_write_audit_log"
  ON public.workspace_audit_log FOR INSERT
  WITH CHECK (false); -- blocked for anon/authenticated; RPCs use SECURITY DEFINER

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Helper: write an audit entry (SECURITY DEFINER so it bypasses RLS)
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.write_workspace_audit(
  p_workspace_id UUID,
  p_actor_id     UUID,
  p_action       TEXT,
  p_target_id    TEXT DEFAULT NULL,
  p_metadata     JSONB DEFAULT '{}'
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO workspace_audit_log (workspace_id, actor_id, action, target_id, metadata)
  VALUES (p_workspace_id, p_actor_id, p_action, p_target_id, p_metadata);
$$;

GRANT EXECUTE ON FUNCTION public.write_workspace_audit(UUID, UUID, TEXT, TEXT, JSONB) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. Ownership transfer RPC
-- ═══════════════════════════════════════════════════════════════════════

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

  -- Atomically swap roles
  UPDATE workspace_members SET role = 'admin'
   WHERE workspace_id = p_workspace_id AND user_id = v_caller;

  UPDATE workspace_members SET role = 'owner'
   WHERE workspace_id = p_workspace_id AND user_id = p_new_owner_id;

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
