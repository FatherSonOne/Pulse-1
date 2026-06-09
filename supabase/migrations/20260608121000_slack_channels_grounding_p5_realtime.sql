-- Slack Channels Grounding (Integration C) · P5 — realtime publication
--
-- The P5 render surface subscribes to live INSERTs so a newly-ingested channel
-- message (and a new/updated thread) appears without a refetch. Supabase realtime
-- only delivers postgres_changes for tables in the supabase_realtime publication,
-- and the P1 schema migration did not add these (verified: neither table was in
-- the publication). RLS still applies to realtime, so the owner-scoped SELECT
-- policies (P1) ensure each subscriber only receives their own rows.

ALTER PUBLICATION supabase_realtime ADD TABLE public.slack_channel_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.slack_channel_threads;
