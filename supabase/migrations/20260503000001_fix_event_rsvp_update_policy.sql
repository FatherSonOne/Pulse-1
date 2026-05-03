-- ============================================================
-- Fix: rsvp_update_own correlated-subquery escape
-- ============================================================
-- Background
-- ----------
-- 20260311000002_calendar_rsvp.sql created policy rsvp_update_own with:
--
--   USING (
--     user_id = auth.uid()::text
--     OR email = (SELECT email FROM auth.users WHERE id = auth.users.id)
--   )
--
-- The reference auth.users.id inside the subquery is the OUTER auth.users
-- table's id — but the subquery already FROMs auth.users, so this resolves
-- as `WHERE id = id` (always true). The subquery returns every email in the
-- system; `email = ANY(all_emails)` then matches any RSVP whose email
-- belongs to ANY auth.users row — effectively any authenticated user can
-- UPDATE any RSVP belonging to anyone.
--
-- This migration drops and recreates the policy correctly using auth.uid().
-- It also adds an explicit WITH CHECK clause so an attacker who could
-- previously satisfy USING cannot now re-point the row at another user.

DROP POLICY IF EXISTS "rsvp_update_own" ON event_rsvp;

CREATE POLICY "rsvp_update_own"
  ON event_rsvp FOR UPDATE
  USING (
    user_id = auth.uid()::text
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()::text
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
