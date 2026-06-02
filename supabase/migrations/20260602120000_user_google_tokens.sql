-- Per-user Google LOGIN provider refresh token store.
--
-- Distinct from public.google_oauth_tokens (the logos-vision integration token
-- store, keyed by workspace_id, OAuth client 234234…). This table holds the
-- Supabase Google LOGIN client (35770…) refresh token, keyed by the auth user
-- id, so the backend can mint fresh access tokens for Gmail/Calendar/Contacts/
-- Drive after Supabase drops provider_token / provider_refresh_token from the
-- session (~1h after sign-in).
--
-- Applied to the cloud project (ucaeuszgoihoyrvhewxk) via the Supabase MCP on
-- 2026-06-02; this file records it for repo history.

CREATE TABLE IF NOT EXISTS public.user_google_tokens (
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
ALTER TABLE public.user_google_tokens ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.user_google_tokens IS
  'Per-user Google LOGIN provider refresh token (Supabase Google client 35770). Server-side only; survives Supabase dropping provider_refresh_token from the session. Distinct from google_oauth_tokens (logos-vision integration, keyed by workspace_id).';
