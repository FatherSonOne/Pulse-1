-- Security sweep (app-dev, 2026-07-01): flip the 'relay' bucket PRIVATE and
-- restrict read to authenticated sessions. This closes the read half of the
-- storage access-control hole (OWASP A01:2021 — Broken Access Control).
--
-- Before this migration, the 'relay' bucket was public=true with a SELECT policy
-- of `USING (bucket_id = 'relay')` and NO role restriction — so ANY object
-- (voice messages, glimpse video, thumbnails) was fetchable by ANYONE who had or
-- guessed the URL, with no authentication at all. Voice comms for the team were
-- effectively world-readable.
--
-- Prerequisite (DONE in code before applying this — sweeps 3b-i / 3b-ii):
-- every read path now resolves to a SIGNED, time-limited URL rather than a raw
-- public URL:
--   * getPlayableUrl()  — imperative playback/download (studio engine,
--                          ClassicMode, VoxDownloadModal)
--   * useSignedUrl()    — declarative JSX bindings (Glimpse <video>/<img>)
-- createSignedUrl enforces the SELECT policy below, so authenticated playback
-- keeps working; anonymous/direct-URL fetches stop working. That is the point.
--
-- ✅ APPLIED 2026-07-02 to pulse-chat (ucaeuszgoihoyrvhewxk) via MCP apply_migration,
-- after Frank ran the live smoke-test (5/5 read paths served signed URLs; race clean).
-- Verified post-apply: bucket public=false, old public policy dropped, new authed
-- policy live. Filename version renamed 20260701130000 -> 20260702054022 to match the
-- version recorded in the remote migration history so `supabase db push` is a no-op.
--
-- ROLLBACK (instant, if playback breaks in prod):
--   UPDATE storage.buckets SET public = true WHERE id = 'relay';
--   -- and, if desired, restore the open SELECT:
--   DROP POLICY IF EXISTS "relay read authenticated" ON storage.objects;
--   CREATE POLICY "Allow public read access to relay"
--     ON storage.objects FOR SELECT USING (bucket_id = 'relay');

-- 1. Flip the bucket private. Public URLs (/object/public/relay/...) now 403;
--    only signed URLs (/object/sign/relay/...?token=) resolve.
UPDATE storage.buckets SET public = false WHERE id = 'relay';

-- 2. Restrict SELECT to authenticated sessions. On a private bucket, this policy
--    is what createSignedUrl checks — so signing (and thus playback) requires a
--    logged-in session. anon can no longer sign or read anything in the bucket.
DROP POLICY IF EXISTS "Allow public read access to relay" ON storage.objects;
CREATE POLICY "relay read authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'relay');

-- NOTE (deliberate scope boundary, future sweep 3b-iv): this still lets ANY
-- authenticated user sign ANY object if they know its key — it closes anonymous
-- access, not cross-user access. Per-recipient confidentiality needs the
-- recipient/owner identity encoded in the object path or metadata so the SELECT
-- predicate can scope to it. That is a larger, separate migration and is tracked
-- as its own roadmap item; this migration intentionally does not attempt it.
