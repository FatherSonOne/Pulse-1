-- Expand archives.archive_type CHECK to cover the full Pulse conversation taxonomy.
--
-- Memory section needs to capture every conversation surface: SMS messages, emails,
-- Relay (voice messages, voice notes, live calls), Glimpse video, plus the existing
-- transcript/meeting/journal/summary/decision derivatives. The original constraint
-- only allowed 8 types; this widens it to 18 and adds source-tracking columns
-- so ingest stays idempotent.

BEGIN;

-- 1) Drop the old check
ALTER TABLE "public"."archives"
  DROP CONSTRAINT IF EXISTS "archives_archive_type_check";

-- 2) Add the expanded check covering all current Memory types
ALTER TABLE "public"."archives"
  ADD CONSTRAINT "archives_archive_type_check"
  CHECK ("archive_type" = ANY (ARRAY[
    -- Original derivatives
    'transcript'::text,
    'meeting_note'::text,
    'journal'::text,
    'summary'::text,
    'vox_transcript'::text,
    'decision_log'::text,
    'artifact'::text,
    'research'::text,
    -- Media (already in TS but absent from DB check)
    'image'::text,
    'video'::text,
    'document'::text,
    'war_room_session'::text,
    -- Conversation streams — the "every word, every voice, every pulse" surfaces
    'message'::text,
    'email'::text,
    'relay_message'::text,
    'relay_note'::text,
    'relay_live'::text,
    'glimpse'::text
  ]));

-- 3) Source-tracking columns for idempotent ingest. When a Memory item is auto-archived
--    from another Pulse section, source_table + source_id together form a unique key
--    that the ingest service uses to skip duplicates on re-runs.
--
--    source_id is text (not uuid) because Pulse's source tables use mixed key types:
--    cached_emails.id is text, voxer_recordings.user_id is text, chat_messages.sender_id
--    is text. A uuid-only column would block ingest from those tables.
ALTER TABLE "public"."archives"
  ADD COLUMN IF NOT EXISTS "source_table" "text" NULL,
  ADD COLUMN IF NOT EXISTS "source_id" "text" NULL;

-- 4) Partial unique index — only enforced when source columns are populated.
--    NULL/NULL pairs (manually-created archives) don't conflict.
CREATE UNIQUE INDEX IF NOT EXISTS "archives_source_uniq"
  ON "public"."archives" ("user_id", "source_table", "source_id")
  WHERE "source_table" IS NOT NULL AND "source_id" IS NOT NULL;

-- 5) Lookup index for "find archive for source row" queries
CREATE INDEX IF NOT EXISTS "idx_archives_source"
  ON "public"."archives" ("source_table", "source_id")
  WHERE "source_table" IS NOT NULL;

COMMIT;
