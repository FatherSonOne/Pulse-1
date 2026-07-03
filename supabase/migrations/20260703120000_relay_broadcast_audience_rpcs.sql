-- Relay · Broadcast (Pulse Radio) — audience-half RPCs (BR1 + BR3)
--
-- pulse_channels.subscriber_count and broadcasts.listen_count are denormalized
-- counters, but under RLS they can only be UPDATEd by the channel owner /
-- broadcast author respectively. A *subscriber* (not the owner) and a *listener*
-- (not the author) therefore cannot keep these counters honest via a direct
-- UPDATE. These SECURITY DEFINER helpers do it for them, with a pinned
-- search_path and no ability to set arbitrary values (they only recompute /
-- increment), so they are safe to grant to every authenticated user.

-- BR1 — recompute a channel's subscriber_count from the source-of-truth
-- subscriptions table. Drift-free: callable after any subscribe/unsubscribe.
create or replace function public.sync_channel_subscriber_count(p_channel_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from pulse_channel_subscriptions
  where channel_id = p_channel_id;

  update pulse_channels
  set subscriber_count = v_count
  where id = p_channel_id;

  return v_count;
end;
$$;

-- BR3 — bump a broadcast's listen_count and roll it up to the channel's
-- total_listens. Returns the broadcast's new listen_count.
create or replace function public.increment_broadcast_listen(p_broadcast_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel uuid;
  v_count integer;
begin
  update broadcasts
  set listen_count = coalesce(listen_count, 0) + 1
  where id = p_broadcast_id
  returning channel_id, listen_count into v_channel, v_count;

  if v_channel is not null then
    update pulse_channels
    set total_listens = coalesce(total_listens, 0) + 1
    where id = v_channel;
  end if;

  return v_count;
end;
$$;

revoke all on function public.sync_channel_subscriber_count(uuid) from public;
revoke all on function public.increment_broadcast_listen(uuid) from public;
grant execute on function public.sync_channel_subscriber_count(uuid) to authenticated;
grant execute on function public.increment_broadcast_listen(uuid) to authenticated;

-- getMySubscribedChannels() looks up subscriptions by subscriber_id. The existing
-- UNIQUE (channel_id, subscriber_id) index leads with channel_id, so it does not
-- serve a lone subscriber_id lookup — add a dedicated index.
create index if not exists idx_pulse_channel_subscriptions_subscriber
  on public.pulse_channel_subscriptions (subscriber_id);
