-- ============================================================
-- WORKSPACE HARDENING — invite + lifecycle + cleanup gaps
-- ============================================================
-- Closes:
--   N18: invite-accept email-match check (forwarded invite = takeover)
--   N19: missing FK CASCADE on workspace-scoped tables (orphan rows
--        survive hard_delete_workspace)
--   N30: My Workspace duplicate-creation race (no unique guard)
--   N31: invite-accept race (two simultaneous accepts both succeed
--        for different users)
--
-- N28 (archive setup_data_cleanup_cron.sql) is handled by file move,
-- not by this migration.

-- ════════════════════════════════════════════════════════════════════
-- N18 + N31: invite-accept email match + race protection
-- ════════════════════════════════════════════════════════════════════
-- Original accept_workspace_invite (20260226000006) only validated the
-- token; it did NOT check that the accepting user's email matched the
-- invite's target email. Anyone in possession of a forwarded invite
-- link could accept under a different account.
--
-- Adds:
--   1. SELECT … FOR UPDATE on the invite row to serialize concurrent
--      accepts.
--   2. lower(auth.users.email) match check against invite.email.
--   3. Re-validation of accepted_at and expires_at INSIDE the locked
--      transaction (not just before the lock).

CREATE OR REPLACE FUNCTION public.accept_workspace_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_invite        public.workspace_invites%ROWTYPE;
  v_user_id       UUID;
  v_user_email    TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Resolve the accepting user's verified email.
  SELECT lower(email) INTO v_user_email FROM auth.users WHERE id = v_user_id;
  IF v_user_email IS NULL OR v_user_email = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authenticated user has no email on file');
  END IF;

  -- Lock the invite row to serialize concurrent accepts.
  SELECT * INTO v_invite
  FROM public.workspace_invites
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite not found or already used');
  END IF;

  IF v_invite.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite has already been accepted');
  END IF;

  IF v_invite.expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite has expired');
  END IF;

  -- Email match — forwarded invite cannot be claimed under a different account.
  IF v_invite.email IS NULL OR lower(v_invite.email) IS DISTINCT FROM v_user_email THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Invite was sent to a different email address. Sign in with the invited email to accept.'
    );
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, invited_by)
  VALUES (v_invite.workspace_id, v_user_id, v_invite.role, v_invite.invited_by)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

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

-- ════════════════════════════════════════════════════════════════════
-- N19: backfill orphans, then add ON DELETE CASCADE FK
-- ════════════════════════════════════════════════════════════════════
-- The Phase-1 stub pattern (per audit C6) stored workspace_id =
-- auth.uid() instead of a real workspaces.id. Production had 6
-- task_activity rows + 44 tasks rows in this state, all blocking the
-- new FK. Backfill maps each stub workspace_id (which is actually the
-- owner's user.id) to that user's earliest non-deleted workspace.
-- Anything we still can't resolve is set to NULL (tasks) or deleted
-- (task_activity, where workspace_id is NOT NULL).

-- Backfill tasks
UPDATE tasks t
SET workspace_id = (
  SELECT w.id FROM workspaces w
  WHERE w.owner_id::text = t.user_id AND w.deleted_at IS NULL
  ORDER BY w.created_at ASC LIMIT 1
)
WHERE workspace_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM workspaces w2 WHERE w2.id = t.workspace_id);

UPDATE tasks t SET workspace_id = NULL
WHERE workspace_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id = t.workspace_id);

-- Backfill task_activity (try owner mapping, fall back to parent task)
UPDATE task_activity ta
SET workspace_id = COALESCE(
  (SELECT w.id FROM workspaces w WHERE w.owner_id = ta.workspace_id AND w.deleted_at IS NULL ORDER BY w.created_at ASC LIMIT 1),
  (SELECT t.workspace_id FROM tasks t WHERE t.id = ta.task_id AND t.workspace_id IS NOT NULL LIMIT 1)
)
WHERE NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id = ta.workspace_id);

DELETE FROM task_activity ta
WHERE NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id = ta.workspace_id);

-- Now safe to add FKs. Each ALTER is idempotent.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'subtasks'
      AND constraint_type = 'FOREIGN KEY' AND constraint_name = 'subtasks_workspace_fk'
  ) THEN
    ALTER TABLE public.subtasks
      ADD CONSTRAINT subtasks_workspace_fk
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'task_activity'
      AND constraint_type = 'FOREIGN KEY' AND constraint_name = 'task_activity_workspace_fk'
  ) THEN
    ALTER TABLE public.task_activity
      ADD CONSTRAINT task_activity_workspace_fk
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'workspace_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'tasks'
      AND constraint_type = 'FOREIGN KEY' AND constraint_name = 'tasks_workspace_fk'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_workspace_fk
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_calendars' AND column_name = 'workspace_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'team_calendars'
      AND constraint_type = 'FOREIGN KEY' AND constraint_name = 'team_calendars_workspace_fk'
  ) THEN
    ALTER TABLE public.team_calendars
      ADD CONSTRAINT team_calendars_workspace_fk
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════
-- N30: prevent duplicate "Personal Workspace" auto-creation race
-- ════════════════════════════════════════════════════════════════════
-- WorkspaceContext.tsx + the auth.users INSERT trigger both can attempt
-- to bootstrap a default workspace for a new user. Without a unique
-- guard, two simultaneous starts (e.g. signup + StrictMode double-mount)
-- can produce two "Personal Workspace" rows owned by the same user.
--
-- Partial unique index lets this constraint coexist with users having
-- multiple workspaces and lets users rename their personal workspace
-- (the index only covers rows with the literal default name).

CREATE UNIQUE INDEX IF NOT EXISTS workspaces_one_personal_per_owner
  ON public.workspaces (owner_id)
  WHERE name IN ('Personal Workspace', 'My Workspace') AND deleted_at IS NULL;
