-- ============================================================
-- MIGRATION: 20260226000005_fix_workspace_bootstrap.sql
-- PURPOSE:   Fix two chicken-and-egg RLS problems introduced in 000003/000004.
--
-- Problem A — workspaces SELECT during INSERT+RETURNING:
--   createWorkspace() does .insert().select(). After the workspace row is
--   inserted but before the workspace_members row exists, the SELECT policy
--   (wm_is_member) returns FALSE → PostgREST returns 403.
--   Fix: let the workspace owner always see their own workspace, even before
--   the member entry is created.
--
-- Problem B — workspace_members first-row INSERT:
--   After creating the workspace, the service inserts the owner into
--   workspace_members. The INSERT policy (wm_is_admin) checks existing
--   membership, but for a brand-new workspace there are no rows yet →
--   wm_is_admin returns FALSE → INSERT blocked.
--   Fix: allow the workspace's own owner to bootstrap the first member row.
--
-- DATE:      2026-02-26
-- DEPENDS:   20260226000004_fix_workspace_rls_recursion.sql
-- SAFE:      Idempotent via DROP IF EXISTS
-- ============================================================

BEGIN;

-- ── Fix A: workspaces SELECT ──────────────────────────────────────────────
-- Owner can always see their workspace; members can see workspaces they
-- belong to.  This allows the .insert().select() pattern to work because
-- the owner row is set at INSERT time, before the member entry exists.

DROP POLICY IF EXISTS workspaces_select ON public.workspaces;

CREATE POLICY workspaces_select ON public.workspaces
    FOR SELECT USING (
        owner_id = auth.uid()
        OR public.wm_is_member(id, auth.uid())
    );

-- ── Fix B: workspace_members INSERT bootstrap ─────────────────────────────
-- Two cases are permitted:
--   1. An existing admin/owner adds a new member (normal path).
--   2. A workspace owner inserts themselves as 'owner' when the table is
--      empty for that workspace (bootstrap path).  The EXISTS check on
--      workspaces ensures the caller really owns the target workspace.

DROP POLICY IF EXISTS workspace_members_insert ON public.workspace_members;

CREATE POLICY workspace_members_insert ON public.workspace_members
    FOR INSERT WITH CHECK (
        -- Normal path: admin/owner inviting someone
        public.wm_is_admin(workspace_id, auth.uid())

        -- Bootstrap path: owner creating their own first member row
        OR (
            user_id = auth.uid()
            AND role = 'owner'
            AND EXISTS (
                SELECT 1 FROM public.workspaces w
                WHERE  w.id       = workspace_id
                  AND  w.owner_id = auth.uid()
            )
        )
    );

COMMIT;
