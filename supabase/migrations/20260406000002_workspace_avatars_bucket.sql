-- Migration: Create workspace-avatars storage bucket
-- Public bucket for workspace avatar images.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'workspace-avatars',
  'workspace-avatars',
  true,
  2097152, -- 2 MB
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: workspace admins can upload/update/delete their workspace's avatars
CREATE POLICY "workspace_admins_manage_avatars"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'workspace-avatars'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- RLS: anyone can read workspace avatars (public bucket)
CREATE POLICY "public_read_workspace_avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'workspace-avatars');
