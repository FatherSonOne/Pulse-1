-- ============================================================
-- MIGRATION: 20260524000003_phase_b_saved_filters.sql
-- PURPOSE:   Persist user-defined and workspace-shared contact filters.
--            predicate_json holds the serialized filter DSL — opaque
--            at the DB layer; savedFiltersService is authoritative
--            for shape.
--
-- DESIGN:
--   * workspace_id NULLABLE: NULL = personal filter (owner-only),
--     set = workspace-shared filter (member-visible).
--   * UPDATE: owner-only per Phase B CHECKPOINT. Peer admins can DELETE
--     a shared filter (cleanup path) but cannot edit predicate.
--   * TODO(phase-7): when Sub-PR 7 lands custom roles, add permission key
--     'saved_filters.edit' to public.permissions and switch the UPDATE
--     predicate to:
--       user_id = auth.uid()
--       OR (workspace_id IS NOT NULL
--           AND public.user_has_permission(workspace_id, 'saved_filters.edit'))
--   * updated_at maintained by trigger update_updated_at_column (existing
--     helper from 20260119062007).
--
-- DATE:      2026-05-24
-- SAFE:      New table; idempotent IF NOT EXISTS pattern.
-- ROLLBACK:
--   DROP TRIGGER  IF EXISTS saved_filters_touch_updated_at ON public.saved_filters;
--   DROP TABLE    IF EXISTS public.saved_filters CASCADE;
-- ============================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS public.saved_filters (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id)        ON DELETE CASCADE,
  workspace_id    uuid                 REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name            text        NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  predicate_json  jsonb       NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_filters_user
  ON public.saved_filters (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_filters_workspace
  ON public.saved_filters (workspace_id, updated_at DESC)
  WHERE workspace_id IS NOT NULL;

ALTER TABLE public.saved_filters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saved_filters_select ON public.saved_filters;
CREATE POLICY saved_filters_select
  ON public.saved_filters FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      workspace_id IS NOT NULL
      AND public.user_has_workspace_access(workspace_id)
    )
  );

DROP POLICY IF EXISTS saved_filters_insert ON public.saved_filters;
CREATE POLICY saved_filters_insert
  ON public.saved_filters FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      workspace_id IS NULL
      OR public.user_has_workspace_access(workspace_id)
    )
  );

DROP POLICY IF EXISTS saved_filters_update ON public.saved_filters;
CREATE POLICY saved_filters_update
  ON public.saved_filters FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS saved_filters_delete ON public.saved_filters;
CREATE POLICY saved_filters_delete
  ON public.saved_filters FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      workspace_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.workspace_members wm
         WHERE wm.workspace_id = saved_filters.workspace_id
           AND wm.user_id      = auth.uid()
           AND wm.role         IN ('owner', 'admin')
      )
    )
  );

CREATE TRIGGER saved_filters_touch_updated_at
  BEFORE UPDATE ON public.saved_filters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.saved_filters IS
  'User and workspace-scoped saved contact filter predicates. '
  'workspace_id NULL => personal filter (owner-only). '
  'workspace_id set => workspace-shared filter (member-visible, '
  'owner-editable). predicate_json shape is owned by '
  'savedFiltersService; DB stores it opaquely.';

COMMENT ON COLUMN public.saved_filters.predicate_json IS
  'Serialized filter DSL. Application-layer schema — DO NOT add a '
  'CHECK constraint here without coordinating with savedFiltersService.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_filters TO authenticated;

COMMIT;
