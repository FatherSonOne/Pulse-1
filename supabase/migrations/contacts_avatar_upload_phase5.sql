-- Contacts redesign Phase 5 — avatar upload infrastructure.
-- Applied to the cloud project (pulse-chat / ucaeuszgoihoyrvhewxk) via MCP
-- apply_migration on 2026-06-05. Recorded here for repo traceability.
--
-- Adds: a persistence column for uploaded avatar URLs, a public Storage bucket
-- (mirrors workspace-avatars, minus SVG), and per-user RLS on storage.objects
-- (public read; write/update/delete only under the uploader's own folder).
-- See docs/CONTACTS_REDESIGN_HANDOFF_2026-06-05.md §4.5 (D3).

ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS avatar_url text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('contact-avatars', 'contact-avatars', true, 2097152,
        ARRAY['image/png','image/jpeg','image/gif','image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS public_read_contact_avatars ON storage.objects;
CREATE POLICY public_read_contact_avatars ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'contact-avatars');

DROP POLICY IF EXISTS users_manage_own_contact_avatars ON storage.objects;
CREATE POLICY users_manage_own_contact_avatars ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'contact-avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'contact-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
