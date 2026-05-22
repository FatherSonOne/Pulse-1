-- ============================================================
-- DRAFT — discover_pulse_users RPC (Phase 1)
--
-- STATUS:    Design artifact. NOT a migration. Do not move under
--            supabase/migrations/ until accord & user have signed off
--            on the contract in docs/pulse-users-discovery-data-design.md.
--
-- PURPOSE:   Surface other Pulse users in the caller's workspace for the
--            "Find teammates on Pulse" add-contact tile.
--
-- CLONED FROM: supabase/migrations/20260406000001_enriched_workspace_members_rpc.sql
--              (same SECURITY DEFINER + STABLE + search_path pattern).
--
-- MEMBERSHIP PRIMITIVE: public.user_has_workspace_access(uuid)
--                       — backed by user_has_permission(ws_id, 'workspace.read')
--                         per 20260522000001_permissions_retire_wm_helpers.sql.
--
-- BARRIER (do NOT remove):  auth.uid() IS NOT NULL  AND
--                           user_has_workspace_access(p_workspace_id).
--                         Skipping the second guard turns this RPC into a
--                         workspace-enumeration oracle.
--
-- DOES NOT RETURN: email, role, status, phone, bio, settings.
--                  (Email is read internally to compute already_in_contacts
--                   but never leaves the function.)
-- ============================================================

CREATE OR REPLACE FUNCTION public.discover_pulse_users(
  p_workspace_id uuid,
  p_query        text         DEFAULT NULL,   -- reserved; Phase 2 handle lookup
  p_limit        int          DEFAULT 50,
  p_cursor       text         DEFAULT NULL    -- reserved; Phase 1.5 keyset
)
RETURNS TABLE (
  user_id               uuid,
  display_name          text,
  handle                text,
  avatar_url            text,
  shared_workspace_id   uuid,
  shared_workspace_role text,
  online_status         text,
  already_in_contacts   boolean,
  joined_at             timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_caller    uuid := auth.uid();
  v_caller_tx text := v_caller::text;            -- contacts.user_id is TEXT
  v_limit     int  := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
BEGIN
  -- Guard 1: reject anonymous callers.
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  -- Guard 2: caller must be a member of the target workspace.
  -- This is THE multi-tenant barrier. Do not weaken or remove.
  IF NOT public.user_has_workspace_access(p_workspace_id) THEN
    RAISE EXCEPTION 'forbidden: not a member of workspace %', p_workspace_id
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT
      wm.user_id,
      up.display_name,
      up.handle,
      up.avatar_url,
      wm.workspace_id    AS shared_workspace_id,
      wm.role            AS shared_workspace_role,
      up.online_status,
      EXISTS (
        SELECT 1
        FROM public.contacts c
        WHERE c.user_id = v_caller_tx
          AND (
            c.external_id = wm.user_id::text
            OR (au.email IS NOT NULL AND lower(c.email) = lower(au.email))
          )
      ) AS already_in_contacts,
      wm.joined_at
    FROM public.workspace_members wm
    LEFT JOIN public.user_profiles up ON up.id = wm.user_id
    LEFT JOIN auth.users           au ON au.id = wm.user_id
    WHERE wm.workspace_id = p_workspace_id
      AND wm.user_id <> v_caller
    ORDER BY
      CASE wm.role
        WHEN 'owner'  THEN 0
        WHEN 'admin'  THEN 1
        WHEN 'member' THEN 2
        WHEN 'viewer' THEN 3
        ELSE 4
      END,
      wm.joined_at ASC,
      wm.user_id   ASC
    LIMIT v_limit;
END;
$$;

ALTER FUNCTION public.discover_pulse_users(uuid, text, int, text)
  OWNER TO postgres;

REVOKE ALL ON FUNCTION public.discover_pulse_users(uuid, text, int, text)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.discover_pulse_users(uuid, text, int, text)
  TO authenticated;

COMMENT ON FUNCTION public.discover_pulse_users(uuid, text, int, text) IS
  'Phase 1: list other Pulse users in p_workspace_id for the add-contact tile.
   SECURITY DEFINER; gated by user_has_workspace_access. Returns a minimum
   safe payload (no email, role, phone, bio). p_query and p_cursor are
   reserved for Phase 2 / Phase 1.5 respectively.';
