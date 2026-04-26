-- Team groups / departments. Each workspace has zero or more groups,
-- and members can belong to multiple groups (many-to-many).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. workspace_groups
-- ---------------------------------------------------------------------------

create table if not exists public.workspace_groups (
  id            uuid        not null default gen_random_uuid() primary key,
  workspace_id  uuid        not null references public.workspaces(id) on delete cascade,
  name          text        not null,
  description   text,
  color         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid        references auth.users(id) on delete set null
);

create unique index if not exists workspace_groups_workspace_name_key
  on public.workspace_groups (workspace_id, lower(name));

create index if not exists workspace_groups_workspace_id_idx
  on public.workspace_groups (workspace_id);

alter table public.workspace_groups
  drop constraint if exists workspace_groups_name_length_check;
alter table public.workspace_groups
  add constraint workspace_groups_name_length_check
  check (char_length(name) between 1 and 60);

-- Color stored as hex (#rgb or #rrggbb) or null.
alter table public.workspace_groups
  drop constraint if exists workspace_groups_color_check;
alter table public.workspace_groups
  add constraint workspace_groups_color_check
  check (color is null or color ~ '^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$');

-- ---------------------------------------------------------------------------
-- 2. workspace_group_members (junction)
-- ---------------------------------------------------------------------------

create table if not exists public.workspace_group_members (
  group_id   uuid        not null references public.workspace_groups(id) on delete cascade,
  user_id    uuid        not null references auth.users(id)              on delete cascade,
  added_at   timestamptz not null default now(),
  added_by   uuid        references auth.users(id) on delete set null,
  primary key (group_id, user_id)
);

create index if not exists workspace_group_members_user_id_idx
  on public.workspace_group_members (user_id);

-- ---------------------------------------------------------------------------
-- 3. updated_at trigger for workspace_groups
-- ---------------------------------------------------------------------------

create or replace function public.set_workspace_groups_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_workspace_groups_updated_at on public.workspace_groups;
create trigger trg_workspace_groups_updated_at
  before update on public.workspace_groups
  for each row
  execute function public.set_workspace_groups_updated_at();

-- ---------------------------------------------------------------------------
-- 4. RLS: workspace_groups
--    - SELECT: any workspace member
--    - INSERT/UPDATE/DELETE: workspace owner or admin
-- ---------------------------------------------------------------------------

alter table public.workspace_groups enable row level security;

drop policy if exists workspace_groups_select on public.workspace_groups;
drop policy if exists workspace_groups_insert on public.workspace_groups;
drop policy if exists workspace_groups_update on public.workspace_groups;
drop policy if exists workspace_groups_delete on public.workspace_groups;

create policy workspace_groups_select on public.workspace_groups
  for select
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = workspace_groups.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy workspace_groups_insert on public.workspace_groups
  for insert
  with check (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = workspace_groups.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

create policy workspace_groups_update on public.workspace_groups
  for update
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = workspace_groups.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

create policy workspace_groups_delete on public.workspace_groups
  for delete
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = workspace_groups.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- ---------------------------------------------------------------------------
-- 5. RLS: workspace_group_members
--    - SELECT: any workspace member (visible scoped via group_id → workspace)
--    - INSERT/DELETE: admin+ in the parent workspace
--    - UPDATE: not used (junction; no mutable columns besides bookkeeping)
-- ---------------------------------------------------------------------------

alter table public.workspace_group_members enable row level security;

drop policy if exists workspace_group_members_select on public.workspace_group_members;
drop policy if exists workspace_group_members_insert on public.workspace_group_members;
drop policy if exists workspace_group_members_delete on public.workspace_group_members;

create policy workspace_group_members_select on public.workspace_group_members
  for select
  using (
    exists (
      select 1
      from public.workspace_groups g
      join public.workspace_members wm
        on wm.workspace_id = g.workspace_id
       and wm.user_id = auth.uid()
      where g.id = workspace_group_members.group_id
    )
  );

create policy workspace_group_members_insert on public.workspace_group_members
  for insert
  with check (
    exists (
      select 1
      from public.workspace_groups g
      join public.workspace_members wm
        on wm.workspace_id = g.workspace_id
       and wm.user_id = auth.uid()
       and wm.role in ('owner', 'admin')
      where g.id = workspace_group_members.group_id
    )
    and exists (
      -- The user being added must already belong to the workspace.
      select 1
      from public.workspace_groups g
      join public.workspace_members wm2
        on wm2.workspace_id = g.workspace_id
       and wm2.user_id = workspace_group_members.user_id
      where g.id = workspace_group_members.group_id
    )
  );

create policy workspace_group_members_delete on public.workspace_group_members
  for delete
  using (
    exists (
      select 1
      from public.workspace_groups g
      join public.workspace_members wm
        on wm.workspace_id = g.workspace_id
       and wm.user_id = auth.uid()
       and wm.role in ('owner', 'admin')
      where g.id = workspace_group_members.group_id
    )
  );

COMMIT;
