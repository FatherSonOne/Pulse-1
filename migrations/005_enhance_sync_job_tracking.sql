-- ============================================
-- Enhancement: Better Sync Job Tracking
-- Add detailed failure/skip reason tracking
-- ============================================

-- Add new columns for detailed tracking
ALTER TABLE public.google_contacts_sync_jobs
ADD COLUMN IF NOT EXISTS skipped_no_identifier INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS skipped_duplicate INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS failed_database_error INTEGER DEFAULT 0;

-- Add comment
COMMENT ON COLUMN public.google_contacts_sync_jobs.skipped_no_identifier IS 'Contacts skipped because they have neither email nor phone';
COMMENT ON COLUMN public.google_contacts_sync_jobs.skipped_duplicate IS 'Contacts skipped because they already exist (optional tracking)';
COMMENT ON COLUMN public.google_contacts_sync_jobs.failed_database_error IS 'Contacts that failed due to database errors';
