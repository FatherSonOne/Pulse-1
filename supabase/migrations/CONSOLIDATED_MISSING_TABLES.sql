-- ============================================
-- CONSOLIDATED MIGRATION: All Missing Tables
-- Run this in Supabase SQL Editor to fix 404 errors
-- ============================================

-- ============================================
-- 1. ATTENTION SERVICE TABLES
-- ============================================

-- Attention Settings
CREATE TABLE IF NOT EXISTS attention_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  max_daily_notifications INTEGER DEFAULT 50,
  batch_interval_minutes INTEGER DEFAULT 30,
  focus_hours_start TEXT DEFAULT '09:00',
  focus_hours_end TEXT DEFAULT '12:00',
  high_priority_bypass BOOLEAN DEFAULT true,
  weekly_attention_goal INTEGER DEFAULT 20,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE attention_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all attention_settings" ON attention_settings;
CREATE POLICY "Allow all attention_settings" ON attention_settings FOR ALL USING (true) WITH CHECK (true);

-- Attention Logs
CREATE TABLE IF NOT EXISTS attention_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  source TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attention_logs_user_date ON attention_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attention_logs_event_type ON attention_logs(user_id, event_type, created_at DESC);

ALTER TABLE attention_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all attention_logs" ON attention_logs;
CREATE POLICY "Allow all attention_logs" ON attention_logs FOR ALL USING (true) WITH CHECK (true);

-- Focus Sessions
CREATE TABLE IF NOT EXISTS focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  planned_duration_minutes INTEGER NOT NULL DEFAULT 25,
  actual_duration_minutes INTEGER,
  interruption_count INTEGER DEFAULT 0,
  topic TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_status ON focus_sessions(user_id, status, started_at DESC);

ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all focus_sessions" ON focus_sessions;
CREATE POLICY "Allow all focus_sessions" ON focus_sessions FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON attention_settings TO authenticated, anon;
GRANT ALL ON attention_logs TO authenticated, anon;
GRANT ALL ON focus_sessions TO authenticated, anon;

-- ============================================
-- 2. WORKSPACE OUTCOMES TABLES
-- ============================================

-- Drop existing tables to start fresh (they have no data)
DROP TABLE IF EXISTS outcome_milestones CASCADE;
DROP TABLE IF EXISTS outcome_blockers CASCADE;
DROP TABLE IF EXISTS workspace_outcomes CASCADE;
DROP TABLE IF EXISTS task_updates CASCADE;
DROP TABLE IF EXISTS extracted_tasks CASCADE;
DROP TABLE IF EXISTS decision_votes CASCADE;
DROP TABLE IF EXISTS decisions CASCADE;

-- Decisions
CREATE TABLE IF NOT EXISTS decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID,
  workspace_id UUID,
  created_by TEXT NOT NULL,
  proposal_text TEXT NOT NULL,
  decision_type TEXT NOT NULL DEFAULT 'proposal',
  status TEXT NOT NULL DEFAULT 'open',
  threshold INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS decision_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  choice TEXT NOT NULL,
  comment TEXT,
  voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(decision_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_decisions_workspace ON decisions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status);
CREATE INDEX IF NOT EXISTS idx_decision_votes_decision ON decision_votes(decision_id);

-- Extracted Tasks
CREATE TABLE IF NOT EXISTS extracted_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  origin_message_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id TEXT,
  deadline TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',
  extracted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS task_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES extracted_tasks(id) ON DELETE CASCADE,
  updated_by TEXT NOT NULL,
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON extracted_tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON extracted_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON extracted_tasks(status);
CREATE INDEX IF NOT EXISTS idx_task_updates_task ON task_updates(task_id);

-- Workspace Outcomes
CREATE TABLE IF NOT EXISTS workspace_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  goal TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'on_track',
  progress INTEGER NOT NULL DEFAULT 0,
  target_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS outcome_blockers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  outcome_id UUID REFERENCES workspace_outcomes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'active',
  reported_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS outcome_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outcome_id UUID NOT NULL REFERENCES workspace_outcomes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outcomes_workspace ON workspace_outcomes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_status ON workspace_outcomes(status);
CREATE INDEX IF NOT EXISTS idx_blockers_outcome ON outcome_blockers(outcome_id);
CREATE INDEX IF NOT EXISTS idx_blockers_workspace ON outcome_blockers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_blockers_status ON outcome_blockers(status);
CREATE INDEX IF NOT EXISTS idx_milestones_outcome ON outcome_milestones(outcome_id);

-- Enable RLS with permissive policies
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcome_blockers ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcome_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all decisions" ON decisions;
CREATE POLICY "Allow all decisions" ON decisions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all decision_votes" ON decision_votes;
CREATE POLICY "Allow all decision_votes" ON decision_votes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all extracted_tasks" ON extracted_tasks;
CREATE POLICY "Allow all extracted_tasks" ON extracted_tasks FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all task_updates" ON task_updates;
CREATE POLICY "Allow all task_updates" ON task_updates FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all workspace_outcomes" ON workspace_outcomes;
CREATE POLICY "Allow all workspace_outcomes" ON workspace_outcomes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all outcome_blockers" ON outcome_blockers;
CREATE POLICY "Allow all outcome_blockers" ON outcome_blockers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all outcome_milestones" ON outcome_milestones;
CREATE POLICY "Allow all outcome_milestones" ON outcome_milestones FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON decisions TO authenticated, anon;
GRANT ALL ON decision_votes TO authenticated, anon;
GRANT ALL ON extracted_tasks TO authenticated, anon;
GRANT ALL ON task_updates TO authenticated, anon;
GRANT ALL ON workspace_outcomes TO authenticated, anon;
GRANT ALL ON outcome_blockers TO authenticated, anon;
GRANT ALL ON outcome_milestones TO authenticated, anon;

-- ============================================
-- 3. USER SETTINGS (fix 406 error)
-- ============================================

-- Add settings column to user_profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'settings'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN settings JSONB DEFAULT '{}';
  END IF;
END $$;

-- Create user_settings table as alternative
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all user_settings" ON user_settings;
CREATE POLICY "Allow all user_settings" ON user_settings FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON user_settings TO authenticated, anon;

-- ============================================
-- 4. HELPER FUNCTIONS (created after tables)
-- ============================================

-- Function to automatically update outcome progress based on milestones
CREATE OR REPLACE FUNCTION update_outcome_progress()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.outcome_id IS NOT NULL THEN
    UPDATE workspace_outcomes
    SET progress = (
      SELECT COALESCE(
        (COUNT(*) FILTER (WHERE completed = true) * 100.0 / NULLIF(COUNT(*), 0))::INTEGER,
        0
      )
      FROM outcome_milestones
      WHERE outcome_id = NEW.outcome_id
    ),
    updated_at = NOW()
    WHERE id = NEW.outcome_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS milestone_progress_trigger ON outcome_milestones;
CREATE TRIGGER milestone_progress_trigger
AFTER INSERT OR UPDATE ON outcome_milestones
FOR EACH ROW
EXECUTE FUNCTION update_outcome_progress();

-- Function to check if decision threshold is met
CREATE OR REPLACE FUNCTION check_decision_threshold()
RETURNS TRIGGER AS $$
DECLARE
  approval_count INTEGER;
  decision_threshold INTEGER;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE choice = 'approve'),
    d.threshold
  INTO approval_count, decision_threshold
  FROM decision_votes dv
  JOIN decisions d ON d.id = dv.decision_id
  WHERE dv.decision_id = NEW.decision_id
  GROUP BY d.threshold;

  IF approval_count >= decision_threshold THEN
    UPDATE decisions
    SET status = 'approved',
        resolved_at = NOW(),
        updated_at = NOW()
    WHERE id = NEW.decision_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS decision_vote_trigger ON decision_votes;
CREATE TRIGGER decision_vote_trigger
AFTER INSERT ON decision_votes
FOR EACH ROW
EXECUTE FUNCTION check_decision_threshold();

-- ============================================
-- DONE! All tables created successfully.
-- ============================================
