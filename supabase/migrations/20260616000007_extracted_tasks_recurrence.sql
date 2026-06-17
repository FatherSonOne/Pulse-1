-- Migration: 20260616000007_extracted_tasks_recurrence.sql
-- Recurring tasks via RFC-5545 RRULE (launch-readiness 2d — table-stakes gap).
--
-- Model: a task carries an RRULE string. When a recurring task is COMPLETED, the
-- client spawns the next occurrence (client-side regeneration — matches how Pulse
-- already expands calendar recurrence). recurrence_parent_id links each spawned
-- instance back to the originating series for grouping/filtering.
--
-- RLS unchanged — the workspace policies on extracted_tasks already gate these
-- new columns. Verified live: extracted_tasks has no existing recurrence column.

ALTER TABLE public.extracted_tasks
  ADD COLUMN IF NOT EXISTS recurrence_rule text,
  ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid;

CREATE INDEX IF NOT EXISTS idx_extracted_tasks_recurrence_parent
  ON public.extracted_tasks(recurrence_parent_id)
  WHERE recurrence_parent_id IS NOT NULL;
