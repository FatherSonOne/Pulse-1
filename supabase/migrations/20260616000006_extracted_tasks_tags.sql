-- Migration: 20260616000006_extracted_tasks_tags.sql
-- Free-text labels/tags for tasks (launch-readiness 2d — table-stakes gap).
--
-- Adds a text[] tags column to extracted_tasks (free-text, no separate registry)
-- plus a GIN index for future server-side tag queries. RLS is unchanged — the
-- existing workspace-based policies on extracted_tasks already gate the rows;
-- a new column inherits them.
--
-- Verified live (2026-06-16): extracted_tasks has no existing tag/label column.

ALTER TABLE public.extracted_tasks
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_extracted_tasks_tags
  ON public.extracted_tasks USING gin (tags);
