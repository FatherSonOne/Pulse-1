-- ============================================================
-- MIGRATION: 20260309000100_audit_fix_ai_lab_rls.sql
-- PURPOSE:   Add WITH CHECK to ai_lab_* RLS policies.
--            Original policies used FOR ALL USING (...) without
--            WITH CHECK, allowing authenticated users to insert/update
--            rows with a different user_id.
-- ISSUE:     C-4 from 2026-03-09 database audit
-- SAFE:      Idempotent via DROP IF EXISTS
-- ============================================================

BEGIN;

-- ── ai_lab_workflows ────────────────────────────────────────

DROP POLICY IF EXISTS "Users manage own workflows" ON public.ai_lab_workflows;

CREATE POLICY "Users manage own workflows"
  ON public.ai_lab_workflows
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── ai_lab_templates ────────────────────────────────────────

DROP POLICY IF EXISTS "Users manage own templates" ON public.ai_lab_templates;

CREATE POLICY "Users manage own templates"
  ON public.ai_lab_templates
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── ai_lab_outputs ──────────────────────────────────────────

DROP POLICY IF EXISTS "Users manage own outputs" ON public.ai_lab_outputs;

CREATE POLICY "Users manage own outputs"
  ON public.ai_lab_outputs
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMIT;
