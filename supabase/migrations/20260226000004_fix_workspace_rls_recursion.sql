-- ============================================================
-- MIGRATION: 20260226000004_fix_workspace_rls_recursion.sql
-- PURPOSE:   Fix infinite recursion in workspace_members RLS policies.
--
--            The policies added in migration 003 query workspace_members
--            from within policies ON workspace_members.  Postgres evaluates
--            RLS before executing the query, so each check triggers the
--            policy again → stack overflow (HTTP 500).
--
--            Fix: expose a SECURITY DEFINER helper that queries the table
--            as the role owner, bypassing RLS.  All workspace_members
--            policies delegate to this function instead of self-joining.
--
-- DATE:      2026-02-26
-- DEPENDS:   20260226000003_workspace_members.sql
-- SAFE:      Idempotent via CREATE OR REPLACE / DROP IF EXISTS
-- ============================================================

BEGIN;

-- ============================================================
-- SECTION 1: SECURITY DEFINER helper
--
-- Runs as the table owner → no RLS → no recursion.
-- Intentionally kept private (no GRANT to public).
-- ============================================================

CREATE OR REPLACE FUNCTION public.wm_is_member(ws_id UUID, uid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE  workspace_id = ws_id
          AND  user_id      = uid
    );
$$;

CREATE OR REPLACE FUNCTION public.wm_is_admin(ws_id UUID, uid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE  workspace_id = ws_id
          AND  user_id      = uid
          AND  role IN ('owner', 'admin')
    );
$$;

-- ============================================================
-- SECTION 2: Replace recursive workspace_members policies
-- ============================================================

DROP POLICY IF EXISTS workspace_members_select ON public.workspace_members;
DROP POLICY IF EXISTS workspace_members_insert ON public.workspace_members;
DROP POLICY IF EXISTS workspace_members_update ON public.workspace_members;
DROP POLICY IF EXISTS workspace_members_delete ON public.workspace_members;

-- Any member of the workspace can read the full member list
CREATE POLICY workspace_members_select ON public.workspace_members
    FOR SELECT USING (
        public.wm_is_member(workspace_id, auth.uid())
    );

-- Only owners/admins can add members
CREATE POLICY workspace_members_insert ON public.workspace_members
    FOR INSERT WITH CHECK (
        public.wm_is_admin(workspace_id, auth.uid())
    );

-- Owners/admins can update roles; users cannot change their own role
CREATE POLICY workspace_members_update ON public.workspace_members
    FOR UPDATE USING (
        user_id <> auth.uid()
        AND public.wm_is_admin(workspace_id, auth.uid())
    );

-- Owners/admins can remove anyone; users can remove themselves (leave)
CREATE POLICY workspace_members_delete ON public.workspace_members
    FOR DELETE USING (
        user_id = auth.uid()
        OR public.wm_is_admin(workspace_id, auth.uid())
    );

-- ============================================================
-- SECTION 3: Also fix workspaces policies that joined workspace_members
--            (those are fine — different table — but replace them to use
--             the helper for consistency and future-proofing)
-- ============================================================

DROP POLICY IF EXISTS workspaces_select ON public.workspaces;
DROP POLICY IF EXISTS workspaces_update ON public.workspaces;

CREATE POLICY workspaces_select ON public.workspaces
    FOR SELECT USING (
        public.wm_is_member(id, auth.uid())
    );

CREATE POLICY workspaces_update ON public.workspaces
    FOR UPDATE USING (
        owner_id = auth.uid()
        OR public.wm_is_admin(id, auth.uid())
    );

-- ============================================================
-- SECTION 4: Also fix user_has_workspace_access() to use the helper
--            (avoids an extra self-join when called from other policies)
-- ============================================================

CREATE OR REPLACE FUNCTION public.user_has_workspace_access(ws_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, auth
AS $$
    SELECT public.wm_is_member(ws_id, auth.uid())
$$;

COMMENT ON FUNCTION public.user_has_workspace_access(UUID) IS
    'Phase 2 (patched): delegates to wm_is_member() to avoid RLS recursion.';

COMMIT;
