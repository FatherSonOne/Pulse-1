-- Slack-Grounded Messages — P0 schema foundation (additive, default-safe).
-- Scope: docs/SLACK_MESSAGES_GROUNDING_SCOPE_2026-06-06.md §7 / §14 (P0).
-- Gated at runtime behind the FeatureContext flag `slackMessagesGrounding`
-- (default OFF). This migration introduces NO behavior change: existing rows
-- are untouched (transport defaults 'pulse') and nothing reads the new columns
-- until later phases. Validated dry-run-rollback clean before apply.

-- (1) Conversation-level external (Slack) identity, used only by a
--     transport='slack' thread. Default-safe: every existing conversation
--     stays transport='pulse'.
ALTER TABLE public.pulse_conversations
  ADD COLUMN IF NOT EXISTS transport              text NOT NULL DEFAULT 'pulse',
  ADD COLUMN IF NOT EXISTS external_slack_user_id  text,
  ADD COLUMN IF NOT EXISTS external_email          text,
  ADD COLUMN IF NOT EXISTS external_display_name   text;

-- (2) Graduation persistence: the Pulse user a contact maps to once they join
--     Pulse (the Slack->native flip). Without this, pulseUserId reverts to
--     External on every refetch (dbToContact never mapped it).
--     NOTE: contacts.user_id is TEXT (a deliberate schema gotcha), but
--     pulse_user_id is uuid to match auth.users(id) / pulse_users.auth_user_id.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS pulse_user_id uuid;

-- (3) Slack USER-token store (xoxp-, send-as-you + own-DM read), modeled on
--     public.user_google_tokens. Slack user tokens are non-expiring unless
--     rotation is enabled (out of scope), so there is intentionally NO
--     refresh_token / expiry_date column.
--     RLS is ENABLED with NO client policies => deny-all to clients. The row is
--     read/written ONLY via the server's service-role tokenStoreClient (the
--     xoxp- token must never reach the browser). This mirrors user_google_tokens
--     exactly (relrowsecurity = true, 0 policies).
CREATE TABLE IF NOT EXISTS public.user_slack_tokens (
  user_id       uuid NOT NULL,
  access_token  text NOT NULL,                 -- the xoxp- user token (authed_user.access_token)
  scope         text,
  slack_user_id text,                          -- authed_user.id
  slack_team_id text,                          -- team.id
  bot_user_id   text,
  token_type    text DEFAULT 'user',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  CONSTRAINT user_slack_tokens_user_id_key UNIQUE (user_id)
);
ALTER TABLE public.user_slack_tokens ENABLE ROW LEVEL SECURITY;
