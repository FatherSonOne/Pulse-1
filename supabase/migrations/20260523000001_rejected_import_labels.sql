-- ============================================================
-- MIGRATION: 20260523000001_rejected_import_labels.sql
-- PURPOSE:   Persist user-level rejection of contact-import labels
--            (Google contactGroups, Outlook categories). Drives the
--            FR-4 re-auth filter — rejected labels never re-appear
--            in the import picker until explicitly un-rejected.
--
-- TABLE:     rejected_import_labels
-- SCOPE:     Per (user, workspace, source, label). A user who rejects
--            "Newsletters" in workspace A may still see it in workspace B.
-- RLS:       SELECT/INSERT/DELETE gated by
--            auth.uid() = user_id AND user_has_workspace_access(workspace_id).
--            No UPDATE policy (un-rejection is INSERT-then-DELETE; no
--            mutable columns in Phase A).
--
-- DATE:      2026-05-23
-- SAFE:      Idempotent via IF NOT EXISTS; no data backfill.
-- ROLLBACK:  DROP TABLE public.rejected_import_labels CASCADE;
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.rejected_import_labels (
  user_id         uuid        NOT NULL REFERENCES auth.users(id)       ON DELETE CASCADE,
  workspace_id    uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source          text        NOT NULL CHECK (source IN ('google', 'microsoft')),
  label_id        text        NOT NULL CHECK (label_id NOT LIKE 'contactGroups/%'),
  label_display   text,
  rejected_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, workspace_id, source, label_id)
);

CREATE INDEX IF NOT EXISTS idx_rejected_import_labels_by_label
  ON public.rejected_import_labels (workspace_id, source, label_id);

ALTER TABLE public.rejected_import_labels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rejected_import_labels_select ON public.rejected_import_labels;
CREATE POLICY rejected_import_labels_select
  ON public.rejected_import_labels FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND public.user_has_workspace_access(workspace_id)
  );

DROP POLICY IF EXISTS rejected_import_labels_insert ON public.rejected_import_labels;
CREATE POLICY rejected_import_labels_insert
  ON public.rejected_import_labels FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.user_has_workspace_access(workspace_id)
  );

DROP POLICY IF EXISTS rejected_import_labels_delete ON public.rejected_import_labels;
CREATE POLICY rejected_import_labels_delete
  ON public.rejected_import_labels FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND public.user_has_workspace_access(workspace_id)
  );

COMMENT ON TABLE public.rejected_import_labels IS
  'Per-user, per-workspace rejected contact-import label registry. Drives '
  'the re-auth filter: labels listed here never resurface in the import '
  'picker. Scoped per workspace so a user can selectively import the same '
  'Google contactGroup into one workspace while suppressing it in another.';

COMMENT ON COLUMN public.rejected_import_labels.label_id IS
  'Google: bare numeric contactGroups id (NOT the full contactGroups/<id> '
  'resource name — strip via getContactGroups() before write). '
  'Microsoft: Outlook category string verbatim. CHECK constraint enforces.';

COMMENT ON COLUMN public.rejected_import_labels.label_display IS
  'Snapshot of human-readable label name at rejection time. Used by the UI '
  'rejected-labels audit list; not authoritative — remote name may have drifted.';

GRANT SELECT, INSERT, DELETE ON public.rejected_import_labels TO authenticated;

COMMIT;
