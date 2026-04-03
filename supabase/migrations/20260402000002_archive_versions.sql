-- Archive Versions table for version history tracking
-- Referenced by archiveService.getVersionHistory() and saveVersionSnapshot()

CREATE TABLE IF NOT EXISTS public.archive_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archive_id UUID NOT NULL REFERENCES public.archives(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT,
  action TEXT NOT NULL DEFAULT 'Modified',
  user_name TEXT NOT NULL DEFAULT 'You',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_archive_versions_archive_id ON public.archive_versions(archive_id);
CREATE INDEX idx_archive_versions_created_at ON public.archive_versions(created_at DESC);

ALTER TABLE public.archive_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY archive_versions_select ON public.archive_versions
  FOR SELECT USING (
    archive_id IN (SELECT id FROM public.archives WHERE user_id = auth.uid()::text)
  );

CREATE POLICY archive_versions_insert ON public.archive_versions
  FOR INSERT WITH CHECK (
    archive_id IN (SELECT id FROM public.archives WHERE user_id = auth.uid()::text)
  );

CREATE POLICY archive_versions_delete ON public.archive_versions
  FOR DELETE USING (
    archive_id IN (SELECT id FROM public.archives WHERE user_id = auth.uid()::text)
  );
