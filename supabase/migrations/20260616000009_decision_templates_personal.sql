-- Migration: 20260616000009_decision_templates_personal.sql
-- Fix the personal-template model (launch-readiness 2c follow-up).
--
-- After 0.4, decision_templates SELECT exposed EVERY workspace_id-NULL row globally
-- (`workspace_id IS NULL OR ...`), and INSERT required user_has_workspace_access,
-- which rejects a NULL workspace. So the wizard's "share = off" path (workspace_id
-- NULL personal template) couldn't be saved AND would have leaked to all users if
-- it had. Root cause: workspace_id NULL meant BOTH "system/global" and "personal".
--
-- New model distinguishes three kinds:
--   • system  — is_system = true                          → visible to everyone
--   • shared  — workspace_id set + member access           → visible to the workspace
--   • personal — workspace_id NULL + is_system = false + created_by = me → creator only
--
-- Verified live (2026-06-16): all 5 existing templates are is_system=true,
-- workspace_id NULL, created_by NULL (global seeds); 0 personal, 0 shared.
-- created_by is uuid (matches auth.uid()). Owner-based UPDATE/DELETE are unchanged.

DROP POLICY IF EXISTS decision_templates_select ON public.decision_templates;
DROP POLICY IF EXISTS decision_templates_insert ON public.decision_templates;

CREATE POLICY decision_templates_select ON public.decision_templates
  FOR SELECT USING (
    is_active = true
    AND (
      is_system = true
      OR (workspace_id IS NOT NULL AND public.user_has_workspace_access(workspace_id))
      OR (workspace_id IS NULL AND created_by = auth.uid())
    )
  );

CREATE POLICY decision_templates_insert ON public.decision_templates
  FOR INSERT WITH CHECK (
    is_system = false
    AND (
      (workspace_id IS NOT NULL AND public.user_has_workspace_access(workspace_id))
      OR (workspace_id IS NULL AND created_by = auth.uid())
    )
  );
