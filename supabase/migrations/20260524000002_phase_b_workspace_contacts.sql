-- ============================================================
-- MIGRATION: 20260524000002_phase_b_workspace_contacts.sql
-- PURPOSE:   Allow a user to elevate one of their personal contacts
--            into a workspace-shared row. The contact stays owned by
--            the original user (contacts.user_id is unchanged); a JOIN
--            row in workspace_contacts marks it as visible-to-workspace.
--
-- DESIGN:
--   * One contact may be shared into many workspaces — composite PK on
--     (workspace_id, contact_id) gives natural dedup + cascade.
--   * shared_by uses ON DELETE SET NULL per CHECKPOINT — when a user is
--     removed from auth, the audit trail "this contact was shared by
--     someone" is preserved; only the actor identity is lost.
--   * RLS critical: contacts.contacts_owner_all gates the underlying
--     contacts row by user_id = auth.uid()::text. A workspace peer
--     CAN read the workspace_contacts JOIN row but CANNOT read the
--     contacts.* columns directly — contacts RLS blocks it. Application
--     layer (workspaceContactsService.listWorkspaceContacts) MUST
--     explicitly SELECT only safe columns: id, name, email, avatar_color,
--     role, vip — NEVER notes / case_notes / phone / address.
--   * INSERT predicate: caller must be workspace member AND contact
--     owner. NB: contacts.user_id is TEXT, so cast auth.uid()::text.
--   * DELETE predicate: original sharer OR workspace owner/admin.
--
-- DATE:      2026-05-24
-- SAFE:      New table; idempotent IF NOT EXISTS pattern.
-- ROLLBACK:  DROP TABLE public.workspace_contacts CASCADE;
-- ============================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS public.workspace_contacts (
  workspace_id  uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id    uuid        NOT NULL REFERENCES public.contacts(id)   ON DELETE CASCADE,
  shared_by     uuid                 REFERENCES auth.users(id)        ON DELETE SET NULL,
  shared_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_contacts_by_contact
  ON public.workspace_contacts (contact_id);

CREATE INDEX IF NOT EXISTS idx_workspace_contacts_by_workspace
  ON public.workspace_contacts (workspace_id, shared_at DESC);

ALTER TABLE public.workspace_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_contacts_select ON public.workspace_contacts;
CREATE POLICY workspace_contacts_select
  ON public.workspace_contacts FOR SELECT
  TO authenticated
  USING (
    public.user_has_workspace_access(workspace_id)
  );

DROP POLICY IF EXISTS workspace_contacts_insert ON public.workspace_contacts;
CREATE POLICY workspace_contacts_insert
  ON public.workspace_contacts FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_workspace_access(workspace_id)
    AND shared_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.contacts c
       WHERE c.id      = contact_id
         AND c.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS workspace_contacts_delete ON public.workspace_contacts;
CREATE POLICY workspace_contacts_delete
  ON public.workspace_contacts FOR DELETE
  TO authenticated
  USING (
    public.user_has_workspace_access(workspace_id)
    AND (
      shared_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.workspace_members wm
         WHERE wm.workspace_id = workspace_contacts.workspace_id
           AND wm.user_id      = auth.uid()
           AND wm.role         IN ('owner', 'admin')
      )
    )
  );

COMMENT ON TABLE public.workspace_contacts IS
  'JOIN table mapping personal contacts to workspaces they have been '
  'shared into. Owner-gated INSERT (only the contacts row owner can '
  'share). Audit-preserving DELETE (sharer OR workspace admin). '
  'Critical: this table only exposes WHICH contact is shared. The '
  'underlying contacts row is still gated by contacts_owner_all RLS — '
  'workspace peers must read it via the application service layer '
  'which projects only the safe-to-share columns.';

COMMENT ON COLUMN public.workspace_contacts.shared_by IS
  'auth.users.id of the user who shared. ON DELETE SET NULL preserves '
  'the audit trail when a user is removed from the workspace. UI must '
  'render "Shared by (former member)" when this is NULL.';

GRANT SELECT, INSERT, DELETE ON public.workspace_contacts TO authenticated;

COMMIT;
