-- ============================================================
-- MIGRATION: 20260426000006_messages_phase2_hardening.sql
-- PURPOSE:   Phase 2 hardening for the Messages section.
--
-- CONTAINS:
--   1. Skew-tolerant CHECK on pulse_scheduled_messages.scheduled_for
--      (deep-dive issue #12)
--   2. Add pulse_starred_messages to realtime publication
--      (deep-dive issue #11)
--   3. CONDITIONAL: workspace-channel atomic reactions table + RLS
--      + read receipts table + RLS — only created when the workspace
--      channel-messages schema actually exists in this database.
--      (deep-dive issues #5 + Table-stakes #1)
--
-- WHY CONDITIONAL:
--   The client-side messageChannelService.ts queries
--     `from('messages').select('*').eq('channel_id', ...)`
--   but the canonical `public.messages` table in this schema does NOT
--   have a `channel_id` column — it's the legacy SMS-thread messages
--   table (keyed by `thread_id`, with `sender`/`text` columns).
--   The workspace-channel messages table that messageChannelService
--   assumes is referenced but never created. Until that schema mismatch
--   is resolved (deep-dive #6 architecture consolidation), the
--   channel-reactions / read-receipts tables have no consumer that
--   actually works server-side, so this migration ships them only if
--   the column they depend on exists.
--
-- DATE:      2026-04-26
-- SAFE:      Idempotent via IF NOT EXISTS / DO blocks.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. Skew-tolerant CHECK on pulse_scheduled_messages.scheduled_for
--    Allow up to 60s clock skew between client and server.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION enforce_scheduled_message_in_future()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only enforce on INSERT or when scheduled_for is changed on UPDATE.
  IF TG_OP = 'INSERT' OR NEW.scheduled_for IS DISTINCT FROM OLD.scheduled_for THEN
    IF NEW.scheduled_for < (now() - interval '60 seconds') THEN
      RAISE EXCEPTION
        'scheduled_for must be in the future (got %, now is %)',
        NEW.scheduled_for, now()
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pulse_scheduled_messages_future_check
  ON pulse_scheduled_messages;

CREATE TRIGGER pulse_scheduled_messages_future_check
  BEFORE INSERT OR UPDATE ON pulse_scheduled_messages
  FOR EACH ROW
  EXECUTE FUNCTION enforce_scheduled_message_in_future();


-- ────────────────────────────────────────────────────────────
-- 2. Add pulse_starred_messages to realtime publication
--    Stars are user-private but we want cross-device sync for the
--    same logged-in user (e.g. star on phone, see star on desktop).
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'pulse_starred_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE pulse_starred_messages';
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────
-- 3. CONDITIONAL: workspace-channel atomic reactions + read receipts
--    Only runs if the underlying `messages.channel_id` column exists.
--    See header comment for context.
-- ────────────────────────────────────────────────────────────
DO $outer$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'channel_id'
  ) THEN
    RAISE NOTICE 'messages.channel_id present — creating channel reactions + read receipts.';

    -- ──── 3a. Atomic reactions ────
    EXECUTE $sql$
      CREATE TABLE IF NOT EXISTS message_reactions (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id  uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        emoji       text NOT NULL,
        created_at  timestamptz NOT NULL DEFAULT now(),
        UNIQUE (message_id, user_id, emoji)
      )
    $sql$;

    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_message_reactions_user    ON message_reactions(user_id)';
    EXECUTE 'ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "channel members can view reactions" ON message_reactions';
    EXECUTE $sql$
      CREATE POLICY "channel members can view reactions"
        ON message_reactions FOR SELECT
        USING (
          EXISTS (
            SELECT 1
            FROM messages m
            JOIN channel_members cm ON cm.channel_id = m.channel_id
            WHERE m.id = message_reactions.message_id
              AND cm.user_id = auth.uid()
          )
        )
    $sql$;

    EXECUTE 'DROP POLICY IF EXISTS "channel members can add reactions" ON message_reactions';
    EXECUTE $sql$
      CREATE POLICY "channel members can add reactions"
        ON message_reactions FOR INSERT
        WITH CHECK (
          user_id = auth.uid()
          AND EXISTS (
            SELECT 1
            FROM messages m
            JOIN channel_members cm ON cm.channel_id = m.channel_id
            WHERE m.id = message_reactions.message_id
              AND cm.user_id = auth.uid()
          )
        )
    $sql$;

    EXECUTE 'DROP POLICY IF EXISTS "users can remove own reactions" ON message_reactions';
    EXECUTE $sql$
      CREATE POLICY "users can remove own reactions"
        ON message_reactions FOR DELETE
        USING (user_id = auth.uid())
    $sql$;

    -- Realtime publication for reactions
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'message_reactions'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions';
    END IF;


    -- ──── 3b. Read receipts ────
    EXECUTE $sql$
      CREATE TABLE IF NOT EXISTS message_reads (
        message_id  uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        read_at     timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (message_id, user_id)
      )
    $sql$;

    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_message_reads_user    ON message_reads(user_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_message_reads_message ON message_reads(message_id)';
    EXECUTE 'ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "channel members can view reads" ON message_reads';
    EXECUTE $sql$
      CREATE POLICY "channel members can view reads"
        ON message_reads FOR SELECT
        USING (
          EXISTS (
            SELECT 1
            FROM messages m
            JOIN channel_members cm ON cm.channel_id = m.channel_id
            WHERE m.id = message_reads.message_id
              AND cm.user_id = auth.uid()
          )
        )
    $sql$;

    EXECUTE 'DROP POLICY IF EXISTS "channel members can mark read" ON message_reads';
    EXECUTE $sql$
      CREATE POLICY "channel members can mark read"
        ON message_reads FOR INSERT
        WITH CHECK (
          user_id = auth.uid()
          AND EXISTS (
            SELECT 1
            FROM messages m
            JOIN channel_members cm ON cm.channel_id = m.channel_id
            WHERE m.id = message_reads.message_id
              AND cm.user_id = auth.uid()
          )
        )
    $sql$;

    EXECUTE 'DROP POLICY IF EXISTS "users can delete own reads" ON message_reads';
    EXECUTE $sql$
      CREATE POLICY "users can delete own reads"
        ON message_reads FOR DELETE
        USING (user_id = auth.uid())
    $sql$;

    -- Realtime publication for reads
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'message_reads'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE message_reads';
    END IF;

  ELSE
    RAISE NOTICE
      'Skipping message_reactions / message_reads creation: public.messages has no channel_id column. The workspace-channel schema referenced by messageChannelService.ts is not the one in this database. Re-run this migration after Phase 5 architecture consolidation lands the canonical channel-messages schema.';
  END IF;
END $outer$;
