-- Database Migration for AI-Enhanced Decisions & Tasks
-- Version: 1.1 (Fixed)
-- Date: 2026-01-21
-- Description: Add AI insights, priorities, and dependency tracking

-- ============================================
-- 1. DECISIONS TABLE ENHANCEMENTS
-- ============================================

-- Add AI-related columns to decisions table
DO $$
BEGIN
  -- Add ai_risk_level column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decisions' AND column_name = 'ai_risk_level'
  ) THEN
    ALTER TABLE decisions ADD COLUMN ai_risk_level TEXT DEFAULT 'low';
  END IF;

  -- Add ai_predicted_completion column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decisions' AND column_name = 'ai_predicted_completion'
  ) THEN
    ALTER TABLE decisions ADD COLUMN ai_predicted_completion TIMESTAMP;
  END IF;

  -- Add ai_suggested_stakeholders column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decisions' AND column_name = 'ai_suggested_stakeholders'
  ) THEN
    ALTER TABLE decisions ADD COLUMN ai_suggested_stakeholders TEXT[];
  END IF;

  -- Add ai_insights column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decisions' AND column_name = 'ai_insights'
  ) THEN
    ALTER TABLE decisions ADD COLUMN ai_insights JSONB DEFAULT '{}';
  END IF;
END $$;

-- Add indexes for AI queries (only if columns exist)
CREATE INDEX IF NOT EXISTS idx_decisions_ai_risk_level ON decisions(ai_risk_level);

-- Only create status index if status column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decisions' AND column_name = 'status'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_decisions_status_created ON decisions(status, created_at DESC);
  END IF;
END $$;

-- ============================================
-- 2. TASKS TABLE ENHANCEMENTS
-- ============================================

-- Add AI priority and dependency columns
DO $$
BEGIN
  -- Add ai_priority_score column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'ai_priority_score'
  ) THEN
    ALTER TABLE tasks ADD COLUMN ai_priority_score DECIMAL(5,2);
  END IF;

  -- Add ai_suggested_assignee column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'ai_suggested_assignee'
  ) THEN
    ALTER TABLE tasks ADD COLUMN ai_suggested_assignee TEXT;
  END IF;

  -- Add ai_predicted_duration column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'ai_predicted_duration'
  ) THEN
    ALTER TABLE tasks ADD COLUMN ai_predicted_duration TEXT;
  END IF;

  -- Add blocks_task_ids column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'blocks_task_ids'
  ) THEN
    ALTER TABLE tasks ADD COLUMN blocks_task_ids UUID[];
  END IF;

  -- Add blocked_by_task_ids column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'blocked_by_task_ids'
  ) THEN
    ALTER TABLE tasks ADD COLUMN blocked_by_task_ids UUID[];
  END IF;
END $$;

-- Add indexes for task queries (only if columns exist)
CREATE INDEX IF NOT EXISTS idx_tasks_ai_priority_score ON tasks(ai_priority_score DESC NULLS LAST);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'status'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'due_date'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_tasks_status_due_date ON tasks(status, due_date ASC NULLS LAST);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'assigned_to'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
  END IF;
END $$;

-- ============================================
-- 3. TASK DEPENDENCIES TABLE (NEW)
-- ============================================

-- Create task dependencies table
CREATE TABLE IF NOT EXISTS task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type TEXT DEFAULT 'blocks', -- 'blocks' or 'relates_to'
  created_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT,
  UNIQUE(task_id, depends_on_task_id)
);

-- Add indexes for dependency queries
CREATE INDEX IF NOT EXISTS idx_task_dependencies_task_id ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on ON task_dependencies(depends_on_task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_type ON task_dependencies(dependency_type);

-- ============================================
-- 4. AI INSIGHTS CACHE TABLE (NEW)
-- ============================================

-- Cache AI-generated insights to reduce API calls
CREATE TABLE IF NOT EXISTS ai_insights_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, -- 'decision' or 'task'
  entity_id UUID NOT NULL,
  insight_type TEXT NOT NULL, -- 'risk_assessment', 'priority', 'suggestions', etc.
  insight_data JSONB NOT NULL,
  confidence_score DECIMAL(5,2),
  generated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  UNIQUE(entity_type, entity_id, insight_type)
);

-- Add indexes for cache lookups
CREATE INDEX IF NOT EXISTS idx_ai_insights_entity ON ai_insights_cache(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_expires ON ai_insights_cache(expires_at);

-- ============================================
-- 5. USER PREFERENCES FOR AI (NEW)
-- ============================================

-- Store user preferences for AI features
CREATE TABLE IF NOT EXISTS user_ai_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  ai_aggressiveness TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
  enable_auto_priority BOOLEAN DEFAULT true,
  enable_proactive_nudges BOOLEAN DEFAULT true,
  enable_ai_assistant BOOLEAN DEFAULT true,
  dismissed_nudges JSONB DEFAULT '[]', -- Array of dismissed nudge IDs
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add index for user lookups
CREATE INDEX IF NOT EXISTS idx_user_ai_preferences_user_id ON user_ai_preferences(user_id);

-- ============================================
-- 6. HELPER FUNCTIONS
-- ============================================

-- Function to get task dependencies (recursive)
CREATE OR REPLACE FUNCTION get_task_dependencies(task_uuid UUID)
RETURNS TABLE(
  task_id UUID,
  depends_on_id UUID,
  depth INTEGER,
  dependency_path UUID[]
) AS $$
WITH RECURSIVE dep_tree AS (
  -- Base case: direct dependencies
  SELECT
    td.task_id,
    td.depends_on_task_id AS depends_on_id,
    1 AS depth,
    ARRAY[task_uuid, td.depends_on_task_id] AS dependency_path
  FROM task_dependencies td
  WHERE td.task_id = task_uuid

  UNION ALL

  -- Recursive case: indirect dependencies
  SELECT
    dt.task_id,
    td.depends_on_task_id AS depends_on_id,
    dt.depth + 1,
    dt.dependency_path || td.depends_on_task_id
  FROM dep_tree dt
  JOIN task_dependencies td ON td.task_id = dt.depends_on_id
  WHERE NOT (td.depends_on_task_id = ANY(dt.dependency_path)) -- Prevent cycles
    AND dt.depth < 10 -- Limit depth
)
SELECT * FROM dep_tree;
$$ LANGUAGE SQL;

-- Function to get all tasks blocked by a task
CREATE OR REPLACE FUNCTION get_blocked_tasks(task_uuid UUID)
RETURNS TABLE(blocked_task_id UUID) AS $$
  SELECT task_id FROM task_dependencies WHERE depends_on_task_id = task_uuid;
$$ LANGUAGE SQL;

-- ============================================
-- 7. CLEANUP OLD INSIGHTS (MAINTENANCE)
-- ============================================

-- Function to clean up expired AI insights
CREATE OR REPLACE FUNCTION cleanup_expired_ai_insights()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM ai_insights_cache
  WHERE expires_at IS NOT NULL AND expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. TRIGGERS
-- ============================================

-- Update timestamp trigger for user preferences
CREATE OR REPLACE FUNCTION update_user_ai_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS trigger_update_user_ai_preferences_timestamp ON user_ai_preferences;
CREATE TRIGGER trigger_update_user_ai_preferences_timestamp
BEFORE UPDATE ON user_ai_preferences
FOR EACH ROW
EXECUTE FUNCTION update_user_ai_preferences_timestamp();

-- ============================================
-- 9. VERIFICATION
-- ============================================

-- Verify tables exist
DO $$
DECLARE
  tables_exist INTEGER;
BEGIN
  SELECT COUNT(*) INTO tables_exist
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('task_dependencies', 'ai_insights_cache', 'user_ai_preferences');

  RAISE NOTICE 'Migration completed! New tables created: %', tables_exist;
END $$;

-- List all new columns added
SELECT
  'decisions' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'decisions'
  AND column_name IN ('ai_risk_level', 'ai_predicted_completion', 'ai_suggested_stakeholders', 'ai_insights')

UNION ALL

SELECT
  'tasks' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'tasks'
  AND column_name IN ('ai_priority_score', 'ai_suggested_assignee', 'ai_predicted_duration', 'blocks_task_ids', 'blocked_by_task_ids');
