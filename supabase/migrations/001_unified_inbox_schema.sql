-- Unified Inbox Database Schema
-- This schema supports aggregation of messages from Slack, Gmail, SMS, and other platforms

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INTEGRATIONS TABLE
-- Stores OAuth tokens and integration configs
-- ============================================
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'slack', 'gmail', 'sms', 'discord', 'teams'
  workspace_id TEXT, -- For Slack workspace ID
  access_token TEXT, -- Encrypted OAuth token
  refresh_token TEXT, -- Encrypted refresh token
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}', -- Platform-specific config
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, platform, workspace_id)
);

-- ============================================
-- CONTACTS TABLE
-- Unified contacts across all platforms
-- ============================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  external_id TEXT NOT NULL, -- Platform-specific ID (Slack user ID, email, phone)
  name TEXT NOT NULL,
  display_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  company TEXT,
  role TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, platform, external_id)
);

-- Add missing columns if table already exists
DO $$ 
BEGIN
  -- Add platform column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'platform'
  ) THEN
    ALTER TABLE contacts ADD COLUMN platform TEXT NOT NULL DEFAULT 'unknown';
  END IF;

  -- Add external_id column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'external_id'
  ) THEN
    ALTER TABLE contacts ADD COLUMN external_id TEXT NOT NULL DEFAULT '';
  END IF;
END $$;

-- Create index for faster contact lookups (safe now that columns exist)
CREATE INDEX IF NOT EXISTS idx_contacts_user_platform ON contacts(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_contacts_external_id ON contacts(external_id);

-- ============================================
-- CHANNELS TABLE
-- Channels, groups, or conversation contexts
-- ============================================
CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  external_id TEXT NOT NULL, -- Platform-specific channel ID
  name TEXT NOT NULL,
  type TEXT, -- 'public_channel', 'private_channel', 'dm', 'group'
  is_member BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, platform, external_id)
);

-- Create index for faster channel lookups
CREATE INDEX IF NOT EXISTS idx_channels_user_platform ON channels(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_channels_external_id ON channels(external_id);

-- ============================================
-- UNIFIED_MESSAGES TABLE
-- Core message storage for all platforms
-- ============================================
CREATE TABLE IF NOT EXISTS unified_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  external_id TEXT NOT NULL, -- Platform-specific message ID
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES contacts(id),

  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text', -- 'text', 'image', 'voice', 'file', 'video'
  media_url TEXT,

  thread_id TEXT, -- For threaded conversations
  reply_to_id UUID REFERENCES unified_messages(id),

  timestamp TIMESTAMPTZ NOT NULL,
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,

  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}', -- Platform-specific data

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, platform, external_id)
);

-- Ensure all required columns exist before creating indexes
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unified_messages') THEN
    -- Add is_starred if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unified_messages' AND column_name = 'is_starred') THEN
      ALTER TABLE unified_messages ADD COLUMN is_starred BOOLEAN DEFAULT false;
    END IF;
    -- Add is_read if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unified_messages' AND column_name = 'is_read') THEN
      ALTER TABLE unified_messages ADD COLUMN is_read BOOLEAN DEFAULT false;
    END IF;
  END IF;
END $$;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_user_timestamp ON unified_messages(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON unified_messages(channel_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_platform ON unified_messages(user_id, platform, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON unified_messages(user_id, is_read, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_starred ON unified_messages(user_id, is_starred, timestamp DESC);

-- ============================================
-- CONVERSATION_GRAPHS TABLE
-- Stores relationships between conversations
-- ============================================
CREATE TABLE IF NOT EXISTS conversation_graphs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  participants UUID[] DEFAULT '{}', -- Array of contact IDs
  related_messages UUID[] DEFAULT '{}', -- Array of message IDs
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MESSAGE_SYNC_STATE TABLE
-- Track sync state for each platform
-- ============================================
CREATE TABLE IF NOT EXISTS message_sync_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  channel_external_id TEXT,
  last_sync_at TIMESTAMPTZ,
  last_message_timestamp TIMESTAMPTZ,
  sync_cursor TEXT, -- Platform-specific pagination cursor
  sync_status TEXT DEFAULT 'pending', -- 'pending', 'syncing', 'completed', 'failed'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, platform, channel_external_id)
);

-- Create index for sync state
CREATE INDEX IF NOT EXISTS idx_sync_state_user_platform ON message_sync_state(user_id, platform);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update_updated_at trigger to all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON channels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON unified_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sync_state_updated_at BEFORE UPDATE ON message_sync_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE unified_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_graphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_sync_state ENABLE ROW LEVEL SECURITY;

-- RLS Policies are created in migration 20260114_zzz_final_fix.sql
-- This avoids issues with column existence during initial migration
