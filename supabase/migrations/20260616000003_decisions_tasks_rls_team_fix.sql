-- Decisions & Tasks — Sprint 0 RLS team-collaboration fixes
-- Source: docs/launch-readiness/decisions-tasks-launch-readiness-2026-06-16.md (Sprint 0, items 0.1–0.4)
--
-- Root cause: the rls_lockdown pass (20260226000001) rewrote decisions/extracted_tasks
-- to the canonical user_has_workspace_access() helper but SKIPPED subtasks/task_activity
-- (they kept the broken `workspace_id = auth.uid()` self-comparison from 20260222000002),
-- and decision_votes was given an owner-only ALL policy that is correct for writes but
-- hides teammates' votes on read. decision_templates / decision_tasks gate on
-- workspace_participants (verified 0 rows) instead of canonical workspace membership.
--
-- Pre-flight verified against live pg_policies + information_schema on pulse-chat
-- (ucaeuszgoihoyrvhewxk), 2026-06-16:
--   subtasks.workspace_id           uuid NOT NULL   (0 rows)
--   task_activity.workspace_id      uuid NOT NULL   (6 rows, all real workspace ids)
--   decision_votes.user_id          text NOT NULL ; decision_votes.decision_id uuid NOT NULL
--   decisions.workspace_id          uuid NULL
--   decision_templates.workspace_id uuid NULL ; created_by uuid ; columns is_active, is_system exist
--   decision_tasks.decision_id      uuid NOT NULL
--   user_has_workspace_access(ws_id uuid) -> boolean, STABLE SECURITY DEFINER (no RLS recursion)

-- ============================================================
-- Item 0.2 — subtasks: replace self-comparison with workspace access
-- ============================================================
DROP POLICY IF EXISTS "Users can view subtasks in their workspace"   ON public.subtasks;
DROP POLICY IF EXISTS "Users can insert subtasks in their workspace" ON public.subtasks;
DROP POLICY IF EXISTS "Users can update subtasks in their workspace" ON public.subtasks;
DROP POLICY IF EXISTS "Users can delete subtasks in their workspace" ON public.subtasks;

CREATE POLICY subtasks_workspace_select ON public.subtasks
  FOR SELECT USING (public.user_has_workspace_access(workspace_id));
CREATE POLICY subtasks_workspace_insert ON public.subtasks
  FOR INSERT WITH CHECK (public.user_has_workspace_access(workspace_id));
CREATE POLICY subtasks_workspace_update ON public.subtasks
  FOR UPDATE USING (public.user_has_workspace_access(workspace_id))
             WITH CHECK (public.user_has_workspace_access(workspace_id));
CREATE POLICY subtasks_workspace_delete ON public.subtasks
  FOR DELETE USING (public.user_has_workspace_access(workspace_id));

-- ============================================================
-- Item 0.3 — task_activity: same fix (SELECT + INSERT).
-- Writes also arrive via the SECURITY DEFINER trigger log_task_status_change,
-- which bypasses RLS and is unaffected; client inserts (taskActivityService,
-- subtaskService.logSubtaskActivity) now pass for real workspace members.
-- ============================================================
DROP POLICY IF EXISTS "Users can view activity in their workspace"   ON public.task_activity;
DROP POLICY IF EXISTS "Users can insert activity in their workspace" ON public.task_activity;

CREATE POLICY task_activity_workspace_select ON public.task_activity
  FOR SELECT USING (public.user_has_workspace_access(workspace_id));
CREATE POLICY task_activity_workspace_insert ON public.task_activity
  FOR INSERT WITH CHECK (public.user_has_workspace_access(workspace_id));

-- ============================================================
-- Item 0.1 — decision_votes: keep owner-only writes, add a workspace-scoped read
-- so the full team tally / consensus (>=3 votes) is visible to every member.
-- decision_votes has no workspace_id, so scope through the parent decision.
-- The owner clause guarantees you always see your own vote (covers solo /
-- NULL-workspace decisions); the EXISTS clause adds teammates' votes.
-- ============================================================
DROP POLICY IF EXISTS decision_votes_owner_all ON public.decision_votes;

CREATE POLICY decision_votes_owner_insert ON public.decision_votes
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY decision_votes_owner_update ON public.decision_votes
  FOR UPDATE USING (user_id = auth.uid()::text)
             WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY decision_votes_owner_delete ON public.decision_votes
  FOR DELETE USING (user_id = auth.uid()::text);

CREATE POLICY decision_votes_workspace_select ON public.decision_votes
  FOR SELECT USING (
    user_id = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.decisions d
      WHERE d.id = decision_votes.decision_id
        AND (d.workspace_id IS NULL OR public.user_has_workspace_access(d.workspace_id))
    )
  );

-- ============================================================
-- Item 0.4 — decision_templates / decision_tasks: workspace_participants (0 rows)
-- -> canonical user_has_workspace_access(). Owner-based UPDATE/DELETE left intact
-- (they correctly key off created_by + is_system and are not broken).
-- ============================================================
DROP POLICY IF EXISTS "Users can view accessible templates"         ON public.decision_templates;
DROP POLICY IF EXISTS "Users can create templates in own workspace" ON public.decision_templates;

CREATE POLICY decision_templates_select ON public.decision_templates
  FOR SELECT USING (
    is_active = true
    AND (workspace_id IS NULL OR public.user_has_workspace_access(workspace_id))
  );
CREATE POLICY decision_templates_insert ON public.decision_templates
  FOR INSERT WITH CHECK (
    public.user_has_workspace_access(workspace_id)
    AND is_system = false
  );

DROP POLICY IF EXISTS "Users can view decision_tasks for accessible decisions"   ON public.decision_tasks;
DROP POLICY IF EXISTS "Users can create decision_tasks for accessible decisions" ON public.decision_tasks;

CREATE POLICY decision_tasks_select ON public.decision_tasks
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.decisions d
    WHERE d.id = decision_tasks.decision_id
      AND (d.workspace_id IS NULL OR public.user_has_workspace_access(d.workspace_id))
  ));
CREATE POLICY decision_tasks_insert ON public.decision_tasks
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.decisions d
    WHERE d.id = decision_tasks.decision_id
      AND (d.workspace_id IS NULL OR public.user_has_workspace_access(d.workspace_id))
  ));
