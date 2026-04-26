-- Compliance: legal hold flag on workspaces.
-- When legal_hold = true, hard-delete is blocked at the RPC level so
-- workspace data cannot be permanently destroyed during an active legal hold.
-- Soft-delete (archive) is still allowed; the data simply cannot be purged.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. legal_hold column
-- ---------------------------------------------------------------------------

alter table public.workspaces
  add column if not exists legal_hold boolean not null default false;

comment on column public.workspaces.legal_hold is
  'When true, hard_delete_workspace is blocked. Used to preserve data during litigation, audits, or compliance investigations.';

-- ---------------------------------------------------------------------------
-- 2. hard_delete_workspace — block when legal_hold = true
-- ---------------------------------------------------------------------------

create or replace function public.hard_delete_workspace(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_legal_hold boolean;
begin
  -- Owner-only guard + capture legal_hold state
  select legal_hold
    into v_legal_hold
  from public.workspaces
  where id = p_workspace_id
    and owner_id = auth.uid();

  if not found then
    raise exception 'Permission denied: only the workspace owner can permanently delete';
  end if;

  if v_legal_hold then
    raise exception 'Cannot permanently delete: workspace is under legal hold. Disable legal hold first.';
  end if;

  delete from public.workspaces
  where id = p_workspace_id;
end;
$$;

COMMIT;
