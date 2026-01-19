-- Migration: Add tables for AI Lab workflows/templates and Voice Rooms
-- Run this in your Supabase SQL Editor

-- ============================================
-- AI LAB WORKFLOWS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ai_lab_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_lab_workflows_user_id ON ai_lab_workflows(user_id);
CREATE INDEX idx_ai_lab_workflows_created_at ON ai_lab_workflows(created_at);

-- ============================================
-- AI LAB TEMPLATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ai_lab_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_lab_templates_user_id ON ai_lab_templates(user_id);
CREATE INDEX idx_ai_lab_templates_agent_id ON ai_lab_templates(agent_id);

-- ============================================
-- VOICE ROOMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS voice_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT NOT NULL DEFAULT 'bg-emerald-500',
  max_participants INTEGER NOT NULL DEFAULT 25,
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  category TEXT,
  description TEXT,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_voice_rooms_user_id ON voice_rooms(user_id);
CREATE INDEX idx_voice_rooms_category ON voice_rooms(category);

-- ============================================
-- VOICE ROOM PARTICIPANTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS voice_room_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES voice_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  avatar_color TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_muted BOOLEAN NOT NULL DEFAULT FALSE,
  is_speaking BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(room_id, user_id)
);

CREATE INDEX idx_voice_room_participants_room_id ON voice_room_participants(room_id);
CREATE INDEX idx_voice_room_participants_user_id ON voice_room_participants(user_id);
