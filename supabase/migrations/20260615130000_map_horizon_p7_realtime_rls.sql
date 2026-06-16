-- Map "Direction D — Horizon" P7 — unblock live presence + RLS/search_path hardening.
-- See docs/MAP_HORIZON_REDESIGN_HANDOFF_2026-06-15.md §P7, §9. Additive + idempotent;
-- dry-run verified clean in a rolled-back transaction before apply (CLAUDE.md schema-first).
-- Applied to live pulse-chat 2026-06-15 via MCP apply_migration (verified: user_locations
-- published, set_places_updated_at search_path pinned, consent policy split confirmed).

-- 1) Realtime publication — REQUIRED. subscribeToUserLocation / useLivePresence are
--    wired-but-dead until user_locations is published. RLS already gates who receives
--    events (user_locations.consented_location_read), so this exposes nothing a viewer
--    couldn't already SELECT.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_locations'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.user_locations';
  END IF;
END $$;

-- 2) DB-baseline hardening — pin search_path on the lone unpinned geo trigger fn.
ALTER FUNCTION public.set_places_updated_at() SET search_path = public, pg_temp;

-- 3) Consent RLS split — close the viewer-can-write footgun on location_share_consents.
--    The old `own_consents` ALL policy used the same (subject OR viewer) predicate for
--    reads AND writes, letting a VIEWER insert/modify consent rows. Reads stay open to
--    both parties (subject manages grants; the viewer's grant is read by user_locations'
--    consented_location_read subquery); writes restricted to the SUBJECT — matches every
--    code path (upsertLocationConsent / setBroadcastRecipients / endBroadcastRecipients
--    all write subject_user_id = the current user). This is a SECURITY fix — do NOT roll
--    it back with the mapHorizon flag.
DROP POLICY IF EXISTS own_consents    ON public.location_share_consents;
DROP POLICY IF EXISTS consents_select ON public.location_share_consents;
DROP POLICY IF EXISTS consents_insert ON public.location_share_consents;
DROP POLICY IF EXISTS consents_update ON public.location_share_consents;
DROP POLICY IF EXISTS consents_delete ON public.location_share_consents;

CREATE POLICY consents_select ON public.location_share_consents
  FOR SELECT USING (subject_user_id = auth.uid() OR viewer_user_id = auth.uid());
CREATE POLICY consents_insert ON public.location_share_consents
  FOR INSERT WITH CHECK (subject_user_id = auth.uid());
CREATE POLICY consents_update ON public.location_share_consents
  FOR UPDATE USING (subject_user_id = auth.uid()) WITH CHECK (subject_user_id = auth.uid());
CREATE POLICY consents_delete ON public.location_share_consents
  FOR DELETE USING (subject_user_id = auth.uid());

-- NOTE: eta_shares + geofence_events are intentionally NOT published here (deferred,
-- §8) — the ETA tick + visited-stops poll remain acceptable for v1; add them later if
-- live ETA-progress / live transition feeds are wanted.
