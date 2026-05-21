-- 20260521000000_permissions_catalog_substrate.sql
-- Issue #42 Sub-PR 1 — permissions catalog substrate.
--
-- Adds the three foundation tables for the permissions epic. No application
-- code consumes them yet; that's intentional. RLS still enforces via
-- workspace_members.role IN ('owner','admin'). Sub-PR 3 introduces the
-- resolver, Sub-PR 4 migrates RLS policies one resource at a time.
--
-- Tables:
--   permissions       — global taxonomy (23 seed rows mirror RolePermissionsMatrixCard)
--   workspace_roles   — per-workspace roles (4 system roles seeded for each)
--   role_permissions  — role → permission grants
--
-- A trigger on workspaces seeds the 4 system roles for any future workspace,
-- so the substrate stays consistent without requiring Sub-PR 2+ to land.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. permissions catalog (global)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.permissions (
  key         text PRIMARY KEY,
  category    text NOT NULL,
  description text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS permissions_select_authenticated ON public.permissions;
CREATE POLICY permissions_select_authenticated
  ON public.permissions
  FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policies — taxonomy is service-role only.

-- ---------------------------------------------------------------------------
-- 2. workspace_roles (per-workspace)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_roles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  key          text NOT NULL,
  name         text NOT NULL,
  is_system    boolean NOT NULL DEFAULT false,
  rank         int NOT NULL DEFAULT 100,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, key)
);
CREATE INDEX IF NOT EXISTS workspace_roles_workspace_idx
  ON public.workspace_roles(workspace_id);

ALTER TABLE public.workspace_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_roles_select_member ON public.workspace_roles;
CREATE POLICY workspace_roles_select_member
  ON public.workspace_roles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_roles.workspace_id
        AND wm.user_id      = auth.uid()
    )
  );

DROP POLICY IF EXISTS workspace_roles_insert_admin ON public.workspace_roles;
CREATE POLICY workspace_roles_insert_admin
  ON public.workspace_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_system = false
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_roles.workspace_id
        AND wm.user_id      = auth.uid()
        AND wm.role         IN ('owner','admin')
    )
  );

DROP POLICY IF EXISTS workspace_roles_update_admin ON public.workspace_roles;
CREATE POLICY workspace_roles_update_admin
  ON public.workspace_roles
  FOR UPDATE
  TO authenticated
  USING (
    is_system = false
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_roles.workspace_id
        AND wm.user_id      = auth.uid()
        AND wm.role         IN ('owner','admin')
    )
  )
  WITH CHECK (
    is_system = false
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_roles.workspace_id
        AND wm.user_id      = auth.uid()
        AND wm.role         IN ('owner','admin')
    )
  );

DROP POLICY IF EXISTS workspace_roles_delete_admin ON public.workspace_roles;
CREATE POLICY workspace_roles_delete_admin
  ON public.workspace_roles
  FOR DELETE
  TO authenticated
  USING (
    is_system = false
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_roles.workspace_id
        AND wm.user_id      = auth.uid()
        AND wm.role         IN ('owner','admin')
    )
  );

-- ---------------------------------------------------------------------------
-- 3. role_permissions junction
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id        uuid NOT NULL REFERENCES public.workspace_roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.permissions(key)    ON DELETE CASCADE,
  granted_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_key)
);
CREATE INDEX IF NOT EXISTS role_permissions_role_idx
  ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS role_permissions_permission_idx
  ON public.role_permissions(permission_key);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS role_permissions_select_member ON public.role_permissions;
CREATE POLICY role_permissions_select_member
  ON public.role_permissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.workspace_roles wr
        JOIN public.workspace_members wm ON wm.workspace_id = wr.workspace_id
       WHERE wr.id      = role_permissions.role_id
         AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS role_permissions_insert_admin ON public.role_permissions;
CREATE POLICY role_permissions_insert_admin
  ON public.role_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.workspace_roles wr
        JOIN public.workspace_members wm ON wm.workspace_id = wr.workspace_id
       WHERE wr.id        = role_permissions.role_id
         AND wr.is_system = false
         AND wm.user_id   = auth.uid()
         AND wm.role      IN ('owner','admin')
    )
  );

DROP POLICY IF EXISTS role_permissions_delete_admin ON public.role_permissions;
CREATE POLICY role_permissions_delete_admin
  ON public.role_permissions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.workspace_roles wr
        JOIN public.workspace_members wm ON wm.workspace_id = wr.workspace_id
       WHERE wr.id        = role_permissions.role_id
         AND wr.is_system = false
         AND wm.user_id   = auth.uid()
         AND wm.role      IN ('owner','admin')
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Seed the permission taxonomy (mirrors RolePermissionsMatrixCard.tsx:34-72)
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions (key, category, description) VALUES
  -- Use product
  ('workspace.read',                'Use product',  'Sign in and use the workspace'),
  ('workspace.use',                 'Use product',  'Send messages, voxes, and use AI'),
  ('integrations.personal.connect', 'Use product',  'Connect personal integrations (per-user OAuth: Gmail, Calendar, etc.)'),
  -- Members
  ('members.read',                  'Members',      'View team roster'),
  ('members.invite',                'Members',      'Invite new members'),
  ('members.invite_bulk',           'Members',      'Bulk invite via CSV'),
  ('members.update_role',           'Members',      'Change member roles (cannot change owner role)'),
  ('members.remove',                'Members',      'Remove members'),
  ('groups.manage',                 'Members',      'Create and manage workspace groups'),
  -- Organization
  ('workspace.update',              'Organization', 'Edit org profile (name, logo, etc.)'),
  ('workspace.policy.auto_join',    'Organization', 'Manage membership policy (auto-join by domain)'),
  ('integrations.workspace.manage', 'Organization', 'Manage workspace-shared integrations'),
  ('workspace.archive',             'Organization', 'Archive (soft-delete) workspace'),
  ('workspace.transfer',            'Organization', 'Transfer workspace ownership'),
  ('workspace.delete',              'Organization', 'Permanently delete workspace (blocked while legal hold is active)'),
  -- Security
  ('security.activity.read',        'Security',     'View sign-in activity for all members'),
  ('security.policy.write',         'Security',     'Configure 2FA / session / IP allowlist'),
  ('security.2fa.self',             'Security',     'Enroll personal 2FA'),
  -- Billing
  ('billing.read',                  'Billing',      'View plan and invoices'),
  ('billing.write',                 'Billing',      'Change plan or payment method'),
  -- Compliance
  ('audit.read',                    'Compliance',   'View audit log'),
  ('audit.export',                  'Compliance',   'Export audit log (CSV)'),
  ('compliance.legal_hold',         'Compliance',   'Toggle legal hold')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Seed 4 system roles + matrix-derived grants for every existing workspace
-- ---------------------------------------------------------------------------
DO $seed$
DECLARE
  ws record;
  v_role_id uuid;
  v_owner_perms  text[] := ARRAY[
    'workspace.read','workspace.use','integrations.personal.connect',
    'members.read','members.invite','members.invite_bulk','members.update_role','members.remove','groups.manage',
    'workspace.update','workspace.policy.auto_join','integrations.workspace.manage',
    'workspace.archive','workspace.transfer','workspace.delete',
    'security.activity.read','security.policy.write','security.2fa.self',
    'billing.read','billing.write',
    'audit.read','audit.export','compliance.legal_hold'
  ];
  v_admin_perms  text[] := ARRAY[
    'workspace.read','workspace.use','integrations.personal.connect',
    'members.read','members.invite','members.invite_bulk','members.update_role','members.remove','groups.manage',
    'workspace.update','workspace.policy.auto_join','integrations.workspace.manage',
    'workspace.archive',
    'security.activity.read','security.policy.write','security.2fa.self',
    'billing.read',
    'audit.read','audit.export'
  ];
  v_member_perms text[] := ARRAY[
    'workspace.read','workspace.use','integrations.personal.connect',
    'members.read',
    'security.2fa.self'
  ];
  v_viewer_perms text[] := ARRAY[
    'workspace.read',
    'members.read'
  ];
  k text;
BEGIN
  FOR ws IN SELECT id FROM public.workspaces LOOP
    -- owner
    INSERT INTO public.workspace_roles (workspace_id, key, name, is_system, rank)
      VALUES (ws.id, 'owner', 'Owner', true, 10)
      ON CONFLICT (workspace_id, key) DO NOTHING;
    SELECT id INTO v_role_id FROM public.workspace_roles WHERE workspace_id = ws.id AND key = 'owner';
    FOREACH k IN ARRAY v_owner_perms LOOP
      INSERT INTO public.role_permissions (role_id, permission_key) VALUES (v_role_id, k) ON CONFLICT DO NOTHING;
    END LOOP;

    -- admin
    INSERT INTO public.workspace_roles (workspace_id, key, name, is_system, rank)
      VALUES (ws.id, 'admin', 'Admin', true, 20)
      ON CONFLICT (workspace_id, key) DO NOTHING;
    SELECT id INTO v_role_id FROM public.workspace_roles WHERE workspace_id = ws.id AND key = 'admin';
    FOREACH k IN ARRAY v_admin_perms LOOP
      INSERT INTO public.role_permissions (role_id, permission_key) VALUES (v_role_id, k) ON CONFLICT DO NOTHING;
    END LOOP;

    -- member
    INSERT INTO public.workspace_roles (workspace_id, key, name, is_system, rank)
      VALUES (ws.id, 'member', 'Member', true, 30)
      ON CONFLICT (workspace_id, key) DO NOTHING;
    SELECT id INTO v_role_id FROM public.workspace_roles WHERE workspace_id = ws.id AND key = 'member';
    FOREACH k IN ARRAY v_member_perms LOOP
      INSERT INTO public.role_permissions (role_id, permission_key) VALUES (v_role_id, k) ON CONFLICT DO NOTHING;
    END LOOP;

    -- viewer
    INSERT INTO public.workspace_roles (workspace_id, key, name, is_system, rank)
      VALUES (ws.id, 'viewer', 'Viewer', true, 40)
      ON CONFLICT (workspace_id, key) DO NOTHING;
    SELECT id INTO v_role_id FROM public.workspace_roles WHERE workspace_id = ws.id AND key = 'viewer';
    FOREACH k IN ARRAY v_viewer_perms LOOP
      INSERT INTO public.role_permissions (role_id, permission_key) VALUES (v_role_id, k) ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END;
$seed$;

-- ---------------------------------------------------------------------------
-- 6. Trigger: seed the 4 system roles for any future workspace.
--    Keeps the substrate consistent regardless of whether Sub-PR 2 has landed.
--    SECURITY DEFINER so RLS doesn't block the seed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_system_roles_for_workspace()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_role_id uuid;
  v_owner_perms  text[] := ARRAY[
    'workspace.read','workspace.use','integrations.personal.connect',
    'members.read','members.invite','members.invite_bulk','members.update_role','members.remove','groups.manage',
    'workspace.update','workspace.policy.auto_join','integrations.workspace.manage',
    'workspace.archive','workspace.transfer','workspace.delete',
    'security.activity.read','security.policy.write','security.2fa.self',
    'billing.read','billing.write',
    'audit.read','audit.export','compliance.legal_hold'
  ];
  v_admin_perms  text[] := ARRAY[
    'workspace.read','workspace.use','integrations.personal.connect',
    'members.read','members.invite','members.invite_bulk','members.update_role','members.remove','groups.manage',
    'workspace.update','workspace.policy.auto_join','integrations.workspace.manage',
    'workspace.archive',
    'security.activity.read','security.policy.write','security.2fa.self',
    'billing.read',
    'audit.read','audit.export'
  ];
  v_member_perms text[] := ARRAY[
    'workspace.read','workspace.use','integrations.personal.connect',
    'members.read',
    'security.2fa.self'
  ];
  v_viewer_perms text[] := ARRAY[
    'workspace.read',
    'members.read'
  ];
  k text;
BEGIN
  INSERT INTO public.workspace_roles (workspace_id, key, name, is_system, rank)
    VALUES (NEW.id, 'owner', 'Owner', true, 10)
    ON CONFLICT (workspace_id, key) DO NOTHING;
  SELECT id INTO v_role_id FROM public.workspace_roles WHERE workspace_id = NEW.id AND key = 'owner';
  FOREACH k IN ARRAY v_owner_perms LOOP
    INSERT INTO public.role_permissions (role_id, permission_key) VALUES (v_role_id, k) ON CONFLICT DO NOTHING;
  END LOOP;

  INSERT INTO public.workspace_roles (workspace_id, key, name, is_system, rank)
    VALUES (NEW.id, 'admin', 'Admin', true, 20)
    ON CONFLICT (workspace_id, key) DO NOTHING;
  SELECT id INTO v_role_id FROM public.workspace_roles WHERE workspace_id = NEW.id AND key = 'admin';
  FOREACH k IN ARRAY v_admin_perms LOOP
    INSERT INTO public.role_permissions (role_id, permission_key) VALUES (v_role_id, k) ON CONFLICT DO NOTHING;
  END LOOP;

  INSERT INTO public.workspace_roles (workspace_id, key, name, is_system, rank)
    VALUES (NEW.id, 'member', 'Member', true, 30)
    ON CONFLICT (workspace_id, key) DO NOTHING;
  SELECT id INTO v_role_id FROM public.workspace_roles WHERE workspace_id = NEW.id AND key = 'member';
  FOREACH k IN ARRAY v_member_perms LOOP
    INSERT INTO public.role_permissions (role_id, permission_key) VALUES (v_role_id, k) ON CONFLICT DO NOTHING;
  END LOOP;

  INSERT INTO public.workspace_roles (workspace_id, key, name, is_system, rank)
    VALUES (NEW.id, 'viewer', 'Viewer', true, 40)
    ON CONFLICT (workspace_id, key) DO NOTHING;
  SELECT id INTO v_role_id FROM public.workspace_roles WHERE workspace_id = NEW.id AND key = 'viewer';
  FOREACH k IN ARRAY v_viewer_perms LOOP
    INSERT INTO public.role_permissions (role_id, permission_key) VALUES (v_role_id, k) ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS seed_system_roles_after_workspace_insert ON public.workspaces;
CREATE TRIGGER seed_system_roles_after_workspace_insert
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_system_roles_for_workspace();

-- Function is trigger-only — not meant to be REST-callable. Lock it down so
-- anon/authenticated can't reach it via /rest/v1/rpc/.
REVOKE EXECUTE ON FUNCTION public.seed_system_roles_for_workspace() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seed_system_roles_for_workspace() FROM anon;
REVOKE EXECUTE ON FUNCTION public.seed_system_roles_for_workspace() FROM authenticated;

COMMIT;
