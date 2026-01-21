-- =====================================================
-- PHASE 7: ROW LEVEL SECURITY (RLS) - Workspace & Shared Policies
-- File 3 of 5: Policies for Workspace-Shared Tables
-- =====================================================
-- Purpose: Create RLS policies for shared resources (voice rooms, workspaces, file storage)
-- Security Model: Workspace membership, participant access, admin controls
-- Run Order: Execute THIRD after user-owned policies
-- =====================================================

-- SECURITY MODELS COVERED:
-- 1. Voice Rooms: Creator + Participants
-- 2. Ephemeral Workspaces: Creator + Participants (E2EE)
-- 3. File Storage: User-owned with optional sharing
-- 4. Backups: Strictly user-owned, encrypted
-- 5. Export Jobs: User-owned with time-limited access
-- 6. In-App Messages: Admin create, users view

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function: Check if user is workspace creator
CREATE OR REPLACE FUNCTION is_workspace_creator(workspace_uuid UUID, check_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM ephemeral_workspaces
    WHERE id = workspace_uuid
    AND created_by = check_user_id
  );
$$;

-- Function: Check if user is workspace participant
CREATE OR REPLACE FUNCTION is_workspace_participant(workspace_uuid UUID, check_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_participants
    WHERE workspace_id = workspace_uuid
    AND user_id = check_user_id
    AND is_active = true
  );
$$;

-- Function: Check if user is voice room creator
CREATE OR REPLACE FUNCTION is_voice_room_creator(room_uuid UUID, check_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM voice_rooms
    WHERE id = room_uuid
    AND user_id = check_user_id
  );
$$;

-- Function: Check if user is voice room participant
CREATE OR REPLACE FUNCTION is_voice_room_participant(room_uuid UUID, check_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM voice_room_participants
    WHERE room_id = room_uuid
    AND user_id = check_user_id
  );
$$;

-- Function: Check if user is admin (from JWT claims)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'admin',
    false
  );
$$;

-- =====================================================
-- 1. VOICE ROOMS - Shared Voice Chat Rooms
-- =====================================================

-- Policy: Users can view public rooms OR rooms they created OR rooms they're in
CREATE POLICY "Users can view accessible voice rooms"
ON voice_rooms
FOR SELECT
USING (
  is_private = false
  OR user_id = auth.current_user_id()
  OR is_voice_room_participant(id, auth.current_user_id())
);

-- Policy: Users can create their own voice rooms
CREATE POLICY "Users can create own voice rooms"
ON voice_rooms
FOR INSERT
WITH CHECK (user_id = auth.current_user_id());

-- Policy: Users can update rooms they created
CREATE POLICY "Users can update own voice rooms"
ON voice_rooms
FOR UPDATE
USING (user_id = auth.current_user_id())
WITH CHECK (user_id = auth.current_user_id());

-- Policy: Users can delete rooms they created
CREATE POLICY "Users can delete own voice rooms"
ON voice_rooms
FOR DELETE
USING (user_id = auth.current_user_id());

-- =====================================================
-- 2. VOICE ROOM PARTICIPANTS - Room Membership
-- =====================================================

-- Policy: Users can view participants in rooms they have access to
CREATE POLICY "Users can view participants in accessible rooms"
ON voice_room_participants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM voice_rooms
    WHERE voice_rooms.id = voice_room_participants.room_id
    AND (
      voice_rooms.is_private = false
      OR voice_rooms.user_id = auth.current_user_id()
      OR is_voice_room_participant(voice_rooms.id, auth.current_user_id())
    )
  )
);

-- Policy: Users can join public rooms or rooms they're invited to
CREATE POLICY "Users can join accessible voice rooms"
ON voice_room_participants
FOR INSERT
WITH CHECK (
  user_id = auth.current_user_id()
  AND EXISTS (
    SELECT 1 FROM voice_rooms
    WHERE voice_rooms.id = voice_room_participants.room_id
    AND (
      voice_rooms.is_private = false
      OR voice_rooms.user_id = auth.current_user_id()
      OR is_voice_room_participant(voice_rooms.id, auth.current_user_id())
    )
  )
);

-- Policy: Users can update their own participant status
CREATE POLICY "Users can update own participant status"
ON voice_room_participants
FOR UPDATE
USING (user_id = auth.current_user_id())
WITH CHECK (user_id = auth.current_user_id());

-- Policy: Users can leave rooms OR room creators can remove participants
CREATE POLICY "Users can leave or be removed from rooms"
ON voice_room_participants
FOR DELETE
USING (
  user_id = auth.current_user_id()
  OR is_voice_room_creator(room_id, auth.current_user_id())
);

-- =====================================================
-- 3. EPHEMERAL WORKSPACES - Temporary E2EE Workspaces
-- =====================================================

-- Policy: Users can view active workspaces they created or participate in
CREATE POLICY "Users can view accessible workspaces"
ON ephemeral_workspaces
FOR SELECT
USING (
  is_active = true
  AND (
    created_by = auth.current_user_id()
    OR is_workspace_participant(id, auth.current_user_id())
  )
);

-- Policy: Users can create their own workspaces
CREATE POLICY "Users can create own workspaces"
ON ephemeral_workspaces
FOR INSERT
WITH CHECK (created_by = auth.current_user_id());

-- Policy: Users can update workspaces they created
CREATE POLICY "Users can update own workspaces"
ON ephemeral_workspaces
FOR UPDATE
USING (created_by = auth.current_user_id())
WITH CHECK (created_by = auth.current_user_id());

-- Policy: Users can delete workspaces they created
CREATE POLICY "Users can delete own workspaces"
ON ephemeral_workspaces
FOR DELETE
USING (created_by = auth.current_user_id());

-- =====================================================
-- 4. CHAT MESSAGES - E2EE Messages in Workspaces
-- =====================================================

-- Policy: Users can view messages in workspaces they have access to
CREATE POLICY "Users can view messages in accessible workspaces"
ON chat_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM ephemeral_workspaces
    WHERE ephemeral_workspaces.id = chat_messages.workspace_id
    AND ephemeral_workspaces.is_active = true
    AND (
      ephemeral_workspaces.created_by = auth.current_user_id()
      OR is_workspace_participant(ephemeral_workspaces.id, auth.current_user_id())
    )
  )
);

-- Policy: Users can send messages to workspaces they participate in
CREATE POLICY "Users can send messages in accessible workspaces"
ON chat_messages
FOR INSERT
WITH CHECK (
  sender_id = auth.current_user_id()
  AND EXISTS (
    SELECT 1 FROM ephemeral_workspaces
    WHERE ephemeral_workspaces.id = chat_messages.workspace_id
    AND ephemeral_workspaces.is_active = true
    AND (
      ephemeral_workspaces.created_by = auth.current_user_id()
      OR is_workspace_participant(ephemeral_workspaces.id, auth.current_user_id())
    )
  )
);

-- Note: No UPDATE or DELETE for E2EE messages (immutable for security)

-- =====================================================
-- 5. WORKSPACE PARTICIPANTS - Workspace Membership
-- =====================================================

-- Policy: Users can view participants in workspaces they have access to
CREATE POLICY "Users can view participants in accessible workspaces"
ON workspace_participants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM ephemeral_workspaces
    WHERE ephemeral_workspaces.id = workspace_participants.workspace_id
    AND (
      ephemeral_workspaces.created_by = auth.current_user_id()
      OR is_workspace_participant(ephemeral_workspaces.id, auth.current_user_id())
    )
  )
);

-- Policy: Workspace creators can add participants
CREATE POLICY "Workspace creators can add participants"
ON workspace_participants
FOR INSERT
WITH CHECK (
  is_workspace_creator(workspace_id, auth.current_user_id())
);

-- Policy: Users can update their own participant status
CREATE POLICY "Users can update own workspace participant status"
ON workspace_participants
FOR UPDATE
USING (user_id = auth.current_user_id())
WITH CHECK (user_id = auth.current_user_id());

-- Policy: Users can leave workspaces OR creators can remove participants
CREATE POLICY "Users can leave or be removed from workspaces"
ON workspace_participants
FOR DELETE
USING (
  user_id = auth.current_user_id()
  OR is_workspace_creator(workspace_id, auth.current_user_id())
);

-- =====================================================
-- 6. FILE UPLOADS - User-Owned File Storage
-- =====================================================

-- Policy: Users can view their own files
CREATE POLICY "Users can view own file uploads"
ON file_uploads
FOR SELECT
USING (user_id::text = auth.current_user_id());

-- Policy: Users can upload files
CREATE POLICY "Users can upload own files"
ON file_uploads
FOR INSERT
WITH CHECK (user_id::text = auth.current_user_id());

-- Policy: Users can update metadata of their own files
CREATE POLICY "Users can update own file uploads"
ON file_uploads
FOR UPDATE
USING (user_id::text = auth.current_user_id())
WITH CHECK (user_id::text = auth.current_user_id());

-- Policy: Users can delete their own files
CREATE POLICY "Users can delete own file uploads"
ON file_uploads
FOR DELETE
USING (user_id::text = auth.current_user_id());

-- =====================================================
-- 7. BACKUPS - Strictly User-Owned, Encrypted
-- =====================================================

-- Policy: Users can ONLY view their own backups
CREATE POLICY "Users can view own backups"
ON backups
FOR SELECT
USING (user_id::text = auth.current_user_id());

-- Policy: Users can create their own backups
CREATE POLICY "Users can create own backups"
ON backups
FOR INSERT
WITH CHECK (user_id::text = auth.current_user_id());

-- Policy: Users can update their own backup status
CREATE POLICY "Users can update own backups"
ON backups
FOR UPDATE
USING (user_id::text = auth.current_user_id())
WITH CHECK (user_id::text = auth.current_user_id());

-- Policy: Users can delete their own backups
CREATE POLICY "Users can delete own backups"
ON backups
FOR DELETE
USING (user_id::text = auth.current_user_id());

-- =====================================================
-- 8. SYNC DEVICES - User's Registered Devices
-- =====================================================

CREATE POLICY "Users can view own sync devices"
ON sync_devices
FOR SELECT
USING (user_id::text = auth.current_user_id());

CREATE POLICY "Users can register own sync devices"
ON sync_devices
FOR INSERT
WITH CHECK (user_id::text = auth.current_user_id());

CREATE POLICY "Users can update own sync devices"
ON sync_devices
FOR UPDATE
USING (user_id::text = auth.current_user_id())
WITH CHECK (user_id::text = auth.current_user_id());

CREATE POLICY "Users can delete own sync devices"
ON sync_devices
FOR DELETE
USING (user_id::text = auth.current_user_id());

-- =====================================================
-- 9. BACKUP SETTINGS - User Backup Preferences
-- =====================================================

CREATE POLICY "Users can view own backup settings"
ON backup_settings
FOR SELECT
USING (user_id::text = auth.current_user_id());

CREATE POLICY "Users can create own backup settings"
ON backup_settings
FOR INSERT
WITH CHECK (user_id::text = auth.current_user_id());

CREATE POLICY "Users can update own backup settings"
ON backup_settings
FOR UPDATE
USING (user_id::text = auth.current_user_id())
WITH CHECK (user_id::text = auth.current_user_id());

CREATE POLICY "Users can delete own backup settings"
ON backup_settings
FOR DELETE
USING (user_id::text = auth.current_user_id());

-- =====================================================
-- 10. SYNC SETTINGS - User Sync Preferences
-- =====================================================

CREATE POLICY "Users can view own sync settings"
ON sync_settings
FOR SELECT
USING (user_id::text = auth.current_user_id());

CREATE POLICY "Users can create own sync settings"
ON sync_settings
FOR INSERT
WITH CHECK (user_id::text = auth.current_user_id());

CREATE POLICY "Users can update own sync settings"
ON sync_settings
FOR UPDATE
USING (user_id::text = auth.current_user_id())
WITH CHECK (user_id::text = auth.current_user_id());

CREATE POLICY "Users can delete own sync settings"
ON sync_settings
FOR DELETE
USING (user_id::text = auth.current_user_id());

-- =====================================================
-- 11. EXPORT JOBS - User Data Exports
-- =====================================================

CREATE POLICY "Users can view own export jobs"
ON export_jobs
FOR SELECT
USING (user_id::text = auth.current_user_id());

CREATE POLICY "Users can create own export jobs"
ON export_jobs
FOR INSERT
WITH CHECK (user_id::text = auth.current_user_id());

CREATE POLICY "Users can update own export jobs"
ON export_jobs
FOR UPDATE
USING (user_id::text = auth.current_user_id())
WITH CHECK (user_id::text = auth.current_user_id());

CREATE POLICY "Users can delete own export jobs"
ON export_jobs
FOR DELETE
USING (user_id::text = auth.current_user_id());

-- =====================================================
-- 12. IN-APP MESSAGES - Admin-Created, User-Viewed
-- =====================================================

-- Policy: Admins can do anything with in-app messages
CREATE POLICY "Admins can manage in app messages"
ON in_app_messages
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Policy: All users can view active messages within their date range
CREATE POLICY "Users can view active in app messages"
ON in_app_messages
FOR SELECT
USING (
  active = true
  AND (start_date IS NULL OR start_date <= NOW())
  AND (end_date IS NULL OR end_date >= NOW())
);

-- Note: Only admins can INSERT/UPDATE/DELETE in-app messages

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check workspace-related policies
SELECT
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
    'voice_rooms', 'voice_room_participants',
    'ephemeral_workspaces', 'chat_messages', 'workspace_participants',
    'file_uploads', 'backups', 'sync_devices', 'backup_settings',
    'sync_settings', 'export_jobs', 'in_app_messages'
)
GROUP BY tablename
ORDER BY tablename;

-- Check helper functions
SELECT
    proname as function_name,
    pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname IN (
    'is_workspace_creator',
    'is_workspace_participant',
    'is_voice_room_creator',
    'is_voice_room_participant',
    'is_admin'
)
ORDER BY proname;

SELECT '✅ Workspace and shared resource policies created. Continue with 004_performance_indexes.sql' as status;
