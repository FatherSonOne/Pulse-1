-- Relay realtime publication (S0-1 inbound + S1-2 receipts + Inbox triage).
--
-- Supabase only delivers postgres_changes for tables in the supabase_realtime
-- publication (RLS still applies to realtime events, so each subscriber only
-- receives rows they are allowed to SELECT). Only team_vox_messages and
-- voice_thread_messages were ever published, so:
--   - Relay "Direct" inbound realtime (subscribeToQuickVox, S0-1) was inert.
--   - 4 of the 5 Inbox/triage subscriptions (useRelayTriage) were inert —
--     only voice_thread_messages fired; the feed went stale for everything else.
--   - quick_vox delivery/listened receipts (S1-2) could not propagate.
--
-- Add the missing Relay source tables (idempotent — safe to re-run). Mirrors the
-- established per-feature pattern (see 20260608121000 slack channels P5).

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='quick_vox_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.quick_vox_messages';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='voxer_recordings'
  ) then
    execute 'alter publication supabase_realtime add table public.voxer_recordings';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='broadcasts'
  ) then
    execute 'alter publication supabase_realtime add table public.broadcasts';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='vox_notes'
  ) then
    execute 'alter publication supabase_realtime add table public.vox_notes';
  end if;
end $$;
