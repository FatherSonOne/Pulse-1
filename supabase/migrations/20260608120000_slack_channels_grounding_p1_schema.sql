-- Slack Channels Grounding (Integration C) · P1 — schema
--
-- Net-new, owner-scoped container for mirroring Slack CHANNEL threads (N-party)
-- into Pulse. A SIBLING of the 1:1 DM grounding path (pulse_conversations /
-- pulse_messages), NOT a change to it: the DM tables are provably 2-party
-- (UNIQUE pair index + CHECK different_users + two NOT NULL participant cols),
-- so a channel needs its own container. See
-- docs/SLACK_CHANNELS_GROUNDING_SCOPE_2026-06-08.md (D1, §2).
--
-- RLS: single-owner. Clients get SELECT only; all writes are service-role
-- (the slack-events edge fn in P3 + the authed reply route in P6), exactly like
-- user_slack_tokens (RLS ON + zero client write policies = deny-all client writes).
--
-- Dry-run-rollback validated against live schema before apply (CLAUDE.md §4).

-- ===== slack_channel_threads — one row per (owner × Slack channel) =====
CREATE TABLE public.slack_channel_threads (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_pulse_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slack_team_id     text        NOT NULL,
  slack_channel_id  text        NOT NULL,
  channel_name      text,
  transport         text        NOT NULL DEFAULT 'slack_channel',
  is_private        boolean     NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  last_message_at   timestamptz,
  CONSTRAINT slack_channel_threads_owner_team_channel_uniq
    UNIQUE (owner_pulse_id, slack_team_id, slack_channel_id)
);

CREATE INDEX idx_slack_channel_threads_owner_recent
  ON public.slack_channel_threads (owner_pulse_id, last_message_at DESC NULLS LAST);

-- ===== slack_channel_messages — text-native; content NOT NULL, no audio fakes =====
CREATE TABLE public.slack_channel_messages (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id         uuid        NOT NULL REFERENCES public.slack_channel_threads(id) ON DELETE CASCADE,
  sender_shadow_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,  -- null = owner's own reply
  sender_slack_id   text,
  sender_name       text        NOT NULL,
  content           text        NOT NULL,
  is_outgoing       boolean     NOT NULL DEFAULT false,
  slack_ts          text,
  slack_thread_ts   text,
  metadata          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Dedup mirrors idx_pulse_messages_slack_ts_per_thread (partial unique on non-null ts)
CREATE UNIQUE INDEX idx_slack_channel_messages_ts_per_thread
  ON public.slack_channel_messages (thread_id, slack_ts) WHERE slack_ts IS NOT NULL;

CREATE INDEX idx_slack_channel_messages_thread_created
  ON public.slack_channel_messages (thread_id, created_at);

-- ===== RLS: single-owner; clients SELECT only, writes are service-role =====
ALTER TABLE public.slack_channel_threads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slack_channel_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY slack_channel_threads_select_owner
  ON public.slack_channel_threads
  FOR SELECT USING (owner_pulse_id = auth.uid());

CREATE POLICY slack_channel_messages_select_owner
  ON public.slack_channel_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.slack_channel_threads t
      WHERE t.id = slack_channel_messages.thread_id
        AND t.owner_pulse_id = auth.uid()
    )
  );
