-- Voxer Storage Bucket Setup
-- This migration ensures the voxer storage bucket exists
-- Run this in Supabase SQL Editor if audio uploads are failing with "Bucket not found"

-- Create the voxer storage bucket for audio recordings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voxer',
  'voxer',
  true,
  52428800, -- 50MB limit
  ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-m4a']::text[]
) ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow public read access to voxer" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to voxer" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete own files in voxer" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update files in voxer" ON storage.objects;

-- Allow public access to voxer bucket (read)
CREATE POLICY "Allow public read access to voxer" ON storage.objects
  FOR SELECT USING (bucket_id = 'voxer');

-- Allow authenticated uploads to voxer bucket
CREATE POLICY "Allow authenticated uploads to voxer" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'voxer');

-- Allow users to delete their own files
CREATE POLICY "Allow users to delete own files in voxer" ON storage.objects
  FOR DELETE USING (bucket_id = 'voxer');

-- Allow users to update their own files
CREATE POLICY "Allow users to update files in voxer" ON storage.objects
  FOR UPDATE USING (bucket_id = 'voxer') WITH CHECK (bucket_id = 'voxer');

-- Verify the bucket was created
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'voxer') THEN
    RAISE NOTICE 'Voxer storage bucket created successfully';
  ELSE
    RAISE EXCEPTION 'Failed to create voxer storage bucket';
  END IF;
END $$;
