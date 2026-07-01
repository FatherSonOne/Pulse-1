-- Passkeys (WebAuthn / FIDO2) — data model for Option A (self-hosted ceremonies).
-- See docs/PASSKEY_WEBAUTHN_BUILD_HANDOFF_2026-07-01.md.
--
-- Two tables:
--   user_passkeys       — one row per enrolled credential (public key + counter)
--   passkey_challenges  — short-lived, single-use ceremony challenges (5 min TTL)
--
-- Storage note: credential_id and public_key are base64url TEXT (not bytea) so
-- they round-trip cleanly through PostgREST and back into a Uint8Array in the
-- edge functions. This deviates from the handoff's `bytea` sketch on purpose.

-- ── Enrolled credentials ──────────────────────────────────────────────
create table if not exists public.user_passkeys (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  credential_id  text not null unique,          -- base64url raw credential id
  public_key     text not null,                 -- base64url COSE public key
  counter        bigint not null default 0,     -- signature counter (clone detection)
  transports     text[],                        -- ['internal','hybrid','usb',...]
  device_label   text,                          -- user-facing ("MacBook Touch ID")
  aaguid         text,                           -- authenticator model (optional)
  backed_up      boolean not null default false, -- synced/multi-device credential?
  created_at     timestamptz not null default now(),
  last_used_at   timestamptz
);

create index if not exists user_passkeys_user_id_idx on public.user_passkeys (user_id);

alter table public.user_passkeys enable row level security;

-- Users may read and delete (revoke) ONLY their own credentials. Inserts and
-- counter updates happen exclusively from the finish edge functions using the
-- service role, which bypasses RLS — so no user-facing write policy exists.
drop policy if exists "own passkeys read" on public.user_passkeys;
create policy "own passkeys read" on public.user_passkeys
  for select using (auth.uid() = user_id);

drop policy if exists "own passkeys delete" on public.user_passkeys;
create policy "own passkeys delete" on public.user_passkeys
  for delete using (auth.uid() = user_id);

-- ── Ceremony challenges ───────────────────────────────────────────────
-- Single-use, short TTL. Registration challenges carry the user_id (authed);
-- authentication challenges are anonymous (usernameless/discoverable) so
-- user_id/email are null until the assertion resolves to a credential.
create table if not exists public.passkey_challenges (
  id          uuid primary key default gen_random_uuid(),
  challenge   text not null,
  kind        text not null check (kind in ('registration', 'authentication')),
  user_id     uuid references auth.users(id) on delete cascade,
  email       text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '5 minutes'),
  consumed_at timestamptz
);

create index if not exists passkey_challenges_expires_at_idx on public.passkey_challenges (expires_at);

-- No policies: only the edge functions (service role) ever touch this table.
-- RLS on with zero policies = deny-all for anon/authenticated.
alter table public.passkey_challenges enable row level security;

-- Housekeeping helper: purge expired/consumed challenges. Called opportunistically
-- from the begin functions; cheap enough that a cron job is optional.
create or replace function public.purge_expired_passkey_challenges()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.passkey_challenges
  where expires_at < now() or consumed_at is not null;
$$;

comment on table public.user_passkeys is 'WebAuthn/FIDO2 credentials. Writes via service-role edge functions only; users read/delete own via RLS.';
comment on table public.passkey_challenges is 'Single-use WebAuthn ceremony challenges, 5min TTL. Edge-function/service-role access only.';
