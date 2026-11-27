-- The link survives a deletion in Pulse so a delivery retry cannot recreate
-- a task the workspace deliberately removed.
create table public.entomate_task_links (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  action_item_id uuid not null,
  meeting_id uuid not null,
  pulse_task_id uuid not null unique,
  status_version timestamptz not null,
  primary key (workspace_id, action_item_id)
);
alter table public.entomate_task_links enable row level security;
revoke all on public.entomate_task_links from public, anon, authenticated;
grant select, insert, update on public.entomate_task_links to service_role;

create or replace function public.apply_entomate_task_status(
  p_workspace_id uuid, p_meeting_id uuid, p_action_item_id uuid, p_status text,
  p_status_version timestamptz, p_completed_at timestamptz, p_task jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  local_task_id uuid;
  pulse_status text := case p_status when 'open' then 'todo' when 'review' then 'in_review' else p_status end;
  status_label text := case p_status when 'done' then 'Completed' when 'open' then 'Open'
    when 'pending' then 'Open' when 'review' then 'In review'
    when 'in_progress' then 'In progress' when 'blocked' then 'Blocked' end;
  status_version_text text := to_char(p_status_version at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  assignee_id text;
  updated_count integer := 0;
begin
  if status_label is null or p_status_version is null then
    raise exception 'Invalid Entomate task status' using errcode = '22023';
  end if;

  -- Materialize only an existing Entomate assignment in this workspace.
  -- The workspace row also keeps the scope valid for the native task board.
  if exists (
    select 1 from public.chat_messages
    where workspace_id = p_workspace_id and sender_id = 'e0000000-0000-0000-0000-e00000000001'
      and bot_app = 'entomate' and is_bot_message and bot_message_type = 'action_items'
      and bot_metadata @> jsonb_build_object('actionItemId', p_action_item_id, 'meetingId', p_meeting_id)
  ) and exists (
    select 1 from public.workspaces where id = p_workspace_id and deleted_at is null
  ) and nullif(btrim(p_task->>'title'), '') is not null then
    insert into public.entomate_task_links (workspace_id, action_item_id, meeting_id, pulse_task_id, status_version)
    values (p_workspace_id, p_action_item_id, p_meeting_id, gen_random_uuid(), p_status_version)
    on conflict (workspace_id, action_item_id) do nothing
    returning pulse_task_id into local_task_id;

    if found then
      -- A name alone does not establish identity. Keep unmatched work visible
      -- in the workspace as unassigned and retain the original assignee name.
      select min(u.id::text) into assignee_id
      from (
        select user_id from public.workspace_members where workspace_id = p_workspace_id
        union
        select owner_id from public.workspaces where id = p_workspace_id
      ) as members
      join auth.users as u on u.id = members.user_id
      where lower(u.email) = lower(nullif(btrim(p_task->>'assigneeEmail'), ''))
      having count(*) = 1;

      insert into public.extracted_tasks
        (id, workspace_id, title, status, priority, deadline, assignee_id, completed_at, blocked_at, metadata)
      values
        (local_task_id, p_workspace_id, p_task->>'title', pulse_status,
         case when p_task->>'priority' in ('low', 'medium', 'high', 'urgent') then p_task->>'priority' else 'medium' end,
         (p_task->>'dueDate')::date, assignee_id,
         case when p_status = 'done' then coalesce(p_completed_at, p_status_version) end,
         case when p_status = 'blocked' then p_status_version end,
         jsonb_strip_nulls(jsonb_build_object('source', 'entomate',
           'entomate_meeting_id', p_meeting_id, 'entomate_action_item_id', p_action_item_id,
           'entomate_assignee', p_task->>'assigneeName')));
      updated_count := 1;
    end if;
  end if;

  if updated_count = 0 then
    update public.entomate_task_links
    set status_version = p_status_version
    where workspace_id = p_workspace_id and action_item_id = p_action_item_id and meeting_id = p_meeting_id
      and status_version < p_status_version
    returning pulse_task_id into local_task_id;

    if found then
      update public.extracted_tasks
      set status = pulse_status, updated_at = now(),
        completed_at = case when p_status = 'done' then coalesce(p_completed_at, p_status_version) end,
        blocked_at = case when p_status = 'blocked' then coalesce(blocked_at, p_status_version) end,
        archived_at = case when p_status <> 'done' and status in ('done', 'cancelled') then null else archived_at end
      where id = local_task_id and workspace_id = p_workspace_id;
      get diagnostics updated_count = row_count;
    end if;
  end if;

  update public.chat_messages
  set bot_content = (case when bot_metadata ? 'entomateStatusVersion'
      then regexp_replace(coalesce(bot_content, ''), E'\\n\\n\\*\\*Status:\\*\\* [^\\r\\n]*$', '')
      else coalesce(bot_content, '') end) || E'\n\n**Status:** ' || status_label,
    bot_metadata = bot_metadata || jsonb_build_object('entomateStatus', p_status, 'entomateStatusVersion', status_version_text)
  where workspace_id = p_workspace_id and sender_id = 'e0000000-0000-0000-0000-e00000000001'
    and bot_app = 'entomate' and is_bot_message and bot_message_type = 'action_items'
    and bot_metadata @> jsonb_build_object('actionItemId', p_action_item_id, 'meetingId', p_meeting_id)
    and (bot_metadata->>'entomateStatusVersion' is null or bot_metadata->>'entomateStatusVersion' < status_version_text);

  return updated_count;
end;
$$;

revoke all on function public.apply_entomate_task_status(uuid, uuid, uuid, text, timestamptz, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_entomate_task_status(uuid, uuid, uuid, text, timestamptz, timestamptz, jsonb)
  to service_role;
