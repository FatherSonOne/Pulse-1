-- Create the 'relay' storage bucket for the Voxer→Relay rename.
-- Mirrors the existing 'voxer' bucket config and RLS policies (50MB limit,
-- audio/video/image MIME types, public read).
--
-- Dual-read model: stored audio/video URLs encode the bucket they were
-- uploaded to. Old vox content was uploaded to the 'voxer' bucket and its
-- URLs in DB records (e.g. vox_messages.audio_url, video_vox_messages.video_url)
-- continue to resolve there. New uploads after this migration go to the
-- 'relay' bucket and their URLs resolve there. No application-level fallback
-- logic is needed; URL-based routing is the dual-read mechanism.
--
-- After the 30-day window: copy any orphan 'voxer' objects to 'relay'
-- (where stored URLs already point at relay), update DB-stored URLs to
-- swap 'voxer' → 'relay' in the path, then drop the 'voxer' bucket. That
-- cleanup is a separate migration (not yet written).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at)
VALUES (
  'relay',
  'relay',
  true,
  52428800,
  ARRAY[
    'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-m4a',
    'video/webm', 'video/mp4', 'video/quicktime', 'video/x-m4v',
    'image/jpeg', 'image/png', 'image/webp'
  ]::text[],
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies on storage.objects scoped to the new 'relay' bucket.
-- Mirrors the four existing 'voxer' policies exactly. Tightening ownership
-- checks (DELETE policy reads bucket only, not object owner) is out of scope
-- for this rename pass; revisit in a security pass.

CREATE POLICY "Allow public read access to relay"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'relay');

CREATE POLICY "Allow authenticated uploads to relay"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'relay');

CREATE POLICY "Allow users to update files in relay"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'relay')
  WITH CHECK (bucket_id = 'relay');

CREATE POLICY "Allow users to delete own files in relay"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'relay');
