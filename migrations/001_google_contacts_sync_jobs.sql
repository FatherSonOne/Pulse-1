-- ============================================
-- Google Contacts Sync Jobs Table
-- Tracks sync operations between Google Contacts and Logos Vision CRM
-- ============================================

-- Create the sync jobs table
CREATE TABLE IF NOT EXISTS public.google_contacts_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  workspace_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  sync_type TEXT NOT NULL DEFAULT 'contacts' CHECK (sync_type IN ('contacts', 'full')),

  -- Sync configuration
  filter JSONB DEFAULT '{}',
  label TEXT,
  domain TEXT,

  -- Progress tracking
  total_contacts INTEGER DEFAULT 0,
  synced INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,

  -- Results
  error_message TEXT,
  error_details JSONB,
  sync_results JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_google_contacts_sync_jobs_user_id ON public.google_contacts_sync_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_google_contacts_sync_jobs_workspace_id ON public.google_contacts_sync_jobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_google_contacts_sync_jobs_status ON public.google_contacts_sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_google_contacts_sync_jobs_created_at ON public.google_contacts_sync_jobs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.google_contacts_sync_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Allow users to read their own sync jobs
CREATE POLICY "Users can view their own sync jobs"
  ON public.google_contacts_sync_jobs
  FOR SELECT
  USING (user_id = auth.uid());

-- Allow users to create their own sync jobs
CREATE POLICY "Users can create their own sync jobs"
  ON public.google_contacts_sync_jobs
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Allow users to update their own sync jobs
CREATE POLICY "Users can update their own sync jobs"
  ON public.google_contacts_sync_jobs
  FOR UPDATE
  USING (user_id = auth.uid());

-- Allow service role to bypass RLS (for API operations)
CREATE POLICY "Service role can do anything"
  ON public.google_contacts_sync_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_google_contacts_sync_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_google_contacts_sync_jobs_updated_at
  BEFORE UPDATE ON public.google_contacts_sync_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_google_contacts_sync_jobs_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.google_contacts_sync_jobs TO authenticated;
GRANT ALL ON public.google_contacts_sync_jobs TO service_role;

-- Add comment
COMMENT ON TABLE public.google_contacts_sync_jobs IS 'Tracks Google Contacts sync operations for Logos Vision CRM integration';
