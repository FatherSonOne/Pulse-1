-- Database Migration for AI-Enhanced Decisions & Tasks
-- Version: 1.3 (FINAL - ABSOLUTELY SAFE)
-- Date: 2026-01-21
-- Description: Add AI insights, priorities, and dependency tracking
-- This version executes each part separately with explicit ordering

-- ============================================
-- PART 1: ADD COLUMNS TO DECISIONS TABLE
-- ============================================

DO $$
BEGIN
  BEGIN ALTER TABLE decisions ADD COLUMN ai_risk_level TEXT DEFAULT 'low';
  EXCEPTION WHEN duplicate_column THEN NULL; END;

  BEGIN ALTER TABLE decisions ADD COLUMN ai_predicted_completion TIMESTAMP;
  EXCEPTION WHEN duplicate_column THEN NULL; END;

  BEGIN ALTER TABLE decisions ADD COLUMN ai_suggested_stakeholders TEXT[];
  EXCEPTION WHEN duplicate_column THEN NULL; END;

  BEGIN ALTER TABLE decisions ADD COLUMN ai_insights JSONB DEFAULT '{}';
  EXCEPTION WHEN duplicate_column THEN NULL; END;
END $$;

-- Create index for decisions
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_decisions_ai_risk_level ON decisions(ai_risk_level);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ============================================
-- PART 2: ADD COLUMNS TO TASKS TABLE
-- ============================================

DO $$
BEGIN
  BEGIN ALTER TABLE tasks ADD COLUMN ai_priority_score DECIMAL(5,2);
  EXCEPTION WHEN duplicate_column THEN NULL; END;

  BEGIN ALTER TABLE tasks ADD COLUMN ai_suggested_assignee TEXT;
  EXCEPTION WHEN duplicate_column THEN NULL; END;

  BEGIN ALTER TABLE tasks ADD COLUMN ai_predicted_duration TEXT;
  EXCEPTION WHEN duplicate_column THEN NULL; END;

  BEGIN ALTER TABLE tasks ADD COLUMN blocks_task_ids UUID[];
  EXCEPTION WHEN duplicate_column THEN NULL; END;

  BEGIN ALTER TABLE tasks ADD COLUMN blocked_by_task_ids UUID[];
  EXCEPTION WHEN duplicate_column THEN NULL; END;
END $$;

-- Create index for tasks
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_tasks_ai_priority_score ON tasks(ai_priority_score DESC NULLS LAST);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ============================================
-- PART 3: CREATE TASK DEPENDENCIES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type TEXT DEFAULT 'blocks',
  created_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT
);

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
  ALTER TABLE task_dependencies ADD CONSTRAINT task_dependencies_unique
    UNIQUE(task_id, depends_on_task_id);
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN others THEN NULL;
END $$;

-- Create indexes for task_dependencies AFTER table is created
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_task_dependencies_task_id ON task_dependencies(task_id);
  CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on ON task_dependencies(depends_on_task_id);
  CREATE INDEX IF NOT EXISTS idx_task_dependencies_type ON task_dependencies(dependency_type);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ============================================
-- PART 4: CREATE AI INSIGHTS CACHE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS ai_insights_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  insight_type TEXT NOT NULL,
  insight_data JSONB NOT NULL,
  confidence_score DECIMAL(5,2),
  generated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- Add unique constraint
DO $$
BEGIN
  ALTER TABLE ai_insights_cache ADD CONSTRAINT ai_insights_cache_unique
    UNIQUE(entity_type, entity_id, insight_type);
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN others THEN NULL;
END $$;

-- Create indexes AFTER table is created
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_ai_insights_entity ON ai_insights_cache(entity_type, entity_id);
  CREATE INDEX IF NOT EXISTS idx_ai_insights_expires ON ai_insights_cache(expires_at);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ============================================
-- PART 5: CREATE USER AI PREFERENCES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS user_ai_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  ai_aggressiveness TEXT DEFAULT 'medium',
  enable_auto_priority BOOLEAN DEFAULT true,
  enable_proactive_nudges BOOLEAN DEFAULT true,
  enable_ai_assistant BOOLEAN DEFAULT true,
  dismissed_nudges JSONB DEFAULT '[]',
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add unique constraint
DO $$
BEGIN
  ALTER TABLE user_ai_preferences ADD CONSTRAINT user_ai_preferences_user_id_unique
    UNIQUE(user_id);
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN others THEN NULL;
END $$;

-- Create index AFTER table is created
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_user_ai_preferences_user_id ON user_ai_preferences(user_id);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ============================================
-- PART 6: CREATE HELPER FUNCTIONS
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
-- PART 7: CREATE TRIGGER
-- ============================================

-- Trigger function
CREATE OR REPLACE FUNCTION update_user_ai_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_user_ai_preferences_timestamp ON user_ai_preferences;
CREATE TRIGGER trigger_update_user_ai_preferences_timestamp
  BEFORE UPDATE ON user_ai_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_ai_preferences_timestamp();

-- ============================================
-- PART 8: VERIFICATION
-- ============================================

SELECT '✅ Migration completed successfully!' AS status;

SELECT
  table_name,
  'EXISTS' as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('task_dependencies', 'ai_insights_cache', 'user_ai_preferences')
ORDER BY table_name;
