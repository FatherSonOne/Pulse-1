-- Migration: 20260330000003_fix_vox_rls_policies.sql
-- PURPOSE: Replace permissive "Allow all" RLS policies on 16 core vox tables
--          with proper user-scoped policies based on each table's user ID column.
-- NOTE: Most user ID columns are UUID type, so compare directly with auth.uid().
--       voxer_recordings.user_id is TEXT, so cast auth.uid()::text for that table.

BEGIN;

-- ============================================
-- 1. pulse_users — users can only read/update their own record
-- ============================================
DROP POLICY IF EXISTS "Allow all operations on pulse_users" ON pulse_users;

CREATE POLICY "Users can view all pulse users"
  ON pulse_users FOR SELECT
  USING (true);

CREATE POLICY "Users can update own pulse profile"
  ON pulse_users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own pulse profile"
  ON pulse_users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================
-- 2. pulse_follows — users manage their own follows
-- ============================================
DROP POLICY IF EXISTS "Allow all operations on pulse_follows" ON pulse_follows;

CREATE POLICY "Users can view all follows"
  ON pulse_follows FOR SELECT
  USING (true);

CREATE POLICY "Users can manage own follows"
  ON pulse_follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can delete own follows"
  ON pulse_follows FOR DELETE
  USING (auth.uid() = follower_id);

-- ============================================
-- 3. pulse_channels — owner manages, all can read
-- ============================================
DROP POLICY IF EXISTS "Allow all operations on pulse_channels" ON pulse_channels;

CREATE POLICY "Users can view all channels"
  ON pulse_channels FOR SELECT
  USING (true);

CREATE POLICY "Users can create own channels"
  ON pulse_channels FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Channel owners can update"
  ON pulse_channels FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Channel owners can delete"
  ON pulse_channels FOR DELETE
  USING (auth.uid() = owner_id);

-- ============================================
-- 4. pulse_channel_subscriptions — users manage own subscriptions
-- ============================================
DROP POLICY IF EXISTS "Allow all operations on pulse_channel_subscriptions" ON pulse_channel_subscriptions;

CREATE POLICY "Users can view all subscriptions"
  ON pulse_channel_subscriptions FOR SELECT
  USING (true);

CREATE POLICY "Users can manage own subscriptions"
  ON pulse_channel_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = subscriber_id);

CREATE POLICY "Users can remove own subscriptions"
  ON pulse_channel_subscriptions FOR DELETE
  USING (auth.uid() = subscriber_id);

-- ============================================
-- 5. broadcasts — authors manage, subscribers can read
-- ============================================
DROP POLICY IF EXISTS "Allow all operations on broadcasts" ON broadcasts;

CREATE POLICY "Users can view all broadcasts"
  ON broadcasts FOR SELECT
  USING (true);

CREATE POLICY "Users can create own broadcasts"
  ON broadcasts FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update own broadcasts"
  ON broadcasts FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "Authors can delete own broadcasts"
  ON broadcasts FOR DELETE
  USING (auth.uid() = author_id);

-- ============================================
-- 6. voice_threads — participants can access (UUID[] array)
-- ============================================
DROP POLICY IF EXISTS "Allow all operations on voice_threads" ON voice_threads;

CREATE POLICY "Participants can view voice threads"
  ON voice_threads FOR SELECT
  USING (auth.uid() = ANY(participants));

CREATE POLICY "Users can create voice threads"
  ON voice_threads FOR INSERT
  WITH CHECK (auth.uid() = ANY(participants));

CREATE POLICY "Participants can update voice threads"
  ON voice_threads FOR UPDATE
  USING (auth.uid() = ANY(participants));

-- ============================================
-- 7. voice_thread_messages — senders manage, participants read
-- ============================================
DROP POLICY IF EXISTS "Allow all operations on voice_thread_messages" ON voice_thread_messages;

CREATE POLICY "Users can view thread messages they participate in"
  ON voice_thread_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM voice_threads
    WHERE voice_threads.id = voice_thread_messages.thread_id
    AND auth.uid() = ANY(voice_threads.participants)
  ));

CREATE POLICY "Users can send thread messages"
  ON voice_thread_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Senders can update own thread messages"
  ON voice_thread_messages FOR UPDATE
  USING (auth.uid() = sender_id);

CREATE POLICY "Senders can delete own thread messages"
  ON voice_thread_messages FOR DELETE
  USING (auth.uid() = sender_id);

-- ============================================
-- 8. vox_workspaces — owner manages, members can read (UUID + UUID[])
-- ============================================
DROP POLICY IF EXISTS "Allow all operations on vox_workspaces" ON vox_workspaces;

CREATE POLICY "Members can view workspaces"
  ON vox_workspaces FOR SELECT
  USING (
    auth.uid() = owner_id
    OR auth.uid() = ANY(member_ids)
  );

CREATE POLICY "Users can create workspaces"
  ON vox_workspaces FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update workspaces"
  ON vox_workspaces FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete workspaces"
  ON vox_workspaces FOR DELETE
  USING (auth.uid() = owner_id);

-- ============================================
-- 9. vox_team_channels — members can access (UUID[] array)
-- ============================================
DROP POLICY IF EXISTS "Allow all operations on vox_team_channels" ON vox_team_channels;

CREATE POLICY "Members can view team channels"
  ON vox_team_channels FOR SELECT
  USING (auth.uid() = ANY(member_ids));

CREATE POLICY "Users can create team channels"
  ON vox_team_channels FOR INSERT
  WITH CHECK (auth.uid() = ANY(member_ids));

CREATE POLICY "Members can update team channels"
  ON vox_team_channels FOR UPDATE
  USING (auth.uid() = ANY(member_ids));

-- ============================================
-- 10. team_vox_messages — senders manage, channel members read
-- ============================================
DROP POLICY IF EXISTS "Allow all operations on team_vox_messages" ON team_vox_messages;

CREATE POLICY "Channel members can view team messages"
  ON team_vox_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM vox_team_channels
    WHERE vox_team_channels.id = team_vox_messages.channel_id
    AND auth.uid() = ANY(vox_team_channels.member_ids)
  ));

CREATE POLICY "Users can send team messages"
  ON team_vox_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Senders can update own team messages"
  ON team_vox_messages FOR UPDATE
  USING (auth.uid() = sender_id);

CREATE POLICY "Senders can delete own team messages"
  ON team_vox_messages FOR DELETE
  USING (auth.uid() = sender_id);

-- ============================================
-- 11. vox_notes — user's own notes only
-- ============================================
DROP POLICY IF EXISTS "Allow all operations on vox_notes" ON vox_notes;

CREATE POLICY "Users can view own notes"
  ON vox_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own notes"
  ON vox_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
  ON vox_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
  ON vox_notes FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 12. quick_vox_favorites — user's own favorites
-- ============================================
DROP POLICY IF EXISTS "Allow all operations on quick_vox_favorites" ON quick_vox_favorites;

CREATE POLICY "Users can view own favorites"
  ON quick_vox_favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own favorites"
  ON quick_vox_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own favorites"
  ON quick_vox_favorites FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites"
  ON quick_vox_favorites FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 13. quick_vox_messages — sender/recipient access
-- ============================================
DROP POLICY IF EXISTS "Allow all operations on quick_vox_messages" ON quick_vox_messages;

CREATE POLICY "Users can view own quick messages"
  ON quick_vox_messages FOR SELECT
  USING (
    auth.uid() = sender_id
    OR auth.uid() = recipient_id
  );

CREATE POLICY "Users can send quick messages"
  ON quick_vox_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Senders can update own quick messages"
  ON quick_vox_messages FOR UPDATE
  USING (auth.uid() = sender_id);

CREATE POLICY "Senders can delete own quick messages"
  ON quick_vox_messages FOR DELETE
  USING (auth.uid() = sender_id);

-- ============================================
-- 14. quick_vox_status — user's own status
-- ============================================
DROP POLICY IF EXISTS "Allow all operations on quick_vox_status" ON quick_vox_status;

CREATE POLICY "Users can view all statuses"
  ON quick_vox_status FOR SELECT
  USING (true);

CREATE POLICY "Users can manage own status"
  ON quick_vox_status FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own status"
  ON quick_vox_status FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- 15. vox_drops — sender manages, recipients can read (UUID + UUID[])
-- ============================================
DROP POLICY IF EXISTS "Allow all operations on vox_drops" ON vox_drops;

CREATE POLICY "Users can view own drops"
  ON vox_drops FOR SELECT
  USING (
    auth.uid() = sender_id
    OR auth.uid() = ANY(recipient_ids)
  );

CREATE POLICY "Users can create drops"
  ON vox_drops FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Senders can update own drops"
  ON vox_drops FOR UPDATE
  USING (auth.uid() = sender_id);

CREATE POLICY "Senders can delete own drops"
  ON vox_drops FOR DELETE
  USING (auth.uid() = sender_id);

-- ============================================
-- 16. vox_notifications — user's own notifications
-- ============================================
DROP POLICY IF EXISTS "Allow all operations on vox_notifications" ON vox_notifications;

CREATE POLICY "Users can view own notifications"
  ON vox_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
  ON vox_notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON vox_notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON vox_notifications FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Also fix voxer_recordings RLS (user_id is TEXT, not UUID)
-- ============================================
DROP POLICY IF EXISTS "Allow all access" ON voxer_recordings;

CREATE POLICY "Users can view own recordings"
  ON voxer_recordings FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can create own recordings"
  ON voxer_recordings FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own recordings"
  ON voxer_recordings FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own recordings"
  ON voxer_recordings FOR DELETE
  USING (auth.uid()::text = user_id);

COMMIT;
