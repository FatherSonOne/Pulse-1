-- ============================================================
-- MIGRATION: 20260514000002_fix_workspace_invites_rls_self_reference.sql
-- PURPOSE:   Hotfix for cross-tenant data leak on public.workspace_invites.
--
--            The four existing policies use an unqualified `workspace_id`
--            on the right-hand side of the membership join:
--
--                WHERE wm.workspace_id = workspace_id   -- ← bug
--
--            PostgreSQL resolves the unqualified `workspace_id` to the
--            innermost scope (the wm subquery's own column), so the
--            predicate becomes `wm.workspace_id = wm.workspace_id` —
--            always TRUE. Any authenticated user who is owner/admin of
--            ANY workspace can SELECT / INSERT / UPDATE / DELETE invites
--            of EVERY other workspace.
--
--            This migration drops the four broken policies and recreates
--            them with the outer column fully qualified:
--
--                WHERE wm.workspace_id = workspace_invites.workspace_id
--
-- ISSUE:     #38  (Pulse-1)
-- EPIC:      #33  (Workspace data-isolation hardening)
-- PLAN DOC:  docs/plans/2026-05-14-team-mgmt-audit-revisal.md  § A.2
--
-- HISTORY:
--   - 20260226000003_workspace_members.sql lines 305-341 — introduced the
--     SELECT / INSERT / DELETE policies with the bug.
--   - 20260309000105_audit_fix_misc_constraints.sql lines 18-43 — replaced
--     SELECT and added UPDATE, propagating the bug.
-- ============================================================

BEGIN;

-- Defense in depth: ensure RLS is on.  Already enabled by the base
-- migration; this is a no-op if already on, raises clearly if not.
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

-- ── Drop all four broken policies ─────────────────────────────
DROP POLICY IF EXISTS workspace_invites_select ON public.workspace_invites;
DROP POLICY IF EXISTS workspace_invites_insert ON public.workspace_invites;
DROP POLICY IF EXISTS workspace_invites_update ON public.workspace_invites;
DROP POLICY IF EXISTS workspace_invites_delete ON public.workspace_invites;

-- ── Recreate with workspace_invites.workspace_id qualified ────

-- Invitee sees their own pending invite by email; admins of the
-- INVITE's workspace can see all of it.
CREATE POLICY workspace_invites_select ON public.workspace_invites
    FOR SELECT
    USING (
        email = auth.email()
        OR EXISTS (
            SELECT 1
            FROM public.workspace_members wm
            WHERE wm.workspace_id = public.workspace_invites.workspace_id
              AND wm.user_id      = auth.uid()
              AND wm.role IN ('owner', 'admin')
        )
    );

-- Only owners/admins of the target workspace can create invites for it.
CREATE POLICY workspace_invites_insert ON public.workspace_invites
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.workspace_members wm
            WHERE wm.workspace_id = public.workspace_invites.workspace_id
              AND wm.user_id      = auth.uid()
              AND wm.role IN ('owner', 'admin')
        )
    );

-- Only owners/admins of the target workspace can update its invites
-- (e.g. extending expires_at, rotating role on resend).
CREATE POLICY workspace_invites_update ON public.workspace_invites
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM public.workspace_members wm
            WHERE wm.workspace_id = public.workspace_invites.workspace_id
              AND wm.user_id      = auth.uid()
              AND wm.role IN ('owner', 'admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.workspace_members wm
            WHERE wm.workspace_id = public.workspace_invites.workspace_id
              AND wm.user_id      = auth.uid()
              AND wm.role IN ('owner', 'admin')
        )
    );

-- Only owners/admins of the target workspace can revoke/delete its invites.
CREATE POLICY workspace_invites_delete ON public.workspace_invites
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1
            FROM public.workspace_members wm
            WHERE wm.workspace_id = public.workspace_invites.workspace_id
              AND wm.user_id      = auth.uid()
              AND wm.role IN ('owner', 'admin')
        )
    );

COMMIT;

-- ── Post-deploy verification (run manually after apply) ───────
--
-- 1. Confirm every qual now references workspace_invites.workspace_id:
--
--    SELECT policyname, qual::text, with_check::text
--    FROM   pg_policies
--    WHERE  schemaname = 'public'
--      AND  tablename  = 'workspace_invites'
--    ORDER  BY policyname;
--
-- 2. Cross-tenant SELECT smoke test (as admin of workspace A):
--
--    SELECT count(*)
--    FROM   public.workspace_invites
--    WHERE  workspace_id = '<some_other_workspace_uuid>';
--    -- expected: 0 rows visible (was: full row set pre-fix)
--
-- 3. Legitimate-flow smoke tests (run as admin of own workspace):
--    - list own pending invites      → returns own workspace's rows
--    - create new invite             → succeeds
--    - extend expiry on own invite   → succeeds
--    - revoke own invite             → succeeds
--    - invitee (different account) sees their own invite by email → succeeds
