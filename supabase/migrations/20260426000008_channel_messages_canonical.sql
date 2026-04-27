-- ============================================================
-- MIGRATION: 20260426000008_channel_messages_canonical.sql
-- PURPOSE:   Phase 5a — create the canonical workspace-channel
--            messages table that messageChannelService.ts has been
--            assuming, then create the dependent atomic reactions
--            and read-receipts tables that the prior conditional
--            block (in 20260426000006) skipped.
--
--            Closes deep-dive issue #0 (phantom schema mismatch),
--            unblocks Session 1 channel edit/delete UI and Session 3
--            read-receipts UI, and resolves issue #5 (atomic reactions)
--            for workspace channels.
--
-- WHY A NEW TABLE INSTEAD OF EXTENDING `public.messages`:
--   `public.messages` is the legacy SMS-thread messages table with
--   columns `thread_id`, `sender` ('me'|'other'), `text`, `timestamp`,
--   `reactions jsonb`. Adding `channel_id`/`sender_id`/`content`/etc
--   would mix two unrelated message identities in one table and
--   would require nullable columns that should be NOT NULL in the
--   channel context. A separate `channel_messages` table keeps each
--   message domain coherent.
--
-- DATE:      2026-04-26
-- SAFE:      Idempotent via IF NOT EXISTS / DROP POLICY IF EXISTS.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. channel_messages — the canonical workspace-channel messages table
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id    uuid NOT NULL REFERENCES message_channels(id) ON DELETE CASCADE,
  sender_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Denormalized for display. Nullable; UI falls back to sender_id when
  -- absent. A trigger could populate this from a profiles table; left
  -- to the consumer for now.
  sender_name   text,
  content       text NOT NULL,
  message_type  text NOT NULL DEFAULT 'text'
                CHECK (message_type IN ('text', 'image', 'file', 'voice')),
  attachments   jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Self-referential FK for threaded replies. Top-level messages have
  -- thread_id = NULL; thread replies set thread_id to the root message id.
  thread_id     uuid REFERENCES channel_messages(id) ON DELETE CASCADE,
  is_pinned     boolean NOT NULL DEFAULT false,
  edited_at     timestamptz,
  -- DEPRECATED legacy back-compat field. The authoritative store for
  -- reactions is the `message_reactions` table created below. New code
  -- MUST NOT write here. Read-only consumers may merge values for legacy
  -- rows, but this column will be dropped in a future migration once all
  -- consumers are migrated.
  reactions     jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_channel_messages_channel
  ON channel_messages(channel_id, created_at DESC)
  WHERE thread_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_channel_messages_thread
  ON channel_messages(thread_id, created_at)
  WHERE thread_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_channel_messages_pinned
  ON channel_messages(channel_id)
  WHERE is_pinned = true;

CREATE INDEX IF NOT EXISTS idx_channel_messages_sender
  ON channel_messages(sender_id);

ALTER TABLE channel_messages ENABLE ROW LEVEL SECURITY;

-- SELECT: members of the channel can read.
DROP POLICY IF EXISTS "channel members can view messages" ON channel_messages;
CREATE POLICY "channel members can view messages"
  ON channel_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM channel_members cm
      WHERE cm.channel_id = channel_messages.channel_id
        AND cm.user_id = auth.uid()
    )
  );

-- INSERT: channel members can post as themselves.
DROP POLICY IF EXISTS "channel members can post messages" ON channel_messages;
CREATE POLICY "channel members can post messages"
  ON channel_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM channel_members cm
      WHERE cm.channel_id = channel_messages.channel_id
        AND cm.user_id = auth.uid()
    )
  );

-- UPDATE: the sender can edit their own message; channel admins can pin.
DROP POLICY IF EXISTS "senders can edit own messages" ON channel_messages;
CREATE POLICY "senders can edit own messages"
  ON channel_messages FOR UPDATE
  USING (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM channel_members cm
      WHERE cm.channel_id = channel_messages.channel_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
  );

-- DELETE: the sender can delete their own message; channel admins can delete any.
DROP POLICY IF EXISTS "senders can delete own messages" ON channel_messages;
CREATE POLICY "senders can delete own messages"
  ON channel_messages FOR DELETE
  USING (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM channel_members cm
      WHERE cm.channel_id = channel_messages.channel_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION touch_channel_messages_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS channel_messages_touch_updated_at
  ON channel_messages;

CREATE TRIGGER channel_messages_touch_updated_at
  BEFORE UPDATE ON channel_messages
  FOR EACH ROW
  EXECUTE FUNCTION touch_channel_messages_updated_at();

-- Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'channel_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE channel_messages';
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────
-- 2. message_reactions — atomic, row-per-reaction
--    The Phase 2 migration's conditional block skipped this because
--    `messages.channel_id` didn't exist. Now it can be created cleanly
--    against the new `channel_messages` table.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_reactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  uuid NOT NULL REFERENCES channel_messages(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message
  ON message_reactions(message_id);

CREATE INDEX IF NOT EXISTS idx_message_reactions_user
  ON message_reactions(user_id);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "channel members can view reactions" ON message_reactions;
CREATE POLICY "channel members can view reactions"
  ON message_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM channel_messages m
      JOIN channel_members cm ON cm.channel_id = m.channel_id
      WHERE m.id = message_reactions.message_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "channel members can add reactions" ON message_reactions;
CREATE POLICY "channel members can add reactions"
  ON message_reactions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM channel_messages m
      JOIN channel_members cm ON cm.channel_id = m.channel_id
      WHERE m.id = message_reactions.message_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "users can remove own reactions" ON message_reactions;
CREATE POLICY "users can remove own reactions"
  ON message_reactions FOR DELETE
  USING (user_id = auth.uid());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'message_reactions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions';
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────
-- 3. message_reads — read receipts
--    Same story: the Phase 2 migration's conditional block skipped
--    this because `messages.channel_id` didn't exist. Now it can be
--    created cleanly against `channel_messages`.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_reads (
  message_id  uuid NOT NULL REFERENCES channel_messages(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_reads_user
  ON message_reads(user_id);

CREATE INDEX IF NOT EXISTS idx_message_reads_message
  ON message_reads(message_id);

ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "channel members can view reads" ON message_reads;
CREATE POLICY "channel members can view reads"
  ON message_reads FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM channel_messages m
      JOIN channel_members cm ON cm.channel_id = m.channel_id
      WHERE m.id = message_reads.message_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "channel members can mark read" ON message_reads;
CREATE POLICY "channel members can mark read"
  ON message_reads FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM channel_messages m
      JOIN channel_members cm ON cm.channel_id = m.channel_id
      WHERE m.id = message_reads.message_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "users can delete own reads" ON message_reads;
CREATE POLICY "users can delete own reads"
  ON message_reads FOR DELETE
  USING (user_id = auth.uid());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'message_reads'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE message_reads';
  END IF;
END $$;
