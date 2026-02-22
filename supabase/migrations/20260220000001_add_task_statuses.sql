-- Migration: Add new task statuses and columns for Phase 1
-- Adds 'in_review' and 'blocked' to allowed task statuses
-- Adds blocked_reason, blocked_at, and archived_at columns

-- For extracted_tasks (workspace-scoped, primary table for DecisionTaskHub):
-- Drop existing constraint if present
ALTER TABLE extracted_tasks DROP CONSTRAINT IF EXISTS extracted_tasks_status_check;

-- Add new constraint with expanded status options
-- existing: 'pending', now adding: 'todo', 'in_progress', 'in_review', 'blocked', 'done', 'cancelled'
ALTER TABLE extracted_tasks ADD CONSTRAINT extracted_tasks_status_check
  CHECK (status IN ('pending', 'todo', 'in_progress', 'in_review', 'blocked', 'done', 'cancelled'));

-- Add blocked_reason column for when tasks are blocked
ALTER TABLE extracted_tasks ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

-- Add blocked_at timestamp
ALTER TABLE extracted_tasks ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;

-- Add archived_at timestamp for auto-archive functionality
ALTER TABLE extracted_tasks ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Also add workspace_id to the legacy tasks table to bridge the gap
-- This allows gradual migration from tasks to extracted_tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS workspace_id UUID;

-- Add status column to legacy tasks table to match extracted_tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'todo';

-- Add description column to legacy tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT;

-- Add completed_at column to legacy tasks table if not exists
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Add metadata column to legacy tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add index on status for efficient filtering
CREATE INDEX IF NOT EXISTS idx_extracted_tasks_status ON extracted_tasks(status);
CREATE INDEX IF NOT EXISTS idx_extracted_tasks_workspace_status ON extracted_tasks(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_extracted_tasks_archived ON extracted_tasks(archived_at) WHERE archived_at IS NOT NULL;

-- Add comment explaining the migration path
COMMENT ON TABLE extracted_tasks IS 'Primary task table for workspace-scoped tasks. Use this for DecisionTaskHub.';
COMMENT ON TABLE tasks IS 'Legacy task table. Being phased out in favor of extracted_tasks.';
