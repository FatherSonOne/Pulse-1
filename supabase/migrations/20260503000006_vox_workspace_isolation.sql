-- Migration: 20260503000006_vox_workspace_isolation.sql
-- PR-2 (issue #33): Fix workspace-isolation regression on vox tables (C12, C13).
--
-- Background: 20260330000003_fix_vox_rls_policies.sql replaced "Allow all" policies
-- with user/participant-only policies that DROPPED the workspace gate. A later
-- migration added workspace-gated policies alongside but did NOT remove the
-- participant-only ones — RLS OR's policies of the same command, so the
-- participant-only rule still grants access. This migration:
--   1. Adds workspace_id columns where missing (voice_threads, vox_drops,
--      vox_notes, voxer_recordings, quick_vox_messages).
--   2. Backfills the 3 orphan rows (1 vox_note, 2 voxer_recordings) to each
--      user's My Workspace.
--   3. Deletes 1 orphan vox_team_channels row pointing at a non-existent
--      workspace (id eba21dc7-..., name "General", empty member_ids).
--   4. Drops legacy participant-only policies and the (workspace_id IS NULL OR ...)
--      escape hatch on tables that had it.
--   5. Recreates policies as: user_has_workspace_access(workspace_id) AND <user check>.
--   6. Adds NOT NULL + FK + index on workspace_id where applicable.
--
-- voice_thread_messages stays workspace-id-less and gates via the parent
-- voice_threads.workspace_id (no column add needed — keeps the message table lean).

BEGIN;

-- =====================================================================
-- 1. Clean up orphan rows BEFORE adding constraints
-- =====================================================================

-- vox_team_channels: single row points to workspace 60373be9-... which does
-- not exist in workspaces. Empty member_ids, name "General" — seed data leftover.
DELETE FROM vox_team_channels
WHERE id = 'eba21dc7-706a-4ea7-9cc6-e7f5af815d1c'
  AND workspace_id = '60373be9-5a2b-49fd-8250-541775dedf30'
  AND NOT EXISTS (SELECT 1 FROM workspaces WHERE id = '60373be9-5a2b-49fd-8250-541775dedf30');

-- =====================================================================
-- 2. team_vox_messages — column already exists, drop legacy policies + replace
-- =====================================================================

-- Backfill: derive workspace_id from parent vox_team_channels.workspace_id via channel_id.
UPDATE team_vox_messages tvm
SET workspace_id = ch.workspace_id
FROM vox_team_channels ch
WHERE tvm.channel_id = ch.id
  AND tvm.workspace_id IS NULL
  AND ch.workspace_id IS NOT NULL;

-- Any remaining NULL rows (orphan messages with no channel) — delete them.
DELETE FROM team_vox_messages WHERE workspace_id IS NULL;

ALTER TABLE team_vox_messages ALTER COLUMN workspace_id SET NOT NULL;

ALTER TABLE team_vox_messages
  DROP CONSTRAINT IF EXISTS team_vox_messages_workspace_id_fkey;
ALTER TABLE team_vox_messages
  ADD CONSTRAINT team_vox_messages_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_team_vox_messages_workspace
  ON team_vox_messages(workspace_id);

-- Drop ALL existing policies (legacy + workspace-with-NULL-escape).
DROP POLICY IF EXISTS "Channel members can view team messages" ON team_vox_messages;
DROP POLICY IF EXISTS "Users can send team messages" ON team_vox_messages;
DROP POLICY IF EXISTS "Senders can update own team messages" ON team_vox_messages;
DROP POLICY IF EXISTS "Senders can delete own team messages" ON team_vox_messages;
DROP POLICY IF EXISTS team_vox_messages_workspace_select ON team_vox_messages;
DROP POLICY IF EXISTS team_vox_messages_sender_insert ON team_vox_messages;
DROP POLICY IF EXISTS team_vox_messages_sender_update ON team_vox_messages;
DROP POLICY IF EXISTS team_vox_messages_sender_delete ON team_vox_messages;

CREATE POLICY team_vox_messages_select ON team_vox_messages FOR SELECT
  USING (
    public.user_has_workspace_access(workspace_id)
    AND EXISTS (
      SELECT 1 FROM vox_team_channels c
      WHERE c.id = team_vox_messages.channel_id
        AND c.workspace_id = team_vox_messages.workspace_id
    )
  );

CREATE POLICY team_vox_messages_insert ON team_vox_messages FOR INSERT
  WITH CHECK (
    public.user_has_workspace_access(workspace_id)
    AND sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM vox_team_channels c
      WHERE c.id = team_vox_messages.channel_id
        AND c.workspace_id = team_vox_messages.workspace_id
    )
  );

CREATE POLICY team_vox_messages_update ON team_vox_messages FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id) AND sender_id = auth.uid())
  WITH CHECK (public.user_has_workspace_access(workspace_id) AND sender_id = auth.uid());

CREATE POLICY team_vox_messages_delete ON team_vox_messages FOR DELETE
  USING (public.user_has_workspace_access(workspace_id) AND sender_id = auth.uid());

-- =====================================================================
-- 3. vox_team_channels — column already exists, drop legacy policies + replace
-- =====================================================================

-- After orphan delete, no NULL workspace_id rows remain. Confirm + lock.
DELETE FROM vox_team_channels WHERE workspace_id IS NULL;
ALTER TABLE vox_team_channels ALTER COLUMN workspace_id SET NOT NULL;

ALTER TABLE vox_team_channels
  DROP CONSTRAINT IF EXISTS vox_team_channels_workspace_id_fkey;
ALTER TABLE vox_team_channels
  ADD CONSTRAINT vox_team_channels_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_vox_team_channels_workspace
  ON vox_team_channels(workspace_id);

DROP POLICY IF EXISTS "Members can view team channels" ON vox_team_channels;
DROP POLICY IF EXISTS "Users can create team channels" ON vox_team_channels;
DROP POLICY IF EXISTS "Members can update team channels" ON vox_team_channels;
DROP POLICY IF EXISTS vox_team_channels_workspace_select ON vox_team_channels;
DROP POLICY IF EXISTS vox_team_channels_workspace_insert ON vox_team_channels;
DROP POLICY IF EXISTS vox_team_channels_workspace_update ON vox_team_channels;
DROP POLICY IF EXISTS vox_team_channels_workspace_delete ON vox_team_channels;

CREATE POLICY vox_team_channels_select ON vox_team_channels FOR SELECT
  USING (public.user_has_workspace_access(workspace_id));

CREATE POLICY vox_team_channels_insert ON vox_team_channels FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id));

CREATE POLICY vox_team_channels_update ON vox_team_channels FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id))
  WITH CHECK (public.user_has_workspace_access(workspace_id));

CREATE POLICY vox_team_channels_delete ON vox_team_channels FOR DELETE
  USING (public.user_has_workspace_access(workspace_id));

-- =====================================================================
-- 4. voice_threads — add workspace_id column + workspace-gated policies
-- =====================================================================

ALTER TABLE voice_threads ADD COLUMN IF NOT EXISTS workspace_id UUID;

-- Backfill from first participant's earliest non-deleted workspace.
-- (0 rows in production; this is a no-op now but covers any future race.)
UPDATE voice_threads vt
SET workspace_id = (
  SELECT w.id FROM workspaces w
  WHERE w.owner_id = vt.participants[1]
    AND w.deleted_at IS NULL
  ORDER BY w.created_at ASC
  LIMIT 1
)
WHERE vt.workspace_id IS NULL
  AND array_length(vt.participants, 1) > 0;

-- Anything still NULL would be unowned data — delete (0 rows expected).
DELETE FROM voice_threads WHERE workspace_id IS NULL;

ALTER TABLE voice_threads ALTER COLUMN workspace_id SET NOT NULL;

ALTER TABLE voice_threads
  DROP CONSTRAINT IF EXISTS voice_threads_workspace_id_fkey;
ALTER TABLE voice_threads
  ADD CONSTRAINT voice_threads_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_voice_threads_workspace
  ON voice_threads(workspace_id);

DROP POLICY IF EXISTS "Participants can view voice threads" ON voice_threads;
DROP POLICY IF EXISTS "Users can view threads they participate in" ON voice_threads;
DROP POLICY IF EXISTS "Users can create voice threads" ON voice_threads;
DROP POLICY IF EXISTS "Users can create threads" ON voice_threads;
DROP POLICY IF EXISTS "Participants can update voice threads" ON voice_threads;
DROP POLICY IF EXISTS "Participants can update thread metadata" ON voice_threads;
DROP POLICY IF EXISTS "Participants can delete threads" ON voice_threads;

CREATE POLICY voice_threads_select ON voice_threads FOR SELECT
  USING (
    public.user_has_workspace_access(workspace_id)
    AND auth.uid() = ANY(participants)
  );

CREATE POLICY voice_threads_insert ON voice_threads FOR INSERT
  WITH CHECK (
    public.user_has_workspace_access(workspace_id)
    AND auth.uid() = ANY(participants)
  );

CREATE POLICY voice_threads_update ON voice_threads FOR UPDATE
  USING (
    public.user_has_workspace_access(workspace_id)
    AND auth.uid() = ANY(participants)
  )
  WITH CHECK (
    public.user_has_workspace_access(workspace_id)
    AND auth.uid() = ANY(participants)
  );

CREATE POLICY voice_threads_delete ON voice_threads FOR DELETE
  USING (
    public.user_has_workspace_access(workspace_id)
    AND auth.uid() = ANY(participants)
  );

-- =====================================================================
-- 5. voice_thread_messages — gate via parent voice_threads.workspace_id
-- =====================================================================

DROP POLICY IF EXISTS "Users can view thread messages they participate in" ON voice_thread_messages;
DROP POLICY IF EXISTS "Users can view messages in their threads" ON voice_thread_messages;
DROP POLICY IF EXISTS "Users can send thread messages" ON voice_thread_messages;
DROP POLICY IF EXISTS "Participants can send messages" ON voice_thread_messages;
DROP POLICY IF EXISTS "Senders can update own thread messages" ON voice_thread_messages;
DROP POLICY IF EXISTS "Senders can update their messages" ON voice_thread_messages;
DROP POLICY IF EXISTS "Senders can delete own thread messages" ON voice_thread_messages;
DROP POLICY IF EXISTS "Senders can delete their messages" ON voice_thread_messages;

CREATE POLICY voice_thread_messages_select ON voice_thread_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM voice_threads vt
      WHERE vt.id = voice_thread_messages.thread_id
        AND public.user_has_workspace_access(vt.workspace_id)
        AND auth.uid() = ANY(vt.participants)
    )
    AND COALESCE(is_deleted, false) = false
  );

CREATE POLICY voice_thread_messages_insert ON voice_thread_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM voice_threads vt
      WHERE vt.id = voice_thread_messages.thread_id
        AND public.user_has_workspace_access(vt.workspace_id)
        AND auth.uid() = ANY(vt.participants)
    )
  );

CREATE POLICY voice_thread_messages_update ON voice_thread_messages FOR UPDATE
  USING (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM voice_threads vt
      WHERE vt.id = voice_thread_messages.thread_id
        AND public.user_has_workspace_access(vt.workspace_id)
        AND auth.uid() = ANY(vt.participants)
    )
  )
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM voice_threads vt
      WHERE vt.id = voice_thread_messages.thread_id
        AND public.user_has_workspace_access(vt.workspace_id)
        AND auth.uid() = ANY(vt.participants)
    )
  );

CREATE POLICY voice_thread_messages_delete ON voice_thread_messages FOR DELETE
  USING (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM voice_threads vt
      WHERE vt.id = voice_thread_messages.thread_id
        AND public.user_has_workspace_access(vt.workspace_id)
        AND auth.uid() = ANY(vt.participants)
    )
  );

-- =====================================================================
-- 6. vox_drops — add workspace_id column + workspace-gated policies
-- =====================================================================

ALTER TABLE vox_drops ADD COLUMN IF NOT EXISTS workspace_id UUID;

UPDATE vox_drops vd
SET workspace_id = (
  SELECT w.id FROM workspaces w
  WHERE w.owner_id = vd.sender_id
    AND w.deleted_at IS NULL
  ORDER BY w.created_at ASC
  LIMIT 1
)
WHERE vd.workspace_id IS NULL;

DELETE FROM vox_drops WHERE workspace_id IS NULL;

ALTER TABLE vox_drops ALTER COLUMN workspace_id SET NOT NULL;

ALTER TABLE vox_drops
  DROP CONSTRAINT IF EXISTS vox_drops_workspace_id_fkey;
ALTER TABLE vox_drops
  ADD CONSTRAINT vox_drops_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_vox_drops_workspace ON vox_drops(workspace_id);

DROP POLICY IF EXISTS "Users can view own drops" ON vox_drops;
DROP POLICY IF EXISTS vox_drops_participant_select ON vox_drops;
DROP POLICY IF EXISTS "Users can create drops" ON vox_drops;
DROP POLICY IF EXISTS vox_drops_sender_insert ON vox_drops;
DROP POLICY IF EXISTS "Senders can update own drops" ON vox_drops;
DROP POLICY IF EXISTS vox_drops_sender_update ON vox_drops;
DROP POLICY IF EXISTS "Senders can delete own drops" ON vox_drops;
DROP POLICY IF EXISTS vox_drops_sender_delete ON vox_drops;

CREATE POLICY vox_drops_select ON vox_drops FOR SELECT
  USING (
    public.user_has_workspace_access(workspace_id)
    AND (sender_id = auth.uid() OR auth.uid() = ANY(recipient_ids))
  );

CREATE POLICY vox_drops_insert ON vox_drops FOR INSERT
  WITH CHECK (
    public.user_has_workspace_access(workspace_id)
    AND sender_id = auth.uid()
  );

CREATE POLICY vox_drops_update ON vox_drops FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id) AND sender_id = auth.uid())
  WITH CHECK (public.user_has_workspace_access(workspace_id) AND sender_id = auth.uid());

CREATE POLICY vox_drops_delete ON vox_drops FOR DELETE
  USING (public.user_has_workspace_access(workspace_id) AND sender_id = auth.uid());

-- =====================================================================
-- 7. vox_notes — add workspace_id column + workspace-gated policies
-- =====================================================================

ALTER TABLE vox_notes ADD COLUMN IF NOT EXISTS workspace_id UUID;

UPDATE vox_notes vn
SET workspace_id = (
  SELECT w.id FROM workspaces w
  WHERE w.owner_id = vn.user_id
    AND w.deleted_at IS NULL
  ORDER BY w.created_at ASC
  LIMIT 1
)
WHERE vn.workspace_id IS NULL;

DELETE FROM vox_notes WHERE workspace_id IS NULL;

ALTER TABLE vox_notes ALTER COLUMN workspace_id SET NOT NULL;

ALTER TABLE vox_notes
  DROP CONSTRAINT IF EXISTS vox_notes_workspace_id_fkey;
ALTER TABLE vox_notes
  ADD CONSTRAINT vox_notes_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_vox_notes_workspace ON vox_notes(workspace_id);

DROP POLICY IF EXISTS vox_notes_owner_all ON vox_notes;
DROP POLICY IF EXISTS "Users can view own notes" ON vox_notes;
DROP POLICY IF EXISTS "Users can create own notes" ON vox_notes;
DROP POLICY IF EXISTS "Users can update own notes" ON vox_notes;
DROP POLICY IF EXISTS "Users can delete own notes" ON vox_notes;

CREATE POLICY vox_notes_select ON vox_notes FOR SELECT
  USING (public.user_has_workspace_access(workspace_id) AND user_id = auth.uid());

CREATE POLICY vox_notes_insert ON vox_notes FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id) AND user_id = auth.uid());

CREATE POLICY vox_notes_update ON vox_notes FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id) AND user_id = auth.uid())
  WITH CHECK (public.user_has_workspace_access(workspace_id) AND user_id = auth.uid());

CREATE POLICY vox_notes_delete ON vox_notes FOR DELETE
  USING (public.user_has_workspace_access(workspace_id) AND user_id = auth.uid());

-- =====================================================================
-- 8. voxer_recordings — add workspace_id column (user_id is TEXT, careful)
-- =====================================================================

ALTER TABLE voxer_recordings ADD COLUMN IF NOT EXISTS workspace_id UUID;

UPDATE voxer_recordings vr
SET workspace_id = (
  SELECT w.id FROM workspaces w
  WHERE w.owner_id::text = vr.user_id
    AND w.deleted_at IS NULL
  ORDER BY w.created_at ASC
  LIMIT 1
)
WHERE vr.workspace_id IS NULL
  AND vr.user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

DELETE FROM voxer_recordings WHERE workspace_id IS NULL;

ALTER TABLE voxer_recordings ALTER COLUMN workspace_id SET NOT NULL;

ALTER TABLE voxer_recordings
  DROP CONSTRAINT IF EXISTS voxer_recordings_workspace_id_fkey;
ALTER TABLE voxer_recordings
  ADD CONSTRAINT voxer_recordings_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_voxer_recordings_workspace
  ON voxer_recordings(workspace_id);

DROP POLICY IF EXISTS voxer_recordings_owner_all ON voxer_recordings;
DROP POLICY IF EXISTS "Users can view own recordings" ON voxer_recordings;
DROP POLICY IF EXISTS "Users can create own recordings" ON voxer_recordings;
DROP POLICY IF EXISTS "Users can update own recordings" ON voxer_recordings;
DROP POLICY IF EXISTS "Users can delete own recordings" ON voxer_recordings;

CREATE POLICY voxer_recordings_select ON voxer_recordings FOR SELECT
  USING (public.user_has_workspace_access(workspace_id) AND user_id = auth.uid()::text);

CREATE POLICY voxer_recordings_insert ON voxer_recordings FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id) AND user_id = auth.uid()::text);

CREATE POLICY voxer_recordings_update ON voxer_recordings FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id) AND user_id = auth.uid()::text)
  WITH CHECK (public.user_has_workspace_access(workspace_id) AND user_id = auth.uid()::text);

CREATE POLICY voxer_recordings_delete ON voxer_recordings FOR DELETE
  USING (public.user_has_workspace_access(workspace_id) AND user_id = auth.uid()::text);

-- =====================================================================
-- 9. quick_vox_messages — add workspace_id column + workspace-gated policies
-- =====================================================================

ALTER TABLE quick_vox_messages ADD COLUMN IF NOT EXISTS workspace_id UUID;

UPDATE quick_vox_messages qm
SET workspace_id = (
  SELECT w.id FROM workspaces w
  WHERE w.owner_id = qm.sender_id
    AND w.deleted_at IS NULL
  ORDER BY w.created_at ASC
  LIMIT 1
)
WHERE qm.workspace_id IS NULL;

DELETE FROM quick_vox_messages WHERE workspace_id IS NULL;

ALTER TABLE quick_vox_messages ALTER COLUMN workspace_id SET NOT NULL;

ALTER TABLE quick_vox_messages
  DROP CONSTRAINT IF EXISTS quick_vox_messages_workspace_id_fkey;
ALTER TABLE quick_vox_messages
  ADD CONSTRAINT quick_vox_messages_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_quick_vox_messages_workspace
  ON quick_vox_messages(workspace_id);

DROP POLICY IF EXISTS "Users can view own quick messages" ON quick_vox_messages;
DROP POLICY IF EXISTS quick_vox_messages_participant_select ON quick_vox_messages;
DROP POLICY IF EXISTS "Users can send quick messages" ON quick_vox_messages;
DROP POLICY IF EXISTS quick_vox_messages_sender_insert ON quick_vox_messages;
DROP POLICY IF EXISTS "Senders can update own quick messages" ON quick_vox_messages;
DROP POLICY IF EXISTS quick_vox_messages_sender_update ON quick_vox_messages;
DROP POLICY IF EXISTS "Senders can delete own quick messages" ON quick_vox_messages;
DROP POLICY IF EXISTS quick_vox_messages_sender_delete ON quick_vox_messages;

CREATE POLICY quick_vox_messages_select ON quick_vox_messages FOR SELECT
  USING (
    public.user_has_workspace_access(workspace_id)
    AND (sender_id = auth.uid() OR recipient_id = auth.uid())
  );

CREATE POLICY quick_vox_messages_insert ON quick_vox_messages FOR INSERT
  WITH CHECK (
    public.user_has_workspace_access(workspace_id)
    AND sender_id = auth.uid()
  );

CREATE POLICY quick_vox_messages_update ON quick_vox_messages FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id) AND sender_id = auth.uid())
  WITH CHECK (public.user_has_workspace_access(workspace_id) AND sender_id = auth.uid());

CREATE POLICY quick_vox_messages_delete ON quick_vox_messages FOR DELETE
  USING (public.user_has_workspace_access(workspace_id) AND sender_id = auth.uid());

COMMIT;
