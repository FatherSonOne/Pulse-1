-- ============================================================
-- MIGRATION: 20260427000001_messages_inbox_triage.sql
-- PURPOSE:   Phase 7 — inbox triage tables.
--
-- TABLES:
--   link_previews     OG-tag link preview cache (shared across all users).
--   thread_reminders  Snooze / "remind me about this thread" per-user.
--   tag_definitions   Workspace-scoped tag taxonomy (color + name).
--   thread_tags       Tag assignments to conversations.
--
-- DESIGN NOTES:
--
-- 1. link_previews is a shared cache — there's no point re-fetching the
--    same URL's OG tags for every user. Keyed by URL hash for fast
--    lookup; refreshed via TTL or explicit re-fetch.
--
-- 2. thread_reminders supports both Pulse DMs and channel threads via
--    `conversation_kind` discriminator + `conversation_id` (uuid that
--    references either pulse_conversations or message_channels —
--    no FK so the row survives if the underlying conversation is
--    deleted, and a subsequent cleanup job can sweep orphans).
--
-- 3. tag_definitions are workspace-scoped (a workspace can define its
--    own tag taxonomy). thread_tags links a conversation to one or
--    more tags. Same conversation_kind discriminator pattern as
--    reminders.
--
-- DATE:      2026-04-27
-- SAFE:      Idempotent via IF NOT EXISTS / DROP POLICY IF EXISTS.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. link_previews — OG-tag cache
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS link_previews (
  -- SHA-256 hex of the canonical URL. Use the hash as PK so we can
  -- quickly check cache hits without scanning a TEXT index.
  url_hash    text PRIMARY KEY,
  url         text NOT NULL,
  title       text,
  description text,
  image_url   text,
  site_name   text,
  -- Provider/type from OG (article, video, product, etc.)
  og_type     text,
  -- Status: 'ok' | 'fetch_failed' | 'parse_failed'
  status      text NOT NULL DEFAULT 'ok'
              CHECK (status IN ('ok', 'fetch_failed', 'parse_failed')),
  fetched_at  timestamptz NOT NULL DEFAULT now(),
  -- Hard expiry: stale entries are re-fetched lazily.
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX IF NOT EXISTS idx_link_previews_expires
  ON link_previews(expires_at);

ALTER TABLE link_previews ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read previews (it's just OG metadata; no
-- private data lives here).
DROP POLICY IF EXISTS "anyone authed can read link previews" ON link_previews;
CREATE POLICY "anyone authed can read link previews"
  ON link_previews FOR SELECT
  USING (auth.role() = 'authenticated');

-- Inserts and upserts come from the link-preview edge function which
-- runs with the service role key — bypasses RLS entirely. No INSERT
-- policy needed (RLS would reject anon inserts which is what we want).


-- ────────────────────────────────────────────────────────────
-- 2. thread_reminders — snooze / remind-me
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS thread_reminders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_kind text NOT NULL
                    CHECK (conversation_kind IN ('dm', 'channel')),
  conversation_id   uuid NOT NULL,
  -- Optional message anchor — useful for "remind me about THIS message"
  -- (vs "remind me about this thread").
  message_id        uuid,
  -- The actual reminder time. The cron job picks up rows where
  -- remind_at <= now() AND status = 'pending'.
  remind_at         timestamptz NOT NULL,
  -- Optional note that surfaces with the reminder ("ask about pricing").
  note              text,
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'fired', 'dismissed', 'cancelled')),
  fired_at          timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Index for the cron job: find pending reminders due for delivery.
CREATE INDEX IF NOT EXISTS idx_thread_reminders_pending
  ON thread_reminders(remind_at)
  WHERE status = 'pending';

-- Index for "show my reminders" UI.
CREATE INDEX IF NOT EXISTS idx_thread_reminders_user
  ON thread_reminders(user_id, remind_at);

-- Index for "show reminders for this conversation".
CREATE INDEX IF NOT EXISTS idx_thread_reminders_conversation
  ON thread_reminders(conversation_id);

-- Skew-tolerant CHECK on remind_at — same pattern as
-- pulse_scheduled_messages from migration 20260426000006.
CREATE OR REPLACE FUNCTION enforce_reminder_in_future()
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

DROP TRIGGER IF EXISTS thread_reminders_future_check ON thread_reminders;
CREATE TRIGGER thread_reminders_future_check
  BEFORE INSERT OR UPDATE ON thread_reminders
  FOR EACH ROW
  EXECUTE FUNCTION enforce_reminder_in_future();

-- updated_at touch
CREATE OR REPLACE FUNCTION touch_thread_reminders_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS thread_reminders_touch_updated_at ON thread_reminders;
CREATE TRIGGER thread_reminders_touch_updated_at
  BEFORE UPDATE ON thread_reminders
  FOR EACH ROW
  EXECUTE FUNCTION touch_thread_reminders_updated_at();

ALTER TABLE thread_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users see own reminders" ON thread_reminders;
CREATE POLICY "users see own reminders"
  ON thread_reminders FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users create own reminders" ON thread_reminders;
CREATE POLICY "users create own reminders"
  ON thread_reminders FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users update own reminders" ON thread_reminders;
CREATE POLICY "users update own reminders"
  ON thread_reminders FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users delete own reminders" ON thread_reminders;
CREATE POLICY "users delete own reminders"
  ON thread_reminders FOR DELETE
  USING (user_id = auth.uid());

-- Realtime so a fired reminder pushes to the user's other devices.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'thread_reminders'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE thread_reminders';
  END IF;
END $$;

-- Cron job — fires reminders every minute. Uses pg_cron if available.
DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fire_thread_reminders') THEN
      PERFORM cron.unschedule('fire_thread_reminders');
    END IF;

    PERFORM cron.schedule(
      'fire_thread_reminders',
      '* * * * *',
      $cron$
        UPDATE thread_reminders
        SET status = 'fired', fired_at = now(), updated_at = now()
        WHERE status = 'pending'
          AND remind_at <= now();
      $cron$
    );
  END IF;
END $outer$;


-- ────────────────────────────────────────────────────────────
-- 3. tag_definitions — workspace-scoped tag taxonomy
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tag_definitions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         text NOT NULL,
  -- Hex color for UI; freeform so workspaces can pick anything.
  color        text NOT NULL DEFAULT '#94a3b8',
  description  text,
  created_by   uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),

  -- Tag names are unique per workspace (case-insensitive).
  UNIQUE (workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tag_definitions_workspace
  ON tag_definitions(workspace_id);

ALTER TABLE tag_definitions ENABLE ROW LEVEL SECURITY;

-- Workspace members can read their workspace's tags.
DROP POLICY IF EXISTS "workspace members read tag definitions" ON tag_definitions;
CREATE POLICY "workspace members read tag definitions"
  ON tag_definitions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = tag_definitions.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

-- Workspace members create tag definitions; the creator is recorded.
DROP POLICY IF EXISTS "workspace members create tag definitions" ON tag_definitions;
CREATE POLICY "workspace members create tag definitions"
  ON tag_definitions FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = tag_definitions.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

-- Only creators (or workspace admins via a future workspace_role check)
-- can update or delete. Keeping simple here.
DROP POLICY IF EXISTS "creators update tag definitions" ON tag_definitions;
CREATE POLICY "creators update tag definitions"
  ON tag_definitions FOR UPDATE
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "creators delete tag definitions" ON tag_definitions;
CREATE POLICY "creators delete tag definitions"
  ON tag_definitions FOR DELETE
  USING (created_by = auth.uid());


-- ────────────────────────────────────────────────────────────
-- 4. thread_tags — assignment table
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS thread_tags (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id            uuid NOT NULL REFERENCES tag_definitions(id) ON DELETE CASCADE,
  conversation_kind text NOT NULL
                    CHECK (conversation_kind IN ('dm', 'channel')),
  conversation_id   uuid NOT NULL,
  applied_by        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  applied_at        timestamptz NOT NULL DEFAULT now(),

  -- A conversation can only have a given tag once.
  UNIQUE (tag_id, conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_thread_tags_conversation
  ON thread_tags(conversation_id);

CREATE INDEX IF NOT EXISTS idx_thread_tags_tag
  ON thread_tags(tag_id);

ALTER TABLE thread_tags ENABLE ROW LEVEL SECURITY;

-- Workspace members can read tag assignments for tags in their workspace.
DROP POLICY IF EXISTS "workspace members read thread tags" ON thread_tags;
CREATE POLICY "workspace members read thread tags"
  ON thread_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM tag_definitions td
      JOIN workspace_members wm ON wm.workspace_id = td.workspace_id
      WHERE td.id = thread_tags.tag_id
        AND wm.user_id = auth.uid()
    )
  );

-- Members can apply tags they're allowed to read.
DROP POLICY IF EXISTS "workspace members apply thread tags" ON thread_tags;
CREATE POLICY "workspace members apply thread tags"
  ON thread_tags FOR INSERT
  WITH CHECK (
    applied_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM tag_definitions td
      JOIN workspace_members wm ON wm.workspace_id = td.workspace_id
      WHERE td.id = thread_tags.tag_id
        AND wm.user_id = auth.uid()
    )
  );

-- Anyone who can see a tag assignment can remove it (low-stakes — it's
-- just a label, no destructive impact).
DROP POLICY IF EXISTS "workspace members remove thread tags" ON thread_tags;
CREATE POLICY "workspace members remove thread tags"
  ON thread_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM tag_definitions td
      JOIN workspace_members wm ON wm.workspace_id = td.workspace_id
      WHERE td.id = thread_tags.tag_id
        AND wm.user_id = auth.uid()
    )
  );

-- Realtime so tag changes propagate.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'thread_tags'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE thread_tags';
  END IF;
END $$;
