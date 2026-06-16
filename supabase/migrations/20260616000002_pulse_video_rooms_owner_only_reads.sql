-- 0.2 Cross-tenant RLS fix for pulse_video_rooms.
--
-- Before: the `authenticated_read` policy (SELECT USING auth.role()='authenticated')
-- let ANY authenticated user read EVERY room's transcript / summary /
-- recording_url. Live exposure was 3 summaries growing per meeting.
--
-- After: `owner_all` (auth.uid() = created_by) is the only policy, so direct
-- table reads are owner-only. The single legitimate cross-tenant reader — the
-- /meet/:roomName deep-link join, which needs only room_url — is preserved via a
-- minimal SECURITY DEFINER RPC that exposes no sensitive columns.
--
-- NOTE on the column REVOKE below: pulse_video_rooms also carries a table-wide
-- SELECT grant to anon/authenticated, which masks column-level revokes, so this
-- REVOKE is a no-op in practice. It is kept as documented intent. The real
-- boundary is RLS (owner_all): non-owners resolve to zero rows regardless of
-- column grants, and the owner still needs column SELECT to read their own
-- transcript/summary (getMeetingRecordings), so a table-level column lockdown is
-- intentionally NOT attempted here.

CREATE OR REPLACE FUNCTION public.resolve_room_for_join(p_room_name text)
RETURNS TABLE (room_url text, room_name text, status text, title text)
LANGUAGE sql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $body$
  SELECT room_url, room_name, status, title
  FROM public.pulse_video_rooms
  WHERE room_name = p_room_name
  LIMIT 1;
$body$;

REVOKE ALL ON FUNCTION public.resolve_room_for_join(text) FROM public;
GRANT EXECUTE ON FUNCTION public.resolve_room_for_join(text) TO authenticated;

DROP POLICY IF EXISTS authenticated_read ON public.pulse_video_rooms;

REVOKE SELECT (transcript, summary, recording_url, recording_id)
  ON public.pulse_video_rooms FROM anon, authenticated;
