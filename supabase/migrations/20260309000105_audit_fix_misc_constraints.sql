-- ============================================================
-- MIGRATION: 20260309000105_audit_fix_misc_constraints.sql
-- PURPOSE:   Batch of smaller fixes from 2026-03-09 audit:
--            1. workspace_invites: use auth.email() in SELECT policy
--            2. workspace_invites: add missing UPDATE policy
--            3. workspace_invites: add index on expires_at for pending filter
--            4. video_vox_ai_queue: remove deprecated auth.role() policy
--            5. ai_lab_workflows/templates: add updated_at triggers
--            6. video_vox_conversation_members: add DELETE policy (leave conversation)
--            7. email_campaigns: wrap in transaction (already applied; guard only)
-- SAFE:      Idempotent via DROP IF EXISTS / CREATE OR REPLACE
-- ============================================================

BEGIN;

-- ── 1 & 2: workspace_invites policy fixes ───────────────────

DROP POLICY IF EXISTS workspace_invites_select ON public.workspace_invites;

CREATE POLICY workspace_invites_select ON public.workspace_invites
    FOR SELECT USING (
        -- Invitee sees their own invite (use built-in auth.email())
        email = auth.email()
        OR EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE  wm.workspace_id = workspace_id
              AND  wm.user_id      = auth.uid()
              AND  wm.role IN ('owner', 'admin')
        )
    );

-- Add missing UPDATE policy (for admins to update invite details)
DROP POLICY IF EXISTS workspace_invites_update ON public.workspace_invites;

CREATE POLICY workspace_invites_update ON public.workspace_invites
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE  wm.workspace_id = workspace_id
              AND  wm.user_id      = auth.uid()
              AND  wm.role IN ('owner', 'admin')
        )
    );

-- ── 3: index on expires_at for pending invite queries ───────

CREATE INDEX IF NOT EXISTS idx_workspace_invites_expires_pending
    ON public.workspace_invites(expires_at)
    WHERE accepted_at IS NULL;

-- ── 4: Remove deprecated auth.role() policy from video_vox_ai_queue ──
-- service_role bypasses RLS automatically; this policy is redundant AND deprecated.

DROP POLICY IF EXISTS "Service role can manage AI queue" ON public.video_vox_ai_queue;

-- ── 5: Add updated_at triggers to ai_lab tables ─────────────

DROP TRIGGER IF EXISTS trg_ai_lab_workflows_updated_at ON public.ai_lab_workflows;
CREATE TRIGGER trg_ai_lab_workflows_updated_at
    BEFORE UPDATE ON public.ai_lab_workflows
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_ai_lab_templates_updated_at ON public.ai_lab_templates;
CREATE TRIGGER trg_ai_lab_templates_updated_at
    BEFORE UPDATE ON public.ai_lab_templates
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 6: Allow users to leave video vox conversations ─────────

DROP POLICY IF EXISTS "Users can leave conversations" ON public.video_vox_conversation_members;

CREATE POLICY "Users can leave conversations"
    ON public.video_vox_conversation_members
    FOR DELETE
    USING (auth.uid() = user_id);

-- ── 7: Revoke public execute on get_search_suggestions ──────

REVOKE ALL ON FUNCTION public.get_search_suggestions(TEXT, UUID, INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_search_suggestions(TEXT, UUID, INTEGER) TO authenticated;

COMMIT;
