-- Migration: Add description column to decisions table
-- Date: 2026-02-23
-- Purpose: Add missing description field for decision context

-- Add description column
ALTER TABLE decisions
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add index for text search on descriptions
CREATE INDEX IF NOT EXISTS idx_decisions_description
ON decisions USING gin(to_tsvector('english', description))
WHERE description IS NOT NULL;

-- Comment on the column
COMMENT ON COLUMN decisions.description IS 'Detailed description and context for the decision';
