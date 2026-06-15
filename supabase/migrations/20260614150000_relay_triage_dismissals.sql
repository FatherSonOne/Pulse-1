-- Relay launch-readiness S2-2 — cross-device triage dismissals.
--
-- Until now, "dismiss" on a Relay Inbox item lived only in localStorage
-- (key `relay_triage_dismissed:<authUserId>` in voxModeService), so a
-- dismissal on one device never followed the user to another. This table is
-- the durable backend the service comment promised; the public surface of
-- dismissTriageItem / undismissTriageItem / getDismissedTriageIds is unchanged.
--
-- Identity: voxModeService.ensureUserId() returns supabase.auth.getUser().id
-- (the auth user UUID), so user_id keys on auth.uid() — matching the
-- recipient-scoped quick_vox receipt RPCs added in 20260614140000.
--
-- row_id is TEXT (not uuid) on purpose: the dismiss key is `${kind}:${id}` and
-- keeping the id side as text avoids a cast hazard if any source ever carries a
-- non-uuid id, and costs nothing here. Composite PK (user_id, kind, row_id)
-- gives idempotent re-dismiss + the per-user uniqueness for free.

create table if not exists public.relay_triage_dismissals (
  user_id      uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  kind         text        not null check (kind in ('classic','thread','quick','broadcast','note')),
  row_id       text        not null,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, kind, row_id)
);

create index if not exists relay_triage_dismissals_user_idx
  on public.relay_triage_dismissals (user_id);

-- Per the 2026-05-31 DB security baseline: every public table is RLS-on.
alter table public.relay_triage_dismissals enable row level security;

-- Own-row only. No UPDATE policy by design — a dismissal is add/remove, never
-- edited; undismiss is a DELETE.
drop policy if exists "relay_triage_dismissals_select_own" on public.relay_triage_dismissals;
create policy "relay_triage_dismissals_select_own"
  on public.relay_triage_dismissals for select
  using (user_id = auth.uid());

drop policy if exists "relay_triage_dismissals_insert_own" on public.relay_triage_dismissals;
create policy "relay_triage_dismissals_insert_own"
  on public.relay_triage_dismissals for insert
  with check (user_id = auth.uid());

drop policy if exists "relay_triage_dismissals_delete_own" on public.relay_triage_dismissals;
create policy "relay_triage_dismissals_delete_own"
  on public.relay_triage_dismissals for delete
  using (user_id = auth.uid());

grant select, insert, delete on public.relay_triage_dismissals to authenticated;
