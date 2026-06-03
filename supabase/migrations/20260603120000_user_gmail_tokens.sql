-- Per-user Gmail grant token store (scope-split, owner-only Gmail).
--
-- Part of the OAuth scope split: the restricted Gmail scopes are pulled out of
-- the login flow into a SEPARATE Gmail OAuth client (its own GCP project kept in
-- "Testing"), so production login stays CASA-free. The Gmail refresh token can
-- only be refreshed by that Gmail client, so it must be stored apart from the
-- login token (public.user_google_tokens) and the logos-vision token
-- (public.google_oauth_tokens, keyed by workspace_id).
--
-- Applied to the cloud project (ucaeuszgoihoyrvhewxk) via the Supabase MCP on
-- 2026-06-03; this file records it for repo history.

CREATE TABLE IF NOT EXISTS public.user_gmail_tokens (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token text NOT NULL,
  access_token  text,
  expiry_date   bigint,
  scope         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- RLS on, no anon/authenticated policies: the refresh token must never reach the
-- browser. The backend uses the service-role key (bypasses RLS).
ALTER TABLE public.user_gmail_tokens ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.user_gmail_tokens IS
  'Per-user Gmail OAuth grant (separate Testing client). Server-side only; distinct from user_google_tokens (login client 35770) and google_oauth_tokens (logos-vision by workspace_id).';
