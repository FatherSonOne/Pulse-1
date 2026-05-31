-- Close 4 CRITICAL "policy exists but RLS disabled" holes. Each already had a
-- PERMISSIVE owner-scoped policy (user_id = auth.uid() / id = auth.uid()) that
-- was inert because RLS was never enabled, leaving the tables fully open to any
-- client. Client access is verified owner-scoped (channels/message_sync_state)
-- or absent (users/conversation_graphs); service-role/edge functions bypass RLS.
--
-- Reverse with: ALTER TABLE <t> DISABLE ROW LEVEL SECURITY;
alter table public.channels             enable row level security;
alter table public.conversation_graphs  enable row level security;
alter table public.message_sync_state   enable row level security;
alter table public.users                enable row level security;
