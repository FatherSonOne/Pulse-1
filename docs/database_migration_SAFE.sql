-- Database Migration for AI-Enhanced Decisions & Tasks
-- Version: 1.2 (ULTRA SAFE)
-- Date: 2026-01-21
-- Description: Add AI insights, priorities, and dependency tracking
-- This version uses the safest possible approach with explicit error handling

-- ============================================
-- PART 1: ADD COLUMNS TO EXISTING TABLES
-- ============================================

-- Add AI columns to decisions table
DO $$
BEGIN
  BEGIN
    ALTER TABLE decisions ADD COLUMN ai_risk_level TEXT DEFAULT 'low';
  EXCEPTION
    WHEN duplicate_column THEN
      RAISE NOTICE 'Column ai_risk_level already exists in decisions';
  END;

  BEGIN
    ALTER TABLE decisions ADD COLUMN ai_predicted_completion TIMESTAMP;
  EXCEPTION
    WHEN duplicate_column THEN
      RAISE NOTICE 'Column ai_predicted_completion already exists in decisions';
  END;

  BEGIN
    ALTER TABLE decisions ADD COLUMN ai_suggested_stakeholders TEXT[];
  EXCEPTION
    WHEN duplicate_column THEN
      RAISE NOTICE 'Column ai_suggested_stakeholders already exists in decisions';
  END;

  BEGIN
    ALTER TABLE decisions ADD COLUMN ai_insights JSONB DEFAULT '{}';
  EXCEPTION
    WHEN duplicate_column THEN
      RAISE NOTICE 'Column ai_insights already exists in decisions';
  END;

  RAISE NOTICE 'Decisions table AI columns added successfully';
END $$;

-- Add AI columns to tasks table
DO $$
BEGIN
  BEGIN
    ALTER TABLE tasks ADD COLUMN ai_priority_score DECIMAL(5,2);
  EXCEPTION
    WHEN duplicate_column THEN
      RAISE NOTICE 'Column ai_priority_score already exists in tasks';
  END;

  BEGIN
    ALTER TABLE tasks ADD COLUMN ai_suggested_assignee TEXT;
  EXCEPTION
    WHEN duplicate_column THEN
      RAISE NOTICE 'Column ai_suggested_assignee already exists in tasks';
  END;

  BEGIN
    ALTER TABLE tasks ADD COLUMN ai_predicted_duration TEXT;
  EXCEPTION
    WHEN duplicate_column THEN
      RAISE NOTICE 'Column ai_predicted_duration already exists in tasks';
  END;

  BEGIN
    ALTER TABLE tasks ADD COLUMN blocks_task_ids UUID[];
  EXCEPTION
    WHEN duplicate_column THEN
      RAISE NOTICE 'Column blocks_task_ids already exists in tasks';
  END;

  BEGIN
    ALTER TABLE tasks ADD COLUMN blocked_by_task_ids UUID[];
  EXCEPTION
    WHEN duplicate_column THEN
      RAISE NOTICE 'Column blocked_by_task_ids already exists in tasks';
  END;

  RAISE NOTICE 'Tasks table AI columns added successfully';
END $$;

-- ============================================
-- PART 2: CREATE NEW TABLES
-- ============================================

-- Create task dependencies table
DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS task_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    dependency_type TEXT DEFAULT 'blocks',
    created_at TIMESTAMP DEFAULT NOW(),
    created_by TEXT,
    UNIQUE(task_id, depends_on_task_id)
  );
  RAISE NOTICE 'task_dependencies table created';
EXCEPTION
  WHEN duplicate_table THEN
    RAISE NOTICE 'task_dependencies table already exists';
END $$;

-- Create AI insights cache table
DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS ai_insights_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    insight_type TEXT NOT NULL,
    insight_data JSONB NOT NULL,
    confidence_score DECIMAL(5,2),
    generated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    UNIQUE(entity_type, entity_id, insight_type)
  );
  RAISE NOTICE 'ai_insights_cache table created';
EXCEPTION
  WHEN duplicate_table THEN
    RAISE NOTICE 'ai_insights_cache table already exists';
END $$;

-- Create user AI preferences table
DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS user_ai_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL UNIQUE,
    ai_aggressiveness TEXT DEFAULT 'medium',
    enable_auto_priority BOOLEAN DEFAULT true,
    enable_proactive_nudges BOOLEAN DEFAULT true,
    enable_ai_assistant BOOLEAN DEFAULT true,
    dismissed_nudges JSONB DEFAULT '[]',
    updated_at TIMESTAMP DEFAULT NOW()
  );
  RAISE NOTICE 'user_ai_preferences table created';
EXCEPTION
  WHEN duplicate_table THEN
    RAISE NOTICE 'user_ai_preferences table already exists';
END $$;

-- ============================================
-- PART 3: CREATE INDEXES
-- ============================================

-- Indexes for decisions
CREATE INDEX IF NOT EXISTS idx_decisions_ai_risk_level ON decisions(ai_risk_level);

-- Indexes for tasks
CREATE INDEX IF NOT EXISTS idx_tasks_ai_priority_score ON tasks(ai_priority_score DESC NULLS LAST);

-- Indexes for task_dependencies
CREATE INDEX IF NOT EXISTS idx_task_dependencies_task_id ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on ON task_dependencies(depends_on_task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_type ON task_dependencies(dependency_type);

-- Indexes for ai_insights_cache
CREATE INDEX IF NOT EXISTS idx_ai_insights_entity ON ai_insights_cache(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_expires ON ai_insights_cache(expires_at);

-- Index for user_ai_preferences
CREATE INDEX IF NOT EXISTS idx_user_ai_preferences_user_id ON user_ai_preferences(user_id);

-- ============================================
-- PART 4: CREATE FUNCTIONS
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
  SELECT
    td.task_id,
    td.depends_on_task_id AS depends_on_id,
    1 AS depth,
    ARRAY[task_uuid, td.depends_on_task_id] AS dependency_path
  FROM task_dependencies td
  WHERE td.task_id = task_uuid

  UNION ALL

  SELECT
    dt.task_id,
    td.depends_on_task_id AS depends_on_id,
    dt.depth + 1,
    dt.dependency_path || td.depends_on_task_id
  FROM dep_tree dt
  JOIN task_dependencies td ON td.task_id = dt.depends_on_id
  WHERE NOT (td.depends_on_task_id = ANY(dt.dependency_path))
    AND dt.depth < 10
)
SELECT * FROM dep_tree;
$$ LANGUAGE SQL STABLE;

-- Function to get blocked tasks
CREATE OR REPLACE FUNCTION get_blocked_tasks(task_uuid UUID)
RETURNS TABLE(blocked_task_id UUID) AS $$
  SELECT task_id FROM task_dependencies WHERE depends_on_task_id = task_uuid;
$$ LANGUAGE SQL STABLE;

-- Function to clean up expired insights
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
-- PART 5: CREATE TRIGGER
-- ============================================

-- Trigger function for user preferences timestamp
CREATE OR REPLACE FUNCTION update_user_ai_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS trigger_update_user_ai_preferences_timestamp ON user_ai_preferences;
CREATE TRIGGER trigger_update_user_ai_preferences_timestamp
  BEFORE UPDATE ON user_ai_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_ai_preferences_timestamp();

-- ============================================
-- PART 6: VERIFICATION
-- ============================================

-- Show what was created
SELECT 'Migration completed successfully!' AS status;

-- Count new tables
SELECT
  COUNT(*) as new_tables_count,
  array_agg(table_name) as table_names
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('task_dependencies', 'ai_insights_cache', 'user_ai_preferences');

-- Show new columns in decisions
SELECT
  'DECISIONS TABLE COLUMNS' as info,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'decisions'
  AND column_name LIKE 'ai_%'
ORDER BY ordinal_position;

-- Show new columns in tasks
SELECT
  'TASKS TABLE COLUMNS' as info,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'tasks'
  AND column_name IN ('ai_priority_score', 'ai_suggested_assignee', 'ai_predicted_duration', 'blocks_task_ids', 'blocked_by_task_ids')
ORDER BY ordinal_position;
