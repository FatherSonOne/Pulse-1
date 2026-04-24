-- Organization-level security policy: 2FA enforcement, session timeout, IP allowlist.
-- Also adds a SECURITY DEFINER RPC so org admins can view recent sign-in activity
-- across all members of a workspace (user_sessions is otherwise SELECT-limited to
-- auth.uid() = user_id by its existing RLS policy).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. workspaces: security policy columns
-- ---------------------------------------------------------------------------

alter table public.workspaces
  add column if not exists enforce_2fa            boolean not null default false,
  add column if not exists session_timeout_minutes integer not null default 0,
  add column if not exists ip_allowlist           jsonb   not null default '[]'::jsonb;

-- Allowed session timeouts: 0 (never), 60 (1h), 480 (8h), 1440 (24h), 10080 (7d).
alter table public.workspaces
  drop constraint if exists workspaces_session_timeout_check;
alter table public.workspaces
  add constraint workspaces_session_timeout_check
  check (session_timeout_minutes in (0, 60, 480, 1440, 10080));

-- ip_allowlist must be a JSON array (of CIDR strings — format validated in app).
alter table public.workspaces
  drop constraint if exists workspaces_ip_allowlist_is_array;
alter table public.workspaces
  add constraint workspaces_ip_allowlist_is_array
  check (jsonb_typeof(ip_allowlist) = 'array');

comment on column public.workspaces.enforce_2fa is
  'When true, all members must have TOTP MFA enrolled to access the workspace.';
comment on column public.workspaces.session_timeout_minutes is
  'Forced session expiry in minutes. 0 = never. Allowed: 0, 60, 480, 1440, 10080.';
comment on column public.workspaces.ip_allowlist is
  'JSON array of CIDR blocks. Empty array = no restriction.';

-- ---------------------------------------------------------------------------
-- 2. RPC: get_workspace_sign_in_activity
--    Returns recent user_sessions rows for all members of a workspace.
--    Owner/admin only; enforced inside the function body.
-- ---------------------------------------------------------------------------

create or replace function public.get_workspace_sign_in_activity(
  p_workspace_id uuid,
  p_limit        integer default 50
)
returns table (
  session_id      uuid,
  user_id         uuid,
  user_email      text,
  user_name       text,
  device_name     varchar,
  device_type     varchar,
  browser_name    varchar,
  os_name         varchar,
  ip_address      inet,
  location        varchar,
  is_active       boolean,
  is_current      boolean,
  last_active_at  timestamptz,
  created_at      timestamptz,
  revoked_at      timestamptz
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_role text;
begin
  select role into v_role
  from public.workspace_members
  where workspace_id = p_workspace_id
    and user_id = auth.uid();

  if v_role is null or v_role not in ('owner', 'admin') then
    raise exception 'forbidden: admin+ required';
  end if;

  return query
  select
    s.id                                             as session_id,
    s.user_id                                        as user_id,
    u.email::text                                    as user_email,
    coalesce(p.display_name, p.full_name, u.email::text) as user_name,
    s.device_name                                    as device_name,
    s.device_type                                    as device_type,
    s.browser_name                                   as browser_name,
    s.os_name                                        as os_name,
    s.ip_address                                     as ip_address,
    s.location                                       as location,
    s.is_active                                      as is_active,
    s.is_current                                     as is_current,
    s.last_active_at                                 as last_active_at,
    s.created_at                                     as created_at,
    s.revoked_at                                     as revoked_at
  from public.user_sessions s
  join public.workspace_members wm
    on wm.user_id = s.user_id
   and wm.workspace_id = p_workspace_id
  join auth.users u
    on u.id = s.user_id
  left join public.user_profiles p
    on p.id = s.user_id
  order by s.last_active_at desc nulls last
  limit coalesce(p_limit, 50);
end;
$$;

grant execute on function public.get_workspace_sign_in_activity(uuid, integer) to authenticated;

comment on function public.get_workspace_sign_in_activity is
  'Returns recent user_sessions rows for all members of the workspace. Owner/admin only.';

COMMIT;
