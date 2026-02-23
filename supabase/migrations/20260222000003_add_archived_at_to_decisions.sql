-- Migration: Add archived_at column to decisions table
-- Phase 4: Archive functionality for decisions
-- Date: 2026-02-22

-- Add archived_at column to decisions table
ALTER TABLE decisions
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Create index for efficient archive queries
CREATE INDEX IF NOT EXISTS idx_decisions_archived_at
ON decisions(workspace_id, archived_at)
WHERE archived_at IS NOT NULL;

-- Create index for active (non-archived) decisions
CREATE INDEX IF NOT EXISTS idx_decisions_active
ON decisions(workspace_id, status)
WHERE archived_at IS NULL;

-- Comment on the column
COMMENT ON COLUMN decisions.archived_at IS 'Timestamp when the decision was archived. NULL for active decisions.';
