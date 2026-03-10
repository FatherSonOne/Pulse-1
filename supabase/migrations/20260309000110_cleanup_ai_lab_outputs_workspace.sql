-- ============================================================
-- MIGRATION: 20260309000110_cleanup_ai_lab_outputs_workspace.sql
-- PURPOSE:   Drop the unused ai_lab_outputs.workspace TEXT column.
--            The column was plain text with no FK to workspaces.id
--            and is not read or written by any frontend service.
--            Any non-null values are preserved in the existing
--            metadata JSONB column before the column is dropped.
-- ISSUE:     H-3 from 2026-03-09 database audit
-- SAFE:      Only drops the column — no RLS or trigger changes
-- ============================================================

BEGIN;

-- Drop the column if it exists (no-op if already removed)
ALTER TABLE public.ai_lab_outputs
    DROP COLUMN IF EXISTS workspace;

COMMIT;
