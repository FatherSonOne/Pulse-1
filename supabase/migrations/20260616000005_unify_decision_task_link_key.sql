-- Migration: 20260616000005_unify_decision_task_link_key.sql
-- Unify the decision<->task link metadata key (launch-readiness 1.5).
--
-- The wizard task-creation path (wizardSubmit.ts) wrote tasks with
-- metadata.linked_decision, but NOTHING reads that key — CockpitHub.linkedTaskCounts
-- and queueModel both key off metadata.generated_from_decision (also written by
-- DecisionDecomposer + seedSampleData). Result: wizard-origin tasks were silently
-- uncounted in the focal pane's "linked tasks" tally and not flagged as
-- decision-origin in the queue.
--
-- The writer is fixed in code to emit generated_from_decision going forward; this
-- migration backfills the existing rows so a single canonical key (generated_from_decision)
-- is used everywhere and the orphan linked_decision key is removed.
--
-- Verified live (2026-06-16): 6 rows have metadata ? 'linked_decision', 0 have
-- 'decision_id', 1 has 'generated_from_decision'. Guard avoids clobbering any row
-- that already carries the canonical key.

UPDATE public.extracted_tasks
SET metadata = (metadata - 'linked_decision')
               || jsonb_build_object('generated_from_decision', metadata -> 'linked_decision')
WHERE metadata ? 'linked_decision'
  AND NOT (metadata ? 'generated_from_decision');

-- Any remaining row that somehow had BOTH keys: just drop the orphan, keep the
-- canonical value already present.
UPDATE public.extracted_tasks
SET metadata = metadata - 'linked_decision'
WHERE metadata ? 'linked_decision';
