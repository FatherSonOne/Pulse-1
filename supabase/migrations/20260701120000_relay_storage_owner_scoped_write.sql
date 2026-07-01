-- Security sweep (app-dev, 2026-07-01): lock down relay storage WRITE access.
--
-- The 'relay' bucket (migration 20260427120000) shipped with write policies whose
-- ONLY predicate was `bucket_id = 'relay'`. That let ANY authenticated user
-- UPDATE (overwrite) or DELETE ANY object in the bucket — including another
-- user's voice-message audio — and upload to any path. That migration explicitly
-- deferred the scoping to "a security pass". This is that pass.
-- Class: OWASP A01:2021 — Broken Access Control.
--
-- Fix: scope INSERT/UPDATE/DELETE to the object's owner. Supabase Storage sets
-- storage.objects.owner to the uploader's auth.uid() on INSERT, so `owner =
-- auth.uid()` is a path-agnostic ownership check that works across all six Relay
-- modes (whose paths place the uploader id at different depths). Also restrict
-- the policies to the `authenticated` role so anon can no longer write at all.
--
-- SELECT (public read) is LEFT UNCHANGED on purpose: playback in every Relay mode
-- fetches audio via public URLs, so converting to a private bucket + signed-URL
-- playback is a separate, playback-wide sweep. This migration closes the
-- tamper/delete vectors without touching the read path.
--
-- Why this is safe for existing behaviour:
--   * Uploads use `upsert: false` with unique timestamped names -> there is no
--     legitimate UPDATE of an existing object to break.
--   * The app deletes DB rows, not storage objects -> owner-scoped DELETE breaks
--     nothing in the current code paths.
--   * SELECT is unchanged -> playback is unaffected.

-- UPDATE: only the uploader may modify their own objects.
DROP POLICY IF EXISTS "Allow users to update files in relay" ON storage.objects;
CREATE POLICY "relay update own objects"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'relay' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'relay' AND owner = auth.uid());

-- DELETE: only the uploader may delete their own objects.
DROP POLICY IF EXISTS "Allow users to delete own files in relay" ON storage.objects;
CREATE POLICY "relay delete own objects"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'relay' AND owner = auth.uid());

-- INSERT: require an authenticated session and stamp ownership to the caller.
-- (Path-prefix scoping is not viable — the six modes place the uploader id at
-- different path depths — so gate on auth + owner instead.)
DROP POLICY IF EXISTS "Allow authenticated uploads to relay" ON storage.objects;
CREATE POLICY "relay insert own objects"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'relay' AND owner = auth.uid());
