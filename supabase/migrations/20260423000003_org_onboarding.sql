-- Organization onboarding: adds onboarding state, org-profile fields,
-- and a domain-based auto-join trigger on auth.users.
--
-- UI renames "Workspace" -> "Organization" but the DB table stays `workspaces`
-- so this migration extends the existing table rather than introducing a new one.

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------

alter table public.workspaces
  add column if not exists onboarding_step   text,
  add column if not exists auto_join_domain  text,
  add column if not exists auto_join_enabled boolean default false,
  add column if not exists legal_name        text,
  add column if not exists billing_email     text,
  add column if not exists industry          text,
  add column if not exists size_bucket       text;

-- Backfill existing rows as "complete" so current users are not blocked
-- by the onboarding modal the first time they load the app after deploy.
update public.workspaces
set onboarding_step = 'complete'
where onboarding_step is null;

alter table public.workspaces
  alter column onboarding_step set default 'pending',
  alter column onboarding_step set not null;

-- Valid states: 'pending' | 'named' | 'complete'
alter table public.workspaces
  add constraint workspaces_onboarding_step_check
  check (onboarding_step in ('pending', 'named', 'complete'));

-- Valid size buckets
alter table public.workspaces
  add constraint workspaces_size_bucket_check
  check (size_bucket is null or size_bucket in ('1-10', '11-50', '51-200', '200+'));

-- Domains are stored lowercase; enforce a simple format.
alter table public.workspaces
  add constraint workspaces_auto_join_domain_format
  check (
    auto_join_domain is null
    or auto_join_domain ~* '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
  );

-- Index for fast domain lookup on signup.
create index if not exists workspaces_auto_join_domain_idx
  on public.workspaces (lower(auto_join_domain))
  where auto_join_enabled = true and deleted_at is null;

-- ---------------------------------------------------------------------------
-- 2. Domain auto-join trigger
-- ---------------------------------------------------------------------------
-- When a new auth.users row is inserted, check if their email domain matches
-- any workspace with auto_join_enabled=true. If so, insert them as a member.

create or replace function public.auto_join_workspace_by_domain()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_domain text;
  v_workspace_id uuid;
begin
  if new.email is null or new.email = '' then
    return new;
  end if;

  v_domain := lower(split_part(new.email, '@', 2));
  if v_domain is null or v_domain = '' then
    return new;
  end if;

  for v_workspace_id in
    select id
    from public.workspaces
    where auto_join_enabled = true
      and lower(auto_join_domain) = v_domain
      and deleted_at is null
  loop
    insert into public.workspace_members (workspace_id, user_id, role, invited_by, joined_at)
    values (v_workspace_id, new.id, 'member', null, now())
    on conflict (workspace_id, user_id) do nothing;
  end loop;

  return new;
end;
$$;

drop trigger if exists auto_join_workspace_by_domain_trigger on auth.users;
create trigger auto_join_workspace_by_domain_trigger
after insert on auth.users
for each row
execute function public.auto_join_workspace_by_domain();

comment on function public.auto_join_workspace_by_domain is
  'On auth.users insert, adds the new user as a member of any workspace whose auto_join_domain matches their email domain and whose auto_join_enabled = true.';
