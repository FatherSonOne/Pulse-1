-- Per-user locale preferences: language and timezone.
-- Stored on user_profiles so they survive across workspaces and sessions.

BEGIN;

alter table public.user_profiles
  add column if not exists language text not null default 'en',
  add column if not exists timezone text not null default 'UTC';

-- Common BCP-47 language tags. Lenient — allow any 2-8 char lowercase tag with optional region.
alter table public.user_profiles
  drop constraint if exists user_profiles_language_check;
alter table public.user_profiles
  add constraint user_profiles_language_check
  check (language ~* '^[a-z]{2,3}(-[A-Z]{2})?$');

-- IANA timezone format: Region/City. Allow Etc/* and UTC.
alter table public.user_profiles
  drop constraint if exists user_profiles_timezone_check;
alter table public.user_profiles
  add constraint user_profiles_timezone_check
  check (timezone = 'UTC' or timezone ~ '^[A-Za-z_]+/[A-Za-z_]+(/[A-Za-z_]+)?$');

comment on column public.user_profiles.language is
  'BCP-47 language tag (e.g. "en", "en-US", "es"). Defaults to "en".';
comment on column public.user_profiles.timezone is
  'IANA timezone identifier (e.g. "America/New_York"). Defaults to "UTC".';

COMMIT;
