-- Pulse App Database Migration v2
-- Handles existing tables with different schemas
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- DROP ALL EXISTING TABLES (CLEAN SLATE)
-- ============================================
-- This ensures we start fresh without schema conflicts

DROP TABLE IF EXISTS key_results CASCADE;
DROP TABLE IF EXISTS outcomes CASCADE;
DROP TABLE IF EXISTS slack_channels CASCADE;
DROP TABLE IF EXISTS sms_messages CASCADE;
DROP TABLE IF EXISTS sms_conversations CASCADE;
DROP TABLE IF EXISTS emails CASCADE;
DROP TABLE IF EXISTS voxer_recordings CASCADE;
DROP TABLE IF EXISTS archives CASCADE;
DROP TABLE IF EXISTS unified_messages CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS threads CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS calendar_events CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;

-- Also drop tables from any previous schema
DROP TABLE IF EXISTS extracted_tasks CASCADE;
DROP TABLE IF EXISTS transcriptions CASCADE;
DROP TABLE IF EXISTS voice_messages CASCADE;
DROP TABLE IF EXISTS channel_artifacts CASCADE;
DROP TABLE IF EXISTS user_retention_cohorts CASCADE;
DROP TABLE IF EXISTS message_interactions CASCADE;
DROP TABLE IF EXISTS in_app_messages CASCADE;

-- ============================================
-- CONTACTS TABLE
-- ============================================
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Contact',
  company TEXT,
  avatar_color TEXT NOT NULL DEFAULT '#6366f1',
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'busy', 'away')),
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT,
  case_notes TEXT,
  website TEXT,
  birthday TEXT,
  groups TEXT[] DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'local' CHECK (source IN ('local', 'google', 'vision')),
  last_synced TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_contacts_email ON contacts(email);

-- ============================================
-- CALENDAR EVENTS TABLE
-- ============================================
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  description TEXT,
  location TEXT,
  attendees TEXT[] DEFAULT '{}',
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  all_day BOOLEAN NOT NULL DEFAULT FALSE,
  event_type TEXT NOT NULL DEFAULT 'event' CHECK (event_type IN ('event', 'meet', 'reminder', 'call', 'deadline')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX idx_calendar_events_start ON calendar_events(start_time);

-- ============================================
-- TASKS TABLE
-- ============================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  due_date TIMESTAMPTZ,
  list_id TEXT NOT NULL DEFAULT 'work',
  assignee_id TEXT,
  origin_message_id TEXT,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_list_id ON tasks(list_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

-- ============================================
-- THREADS TABLE
-- ============================================
CREATE TABLE threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  avatar_color TEXT NOT NULL DEFAULT '#6366f1',
  unread BOOLEAN NOT NULL DEFAULT FALSE,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  outcome_goal TEXT,
  outcome_status TEXT CHECK (outcome_status IN ('on_track', 'at_risk', 'completed', 'blocked')),
  outcome_progress INTEGER DEFAULT 0,
  outcome_blockers TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_threads_user_id ON threads(user_id);
CREATE INDEX idx_threads_contact_id ON threads(contact_id);

-- ============================================
-- MESSAGES TABLE
-- ============================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('me', 'other')),
  text TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT CHECK (source IN ('pulse', 'slack', 'email', 'sms')),
  attachment_type TEXT CHECK (attachment_type IN ('image', 'file', 'audio')),
  attachment_name TEXT,
  attachment_url TEXT,
  attachment_size TEXT,
  attachment_duration INTEGER,
  reply_to_id UUID,
  reactions JSONB DEFAULT '[]',
  status TEXT CHECK (status IN ('sent', 'delivered', 'read')),
  decision_data JSONB,
  related_task_id UUID,
  voice_analysis JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_thread_id ON messages(thread_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp);

-- ============================================
-- UNIFIED MESSAGES TABLE
-- ============================================
CREATE TABLE unified_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  source TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_id TEXT,
  sender_email TEXT,
  content TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  channel_id TEXT,
  channel_name TEXT,
  thread_id TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  starred BOOLEAN NOT NULL DEFAULT FALSE,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'voice')),
  conversation_graph_id TEXT,
  tags TEXT[] DEFAULT '{}',
  media_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_unified_messages_user_id ON unified_messages(user_id);
CREATE INDEX idx_unified_messages_source ON unified_messages(source);
CREATE INDEX idx_unified_messages_timestamp ON unified_messages(timestamp);
CREATE INDEX idx_unified_messages_is_read ON unified_messages(is_read);

-- ============================================
-- ARCHIVES TABLE
-- ============================================
CREATE TABLE archives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  archive_type TEXT NOT NULL CHECK (archive_type IN ('transcript', 'meeting_note', 'journal', 'summary', 'vox_transcript', 'decision_log', 'artifact', 'research')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tags TEXT[] DEFAULT '{}',
  related_contact_id TEXT,
  decision_status TEXT CHECK (decision_status IN ('approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_archives_user_id ON archives(user_id);
CREATE INDEX idx_archives_type ON archives(archive_type);

-- ============================================
-- VOXER RECORDINGS TABLE
-- ============================================
CREATE TABLE voxer_recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  title TEXT,
  audio_url TEXT,
  duration INTEGER NOT NULL DEFAULT 0,
  transcript TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  contact_id TEXT,
  contact_name TEXT,
  is_outgoing BOOLEAN NOT NULL DEFAULT TRUE,
  played BOOLEAN NOT NULL DEFAULT FALSE,
  starred BOOLEAN NOT NULL DEFAULT FALSE,
  tags TEXT[] DEFAULT '{}',
  notes JSONB DEFAULT '[]',
  analysis JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_voxer_recordings_user_id ON voxer_recordings(user_id);
CREATE INDEX idx_voxer_recordings_recorded_at ON voxer_recordings(recorded_at);

-- ============================================
-- EMAIL TABLE
-- ============================================
CREATE TABLE emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  from_address TEXT NOT NULL,
  to_addresses TEXT[] DEFAULT '{}',
  cc_addresses TEXT[] DEFAULT '{}',
  subject TEXT NOT NULL,
  snippet TEXT,
  body TEXT,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read BOOLEAN NOT NULL DEFAULT FALSE,
  provider TEXT NOT NULL DEFAULT 'google' CHECK (provider IN ('google', 'microsoft', 'icloud')),
  folder TEXT NOT NULL DEFAULT 'inbox' CHECK (folder IN ('inbox', 'sent', 'spam', 'drafts', 'trash', 'archive')),
  labels TEXT[] DEFAULT '{}',
  attachments JSONB DEFAULT '[]',
  external_id TEXT,
  thread_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_emails_user_id ON emails(user_id);
CREATE INDEX idx_emails_folder ON emails(folder);
CREATE INDEX idx_emails_date ON emails(date);

-- ============================================
-- SMS CONVERSATIONS TABLE
-- ============================================
CREATE TABLE sms_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  contact_name TEXT,
  avatar_color TEXT NOT NULL DEFAULT '#6366f1',
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sms_conversations_user_id ON sms_conversations(user_id);
CREATE INDEX idx_sms_conversations_phone ON sms_conversations(phone_number);

-- ============================================
-- SMS MESSAGES TABLE
-- ============================================
CREATE TABLE sms_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES sms_conversations(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('me', 'them')),
  text TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  media_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sms_messages_conversation_id ON sms_messages(conversation_id);
CREATE INDEX idx_sms_messages_timestamp ON sms_messages(timestamp);

-- ============================================
-- SLACK CHANNELS TABLE
-- ============================================
CREATE TABLE slack_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  workspace_id TEXT,
  workspace_name TEXT,
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  is_member BOOLEAN NOT NULL DEFAULT TRUE,
  member_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_slack_channels_user_id ON slack_channels(user_id);

-- ============================================
-- OUTCOMES TABLE
-- ============================================
CREATE TABLE outcomes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  workspace_id TEXT,
  thread_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'blocked', 'cancelled')),
  progress INTEGER NOT NULL DEFAULT 0,
  target_date TIMESTAMPTZ,
  blockers TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outcomes_user_id ON outcomes(user_id);
CREATE INDEX idx_outcomes_status ON outcomes(status);

-- ============================================
-- KEY RESULTS TABLE
-- ============================================
CREATE TABLE key_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  outcome_id UUID NOT NULL REFERENCES outcomes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  current_value NUMERIC NOT NULL DEFAULT 0,
  target_value NUMERIC NOT NULL,
  unit TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_key_results_outcome_id ON key_results(outcome_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE unified_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE voxer_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_results ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous access (for development/testing)
CREATE POLICY "Allow all access" ON contacts FOR ALL USING (true);
CREATE POLICY "Allow all access" ON calendar_events FOR ALL USING (true);
CREATE POLICY "Allow all access" ON tasks FOR ALL USING (true);
CREATE POLICY "Allow all access" ON threads FOR ALL USING (true);
CREATE POLICY "Allow all access" ON messages FOR ALL USING (true);
CREATE POLICY "Allow all access" ON unified_messages FOR ALL USING (true);
CREATE POLICY "Allow all access" ON archives FOR ALL USING (true);
CREATE POLICY "Allow all access" ON voxer_recordings FOR ALL USING (true);
CREATE POLICY "Allow all access" ON emails FOR ALL USING (true);
CREATE POLICY "Allow all access" ON sms_conversations FOR ALL USING (true);
CREATE POLICY "Allow all access" ON sms_messages FOR ALL USING (true);
CREATE POLICY "Allow all access" ON slack_channels FOR ALL USING (true);
CREATE POLICY "Allow all access" ON outcomes FOR ALL USING (true);
CREATE POLICY "Allow all access" ON key_results FOR ALL USING (true);

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_threads_updated_at BEFORE UPDATE ON threads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_archives_updated_at BEFORE UPDATE ON archives FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sms_conversations_updated_at BEFORE UPDATE ON sms_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_outcomes_updated_at BEFORE UPDATE ON outcomes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_key_results_updated_at BEFORE UPDATE ON key_results FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'Migration v2 completed successfully! All tables created fresh.' as status;
