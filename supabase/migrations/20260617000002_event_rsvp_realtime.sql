-- ============================================================
-- Migration: event_rsvp realtime (#132)
--
-- rsvpService.subscribeToRSVP() listens for postgres_changes on event_rsvp so
-- the organiser's RSVPPanel updates live when an invitee responds — but the
-- table was never added to the supabase_realtime publication, so no events were
-- ever delivered. REPLICA IDENTITY FULL ensures UPDATE/DELETE payloads carry
-- event_id (the channel filter key), not just the primary key.
-- ============================================================

ALTER TABLE event_rsvp REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE event_rsvp;
