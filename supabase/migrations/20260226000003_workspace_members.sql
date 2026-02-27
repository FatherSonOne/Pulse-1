-- ============================================================
-- MIGRATION: 20260226000003_workspace_members.sql
-- PURPOSE:   Phase 2 multi-tenancy — real workspace membership model.
--            Creates workspaces, workspace_members, workspace_invites,
--            auto-provisioning trigger, backfill for existing users,
--            and replaces the Phase 1 user_has_workspace_access() stub.
-- DATE:      2026-02-26
-- DEPENDS:   20260226000001_rls_lockdown.sql (defines Phase 1 helper)
-- SAFE:      Fully idempotent via IF NOT EXISTS / CREATE OR REPLACE
-- ============================================================

BEGIN;

-- ============================================================
-- SECTION 1: public.workspaces
-- Primary workspace registry.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workspaces (
    id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name        TEXT        NOT NULL,
    slug        TEXT        UNIQUE,
    description TEXT,
    avatar_url  TEXT,
    plan        TEXT        NOT NULL DEFAULT 'free'
                            CHECK (plan IN ('free', 'pro', 'team', 'enterprise')),
    owner_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.workspaces IS
    'Primary workspace registry. Each user gets one personal workspace on sign-up.';

-- ============================================================
-- SECTION 2: public.workspace_members
-- Maps users to workspaces with a role.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workspace_members (
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES auth.users(id)        ON DELETE CASCADE,
    role         TEXT NOT NULL DEFAULT 'member'
                      CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    invited_by   UUID          REFERENCES auth.users(id)        ON DELETE SET NULL,
    joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, user_id)
);

-- ============================================================
-- SECTION 3: public.workspace_invites
-- Pending e-mail invitations scoped to a workspace.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workspace_invites (
    id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    email        TEXT        NOT NULL,
    role         TEXT        NOT NULL DEFAULT 'member'
                             CHECK (role IN ('admin', 'member', 'viewer')),
    token        TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    invited_by   UUID                 REFERENCES auth.users(id) ON DELETE SET NULL,
    accepted_at  TIMESTAMPTZ,
    expires_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, email)
);

-- ============================================================
-- SECTION 4: Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id
    ON public.workspaces(owner_id);

CREATE INDEX IF NOT EXISTS idx_workspaces_slug
    ON public.workspaces(slug);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id
    ON public.workspace_members(user_id);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id
    ON public.workspace_members(workspace_id);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace_id
    ON public.workspace_invites(workspace_id);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_email
    ON public.workspace_invites(email);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_token
    ON public.workspace_invites(token);

-- ============================================================
-- SECTION 5: updated_at auto-maintenance trigger for workspaces
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_workspaces_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workspaces_updated_at ON public.workspaces;

CREATE TRIGGER trg_workspaces_updated_at
    BEFORE UPDATE ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.set_workspaces_updated_at();

-- ============================================================
-- SECTION 6: Auto-provision personal workspace on new user sign-up
-- Fires AFTER INSERT on auth.users.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_workspace()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_workspace_id UUID;
    v_name         TEXT;
BEGIN
    -- Derive a friendly workspace name from user metadata or email prefix
    v_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
        split_part(NEW.email, '@', 1)
    );

    INSERT INTO public.workspaces (name, owner_id)
    VALUES (v_name, NEW.id)
    RETURNING id INTO v_workspace_id;

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (v_workspace_id, NEW.id, 'owner');

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_workspace();

-- ============================================================
-- SECTION 7: Backfill existing users
-- Creates personal workspaces for users who don't yet have one.
-- Safe to re-run; the EXISTS guard prevents duplicate rows.
-- ============================================================

DO $$
DECLARE
    v_rec          RECORD;
    v_workspace_id UUID;
    v_name         TEXT;
BEGIN
    FOR v_rec IN
        SELECT u.id, u.email, u.raw_user_meta_data
        FROM   auth.users u
        WHERE  NOT EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE  wm.user_id = u.id
        )
    LOOP
        v_name := COALESCE(
            NULLIF(TRIM(v_rec.raw_user_meta_data->>'name'), ''),
            split_part(v_rec.email, '@', 1)
        );

        INSERT INTO public.workspaces (name, owner_id)
        VALUES (v_name, v_rec.id)
        RETURNING id INTO v_workspace_id;

        INSERT INTO public.workspace_members (workspace_id, user_id, role)
        VALUES (v_workspace_id, v_rec.id, 'owner');
    END LOOP;
END;
$$;

-- ============================================================
-- SECTION 8: Replace Phase 1 user_has_workspace_access() helper
-- Phase 2: checks workspace_members instead of uid = ws_id.
-- ============================================================

CREATE OR REPLACE FUNCTION public.user_has_workspace_access(ws_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, auth
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE  workspace_id = ws_id
          AND  user_id      = auth.uid()
    )
$$;

COMMENT ON FUNCTION public.user_has_workspace_access(UUID) IS
    'Phase 2: checks workspace_members table. Replaces Phase 1 uid=ws_id check.';

-- ============================================================
-- SECTION 9: Row-Level Security
-- ============================================================

-- ---- workspaces ----

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspaces_select     ON public.workspaces;
DROP POLICY IF EXISTS workspaces_insert     ON public.workspaces;
DROP POLICY IF EXISTS workspaces_update     ON public.workspaces;
DROP POLICY IF EXISTS workspaces_delete     ON public.workspaces;

-- Members can see workspaces they belong to
CREATE POLICY workspaces_select ON public.workspaces
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE  wm.workspace_id = id
              AND  wm.user_id      = auth.uid()
        )
    );

-- Only the owner creates a workspace (row-level owner_id enforcement)
CREATE POLICY workspaces_insert ON public.workspaces
    FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Owner or admin can update workspace metadata
CREATE POLICY workspaces_update ON public.workspaces
    FOR UPDATE USING (
        owner_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE  wm.workspace_id = id
              AND  wm.user_id      = auth.uid()
              AND  wm.role IN ('owner', 'admin')
        )
    );

-- Only the owner can delete the workspace
CREATE POLICY workspaces_delete ON public.workspaces
    FOR DELETE USING (owner_id = auth.uid());

-- ---- workspace_members ----

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_select ON public.workspace_members;
DROP POLICY IF EXISTS workspace_members_insert ON public.workspace_members;
DROP POLICY IF EXISTS workspace_members_update ON public.workspace_members;
DROP POLICY IF EXISTS workspace_members_delete ON public.workspace_members;

-- Any member of the workspace can see the full member list
CREATE POLICY workspace_members_select ON public.workspace_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE  wm.workspace_id = workspace_id
              AND  wm.user_id      = auth.uid()
        )
    );

-- Only owners/admins can add members
CREATE POLICY workspace_members_insert ON public.workspace_members
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE  wm.workspace_id = workspace_id
              AND  wm.user_id      = auth.uid()
              AND  wm.role IN ('owner', 'admin')
        )
    );

-- Owners/admins can update roles; a user cannot update their own role
CREATE POLICY workspace_members_update ON public.workspace_members
    FOR UPDATE USING (
        user_id <> auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE  wm.workspace_id = workspace_id
              AND  wm.user_id      = auth.uid()
              AND  wm.role IN ('owner', 'admin')
        )
    );

-- Owners/admins can remove anyone; users can remove themselves (leave)
CREATE POLICY workspace_members_delete ON public.workspace_members
    FOR DELETE USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE  wm.workspace_id = workspace_id
              AND  wm.user_id      = auth.uid()
              AND  wm.role IN ('owner', 'admin')
        )
    );

-- ---- workspace_invites ----

ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_invites_select ON public.workspace_invites;
DROP POLICY IF EXISTS workspace_invites_insert ON public.workspace_invites;
DROP POLICY IF EXISTS workspace_invites_delete ON public.workspace_invites;

-- Workspace owner/admin can see all invites; invitee sees their own
CREATE POLICY workspace_invites_select ON public.workspace_invites
    FOR SELECT USING (
        email = (SELECT email FROM auth.users WHERE id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE  wm.workspace_id = workspace_id
              AND  wm.user_id      = auth.uid()
              AND  wm.role IN ('owner', 'admin')
        )
    );

-- Only owners/admins can create invites
CREATE POLICY workspace_invites_insert ON public.workspace_invites
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE  wm.workspace_id = workspace_id
              AND  wm.user_id      = auth.uid()
              AND  wm.role IN ('owner', 'admin')
        )
    );

-- Only owners/admins can revoke/delete invites
CREATE POLICY workspace_invites_delete ON public.workspace_invites
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE  wm.workspace_id = workspace_id
              AND  wm.user_id      = auth.uid()
              AND  wm.role IN ('owner', 'admin')
        )
    );

COMMIT;
