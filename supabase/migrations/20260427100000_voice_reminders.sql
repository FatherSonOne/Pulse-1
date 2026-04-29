-- ============================================================
-- MIGRATION: 20260427100000_voice_reminders.sql
-- PURPOSE:   Stage 5 (Relay) — snooze / "remind me about this voice
--            message" persistence per user.
--
-- WHY A SEPARATE TABLE FROM thread_reminders?
--   thread_reminders is keyed by `conversation_id` (a uuid pointing at
--   pulse_conversations or message_channels). Voice content is keyed
--   by per-kind row ids (voxer_recordings.id, voice_thread_messages.id,
--   quick_vox_messages.id, broadcasts.id, vox_notes.id) — there's no
--   single conversation primary key that covers all five surfaces, and
--   trying to share thread_reminders.conversation_kind would muddy the
--   discriminator's existing 'dm' / 'channel' meaning.
--
--   Keeping voice reminders in their own table also leaves room for
--   voice-specific fields later (e.g. resume-at-timestamp inside an
--   audio file, "snooze until conversation has new activity") without
--   bloating the text inbox schema.
--
-- DATE:      2026-04-27
-- SAFE:      Idempotent via IF NOT EXISTS / DROP POLICY IF EXISTS.
-- ============================================================


CREATE TABLE IF NOT EXISTS voice_reminders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Discriminator matching TriageItemKind in src/hooks/useRelayTriage.ts.
  -- Prefixed `voice_` to keep these readable alongside thread_reminders.
  voice_kind  text NOT NULL
              CHECK (voice_kind IN (
                'voice_classic',
                'voice_thread',
                'voice_quick',
                'voice_broadcast',
                'voice_note'
              )),
  -- The source row id (voxer_recordings.id, voice_thread_messages.id, etc.).
  -- No FK so a deleted source row leaves the reminder for cleanup rather
  -- than cascading and surprising the user. text not uuid because
  -- voxer_recordings.id is text in the legacy schema.
  source_id   text NOT NULL,
  -- Reminder time. The cron worker picks up rows where
  -- remind_at <= now() AND status = 'pending'.
  remind_at   timestamptz NOT NULL,
  -- Optional user note ("ping Sarah back about Friday's call").
  note        text,
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'fired', 'dismissed', 'cancelled')),
  fired_at    timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Cron job lookup: pending reminders whose time has come.
CREATE INDEX IF NOT EXISTS idx_voice_reminders_pending
  ON voice_reminders(remind_at)
  WHERE status = 'pending';

-- "Show my reminders" UI lookup.
CREATE INDEX IF NOT EXISTS idx_voice_reminders_user
  ON voice_reminders(user_id, remind_at);

-- "Show reminders for this voice item" lookup (used to highlight a row
-- in Triage that already has an active snooze).
CREATE INDEX IF NOT EXISTS idx_voice_reminders_source
  ON voice_reminders(voice_kind, source_id);

-- Skew-tolerant CHECK on remind_at — same pattern as thread_reminders
-- in 20260427000001 and pulse_scheduled_messages in 20260426000006.
CREATE OR REPLACE FUNCTION enforce_voice_reminder_in_future()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.remind_at IS DISTINCT FROM OLD.remind_at THEN
    IF NEW.remind_at < (now() - interval '60 seconds') THEN
      RAISE EXCEPTION
        'remind_at must be in the future (got %, now is %)',
        NEW.remind_at, now()
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS voice_reminders_future_check ON voice_reminders;
CREATE TRIGGER voice_reminders_future_check
  BEFORE INSERT OR UPDATE ON voice_reminders
  FOR EACH ROW
  EXECUTE FUNCTION enforce_voice_reminder_in_future();

CREATE OR REPLACE FUNCTION touch_voice_reminders_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS voice_reminders_touch_updated_at ON voice_reminders;
CREATE TRIGGER voice_reminders_touch_updated_at
  BEFORE UPDATE ON voice_reminders
  FOR EACH ROW
  EXECUTE FUNCTION touch_voice_reminders_updated_at();

ALTER TABLE voice_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users see own voice reminders" ON voice_reminders;
CREATE POLICY "users see own voice reminders"
  ON voice_reminders FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users create own voice reminders" ON voice_reminders;
CREATE POLICY "users create own voice reminders"
  ON voice_reminders FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users update own voice reminders" ON voice_reminders;
CREATE POLICY "users update own voice reminders"
  ON voice_reminders FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users delete own voice reminders" ON voice_reminders;
CREATE POLICY "users delete own voice reminders"
  ON voice_reminders FOR DELETE
  USING (user_id = auth.uid());

-- Realtime so a fired reminder pushes to the user's other devices.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'voice_reminders'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE voice_reminders';
  END IF;
END $$;
