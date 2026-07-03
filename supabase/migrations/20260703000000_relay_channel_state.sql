-- Relay · Channels launch-readiness CH2/CH3/CH4 (2026-07-03).
--
-- Backs three previously-dead/theatrical Channels capabilities with real,
-- cross-device state:
--   CH2  Real unread counts   — per-user last-read marker; unread derived from it.
--   CH3  Notification prefs    — per-user/per-channel All/Mentions/Mute, ENFORCED.
--   CH4  Announcement fan-out  — announcements actually notify every member.
--
-- Design notes:
--   * ONE table `vox_channel_state` holds both the last-read marker (CH2) and the
--     notify pref (CH3). Both are per-(channel,user) state with the same access
--     pattern, so a single row keeps them atomic and cheap.
--   * The table is strictly OWN-ROW (user_id = auth.uid()) for both read and
--     write: last_read_at is a read receipt and must not leak to co-members.
--   * Because a SENDER cannot read a RECIPIENT's own-row pref, the notification
--     fan-out (CH3 enforcement + CH4 announcement) runs in a SECURITY DEFINER
--     RPC that can see every recipient's pref and insert their notification rows.
--   * Unread counting runs as SECURITY INVOKER so the existing team_vox_messages
--     RLS (workspace-scoped) and vox_channel_state own-row RLS both still apply.
--   * All ids are auth.uid() space, consistent with the rest of Channels.

-- ============================================================================
-- Table: per-user, per-channel state (last-read marker + notification pref)
-- ============================================================================
create table if not exists public.vox_channel_state (
  channel_id   uuid        not null references public.vox_team_channels(id) on delete cascade,
  user_id      uuid        not null references auth.users(id)               on delete cascade,
  last_read_at timestamptz not null default now(),
  notify_pref  text        not null default 'all' check (notify_pref in ('all','mentions','mute')),
  updated_at   timestamptz not null default now(),
  primary key (channel_id, user_id)
);

comment on table public.vox_channel_state is
  'Per-user, per-channel Relay state: last-read marker (unread derivation) + notification preference. Own-row only.';

alter table public.vox_channel_state enable row level security;

-- Own-row only. A user sees and edits ONLY their own state.
drop policy if exists vox_channel_state_select on public.vox_channel_state;
create policy vox_channel_state_select on public.vox_channel_state
  for select to authenticated using (user_id = auth.uid());

drop policy if exists vox_channel_state_insert on public.vox_channel_state;
create policy vox_channel_state_insert on public.vox_channel_state
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists vox_channel_state_update on public.vox_channel_state;
create policy vox_channel_state_update on public.vox_channel_state
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists vox_channel_state_delete on public.vox_channel_state;
create policy vox_channel_state_delete on public.vox_channel_state
  for delete to authenticated using (user_id = auth.uid());

-- ============================================================================
-- CH2: unread counts for the caller, per channel.
-- SECURITY INVOKER: team_vox_messages RLS restricts to the caller's workspaces,
-- and vox_channel_state own-row RLS restricts the join to the caller's markers.
-- Channels with zero unread simply don't appear (caller defaults them to 0).
-- ============================================================================
create or replace function public.relay_unread_counts()
returns table (channel_id uuid, unread integer)
language sql
security invoker
stable
set search_path = public
as $$
  select m.channel_id,
         count(*)::int as unread
  from team_vox_messages m
  left join vox_channel_state s
    on s.channel_id = m.channel_id
   and s.user_id = auth.uid()
  where m.sender_id is distinct from auth.uid()
    and m.created_at > coalesce(s.last_read_at, 'epoch'::timestamptz)
  group by m.channel_id;
$$;

grant execute on function public.relay_unread_counts() to authenticated;
-- Postgres grants EXECUTE to PUBLIC by default; keep it off anon.
revoke execute on function public.relay_unread_counts() from public, anon;

-- ============================================================================
-- CH3 + CH4: notification fan-out for a newly-sent team vox.
-- Replaces the client-side "notify mentions only" loop. Per recipient:
--   * pref = 'mute'          -> never notified.
--   * mentioned              -> notified ('mention').
--   * message is announcement-> notified ('new_vox'), overrides mentions-only.
--   * pref = 'all'           -> notified on every message ('new_vox').
--   * otherwise (mentions-only, not mentioned, not announcement) -> skipped.
-- SECURITY DEFINER so it can read every recipient's own-row pref and insert
-- their notification rows. auth.uid() still resolves to the CALLER inside a
-- definer function (it reads the request JWT), so the sender is derived safely.
-- ============================================================================
create or replace function public.relay_channel_fanout(
  p_message_id   uuid,
  p_channel_id   uuid,
  p_workspace_id uuid,
  p_message_type text,
  p_mentions     uuid[],
  p_sender_name  text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender       uuid := auth.uid();
  v_channel_name text;
  v_count        int  := 0;
begin
  if v_sender is null then
    return 0;
  end if;

  -- Authorize: the caller must actually belong to this workspace, and the
  -- channel must live in it. Prevents a definer-privilege escalation where an
  -- arbitrary caller fans notifications into a workspace they can't access.
  if not user_has_workspace_access(p_workspace_id) then
    raise exception 'not authorized for workspace %', p_workspace_id;
  end if;

  select name into v_channel_name
  from vox_team_channels
  where id = p_channel_id and workspace_id = p_workspace_id;

  if v_channel_name is null then
    raise exception 'channel % not in workspace %', p_channel_id, p_workspace_id;
  end if;

  with members as (
    select wm.user_id
    from workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id <> v_sender
  ),
  scored as (
    select m.user_id,
           coalesce(s.notify_pref, 'all') as pref,
           (m.user_id = any (coalesce(p_mentions, '{}'::uuid[]))) as is_mentioned
    from members m
    left join vox_channel_state s
      on s.channel_id = p_channel_id and s.user_id = m.user_id
  ),
  recipients as (
    select user_id, is_mentioned
    from scored
    where pref <> 'mute'
      and (is_mentioned or p_message_type = 'announcement' or pref = 'all')
  )
  insert into vox_notifications
    (user_id, type, title, body, related_vox_id, sender_id, sender_name, is_read, created_at)
  select r.user_id,
         case when r.is_mentioned then 'mention' else 'new_vox' end,
         case when r.is_mentioned then p_sender_name || ' mentioned you'
              when p_message_type = 'announcement' then 'New announcement'
              else 'New voice message' end,
         case when r.is_mentioned then 'You were mentioned in #' || v_channel_name
              when p_message_type = 'announcement' then p_sender_name || ' posted an announcement in #' || v_channel_name
              else p_sender_name || ' posted in #' || v_channel_name end,
         p_message_id, v_sender, p_sender_name, false, now()
  from recipients r;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.relay_channel_fanout(uuid, uuid, uuid, text, uuid[], text) to authenticated;
-- Definer function: keep it off PUBLIC/anon (anon no-ops on null auth.uid(), but
-- silence the linter and shrink the surface). authenticated is intentional — the
-- function self-authorizes via user_has_workspace_access().
revoke execute on function public.relay_channel_fanout(uuid, uuid, uuid, text, uuid[], text) from public, anon;
