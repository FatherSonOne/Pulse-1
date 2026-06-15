-- S1-2: delivery / listened receipts for Relay "Direct" (quick_vox_messages).
--
-- The category's #1 trust signal is "did it arrive / was it heard". quick_vox
-- already has delivered_at + played_at, but the table's UPDATE RLS is sender-only
-- (sender_id = auth.uid()), so the RECIPIENT — the only party who knows a message
-- was delivered/played — cannot set those timestamps. The prior direct UPDATE in
-- markTriageItemRead('quick') silently matched 0 rows.
--
-- These SECURITY DEFINER RPCs let the recipient set ONLY the delivery
-- timestamps/status, and ONLY on rows where they are the recipient (auth.uid()
-- reads the caller's JWT even under SECURITY DEFINER). They cannot edit audio,
-- transcript, analysis, or any sender-owned field, and cannot touch messages they
-- did not receive. search_path is pinned per the DB security baseline.

create or replace function public.mark_quick_vox_played(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  update public.quick_vox_messages
     set played_at = coalesce(played_at, now()),
         delivered_at = coalesce(delivered_at, now()),
         status = 'played'
   where id = p_message_id
     and recipient_id = auth.uid();
end;
$$;

create or replace function public.mark_quick_vox_delivered_all()
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  update public.quick_vox_messages
     set delivered_at = now(),
         status = case when status = 'sent' then 'delivered' else status end
   where recipient_id = auth.uid()
     and delivered_at is null;
end;
$$;

revoke all on function public.mark_quick_vox_played(uuid) from public;
revoke all on function public.mark_quick_vox_delivered_all() from public;
grant execute on function public.mark_quick_vox_played(uuid) to authenticated;
grant execute on function public.mark_quick_vox_delivered_all() to authenticated;
