-- ============================================================
-- MIGRATION: 20260405000004_workspace_deletion.sql
-- PURPOSE:   Workspace soft-delete with 30-day recovery window
--            and owner-only hard-delete for permanent removal.
-- DATE:      2026-04-05
-- DEPENDS:   20260226000003_workspace_members.sql
-- ============================================================

BEGIN;

-- ============================================================
-- SECTION 1: Add soft-delete columns to workspaces
-- ============================================================

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workspaces_deleted_at
  ON public.workspaces(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ============================================================
-- SECTION 2: Update RLS — exclude soft-deleted from normal SELECT
-- ============================================================

-- Drop and recreate the select policy to filter out deleted workspaces
DROP POLICY IF EXISTS workspaces_select ON public.workspaces;

CREATE POLICY workspaces_select ON public.workspaces
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = id
        AND wm.user_id = auth.uid()
    )
  );

-- New policy: owner can see their own soft-deleted workspaces (for interstitial)
DROP POLICY IF EXISTS workspaces_select_deleted ON public.workspaces;

CREATE POLICY workspaces_select_deleted ON public.workspaces
  FOR SELECT USING (
    deleted_at IS NOT NULL
    AND owner_id = auth.uid()
  );

-- ============================================================
-- SECTION 3: soft_delete_workspace RPC
-- Owner or admin can soft-delete a workspace.
-- ============================================================

CREATE OR REPLACE FUNCTION public.soft_delete_workspace(p_workspace_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Check caller is owner or admin
  SELECT role INTO v_role
  FROM public.workspace_members
  WHERE workspace_id = p_workspace_id
    AND user_id = auth.uid();

  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Permission denied: only owners and admins can archive a workspace';
  END IF;

  UPDATE public.workspaces
  SET deleted_at = NOW(),
      deleted_by = auth.uid()
  WHERE id = p_workspace_id
    AND deleted_at IS NULL;
END;
$$;

-- ============================================================
-- SECTION 4: hard_delete_workspace RPC
-- Owner-only permanent deletion.  FK cascades handle members,
-- invites, and any other workspace-scoped data.
-- ============================================================

CREATE OR REPLACE FUNCTION public.hard_delete_workspace(p_workspace_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Owner-only guard
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = p_workspace_id
      AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Permission denied: only the workspace owner can permanently delete';
  END IF;

  -- Hard-delete — FK ON DELETE CASCADE handles workspace_members,
  -- workspace_invites, and any other tables referencing workspaces(id).
  DELETE FROM public.workspaces
  WHERE id = p_workspace_id;
END;
$$;

-- ============================================================
-- SECTION 5: restore_workspace RPC
-- Owner-only, within 30-day recovery window.
-- ============================================================

CREATE OR REPLACE FUNCTION public.restore_workspace(p_workspace_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Owner-only guard + 30-day window
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = p_workspace_id
      AND owner_id = auth.uid()
      AND deleted_at IS NOT NULL
      AND deleted_at > NOW() - INTERVAL '30 days'
  ) THEN
    RAISE EXCEPTION 'Cannot restore: workspace not found, not deleted, not owned by you, or past 30-day recovery window';
  END IF;

  UPDATE public.workspaces
  SET deleted_at = NULL,
      deleted_by = NULL
  WHERE id = p_workspace_id;
END;
$$;

COMMIT;
