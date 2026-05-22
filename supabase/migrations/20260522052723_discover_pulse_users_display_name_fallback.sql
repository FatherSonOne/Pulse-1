-- ============================================================
-- MIGRATION: 20260522052723_discover_pulse_users_display_name_fallback.sql
-- PURPOSE:   Replace public.discover_pulse_users() with a version
--            that resolves display_name server-side via COALESCE,
--            so clients never need to render "Unnamed" for a
--            teammate whose user_profiles.display_name is null.
--
--            Fallback chain (privacy-respecting — no email leak):
--              1. NULLIF(up.display_name, '')   — when set + non-empty
--              2. '@' || up.handle              — when handle present
--              3. 'Pulse User'                  — last resort
--
--            Signature, security, and result columns are unchanged.
--            All other guards (auth.uid IS NOT NULL,
--            user_has_workspace_access) preserved verbatim.
--
-- spec:    docs/pulse-users-discovery-spec.md
-- supersedes the body of: 20260522042208_discover_pulse_users.sql
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.discover_pulse_users(
  p_workspace_id uuid,
  p_query        text         DEFAULT NULL,
  p_limit        int          DEFAULT 50,
  p_cursor       text         DEFAULT NULL
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
  v_caller_tx text := v_caller::text;
  v_limit     int  := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT public.user_has_workspace_access(p_workspace_id) THEN
    RAISE EXCEPTION 'forbidden: not a member of workspace %', p_workspace_id
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT
      wm.user_id,
      COALESCE(
        NULLIF(up.display_name, ''),
        CASE WHEN up.handle IS NOT NULL THEN '@' || up.handle ELSE NULL END,
        'Pulse User'
      ) AS display_name,
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

COMMENT ON FUNCTION public.discover_pulse_users(uuid, text, int, text) IS
  'Phase 1: list other Pulse users in p_workspace_id for the add-contact tile.
   SECURITY DEFINER; gated by user_has_workspace_access. display_name is
   resolved server-side via COALESCE(NULLIF(display_name,""), @handle,
   "Pulse User") so callers never need a "Unnamed" fallback. Returns a
   minimum safe payload (no email, role, phone, bio). p_query and p_cursor
   are reserved for Phase 2 / Phase 1.5 respectively.';

COMMIT;
