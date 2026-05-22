-- ============================================================
-- MIGRATION: 20260522161139_fix_discover_pulse_users_join_pulse_users_table.sql
-- PURPOSE:   Correct the table join in public.discover_pulse_users().
--            The Phase 1 RPC (PR #85) joined public.user_profiles, but
--            the canonical Pulse-user record is public.pulse_users,
--            populated by the bootstrap_pulse_user_on_auth_insert
--            trigger via ensure_pulse_user_for_auth().
--
--            user_profiles turned out to be a sparsely-populated
--            secondary table (6 rows for 12 distinct workspace
--            members at the time of this fix), so ~half of teammates
--            fell through the COALESCE to 'Pulse User' instead of
--            showing real names that exist in pulse_users.
--
--            Also: exclude is_bot rows (MeetMate etc.) — bots are
--            not teammates for discovery purposes.  The LEFT JOIN
--            keeps users whose pulse_users row is somehow missing
--            (is_bot IS NULL passes the IS NOT TRUE filter; they
--            still get the COALESCE 'Pulse User' fallback).
--
--            Signature, both guards (auth.uid IS NOT NULL,
--            user_has_workspace_access), and return columns are
--            UNCHANGED.  Only the SELECT body differs.
--
--            online_status: pulse_users carries last_active_at but
--            no presence field.  Derived: <5min ago = 'online',
--            else 'offline'.  Honest given current presence infra.
--
-- spec:        docs/pulse-users-discovery-spec.md
-- supersedes:  body of 20260522052723_discover_pulse_users_display_name_fallback.sql
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
        NULLIF(pu.display_name, ''),
        CASE WHEN pu.handle IS NOT NULL THEN '@' || pu.handle ELSE NULL END,
        'Pulse User'
      ) AS display_name,
      pu.handle,
      pu.avatar_url,
      wm.workspace_id    AS shared_workspace_id,
      wm.role            AS shared_workspace_role,
      CASE
        WHEN pu.last_active_at IS NOT NULL
         AND pu.last_active_at > NOW() - interval '5 minutes' THEN 'online'
        ELSE 'offline'
      END AS online_status,
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
    LEFT JOIN public.pulse_users pu ON pu.auth_user_id = wm.user_id
    LEFT JOIN auth.users         au ON au.id           = wm.user_id
    WHERE wm.workspace_id = p_workspace_id
      AND wm.user_id <> v_caller
      AND (pu.is_bot IS NOT TRUE)
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
  'Phase 1 (fixed): list other Pulse users in p_workspace_id for the
   add-contact tile. SECURITY DEFINER; gated by user_has_workspace_access.
   Joins canonical public.pulse_users (NOT user_profiles); excludes bots.
   Returns a minimum safe payload (no email, role, phone, bio). p_query
   and p_cursor reserved for Phase 2 / Phase 1.5.';

COMMIT;
