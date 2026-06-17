-- Migration: 20260616000008_decisions_scoring_matrix.sql
-- Weighted-criteria decision matrix (launch-readiness 3d).
--
-- A self-contained scoring matrix per decision: { options, criteria (weighted),
-- scores }. Stored in its own jsonb column rather than reusing decisions.options/
-- criteria (which the wizard frames own with different shapes) to avoid collisions.
-- RLS unchanged — the workspace policies on decisions already gate this column.

ALTER TABLE public.decisions
  ADD COLUMN IF NOT EXISTS scoring_matrix jsonb;
