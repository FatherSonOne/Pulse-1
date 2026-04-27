-- ============================================================
-- MIGRATION: 20260426000007_messages_personal_features.sql
-- PURPOSE:   Phase 4 — convert in-memory-only Messages features
--            into real persisted tables.
--
--            Closes deep-dive issue #26 ("useMessagesState
--            collaboration features are pure useState — no DB
--            persistence; all Phase 4-6 features lost on refresh").
--
-- TABLES:
--   message_bookmarks    Per-user saved messages (with collections/notes)
--   message_highlights   Per-user text-range highlights (5 colors)
--   message_annotations  Post-it notes on a message (with threaded replies)
--   message_templates    Reusable message bodies, optionally workspace-shared
--
-- SCOPE NOTE — message identity:
--   These tables FK to pulse_messages(id) on delete cascade. The
--   workspace-channel messages schema is unresolved (see Phase 5
--   architecture consolidation). When that lands, additional FK
--   targets can be added or the schema can shift to a discriminator
--   column. For now, every working chat surface in Pulse is a Pulse DM,
--   so pulse_messages is the right (and only) target.
--
-- DATE:      2026-04-26
-- SAFE:      Idempotent via IF NOT EXISTS / DROP POLICY IF EXISTS.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. message_bookmarks
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_bookmarks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id  uuid NOT NULL REFERENCES pulse_messages(id) ON DELETE CASCADE,
  collection  text,
  note        text,
  tags        text[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),

  -- One bookmark per user per message
  UNIQUE (user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_message_bookmarks_user
  ON message_bookmarks(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_bookmarks_collection
  ON message_bookmarks(user_id, collection)
  WHERE collection IS NOT NULL;

ALTER TABLE message_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can view own bookmarks" ON message_bookmarks;
CREATE POLICY "users can view own bookmarks"
  ON message_bookmarks FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users can create own bookmarks" ON message_bookmarks;
CREATE POLICY "users can create own bookmarks"
  ON message_bookmarks FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users can update own bookmarks" ON message_bookmarks;
CREATE POLICY "users can update own bookmarks"
  ON message_bookmarks FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users can delete own bookmarks" ON message_bookmarks;
CREATE POLICY "users can delete own bookmarks"
  ON message_bookmarks FOR DELETE
  USING (user_id = auth.uid());


-- ────────────────────────────────────────────────────────────
-- 2. message_highlights
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_highlights (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id   uuid NOT NULL REFERENCES pulse_messages(id) ON DELETE CASCADE,
  range_start  integer NOT NULL,
  range_end    integer NOT NULL,
  highlighted  text NOT NULL,
  color        text NOT NULL DEFAULT 'yellow'
               CHECK (color IN ('yellow', 'green', 'blue', 'pink', 'purple')),
  label        text,
  created_at   timestamptz NOT NULL DEFAULT now(),

  CHECK (range_end > range_start),
  CHECK (range_start >= 0)
);

CREATE INDEX IF NOT EXISTS idx_message_highlights_message
  ON message_highlights(message_id);

CREATE INDEX IF NOT EXISTS idx_message_highlights_user
  ON message_highlights(user_id, created_at DESC);

ALTER TABLE message_highlights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can view own highlights" ON message_highlights;
CREATE POLICY "users can view own highlights"
  ON message_highlights FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users can create own highlights" ON message_highlights;
CREATE POLICY "users can create own highlights"
  ON message_highlights FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users can delete own highlights" ON message_highlights;
CREATE POLICY "users can delete own highlights"
  ON message_highlights FOR DELETE
  USING (user_id = auth.uid());


-- ────────────────────────────────────────────────────────────
-- 3. message_annotations
--    Annotations are visible to message participants (sender +
--    recipient of the underlying pulse_message), not just the
--    annotator — they're a collaboration feature, not a private note.
--    Self-referential parent_id supports threaded replies on an
--    annotation without needing a second table.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_annotations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  uuid NOT NULL REFERENCES pulse_messages(id) ON DELETE CASCADE,
  parent_id   uuid REFERENCES message_annotations(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body        text NOT NULL,
  type        text NOT NULL DEFAULT 'comment'
              CHECK (type IN ('comment', 'question', 'suggestion', 'flag', 'approval')),
  resolved    boolean NOT NULL DEFAULT false,
  mentions    uuid[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_annotations_message
  ON message_annotations(message_id, created_at);

CREATE INDEX IF NOT EXISTS idx_message_annotations_parent
  ON message_annotations(parent_id)
  WHERE parent_id IS NOT NULL;

ALTER TABLE message_annotations ENABLE ROW LEVEL SECURITY;

-- SELECT: visible to either participant in the underlying Pulse DM.
DROP POLICY IF EXISTS "participants can view annotations" ON message_annotations;
CREATE POLICY "participants can view annotations"
  ON message_annotations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pulse_messages pm
      WHERE pm.id = message_annotations.message_id
        AND (pm.sender_id = auth.uid() OR pm.recipient_id = auth.uid())
    )
  );

-- INSERT: only participants can annotate, and only as themselves.
DROP POLICY IF EXISTS "participants can create annotations" ON message_annotations;
CREATE POLICY "participants can create annotations"
  ON message_annotations FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM pulse_messages pm
      WHERE pm.id = message_annotations.message_id
        AND (pm.sender_id = auth.uid() OR pm.recipient_id = auth.uid())
    )
  );

-- UPDATE: only the annotation author can edit body/resolved status.
DROP POLICY IF EXISTS "authors can update own annotations" ON message_annotations;
CREATE POLICY "authors can update own annotations"
  ON message_annotations FOR UPDATE
  USING (user_id = auth.uid());

-- DELETE: only the annotation author.
DROP POLICY IF EXISTS "authors can delete own annotations" ON message_annotations;
CREATE POLICY "authors can delete own annotations"
  ON message_annotations FOR DELETE
  USING (user_id = auth.uid());


-- ────────────────────────────────────────────────────────────
-- 4. message_templates
--    Per-user reusable message bodies. workspace_id is nullable so a
--    template can be private (workspace_id IS NULL) or shared with
--    everyone in a workspace.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id  uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  name          text NOT NULL,
  body          text NOT NULL,
  category      text NOT NULL DEFAULT 'custom'
                CHECK (category IN ('greeting', 'follow-up', 'meeting', 'feedback', 'closing', 'custom')),
  variables     jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags          text[] NOT NULL DEFAULT '{}',
  usage_count   integer NOT NULL DEFAULT 0,
  last_used_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_templates_user
  ON message_templates(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_templates_workspace
  ON message_templates(workspace_id)
  WHERE workspace_id IS NOT NULL;

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

-- SELECT: own private templates + workspace-shared templates from
-- workspaces I'm a member of.
DROP POLICY IF EXISTS "users can view own and shared templates" ON message_templates;
CREATE POLICY "users can view own and shared templates"
  ON message_templates FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      workspace_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = message_templates.workspace_id
          AND wm.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "users can create own templates" ON message_templates;
CREATE POLICY "users can create own templates"
  ON message_templates FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users can update own templates" ON message_templates;
CREATE POLICY "users can update own templates"
  ON message_templates FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users can delete own templates" ON message_templates;
CREATE POLICY "users can delete own templates"
  ON message_templates FOR DELETE
  USING (user_id = auth.uid());

-- updated_at maintenance trigger (idempotent)
CREATE OR REPLACE FUNCTION touch_message_templates_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS message_templates_touch_updated_at
  ON message_templates;

CREATE TRIGGER message_templates_touch_updated_at
  BEFORE UPDATE ON message_templates
  FOR EACH ROW
  EXECUTE FUNCTION touch_message_templates_updated_at();


-- ────────────────────────────────────────────────────────────
-- 5. RPC: increment_template_usage
--    Atomic increment + last_used_at update; called from
--    messagePersonalService.recordTemplateUsage. Avoids the lossy
--    read-modify-write fallback when many uses race.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_template_usage(template_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE message_templates
  SET usage_count = usage_count + 1,
      last_used_at = now()
  WHERE id = template_id
    AND user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION increment_template_usage(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_template_usage(uuid) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 6. Realtime publications (cross-device sync for the same user)
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'message_bookmarks'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE message_bookmarks';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'message_annotations'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE message_annotations';
  END IF;
END $$;
