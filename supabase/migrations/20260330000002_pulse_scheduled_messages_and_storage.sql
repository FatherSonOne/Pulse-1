-- ============================================================
-- MIGRATION: 20260330000002_pulse_scheduled_messages_and_storage.sql
-- PURPOSE:   Add server-side scheduled messages and attachment
--            storage bucket for Pulse messaging.
--
-- DATE:      2026-03-30
-- SAFE:      Idempotent via IF NOT EXISTS
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. pulse_scheduled_messages
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pulse_scheduled_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content       text NOT NULL,
  content_type  text NOT NULL DEFAULT 'text',
  media_url     text,
  scheduled_for timestamptz NOT NULL,
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Index for cron job: find pending messages due for delivery
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_pending
  ON pulse_scheduled_messages(scheduled_for)
  WHERE status = 'pending';

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_sender
  ON pulse_scheduled_messages(sender_id);

-- Enable RLS
ALTER TABLE pulse_scheduled_messages ENABLE ROW LEVEL SECURITY;

-- SELECT: users can see their own scheduled messages
CREATE POLICY "Users can view own scheduled messages"
  ON pulse_scheduled_messages FOR SELECT
  USING (sender_id = auth.uid());

-- INSERT: users can create their own scheduled messages
CREATE POLICY "Users can create scheduled messages"
  ON pulse_scheduled_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- UPDATE: users can update their own scheduled messages (cancel)
CREATE POLICY "Users can update own scheduled messages"
  ON pulse_scheduled_messages FOR UPDATE
  USING (sender_id = auth.uid());

-- DELETE: users can delete their own scheduled messages
CREATE POLICY "Users can delete own scheduled messages"
  ON pulse_scheduled_messages FOR DELETE
  USING (sender_id = auth.uid());


-- ────────────────────────────────────────────────────────────
-- 2. Cron job to send scheduled messages
--    Uses pg_cron to check every minute for due messages
-- ────────────────────────────────────────────────────────────
DO $outer$
BEGIN
  -- Only create if pg_cron extension is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove existing job if any (guard: only if it exists)
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send_scheduled_pulse_messages') THEN
      PERFORM cron.unschedule('send_scheduled_pulse_messages');
    END IF;

    -- Schedule: every minute, send due messages
    PERFORM cron.schedule(
      'send_scheduled_pulse_messages',
      '* * * * *',
      $cron$
        -- Send each pending message that is due
        WITH due_messages AS (
          SELECT id, sender_id, recipient_id, content, content_type, media_url
          FROM pulse_scheduled_messages
          WHERE status = 'pending'
            AND scheduled_for <= now()
          FOR UPDATE SKIP LOCKED
          LIMIT 50
        ),
        sent AS (
          SELECT dm.id,
                 send_pulse_message(
                   dm.sender_id,
                   dm.recipient_id,
                   dm.content,
                   dm.content_type,
                   dm.media_url
                 ) as message_id
          FROM due_messages dm
        )
        UPDATE pulse_scheduled_messages psm
        SET status = 'sent', sent_at = now(), updated_at = now()
        FROM sent s
        WHERE psm.id = s.id;
      $cron$
    );
  END IF;
END $outer$;


-- ────────────────────────────────────────────────────────────
-- 3. Storage bucket for Pulse attachments
-- ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pulse-attachments',
  'pulse-attachments',
  true,
  52428800, -- 50MB limit
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav',
    'video/mp4', 'video/webm',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users can upload to their own folder
CREATE POLICY "Users can upload own attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'pulse-attachments'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Anyone can read (public bucket)
CREATE POLICY "Public read for pulse attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pulse-attachments');

-- Users can delete their own files
CREATE POLICY "Users can delete own attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'pulse-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
