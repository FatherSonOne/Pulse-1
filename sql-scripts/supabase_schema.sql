-- Supabase SQL Schema for Pulse E2EE Chat with Ephemeral Workspaces
-- Run this in your Supabase SQL Editor

-- 1. Create ephemeral_workspaces table
CREATE TABLE IF NOT EXISTS ephemeral_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES ephemeral_workspaces(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  encrypted_content TEXT NOT NULL,
  nonce TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create workspace_participants table (for multi-user workspaces)
CREATE TABLE IF NOT EXISTS workspace_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES ephemeral_workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(workspace_id, user_id)
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_workspace_id ON chat_messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_workspaces_is_active ON ephemeral_workspaces(is_active);
CREATE INDEX IF NOT EXISTS idx_workspaces_expires_at ON ephemeral_workspaces(expires_at);
CREATE INDEX IF NOT EXISTS idx_participants_workspace_id ON workspace_participants(workspace_id);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE ephemeral_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_participants ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies (allow all for now - you should restrict these in production)
-- Allow anyone to view active workspaces
CREATE POLICY "Allow viewing active workspaces"
  ON ephemeral_workspaces
  FOR SELECT
  USING (is_active = true);

-- Allow anyone to insert messages
CREATE POLICY "Allow inserting messages"
  ON chat_messages
  FOR INSERT
  WITH CHECK (true);

-- Allow viewing messages in active workspaces
CREATE POLICY "Allow viewing messages"
  ON chat_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ephemeral_workspaces
      WHERE id = chat_messages.workspace_id AND is_active = true
    )
  );

-- Allow inserting participants
CREATE POLICY "Allow inserting participants"
  ON workspace_participants
  FOR INSERT
  WITH CHECK (true);

-- Allow viewing participants
CREATE POLICY "Allow viewing participants"
  ON workspace_participants
  FOR SELECT
  USING (true);
