-- 20260522000000_permissions_group_grants.sql
-- Issue #42 Sub-PR 5 — group_grants table + extend user_has_permission() to walk groups.
--
-- The p_resource_id parameter on user_has_permission(workspace_id, permission_key, resource_id)
-- becomes meaningful in this PR. Direct role grants (Sub-PR 1-3) are always workspace-wide;
-- group_grants may be either workspace-wide (resource_id IS NULL) or scoped to one specific
-- resource (resource_type + resource_id NOT NULL).
--
-- Resolution order in user_has_permission():
--   1. workspace membership gate — non-members get false immediately
--   2. direct role grant via workspace_members.role → workspace_roles → role_permissions
--   3. group grant via workspace_group_members → workspace_groups → group_grants
--      - workspace-wide grant (resource_id IS NULL) matches any caller resource_id,
--        including NULL
--      - resource-scoped grant (resource_id IS NOT NULL) matches only when caller
--        passes the same uuid
--
-- resource_type is an enumerated text column. Add new types here as features ship that
-- need group-scoped permissions (e.g. channels, lists, places).
--
-- RLS on group_grants:
--   SELECT — any workspace member can read grants in their workspace
--   INSERT/UPDATE/DELETE — require groups.manage on the group's workspace (same key
--   that gates workspace_groups + workspace_group_members in Sub-PR 4a)

BEGIN;

-- ============================================================================
-- group_grants table
-- ============================================================================

CREATE TABLE public.group_grants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        uuid NOT NULL REFERENCES public.workspace_groups(id) ON DELETE CASCADE,
  permission_key  text NOT NULL REFERENCES public.permissions(key)     ON DELETE CASCADE,
  resource_type   text,
  resource_id     uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT group_grants_resource_consistency
    CHECK ((resource_type IS NULL) = (resource_id IS NULL)),

  CONSTRAINT group_grants_resource_type_allowed
    CHECK (resource_type IS NULL OR resource_type IN (
      'channel',
      'list',
      'place',
      'workspace_group',
      'contact_record'
    ))
);

COMMENT ON TABLE  public.group_grants IS
  'Permission grants assigned to workspace groups. NULL resource_id = workspace-wide; NOT NULL = scoped to one resource.';
COMMENT ON COLUMN public.group_grants.resource_type IS
  'Required when resource_id is present. CHECK-restricted enum (add new types as features need them).';
COMMENT ON COLUMN public.group_grants.resource_id IS
  'Required when resource_type is present. Caller must pass matching uuid to user_has_permission(p_resource_id).';

-- Uniqueness: NULL is treated as distinct by default in unique constraints, so split into
-- two partial indexes — one for workspace-wide rows, one for resource-scoped rows.
CREATE UNIQUE INDEX group_grants_unique_workspace_wide
  ON public.group_grants(group_id, permission_key)
  WHERE resource_id IS NULL;

CREATE UNIQUE INDEX group_grants_unique_scoped
  ON public.group_grants(group_id, permission_key, resource_id)
  WHERE resource_id IS NOT NULL;

-- Hot resolver path: (group_id, permission_key).
CREATE INDEX group_grants_lookup
  ON public.group_grants(group_id, permission_key);

-- Reverse lookup ("what's granted on this resource?").
CREATE INDEX group_grants_resource_lookup
  ON public.group_grants(resource_type, resource_id)
  WHERE resource_id IS NOT NULL;

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE public.group_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY group_grants_select
  ON public.group_grants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.workspace_groups g
        JOIN public.workspace_members wm ON wm.workspace_id = g.workspace_id
       WHERE g.id = group_grants.group_id
         AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY group_grants_insert
  ON public.group_grants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_groups g
       WHERE g.id = group_grants.group_id
         AND public.user_has_permission(g.workspace_id, 'groups.manage')
    )
  );

CREATE POLICY group_grants_update
  ON public.group_grants
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_groups g
       WHERE g.id = group_grants.group_id
         AND public.user_has_permission(g.workspace_id, 'groups.manage')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_groups g
       WHERE g.id = group_grants.group_id
         AND public.user_has_permission(g.workspace_id, 'groups.manage')
    )
  );

CREATE POLICY group_grants_delete
  ON public.group_grants
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_groups g
       WHERE g.id = group_grants.group_id
         AND public.user_has_permission(g.workspace_id, 'groups.manage')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_grants TO authenticated;

-- ============================================================================
-- Extend user_has_permission to walk groups
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_has_permission(
  p_workspace_id   uuid,
  p_permission_key text,
  p_resource_id    uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_user_id     uuid := auth.uid();
  v_member_role text;
  v_has         boolean;
BEGIN
  IF v_user_id IS NULL OR p_workspace_id IS NULL OR p_permission_key IS NULL THEN
    RETURN false;
  END IF;

  SELECT role INTO v_member_role
    FROM public.workspace_members
   WHERE workspace_id = p_workspace_id AND user_id = v_user_id;

  IF v_member_role IS NULL THEN
    RETURN false;
  END IF;

  -- (1) Direct role grant
  SELECT EXISTS (
    SELECT 1
      FROM public.workspace_roles  wr
      JOIN public.role_permissions rp ON rp.role_id = wr.id
     WHERE wr.workspace_id   = p_workspace_id
       AND wr.key            = v_member_role
       AND rp.permission_key = p_permission_key
  ) INTO v_has;

  IF COALESCE(v_has, false) THEN
    RETURN true;
  END IF;

  -- (2) Group grant. Workspace-wide grants (resource_id IS NULL) match any caller
  -- resource_id; resource-scoped grants match only on exact uuid equality.
  SELECT EXISTS (
    SELECT 1
      FROM public.workspace_group_members wgm
      JOIN public.workspace_groups        g  ON g.id = wgm.group_id
      JOIN public.group_grants            gg ON gg.group_id = g.id
     WHERE g.workspace_id    = p_workspace_id
       AND wgm.user_id       = v_user_id
       AND gg.permission_key = p_permission_key
       AND (
         gg.resource_id IS NULL
         OR (p_resource_id IS NOT NULL AND gg.resource_id = p_resource_id)
       )
  ) INTO v_has;

  RETURN COALESCE(v_has, false);
END;
$function$;

COMMIT;
