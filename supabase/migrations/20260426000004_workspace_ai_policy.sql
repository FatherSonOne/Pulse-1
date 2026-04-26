-- Workspace-level AI policy: allowed model providers, PII masking enforcement,
-- and AI output retention window. Admin/owner only — RLS on workspaces already
-- restricts UPDATE to admin+, so no extra policies needed.

BEGIN;

alter table public.workspaces
  add column if not exists ai_allowed_providers      jsonb   not null default '{"openai":true,"anthropic":true,"google":true}'::jsonb,
  add column if not exists ai_pii_masking_enforced   boolean not null default false,
  add column if not exists ai_output_retention_days  integer not null default 0;

-- Allowed providers must be a JSON object.
alter table public.workspaces
  drop constraint if exists workspaces_ai_allowed_providers_is_object;
alter table public.workspaces
  add constraint workspaces_ai_allowed_providers_is_object
  check (jsonb_typeof(ai_allowed_providers) = 'object');

-- Retention windows: 0 (forever), 7, 30, 90, 365 days.
alter table public.workspaces
  drop constraint if exists workspaces_ai_output_retention_check;
alter table public.workspaces
  add constraint workspaces_ai_output_retention_check
  check (ai_output_retention_days in (0, 7, 30, 90, 365));

comment on column public.workspaces.ai_allowed_providers is
  'JSON object: { openai: bool, anthropic: bool, google: bool }. False blocks the provider org-wide.';
comment on column public.workspaces.ai_pii_masking_enforced is
  'When true, all AI prompts have emails / phones / SSNs scrubbed before sending to providers. Members cannot disable.';
comment on column public.workspaces.ai_output_retention_days is
  'Days to retain AI prompts and completions. 0 = retained until manually deleted. Allowed: 0, 7, 30, 90, 365.';

COMMIT;
