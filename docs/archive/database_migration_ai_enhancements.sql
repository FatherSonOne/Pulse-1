-- Database Migration for AI-Enhanced Decisions & Tasks
-- Version: 1.0
-- Date: 2026-01-21
-- Description: Add AI insights, priorities, and dependency tracking

-- ============================================
-- 1. DECISIONS TABLE ENHANCEMENTS
-- ============================================

-- Add AI-related columns to decisions table
ALTER TABLE decisions
ADD COLUMN IF NOT EXISTS ai_risk_level TEXT DEFAULT 'low',
ADD COLUMN IF NOT EXISTS ai_predicted_completion TIMESTAMP,
ADD COLUMN IF NOT EXISTS ai_suggested_stakeholders TEXT[],
ADD COLUMN IF NOT EXISTS ai_insights JSONB DEFAULT '{}';

-- Add index for AI queries
CREATE INDEX IF NOT EXISTS idx_decisions_ai_risk_level ON decisions(ai_risk_level);
CREATE INDEX IF NOT EXISTS idx_decisions_status_created ON decisions(status, created_at DESC);

-- ============================================
-- 2. TASKS TABLE ENHANCEMENTS
-- ============================================

-- Add AI priority and dependency columns
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS ai_priority_score DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS ai_suggested_assignee TEXT,
ADD COLUMN IF NOT EXISTS ai_predicted_duration TEXT,
ADD COLUMN IF NOT EXISTS blocks_task_ids UUID[],
ADD COLUMN IF NOT EXISTS blocked_by_task_ids UUID[];

-- Add indexes for task queries
CREATE INDEX IF NOT EXISTS idx_tasks_ai_priority_score ON tasks(ai_priority_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_tasks_status_due_date ON tasks(status, due_date ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);

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

-- Optional: Cache AI-generated insights to reduce API calls
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

CREATE TRIGGER trigger_update_user_ai_preferences_timestamp
BEFORE UPDATE ON user_ai_preferences
FOR EACH ROW
EXECUTE FUNCTION update_user_ai_preferences_timestamp();

-- ============================================
-- 9. SAMPLE DATA (OPTIONAL - FOR TESTING)
-- ============================================

-- Insert default AI preferences for existing users (optional)
-- INSERT INTO user_ai_preferences (user_id)
-- SELECT DISTINCT created_by FROM decisions
-- WHERE created_by IS NOT NULL
-- ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- 10. ROLLBACK INSTRUCTIONS (IF NEEDED)
-- ============================================

/*
-- To rollback this migration:

-- Drop new tables
DROP TABLE IF EXISTS ai_insights_cache CASCADE;
DROP TABLE IF EXISTS task_dependencies CASCADE;
DROP TABLE IF EXISTS user_ai_preferences CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS get_task_dependencies(UUID);
DROP FUNCTION IF EXISTS get_blocked_tasks(UUID);
DROP FUNCTION IF EXISTS cleanup_expired_ai_insights();
DROP FUNCTION IF EXISTS update_user_ai_preferences_timestamp();

-- Remove columns from decisions
ALTER TABLE decisions
DROP COLUMN IF EXISTS ai_risk_level,
DROP COLUMN IF EXISTS ai_predicted_completion,
DROP COLUMN IF EXISTS ai_suggested_stakeholders,
DROP COLUMN IF EXISTS ai_insights;

-- Remove columns from tasks
ALTER TABLE tasks
DROP COLUMN IF EXISTS ai_priority_score,
DROP COLUMN IF EXISTS ai_suggested_assignee,
DROP COLUMN IF EXISTS ai_predicted_duration,
DROP COLUMN IF EXISTS blocks_task_ids,
DROP COLUMN IF EXISTS blocked_by_task_ids;
*/

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Verify tables exist
SELECT 'Migration completed successfully!' AS status;
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('task_dependencies', 'ai_insights_cache', 'user_ai_preferences');
