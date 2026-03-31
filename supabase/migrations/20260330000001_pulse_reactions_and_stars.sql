-- ============================================================
-- MIGRATION: 20260330000001_pulse_reactions_and_stars.sql
-- PURPOSE:   Add persistence for Pulse message reactions and
--            starred messages (previously client-side only).
--
-- TABLES:    pulse_message_reactions, pulse_starred_messages
-- RLS:       Users can only manage their own reactions/stars,
--            but can read reactions on messages they participate in.
--
-- DATE:      2026-03-30
-- SAFE:      Idempotent via IF NOT EXISTS
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. pulse_message_reactions
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pulse_message_reactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  uuid NOT NULL REFERENCES pulse_messages(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),

  -- One reaction per emoji per user per message
  UNIQUE (message_id, user_id, emoji)
);

-- Index for fast lookup by message
CREATE INDEX IF NOT EXISTS idx_pulse_reactions_message
  ON pulse_message_reactions(message_id);

-- Index for fast lookup by user (e.g. "my reactions")
CREATE INDEX IF NOT EXISTS idx_pulse_reactions_user
  ON pulse_message_reactions(user_id);

-- Enable RLS
ALTER TABLE pulse_message_reactions ENABLE ROW LEVEL SECURITY;

-- SELECT: users can see reactions on messages they sent or received
CREATE POLICY "Users can view reactions on their messages"
  ON pulse_message_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pulse_messages pm
      WHERE pm.id = pulse_message_reactions.message_id
        AND (pm.sender_id = auth.uid() OR pm.recipient_id = auth.uid())
    )
  );

-- INSERT: users can add reactions to messages they participate in
CREATE POLICY "Users can add reactions"
  ON pulse_message_reactions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM pulse_messages pm
      WHERE pm.id = pulse_message_reactions.message_id
        AND (pm.sender_id = auth.uid() OR pm.recipient_id = auth.uid())
    )
  );

-- DELETE: users can remove their own reactions
CREATE POLICY "Users can remove own reactions"
  ON pulse_message_reactions FOR DELETE
  USING (user_id = auth.uid());


-- ────────────────────────────────────────────────────────────
-- 2. pulse_starred_messages
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pulse_starred_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  uuid NOT NULL REFERENCES pulse_messages(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),

  -- One star per user per message
  UNIQUE (message_id, user_id)
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_pulse_stars_user
  ON pulse_starred_messages(user_id);

-- Index for fast lookup by message
CREATE INDEX IF NOT EXISTS idx_pulse_stars_message
  ON pulse_starred_messages(message_id);

-- Enable RLS
ALTER TABLE pulse_starred_messages ENABLE ROW LEVEL SECURITY;

-- SELECT: users can see their own stars
CREATE POLICY "Users can view own stars"
  ON pulse_starred_messages FOR SELECT
  USING (user_id = auth.uid());

-- INSERT: users can star messages they participate in
CREATE POLICY "Users can star messages"
  ON pulse_starred_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM pulse_messages pm
      WHERE pm.id = pulse_starred_messages.message_id
        AND (pm.sender_id = auth.uid() OR pm.recipient_id = auth.uid())
    )
  );

-- DELETE: users can unstar their own
CREATE POLICY "Users can unstar own messages"
  ON pulse_starred_messages FOR DELETE
  USING (user_id = auth.uid());


-- ────────────────────────────────────────────────────────────
-- 3. Enable realtime for reactions (stars are user-private)
-- ────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE pulse_message_reactions;
