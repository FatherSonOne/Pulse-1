-- Workspace-level integration policy + admin visibility into member connections.
--
-- 1. workspace_integrations: per-org record of which integrations exist and
--    whether they're "shared" (admin connects once, all members route through it)
--    or "per_user" (each member connects their own credentials).
-- 2. get_workspace_member_connections RPC: SECURITY DEFINER read across all
--    members' oauth_connected_apps for admin visibility.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. workspace_integrations
-- ---------------------------------------------------------------------------

create table if not exists public.workspace_integrations (
  id              uuid        not null default gen_random_uuid() primary key,
  workspace_id    uuid        not null references public.workspaces(id) on delete cascade,
  integration_key text        not null,
  scope           text        not null default 'per_user',
  is_enabled      boolean     not null default true,
  shared_config   jsonb       not null default '{}'::jsonb,
  connected_by    uuid        references auth.users(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (workspace_id, integration_key)
);

create index if not exists workspace_integrations_workspace_idx
  on public.workspace_integrations (workspace_id);

-- Curated list of supported integration keys.
alter table public.workspace_integrations
  drop constraint if exists workspace_integrations_key_check;
alter table public.workspace_integrations
  add constraint workspace_integrations_key_check
  check (integration_key in (
    'slack', 'gmail', 'google_calendar', 'google_drive',
    'microsoft', 'twilio', 'zapier'
  ));

-- Scope must be one of two values.
alter table public.workspace_integrations
  drop constraint if exists workspace_integrations_scope_check;
alter table public.workspace_integrations
  add constraint workspace_integrations_scope_check
  check (scope in ('per_user', 'shared'));

-- updated_at trigger
create or replace function public.set_workspace_integrations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_workspace_integrations_updated_at on public.workspace_integrations;
create trigger trg_workspace_integrations_updated_at
  before update on public.workspace_integrations
  for each row
  execute function public.set_workspace_integrations_updated_at();

-- ---------------------------------------------------------------------------
-- 2. RLS: workspace_integrations
-- ---------------------------------------------------------------------------

alter table public.workspace_integrations enable row level security;

drop policy if exists workspace_integrations_select on public.workspace_integrations;
drop policy if exists workspace_integrations_insert on public.workspace_integrations;
drop policy if exists workspace_integrations_update on public.workspace_integrations;
drop policy if exists workspace_integrations_delete on public.workspace_integrations;

create policy workspace_integrations_select on public.workspace_integrations
  for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_integrations.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy workspace_integrations_insert on public.workspace_integrations
  for insert
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_integrations.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

create policy workspace_integrations_update on public.workspace_integrations
  for update
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_integrations.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

create policy workspace_integrations_delete on public.workspace_integrations
  for delete
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_integrations.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- ---------------------------------------------------------------------------
-- 3. RPC: get_workspace_member_connections
--    Returns each member's connected providers from oauth_connected_apps.
--    Admin/owner only; enforced inside the function body.
-- ---------------------------------------------------------------------------

create or replace function public.get_workspace_member_connections(p_workspace_id uuid)
returns table (
  user_id          uuid,
  user_name        text,
  user_email       text,
  user_avatar_url  text,
  user_role        text,
  joined_at        timestamptz,
  providers        text[],
  app_count        integer,
  last_connected_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_role text;
begin
  -- NB: alias + qualify, otherwise `workspace_id` / `user_id` collide with the
  -- function's OUT parameters (same names in the RETURNS TABLE list) and
  -- Postgres raises "column reference 'user_id' is ambiguous" at runtime.
  select wm.role into v_role
  from public.workspace_members wm
  where wm.workspace_id = p_workspace_id
    and wm.user_id = auth.uid();

  if v_role is null or v_role not in ('owner', 'admin') then
    raise exception 'forbidden: admin+ required';
  end if;

  return query
  select
    wm.user_id                                                              as user_id,
    coalesce(p.display_name, p.full_name, u.email::text)                    as user_name,
    u.email::text                                                           as user_email,
    p.avatar_url                                                            as user_avatar_url,
    wm.role                                                                 as user_role,
    wm.joined_at                                                            as joined_at,
    -- Cast provider to text inside the agg — column is varchar in
    -- oauth_connected_apps, so the bare array_agg yields varchar[] which
    -- doesn't match this function's `providers text[]` OUT type and trips
    -- "structure of query does not match function result type".
    coalesce(array_agg(distinct apps.provider::text) filter (where apps.id is not null), '{}'::text[]) as providers,
    coalesce(count(apps.id) filter (where apps.is_active is true), 0)::int  as app_count,
    max(apps.last_used_at)                                                  as last_connected_at
  from public.workspace_members wm
  left join auth.users u
    on u.id = wm.user_id
  left join public.user_profiles p
    on p.id = wm.user_id
  left join public.oauth_connected_apps apps
    on apps.user_id = wm.user_id
   and apps.is_active = true
  where wm.workspace_id = p_workspace_id
  group by wm.user_id, p.display_name, p.full_name, u.email, p.avatar_url, wm.role, wm.joined_at
  order by wm.joined_at asc;
end;
$$;

grant execute on function public.get_workspace_member_connections(uuid) to authenticated;

comment on function public.get_workspace_member_connections is
  'Returns each workspace member with the OAuth providers they have connected. Admin+ only.';

COMMIT;
