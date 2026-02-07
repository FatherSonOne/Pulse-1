-- ================================================
-- Simple Data Cleanup with pg_cron (No Edge Function)
-- ================================================
-- This creates a database function that cleans up old data automatically

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create cleanup function
CREATE OR REPLACE FUNCTION public.execute_data_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cleanup_count INT := 0;
BEGIN
  -- Clean up old activity logs based on retention policy
  DELETE FROM public.activity_logs
  WHERE created_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS cleanup_count = ROW_COUNT;

  -- Log the cleanup
  INSERT INTO public.data_cleanup_logs (
    cleanup_type,
    items_deleted,
    status
  ) VALUES (
    'activity_logs',
    cleanup_count,
    'completed'
  );

  -- Add more cleanup operations as needed
  -- DELETE FROM public.security_alerts WHERE created_at < NOW() - INTERVAL '180 days';

END;
$$;

-- Schedule the cleanup to run daily at 2 AM UTC
SELECT cron.schedule(
    'daily-data-cleanup',
    '0 2 * * *',
    'SELECT public.execute_data_cleanup();'
);

-- Verify the cron job was created
SELECT * FROM cron.job WHERE jobname = 'daily-data-cleanup';
