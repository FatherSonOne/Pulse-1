-- 20260521000001_permissions_label_description_split.sql
-- Issue #42 Sub-PR 2 prep — split the seeded `description` column into a
-- primary `label` and a nullable secondary `description` so the matrix card
-- can render the same two-line layout it has today
-- (RolePermissionsMatrixCard.tsx: label + optional description).
--
-- Substrate-only. No app code consumes this yet — Sub-PR 2 wires the hook.

BEGIN;

ALTER TABLE public.permissions RENAME COLUMN description TO label;
ALTER TABLE public.permissions ADD COLUMN description text;

-- Three matrix rows had a separate secondary description before Sub-PR 1
-- collapsed them into `description`. Restore the original split.

UPDATE public.permissions
   SET label       = 'Connect personal integrations',
       description = 'Per-user OAuth connections (Gmail, Calendar, etc.)'
 WHERE key = 'integrations.personal.connect';

UPDATE public.permissions
   SET label       = 'Change member roles',
       description = 'Cannot change owner role — only the owner can transfer ownership.'
 WHERE key = 'members.update_role';

UPDATE public.permissions
   SET label       = 'Permanently delete workspace',
       description = 'Blocked while legal hold is active.'
 WHERE key = 'workspace.delete';

COMMIT;
