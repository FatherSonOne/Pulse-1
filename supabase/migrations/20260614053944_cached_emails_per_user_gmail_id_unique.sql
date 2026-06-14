-- cached_emails is a per-user cache: PK is `${user_id}-${gmail_id}`, it has an
-- FK on user_id, per-user RLS, and per-user read/star/label state. The original
-- UNIQUE(gmail_id) was GLOBAL, which forbade a second Pulse account from caching
-- the same Gmail message id — the same mailbox can be connected under multiple
-- accounts. That produced `duplicate key value violates unique constraint
-- "cached_emails_gmail_id_key"` (23505 / REST 409) on every full sync whenever a
-- gmail_id already cached under another user was re-inserted under the current
-- user (the onConflict:'id' upsert can't match the new namespaced id).
--
-- Replace the global key with the correct per-user composite key. No code change
-- is needed: id = `${user_id}-${gmail_id}` is bijective with (user_id, gmail_id),
-- so the existing onConflict:'id' upsert keeps updating same-user rows and now
-- inserts cross-user duplicates of a gmail_id cleanly. No FK references gmail_id
-- (dependents FK to cached_emails(id)); the plain lookup index on gmail_id stays.
ALTER TABLE public.cached_emails DROP CONSTRAINT cached_emails_gmail_id_key;
ALTER TABLE public.cached_emails
  ADD CONSTRAINT cached_emails_user_gmail_id_key UNIQUE (user_id, gmail_id);
