-- contactsHybrid Phase 8: per-contact Slack identity.
-- Nullable, FK-free text column holding a resolved Slack user id (e.g. U0123ABCD)
-- for an external contact, set by the "Link Slack" resolver via users.lookupByEmail
-- on contact.email. NULL = not linked (the Slack channel does not appear).
-- Additive + reversible; new column inherits the contacts table's existing RLS.
-- Dry-run validated in a rolled-back DO block before apply (CLAUDE.md schema-first).
-- Applied to pulse-chat (ucaeuszgoihoyrvhewxk) as version 20260606034444.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS slack_user_id text NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_slack_user_id
  ON public.contacts (slack_user_id)
  WHERE slack_user_id IS NOT NULL;

COMMENT ON COLUMN public.contacts.slack_user_id IS
  'Resolved Slack user id (e.g. U0123ABCD) for an external contact, set by the Phase 8 "Link Slack" resolver via users.lookupByEmail on contact.email. NULL = not linked (Slack channel does not appear). Independent of user_id (no FK). Client mirror: Contact.slackUserId in src/types.ts.';
