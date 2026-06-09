-- Track 4: separate Google Contacts grant (owner-only, mirrors user_gmail_tokens)
-- so a user can import contacts from a DIFFERENT Google account than their login,
-- plus per-account provenance on contacts so wipe/dedupe can be account-scoped.
--
-- Applied to the cloud project (ucaeuszgoihoyrvhewxk) via the Supabase MCP on
-- 2026-06-08 (dry-run in a rolled-back DO block first, then applied once); this
-- file records it for repo history (apply-via-MCP-first pattern, matches
-- 20260603120000_user_gmail_tokens.sql).

CREATE TABLE IF NOT EXISTS public.user_google_contacts_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token text NOT NULL,
  access_token text,
  expiry_date bigint,
  scope text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS on, no anon/authenticated policies (deny-all to clients; backend
-- service-role bypasses). Mirrors user_gmail_tokens.
ALTER TABLE public.user_google_contacts_tokens ENABLE ROW LEVEL SECURITY;

-- Provenance: which Google account a contact row was imported from. Nullable,
-- NULL for existing rows and for login-account imports; set only when a contact
-- comes from the separate Contacts grant (a different account). Lets "Start
-- Over" / dedupe be scoped per source account instead of all-Google.
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS source_account_email text;
