-- ============================================================
-- Block one-query escalation to global super-admin
-- ============================================================
-- Background
-- ----------
-- 20260405000002_admin_rls_policies.sql:80-89 created policy
-- user_profiles_admin_update with USING (auth.uid() = id OR is admin)
-- and NO WITH CHECK clause and NO column-level restriction. Any
-- authenticated user could run:
--
--   UPDATE user_profiles SET role = 'admin' WHERE id = auth.uid();
--
-- and immediately become a global super-admin: read access to
-- admin_settings, ability to ban/delete other users via the
-- admin-manage-user edge function, read all admin_activity_logs.
--
-- Why a trigger and not a tightened policy
-- ----------------------------------------
-- Postgres RLS has no column-level control, and policy WITH CHECK
-- expressions can only inspect NEW row values, not compare against OLD
-- to detect "did role change?". A BEFORE UPDATE trigger lets us
-- atomically reject role/status changes by non-admins without
-- restricting legitimate self-updates of name, avatar, etc.
--
-- Also fixes
-- ----------
-- activity_logs_insert_policy at 20260405000002:73-77 only required
-- auth.uid() IS NOT NULL with no actor_id check, letting any user
-- forge log entries with an arbitrary actor_id (pin admin actions on
-- innocent users). Tightened to require actor_id = auth.uid() OR NULL
-- (NULL is reserved for system entries inserted via service_role).

CREATE OR REPLACE FUNCTION public.prevent_user_profile_privesc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
BEGIN
  -- service_role / system calls have no auth.uid() — let through. The
  -- admin-manage-user edge function uses service_role and is responsible
  -- for its own authorization (it gates by user_profiles.role = 'admin'
  -- on the caller side).
  IF v_caller IS NULL THEN
    RETURN NEW;
  END IF;

  -- No-op updates that touch role/status without changing them are fine.
  IF OLD.role IS NOT DISTINCT FROM NEW.role
     AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- We are SECURITY DEFINER, so this SELECT bypasses RLS — necessary
  -- because the caller's user_profiles_select policy may be more
  -- restrictive than we need for this internal check.
  SELECT role INTO v_caller_role
    FROM public.user_profiles
   WHERE id = v_caller;

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'cannot change role or status of user profile without admin privilege'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_user_profile_privesc() FROM PUBLIC;

DROP TRIGGER IF EXISTS user_profiles_block_privesc ON public.user_profiles;
CREATE TRIGGER user_profiles_block_privesc
  BEFORE UPDATE OF role, status ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_user_profile_privesc();

-- Tighten admin_activity_logs INSERT policy: prevent forged actor_id.
DROP POLICY IF EXISTS activity_logs_insert_policy ON admin_activity_logs;
CREATE POLICY activity_logs_insert_policy ON admin_activity_logs
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
  AND (actor_id = auth.uid() OR actor_id IS NULL)
);
