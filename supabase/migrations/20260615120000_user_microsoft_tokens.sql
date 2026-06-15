-- Per-user Microsoft (Azure AD / Graph) LOGIN provider refresh token store.
--
-- Mirrors public.user_google_tokens. Holds the Supabase `azure` provider refresh
-- token, keyed by the auth user id, so the backend can mint fresh Microsoft Graph
-- access tokens for Contacts (and future server-side Outlook/Calendar use) after
-- Supabase drops provider_token / provider_refresh_token from the session
-- (~1h after sign-in). The refresh_token never reaches the browser; the backend
-- uses the service-role key to read/write this table.
--
-- Applied to the cloud project (ucaeuszgoihoyrvhewxk) via the Supabase MCP on
-- 2026-06-15; this file records it for repo history.

CREATE TABLE IF NOT EXISTS public.user_microsoft_tokens (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token text NOT NULL,
  access_token  text,
  expiry_date   bigint,
  scope         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- All public tables are RLS-on (DB security baseline). No anon/authenticated
-- policies: the refresh_token must never reach the browser. The backend uses
-- the service-role key, which bypasses RLS.
ALTER TABLE public.user_microsoft_tokens ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.user_microsoft_tokens IS
  'Per-user Microsoft (Azure) provider refresh token (Supabase azure client). Server-side only; survives Supabase dropping provider_refresh_token from the session. Mirror of user_google_tokens.';

-- Widen the contacts source provenance set to include Microsoft/Outlook imports.
-- Superset of the existing allowed values, so every existing row still passes.
ALTER TABLE public.contacts DROP CONSTRAINT contacts_source_check;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_source_check
  CHECK (source = ANY (ARRAY['local'::text, 'google'::text, 'vision'::text, 'microsoft'::text]));
