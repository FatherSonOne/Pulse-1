-- Vox Modes Database Schema
-- Comprehensive voice communication system for Pulse

-- ============================================
-- PULSE USERS & HANDLES
-- ============================================

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS vox_notifications CASCADE;
DROP TABLE IF EXISTS vox_drops CASCADE;
DROP TABLE IF EXISTS quick_vox_status CASCADE;
DROP TABLE IF EXISTS quick_vox_messages CASCADE;
DROP TABLE IF EXISTS quick_vox_favorites CASCADE;
DROP TABLE IF EXISTS vox_notes CASCADE;
DROP TABLE IF EXISTS team_vox_messages CASCADE;
DROP TABLE IF EXISTS vox_team_channels CASCADE;
DROP TABLE IF EXISTS vox_workspaces CASCADE;
DROP TABLE IF EXISTS voice_thread_messages CASCADE;
DROP TABLE IF EXISTS voice_threads CASCADE;
DROP TABLE IF EXISTS broadcasts CASCADE;
DROP TABLE IF EXISTS pulse_channel_subscriptions CASCADE;
DROP TABLE IF EXISTS pulse_channels CASCADE;
DROP TABLE IF EXISTS pulse_follows CASCADE;
DROP TABLE IF EXISTS pulse_users CASCADE;

-- Create pulse_users table (standalone, not referencing auth.users directly for flexibility)
CREATE TABLE pulse_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE,  -- Optional link to auth.users
  handle TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  avatar_color TEXT NOT NULL DEFAULT '#10b981',
  bio TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  settings JSONB DEFAULT '{"notificationsEnabled": true, "emailNotifications": true, "pushNotifications": true, "defaultVoxMode": "quick_vox", "autoPlayIncoming": false, "transcriptionEnabled": true, "privacyLevel": "followers"}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pulse_users_handle ON pulse_users(handle);
CREATE INDEX idx_pulse_users_auth ON pulse_users(auth_user_id);

-- Follows relationship
CREATE TABLE pulse_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES pulse_users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES pulse_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

CREATE INDEX idx_pulse_follows_follower ON pulse_follows(follower_id);
CREATE INDEX idx_pulse_follows_following ON pulse_follows(following_id);

-- ============================================
-- PULSE RADIO (Broadcasts)
-- ============================================

CREATE TABLE pulse_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES pulse_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  is_public BOOLEAN DEFAULT TRUE,
  subscriber_count INTEGER DEFAULT 0,
  total_listens INTEGER DEFAULT 0,
  category TEXT DEFAULT 'general',
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_broadcast_at TIMESTAMPTZ
);

CREATE INDEX idx_pulse_channels_owner ON pulse_channels(owner_id);
CREATE INDEX idx_pulse_channels_public ON pulse_channels(is_public) WHERE is_public = TRUE;

CREATE TABLE pulse_channel_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES pulse_channels(id) ON DELETE CASCADE,
  subscriber_id UUID REFERENCES pulse_users(id) ON DELETE CASCADE,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel_id, subscriber_id)
);

CREATE TABLE broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES pulse_channels(id) ON DELETE CASCADE,
  author_id UUID REFERENCES pulse_users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  audio_url TEXT NOT NULL,
  duration INTEGER NOT NULL,
  transcript TEXT,
  listen_count INTEGER DEFAULT 0,
  reaction_counts JSONB DEFAULT '{}'::jsonb,
  is_live BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  episode_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_broadcasts_channel ON broadcasts(channel_id);
CREATE INDEX idx_broadcasts_published ON broadcasts(published_at DESC);

-- ============================================
-- VOICE THREADS
-- ============================================

CREATE TABLE voice_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participants UUID[] NOT NULL,
  subject TEXT,
  root_message_id UUID,
  message_count INTEGER DEFAULT 0,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_threads_participants ON voice_threads USING GIN(participants);
CREATE INDEX idx_voice_threads_activity ON voice_threads(last_activity_at DESC);

CREATE TABLE voice_thread_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES voice_threads(id) ON DELETE CASCADE,
  sender_id UUID,
  sender_name TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  duration INTEGER NOT NULL,
  transcript TEXT,
  reply_to_id UUID REFERENCES voice_thread_messages(id) ON DELETE SET NULL,
  reply_to_timestamp INTEGER,
  quoted_text TEXT,
  read_by UUID[] DEFAULT ARRAY[]::UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_thread_messages_thread ON voice_thread_messages(thread_id);
CREATE INDEX idx_voice_thread_messages_created ON voice_thread_messages(created_at);

-- ============================================
-- TEAM VOX (Workspaces)
-- ============================================

CREATE TABLE vox_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID,
  member_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vox_workspaces_owner ON vox_workspaces(owner_id);
CREATE INDEX idx_vox_workspaces_members ON vox_workspaces USING GIN(member_ids);

CREATE TABLE vox_team_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES vox_workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'general' CHECK (type IN ('general', 'standup', 'announcement', 'project')),
  member_ids UUID[] DEFAULT ARRAY[]::UUID[],
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vox_team_channels_workspace ON vox_team_channels(workspace_id);

CREATE TABLE team_vox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES vox_team_channels(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES vox_workspaces(id) ON DELETE CASCADE,
  sender_id UUID,
  sender_name TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  duration INTEGER NOT NULL,
  transcript TEXT,
  message_type TEXT NOT NULL DEFAULT 'normal' CHECK (message_type IN ('normal', 'standup', 'announcement')),
  action_items TEXT[] DEFAULT ARRAY[]::TEXT[],
  mentions UUID[] DEFAULT ARRAY[]::UUID[],
  reactions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_team_vox_messages_channel ON team_vox_messages(channel_id);
CREATE INDEX idx_team_vox_messages_created ON team_vox_messages(created_at DESC);

-- ============================================
-- VOX NOTES
-- ============================================

CREATE TABLE vox_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  audio_url TEXT NOT NULL,
  duration INTEGER NOT NULL,
  transcript TEXT,
  title TEXT,
  summary TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  linked_items JSONB DEFAULT '[]'::jsonb,
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vox_notes_user ON vox_notes(user_id);
CREATE INDEX idx_vox_notes_created ON vox_notes(created_at DESC);
CREATE INDEX idx_vox_notes_tags ON vox_notes USING GIN(tags);

-- ============================================
-- QUICK VOX
-- ============================================

CREATE TABLE quick_vox_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  contact_id UUID NOT NULL,
  contact_handle TEXT,
  contact_name TEXT NOT NULL,
  avatar_color TEXT NOT NULL DEFAULT '#3B82F6',
  position INTEGER NOT NULL DEFAULT 0,
  last_vox_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quick_vox_favorites_user ON quick_vox_favorites(user_id);
CREATE UNIQUE INDEX idx_quick_vox_favorites_unique ON quick_vox_favorites(user_id, contact_id);

CREATE TABLE quick_vox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  audio_url TEXT NOT NULL,
  duration INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sending', 'sent', 'delivered', 'read', 'played')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  played_at TIMESTAMPTZ
);

CREATE INDEX idx_quick_vox_messages_sender ON quick_vox_messages(sender_id);
CREATE INDEX idx_quick_vox_messages_recipient ON quick_vox_messages(recipient_id);
CREATE INDEX idx_quick_vox_messages_conversation ON quick_vox_messages(sender_id, recipient_id);

CREATE TABLE quick_vox_status (
  user_id UUID PRIMARY KEY,
  is_recording BOOLEAN DEFAULT FALSE,
  is_online BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- VOX DROP (Time Capsules)
-- ============================================

CREATE TABLE vox_drops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL,
  recipient_ids UUID[] NOT NULL,
  audio_url TEXT NOT NULL,
  duration INTEGER NOT NULL,
  transcript TEXT,
  title TEXT,
  message TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL,
  delivered_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'delivered', 'opened', 'expired')),
  reveal_condition JSONB,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_pattern JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vox_drops_sender ON vox_drops(sender_id);
CREATE INDEX idx_vox_drops_recipients ON vox_drops USING GIN(recipient_ids);
CREATE INDEX idx_vox_drops_scheduled ON vox_drops(scheduled_for) WHERE status = 'scheduled';

-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE vox_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('new_vox', 'reaction', 'reply', 'mention', 'broadcast', 'vox_drop')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  related_vox_id UUID,
  sender_id UUID,
  sender_name TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vox_notifications_user ON vox_notifications(user_id);
CREATE INDEX idx_vox_notifications_unread ON vox_notifications(user_id) WHERE is_read = FALSE;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Increment follower count
CREATE OR REPLACE FUNCTION increment_follower_count(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE pulse_users
  SET follower_count = follower_count + 1
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql;

-- Increment following count
CREATE OR REPLACE FUNCTION increment_following_count(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE pulse_users
  SET following_count = following_count + 1
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql;

-- Decrement follower count
CREATE OR REPLACE FUNCTION decrement_follower_count(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE pulse_users
  SET follower_count = GREATEST(follower_count - 1, 0)
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql;

-- Decrement following count
CREATE OR REPLACE FUNCTION decrement_following_count(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE pulse_users
  SET following_count = GREATEST(following_count - 1, 0)
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE pulse_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pulse_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE pulse_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE pulse_channel_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_thread_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE vox_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE vox_team_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_vox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE vox_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_vox_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_vox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_vox_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE vox_drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE vox_notifications ENABLE ROW LEVEL SECURITY;

-- Pulse Users policies (allow all for now, auth handled at app level)
CREATE POLICY "Allow all operations on pulse_users" ON pulse_users FOR ALL USING (true) WITH CHECK (true);

-- Follows policies
CREATE POLICY "Allow all operations on pulse_follows" ON pulse_follows FOR ALL USING (true) WITH CHECK (true);

-- Channels policies
CREATE POLICY "Allow all operations on pulse_channels" ON pulse_channels FOR ALL USING (true) WITH CHECK (true);

-- Channel subscriptions policies
CREATE POLICY "Allow all operations on pulse_channel_subscriptions" ON pulse_channel_subscriptions FOR ALL USING (true) WITH CHECK (true);

-- Broadcasts policies
CREATE POLICY "Allow all operations on broadcasts" ON broadcasts FOR ALL USING (true) WITH CHECK (true);

-- Voice threads policies
CREATE POLICY "Allow all operations on voice_threads" ON voice_threads FOR ALL USING (true) WITH CHECK (true);

-- Voice thread messages policies
CREATE POLICY "Allow all operations on voice_thread_messages" ON voice_thread_messages FOR ALL USING (true) WITH CHECK (true);

-- Workspace policies
CREATE POLICY "Allow all operations on vox_workspaces" ON vox_workspaces FOR ALL USING (true) WITH CHECK (true);

-- Team channel policies
CREATE POLICY "Allow all operations on vox_team_channels" ON vox_team_channels FOR ALL USING (true) WITH CHECK (true);

-- Team messages policies
CREATE POLICY "Allow all operations on team_vox_messages" ON team_vox_messages FOR ALL USING (true) WITH CHECK (true);

-- Vox notes policies
CREATE POLICY "Allow all operations on vox_notes" ON vox_notes FOR ALL USING (true) WITH CHECK (true);

-- Quick vox favorites policies
CREATE POLICY "Allow all operations on quick_vox_favorites" ON quick_vox_favorites FOR ALL USING (true) WITH CHECK (true);

-- Quick vox messages policies
CREATE POLICY "Allow all operations on quick_vox_messages" ON quick_vox_messages FOR ALL USING (true) WITH CHECK (true);

-- Quick vox status policies
CREATE POLICY "Allow all operations on quick_vox_status" ON quick_vox_status FOR ALL USING (true) WITH CHECK (true);

-- Vox drops policies
CREATE POLICY "Allow all operations on vox_drops" ON vox_drops FOR ALL USING (true) WITH CHECK (true);

-- Notifications policies
CREATE POLICY "Allow all operations on vox_notifications" ON vox_notifications FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- STORAGE BUCKET FOR VOX AUDIO FILES
-- ============================================

-- Create the voxer storage bucket for audio recordings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voxer',
  'voxer',
  true,
  52428800, -- 50MB limit
  ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-m4a']::text[]
) ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Allow public access to voxer bucket (read)
CREATE POLICY "Allow public read access to voxer" ON storage.objects
  FOR SELECT USING (bucket_id = 'voxer');

-- Allow authenticated uploads to voxer bucket
CREATE POLICY "Allow authenticated uploads to voxer" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'voxer');

-- Allow users to delete their own files
CREATE POLICY "Allow users to delete own files in voxer" ON storage.objects
  FOR DELETE USING (bucket_id = 'voxer');

-- Allow users to update their own files
CREATE POLICY "Allow users to update files in voxer" ON storage.objects
  FOR UPDATE USING (bucket_id = 'voxer') WITH CHECK (bucket_id = 'voxer');

-- ============================================
-- TEST DATA: Add test Pulse user for messaging
-- ============================================

-- Insert test Pulse user that can be used for testing vox messaging
INSERT INTO pulse_users (
  id,
  handle,
  display_name,
  avatar_color,
  bio,
  is_verified,
  follower_count,
  following_count,
  settings,
  created_at,
  last_active_at
) VALUES (
  '00000000-0000-0000-0000-000000000001'::UUID,
  'testpulseuser',
  'Test Pulse User',
  '#8B5CF6',
  'A test user for messaging and vox testing',
  true,
  100,
  50,
  '{"notificationsEnabled": true, "emailNotifications": false, "pushNotifications": false, "defaultVoxMode": "quick_vox", "autoPlayIncoming": true, "transcriptionEnabled": true, "privacyLevel": "public"}'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Insert a second test user for group conversations
INSERT INTO pulse_users (
  id,
  handle,
  display_name,
  avatar_color,
  bio,
  is_verified,
  follower_count,
  following_count,
  settings,
  created_at,
  last_active_at
) VALUES (
  '00000000-0000-0000-0000-000000000002'::UUID,
  'demopulseuser',
  'Demo Pulse User',
  '#10B981',
  'Another test user for group conversations',
  false,
  25,
  30,
  '{"notificationsEnabled": true, "emailNotifications": false, "pushNotifications": false, "defaultVoxMode": "voice_threads", "autoPlayIncoming": false, "transcriptionEnabled": true, "privacyLevel": "followers"}'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;
