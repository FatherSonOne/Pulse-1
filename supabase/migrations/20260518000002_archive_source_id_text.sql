-- Convert archives.source_id from uuid to text.
--
-- The original migration (20260518000001) typed source_id as uuid, but several
-- of Pulse's source tables use non-uuid primary keys:
--   - cached_emails.id is text (Gmail-style: "user_id-thread_suffix")
--   - voxer_recordings.user_id is text
--   - chat_messages.sender_id is text
-- Trying to cast those into a uuid column blocks every email/voice import.
--
-- Solution: source_id becomes text. The partial unique index gets recreated
-- against the new type.

BEGIN;

-- 1) Drop the partial unique index that depends on source_id's type
DROP INDEX IF EXISTS public.archives_source_uniq;
DROP INDEX IF EXISTS public.idx_archives_source;

-- 2) Convert the column type
ALTER TABLE public.archives
  ALTER COLUMN source_id TYPE text USING source_id::text;

-- 3) Recreate the indexes against the new type
CREATE UNIQUE INDEX IF NOT EXISTS archives_source_uniq
  ON public.archives (user_id, source_table, source_id)
  WHERE source_table IS NOT NULL AND source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_archives_source
  ON public.archives (source_table, source_id)
  WHERE source_table IS NOT NULL;

COMMIT;
