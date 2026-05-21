-- ============================================================
-- MIGRATION: 20260512000001_pulse_notes.sql
-- PURPOSE:   Pulse Capture layer — fast cross-surface note capture.
--            Replaces the "Journal-only" pattern with a workspace-scoped
--            notes table writable from anywhere (Cmd+J), readable by
--            dashboard, archives, war-room, summit, and search.
--
-- TABLE:     pulse_notes
-- RLS:       user_has_workspace_access(workspace_id) gates everything;
--            user_id must equal auth.uid() on INSERT.
--
-- DATE:      2026-05-12
-- SAFE:      Idempotent via IF NOT EXISTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pulse_notes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id    uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  content         text NOT NULL,
  content_html    text,

  -- Where the note was captured from. source_section is required so we can
  -- filter by surface; source_id is the in-section entity (thread, decision,
  -- summit-session, war-room id) when applicable.
  source_section  text NOT NULL DEFAULT 'global',
  source_id       text,
  source_url      text,

  -- Optional routing intent (matches the starter-chip semantics).
  kind            text CHECK (kind IS NULL OR kind IN (
                    'decision', 'learning', 'friction', 'question', 'task'
                  )),

  -- If the note was routed to another section, capture the link so we don't
  -- re-create downstream artifacts on subsequent edits.
  routed_task_id      uuid REFERENCES public.extracted_tasks(id) ON DELETE SET NULL,
  routed_decision_id  uuid REFERENCES public.decisions(id) ON DELETE SET NULL,

  tags            text[] NOT NULL DEFAULT '{}',
  ai_insight      text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  archived_at     timestamptz
);

-- Indexes for the three primary read patterns:
--   1. Workspace recents  → dashboard widget, archives list
--   2. Per-source filter  → war-room panel, summit panel, thread sidebar
--   3. Per-user           → 'my notes' anywhere
CREATE INDEX IF NOT EXISTS idx_pulse_notes_workspace_recent
  ON public.pulse_notes (workspace_id, created_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pulse_notes_source
  ON public.pulse_notes (workspace_id, source_section, source_id)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pulse_notes_user
  ON public.pulse_notes (user_id, created_at DESC)
  WHERE archived_at IS NULL;

-- Full-text search support: existing fulltext infra in Pulse uses generated tsv columns.
-- Add one for content so the search edge function can include captures.
ALTER TABLE public.pulse_notes
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;

CREATE INDEX IF NOT EXISTS idx_pulse_notes_search
  ON public.pulse_notes USING gin(search_tsv);

-- updated_at trigger (mirrors pattern in other Pulse tables)
CREATE OR REPLACE FUNCTION public.pulse_notes_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pulse_notes_updated_at ON public.pulse_notes;
CREATE TRIGGER trg_pulse_notes_updated_at
  BEFORE UPDATE ON public.pulse_notes
  FOR EACH ROW EXECUTE FUNCTION public.pulse_notes_touch_updated_at();

-- ────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.pulse_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pulse_notes_select" ON public.pulse_notes;
CREATE POLICY "pulse_notes_select"
  ON public.pulse_notes FOR SELECT
  USING (public.user_has_workspace_access(workspace_id));

DROP POLICY IF EXISTS "pulse_notes_insert" ON public.pulse_notes;
CREATE POLICY "pulse_notes_insert"
  ON public.pulse_notes FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND public.user_has_workspace_access(workspace_id)
  );

DROP POLICY IF EXISTS "pulse_notes_update" ON public.pulse_notes;
CREATE POLICY "pulse_notes_update"
  ON public.pulse_notes FOR UPDATE
  USING (user_id = auth.uid() AND public.user_has_workspace_access(workspace_id))
  WITH CHECK (user_id = auth.uid() AND public.user_has_workspace_access(workspace_id));

DROP POLICY IF EXISTS "pulse_notes_delete" ON public.pulse_notes;
CREATE POLICY "pulse_notes_delete"
  ON public.pulse_notes FOR DELETE
  USING (user_id = auth.uid() AND public.user_has_workspace_access(workspace_id));

COMMENT ON TABLE public.pulse_notes IS
  'Cross-surface capture layer. Cmd+J writes here from anywhere in Pulse; '
  'dashboard widget, archives, war-room panel, summit panel, and search '
  'all read from here. source_section/source_id record provenance.';
