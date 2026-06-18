-- ============================================================
-- Migration: Booking confirmation RPC + slot lock (#131)
--
-- Fixes the public /book/:slug flow, which previously:
--   • silently failed to create the organiser's calendar event (anon insert
--     blocked by calendar_events RLS, and it used non-existent columns
--     `type`/`date` instead of `event_type`),
--   • allowed the same slot to be double-booked (no uniqueness),
--   • saved booking_requests with event_id = null.
--
-- confirm_booking() is SECURITY DEFINER so it can create the organiser-owned
-- calendar_events row on behalf of an anonymous booker, atomically with the
-- booking_request, while the partial unique index guarantees no double-book.
-- ============================================================

-- (page, slot) double-book lock: at most one CONFIRMED request per (page, start).
CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_requests_page_slot
  ON booking_requests (page_id, proposed_start)
  WHERE status = 'confirmed';

CREATE OR REPLACE FUNCTION public.confirm_booking(
  p_page_id UUID,
  p_start   TIMESTAMPTZ,
  p_end     TIMESTAMPTZ,
  p_name    TEXT,
  p_email   TEXT,
  p_notes   TEXT DEFAULT NULL
)
RETURNS public.booking_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $fn$
DECLARE
  v_page    public.booking_pages;
  v_event   UUID;
  v_request public.booking_requests;
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' THEN RAISE EXCEPTION 'invalid_name'; END IF;
  IF p_email IS NULL OR btrim(p_email) = '' THEN RAISE EXCEPTION 'invalid_email'; END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_end <= p_start THEN RAISE EXCEPTION 'invalid_slot'; END IF;

  SELECT * INTO v_page FROM public.booking_pages WHERE id = p_page_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'page_not_found'; END IF;
  IF NOT v_page.is_active THEN RAISE EXCEPTION 'page_inactive'; END IF;

  -- Claim the slot first; the partial unique index enforces no double-book.
  BEGIN
    INSERT INTO public.booking_requests
      (page_id, booker_name, booker_email, booker_notes, proposed_start, proposed_end, status)
    VALUES
      (p_page_id, btrim(p_name), btrim(p_email), p_notes, p_start, p_end, 'confirmed')
    RETURNING * INTO v_request;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'slot_taken';
  END;

  -- Create the organiser's calendar event (definer bypasses owner RLS safely).
  -- Correct columns only: event_type (not `type`), no `date` column exists.
  INSERT INTO public.calendar_events
    (user_id, title, description, start_time, end_time, color, event_type, all_day)
  VALUES
    (v_page.user_id, btrim(p_name) || ' — ' || v_page.title, COALESCE(p_notes, ''),
     p_start, p_end, 'bg-rose-500', 'meet', false)
  RETURNING id INTO v_event;

  UPDATE public.booking_requests SET event_id = v_event WHERE id = v_request.id
  RETURNING * INTO v_request;

  RETURN v_request;
END;
$fn$;

-- Public booking route is anonymous; the edge function calls this via service
-- role, but grant the direct path too (the function self-validates + locks).
GRANT EXECUTE ON FUNCTION public.confirm_booking(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT)
  TO anon, authenticated, service_role;
