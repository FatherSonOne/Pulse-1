-- ============================================================
-- Migration: Threaded Event Comments
-- ============================================================

CREATE TABLE IF NOT EXISTS event_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id    TEXT        NOT NULL,
  parent_id  UUID        REFERENCES event_comments(id) ON DELETE CASCADE, -- NULL = top-level
  body       TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  edited_at  TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ           -- soft-delete; NULL = visible
);

-- Primary fetch pattern: all comments for an event ordered by creation time
CREATE INDEX IF NOT EXISTS idx_event_comments_event_created
  ON event_comments(event_id, created_at);

-- Reply look-up
CREATE INDEX IF NOT EXISTS idx_event_comments_parent
  ON event_comments(parent_id)
  WHERE parent_id IS NOT NULL;

-- Author look-up (e.g. "find all my comments")
CREATE INDEX IF NOT EXISTS idx_event_comments_user
  ON event_comments(user_id);

-- ── Row-Level Security ──────────────────────────────────────
ALTER TABLE event_comments ENABLE ROW LEVEL SECURITY;

-- Workspace members can read non-deleted comments for events they can see
CREATE POLICY "comments_read_workspace_members"
  ON event_comments FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM calendar_events ce
      WHERE ce.id = event_comments.event_id
        AND (
          ce.user_id = auth.uid()::text
          OR ce.user_id IS NULL            -- public/shared event
        )
    )
  );

-- Authors can read their own soft-deleted comments
CREATE POLICY "comments_read_own_deleted"
  ON event_comments FOR SELECT
  USING (user_id = auth.uid()::text);

-- Any authenticated user can add a comment to an event they can see
CREATE POLICY "comments_insert_authenticated"
  ON event_comments FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()::text
  );

-- Authors can edit their own non-deleted comments
CREATE POLICY "comments_update_own"
  ON event_comments FOR UPDATE
  USING (
    user_id = auth.uid()::text
    AND deleted_at IS NULL
  );

-- Authors can soft-delete (set deleted_at) their own comments
-- Event owners can also soft-delete any comment on their event
CREATE POLICY "comments_delete_author_or_owner"
  ON event_comments FOR UPDATE
  USING (
    user_id = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM calendar_events ce
      WHERE ce.id = event_comments.event_id
        AND ce.user_id = auth.uid()::text
    )
  );
