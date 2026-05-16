-- 20260521000010_places_rls_to_user_has_permission.sql
-- Issue #42 Sub-PR 4f — migrate places + entity_places policies that gate on
-- workspace_members.role to user_has_permission(workspace_id, 'workspace.update').
--
-- Policies migrated
--   places.places_update          (UPDATE)
--   places.places_delete          (DELETE)
--   entity_places.entity_places_delete (DELETE; joins via places.workspace_id)
--
-- Policies untouched
--   places.places_select  / places_insert        — personal or membership only
--   entity_places.entity_places_select / _insert — same
--
-- Per catalog seed: owner + admin have workspace.update; member + viewer don't.
-- Personal places (workspace_id IS NULL, owner_user_id = caller) are preserved
-- verbatim — those are individual user resources, not workspace ones.
--
-- WITH CHECK on places_update added (hardening)
--   Original had USING only; add WITH CHECK = USING so post-update row stays
--   visible to caller. Matches pattern from 4a/4b/4d/4e.

BEGIN;

DROP POLICY IF EXISTS places_update ON public.places;
CREATE POLICY places_update
  ON public.places
  FOR UPDATE
  TO authenticated
  USING (
    (workspace_id IS NULL AND owner_user_id = auth.uid()::text)
    OR (
      workspace_id IS NOT NULL
      AND (
        owner_user_id = auth.uid()::text
        OR public.user_has_permission(workspace_id, 'workspace.update')
      )
    )
  )
  WITH CHECK (
    (workspace_id IS NULL AND owner_user_id = auth.uid()::text)
    OR (
      workspace_id IS NOT NULL
      AND (
        owner_user_id = auth.uid()::text
        OR public.user_has_permission(workspace_id, 'workspace.update')
      )
    )
  );

DROP POLICY IF EXISTS places_delete ON public.places;
CREATE POLICY places_delete
  ON public.places
  FOR DELETE
  TO authenticated
  USING (
    (workspace_id IS NULL AND owner_user_id = auth.uid()::text)
    OR (
      workspace_id IS NOT NULL
      AND (
        owner_user_id = auth.uid()::text
        OR public.user_has_permission(workspace_id, 'workspace.update')
      )
    )
  );

DROP POLICY IF EXISTS entity_places_delete ON public.entity_places;
CREATE POLICY entity_places_delete
  ON public.entity_places
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.places p
       WHERE p.id = entity_places.place_id
         AND (
           (p.workspace_id IS NULL AND p.owner_user_id = auth.uid()::text)
           OR (
             p.workspace_id IS NOT NULL
             AND public.user_has_permission(p.workspace_id, 'workspace.update')
           )
         )
    )
  );

COMMIT;
