-- Drop the orphaned test_matrix_results table.
--
-- The TestMatrix UI (src/components/TestMatrix.tsx) was a manual pre-launch
-- QA checklist that has been removed. The backing table held
-- per-user pass/fail/notes for each checklist item. With the UI gone, the
-- table cannot be read or written by any client — drop it to keep the schema
-- honest.
--
-- Idempotent: uses IF EXISTS so re-running on environments that have already
-- been pruned is a no-op. Cascade drops the dependent indexes and policies.

DROP TABLE IF EXISTS public.test_matrix_results CASCADE;
