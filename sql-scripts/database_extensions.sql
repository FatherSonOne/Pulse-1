-- ============================================
-- PULSE 1.0 - Feature Extensions
-- Decision Objects + Inline Tasks + Outcome Threads
-- ============================================

-- ============================================
-- 1. DECISION OBJECTS
-- ============================================

CREATE TABLE IF NOT EXISTS decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL,
  workspace_id UUID NOT NULL REFERENCES ephemeral_workspaces(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL,
  proposal_text TEXT NOT NULL,
  decision_type TEXT NOT NULL DEFAULT 'proposal', -- 'proposal' or 'final'
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'approved', 'rejected'
  threshold INTEGER NOT NULL DEFAULT 1, -- Number of approvals needed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS decision_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  choice TEXT NOT NULL, -- 'approve' or 'reject'
  comment TEXT,
  voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(decision_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_decisions_workspace ON decisions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status);
CREATE INDEX IF NOT EXISTS idx_decision_votes_decision ON decision_votes(decision_id);

-- ============================================
-- 2. INLINE TASK EXTRACTION
-- ============================================

CREATE TABLE IF NOT EXISTS extracted_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES ephemeral_workspaces(id) ON DELETE CASCADE,
  origin_message_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id TEXT,
  deadline TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  extracted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS task_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES extracted_tasks(id) ON DELETE CASCADE,
  updated_by TEXT NOT NULL,
  field_changed TEXT NOT NULL, -- 'status', 'assignee', 'deadline', etc.
  old_value TEXT,
  new_value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON extracted_tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON extracted_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON extracted_tasks(status);
CREATE INDEX IF NOT EXISTS idx_task_updates_task ON task_updates(task_id);

-- ============================================
-- 3. OUTCOME THREADS
-- ============================================

CREATE TABLE IF NOT EXISTS workspace_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES ephemeral_workspaces(id) ON DELETE CASCADE,
  goal TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'on_track', -- 'on_track', 'at_risk', 'blocked', 'completed'
  progress INTEGER NOT NULL DEFAULT 0, -- 0-100
  target_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  UNIQUE(workspace_id) -- One outcome per workspace
);

CREATE TABLE IF NOT EXISTS outcome_blockers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outcome_id UUID NOT NULL REFERENCES workspace_outcomes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high'
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'resolved', 'cancelled'
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS outcome_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outcome_id UUID NOT NULL REFERENCES workspace_outcomes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_date TIMESTAMP WITH TIME ZONE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outcomes_workspace ON workspace_outcomes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_blockers_outcome ON outcome_blockers(outcome_id);
CREATE INDEX IF NOT EXISTS idx_blockers_status ON outcome_blockers(status);
CREATE INDEX IF NOT EXISTS idx_milestones_outcome ON outcome_milestones(outcome_id);

-- ============================================
-- 4. RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcome_blockers ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcome_milestones ENABLE ROW LEVEL SECURITY;

-- Decisions: Allow all authenticated users to view/insert
CREATE POLICY "Allow viewing decisions"
  ON decisions FOR SELECT
  USING (true);

CREATE POLICY "Allow creating decisions"
  ON decisions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow updating decisions"
  ON decisions FOR UPDATE
  USING (true);

-- Decision Votes: Allow all authenticated users
CREATE POLICY "Allow viewing votes"
  ON decision_votes FOR SELECT
  USING (true);

CREATE POLICY "Allow casting votes"
  ON decision_votes FOR INSERT
  WITH CHECK (true);

-- Tasks: Allow all authenticated users
CREATE POLICY "Allow viewing tasks"
  ON extracted_tasks FOR SELECT
  USING (true);

CREATE POLICY "Allow creating tasks"
  ON extracted_tasks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow updating tasks"
  ON extracted_tasks FOR UPDATE
  USING (true);

-- Task Updates: Allow all authenticated users
CREATE POLICY "Allow viewing task updates"
  ON task_updates FOR SELECT
  USING (true);

CREATE POLICY "Allow creating task updates"
  ON task_updates FOR INSERT
  WITH CHECK (true);

-- Outcomes: Allow all authenticated users
CREATE POLICY "Allow viewing outcomes"
  ON workspace_outcomes FOR SELECT
  USING (true);

CREATE POLICY "Allow creating outcomes"
  ON workspace_outcomes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow updating outcomes"
  ON workspace_outcomes FOR UPDATE
  USING (true);

-- Blockers: Allow all authenticated users
CREATE POLICY "Allow viewing blockers"
  ON outcome_blockers FOR SELECT
  USING (true);

CREATE POLICY "Allow creating blockers"
  ON outcome_blockers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow updating blockers"
  ON outcome_blockers FOR UPDATE
  USING (true);

-- Milestones: Allow all authenticated users
CREATE POLICY "Allow viewing milestones"
  ON outcome_milestones FOR SELECT
  USING (true);

CREATE POLICY "Allow creating milestones"
  ON outcome_milestones FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow updating milestones"
  ON outcome_milestones FOR UPDATE
  USING (true);

-- ============================================
-- 5. HELPER FUNCTIONS
-- ============================================

-- Function to automatically update outcome progress based on milestones
CREATE OR REPLACE FUNCTION update_outcome_progress()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE workspace_outcomes
  SET progress = (
    SELECT COALESCE(
      (COUNT(*) FILTER (WHERE completed = true) * 100.0 / NULLIF(COUNT(*), 0))::INTEGER,
      0
    )
    FROM outcome_milestones
    WHERE outcome_id = NEW.outcome_id
  )
  WHERE id = NEW.outcome_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
  -- Get approval count and threshold
  SELECT 
    COUNT(*) FILTER (WHERE choice = 'approve'),
    d.threshold
  INTO approval_count, decision_threshold
  FROM decision_votes dv
  JOIN decisions d ON d.id = dv.decision_id
  WHERE dv.decision_id = NEW.decision_id
  GROUP BY d.threshold;
  
  -- If threshold met, mark as approved
  IF approval_count >= decision_threshold THEN
    UPDATE decisions
    SET status = 'approved',
        resolved_at = NOW()
    WHERE id = NEW.decision_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER decision_vote_trigger
AFTER INSERT ON decision_votes
FOR EACH ROW
EXECUTE FUNCTION check_decision_threshold();
