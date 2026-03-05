-- AI Lab Tables Migration
-- Creates workflow, template, and output persistence for AI Lab

-- AI Lab Workflows
CREATE TABLE IF NOT EXISTS ai_lab_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  steps JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_lab_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own workflows"
  ON ai_lab_workflows FOR ALL
  USING (auth.uid() = user_id);

-- AI Lab Templates
CREATE TABLE IF NOT EXISTS ai_lab_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_lab_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own templates"
  ON ai_lab_templates FOR ALL
  USING (auth.uid() = user_id);

-- AI Lab Saved Outputs (for sharing and knowledge base integration)
CREATE TABLE IF NOT EXISTS ai_lab_outputs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_lab_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own outputs"
  ON ai_lab_outputs FOR ALL
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_lab_workflows_user ON ai_lab_workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_lab_templates_user ON ai_lab_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_lab_outputs_user ON ai_lab_outputs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_lab_outputs_workspace ON ai_lab_outputs(workspace);
