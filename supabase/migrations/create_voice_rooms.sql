-- Live (Voice Rooms) backing tables. voiceRoomService.ts expects these; they
-- were never created, so the Live tab 404'd (PGRST205) and stayed empty.
-- Column names/shapes mirror the service exactly (snake_case). Applied to
-- pulse-chat (ucaeuszgoihoyrvhewxk) via the Supabase MCP on 2026-05-25.

create table if not exists public.voice_rooms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,                 -- room owner; getRooms() filters on this
  name text not null,
  icon text,
  color text,
  max_participants integer not null default 10,
  is_private boolean not null default false,
  category text,
  description text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.voice_room_participants (
  room_id uuid not null references public.voice_rooms(id) on delete cascade,
  user_id uuid not null,
  user_name text not null,
  avatar_color text,
  joined_at timestamptz not null default now(),
  is_muted boolean not null default false,
  is_speaking boolean not null default false,
  primary key (room_id, user_id)          -- matches upsert onConflict 'room_id,user_id'
);

create index if not exists voice_rooms_user_id_idx on public.voice_rooms(user_id);
create index if not exists voice_room_participants_room_id_idx on public.voice_room_participants(room_id);

alter table public.voice_rooms enable row level security;
alter table public.voice_room_participants enable row level security;

create policy voice_rooms_select on public.voice_rooms
  for select to authenticated using (user_id = auth.uid());
create policy voice_rooms_insert on public.voice_rooms
  for insert to authenticated with check (user_id = auth.uid());
create policy voice_rooms_update on public.voice_rooms
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy voice_rooms_delete on public.voice_rooms
  for delete to authenticated using (user_id = auth.uid());

create policy voice_room_participants_select on public.voice_room_participants
  for select to authenticated using (
    exists (select 1 from public.voice_rooms r where r.id = room_id and r.user_id = auth.uid())
    or user_id = auth.uid()
  );
create policy voice_room_participants_insert on public.voice_room_participants
  for insert to authenticated with check (user_id = auth.uid());
create policy voice_room_participants_update on public.voice_room_participants
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy voice_room_participants_delete on public.voice_room_participants
  for delete to authenticated using (user_id = auth.uid());
