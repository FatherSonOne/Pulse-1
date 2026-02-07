-- ================================================
-- Setup Scheduled Data Cleanup using pg_cron
-- ================================================
-- This creates a cron job that calls the data-cleanup Edge Function daily at 2 AM UTC

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a cron job that runs daily at 2 AM UTC
-- This calls the data-cleanup Edge Function via HTTP
SELECT cron.schedule(
    'data-retention-cleanup',           -- Job name
    '0 2 * * *',                        -- Cron schedule (2 AM UTC daily)
    $$
    -- Call the Edge Function via HTTP
    SELECT
      net.http_post(
        url := 'YOUR_SUPABASE_PROJECT_URL/functions/v1/data-cleanup',
        headers := jsonb_build_object(
          'Authorization', 'Bearer YOUR_SUPABASE_ANON_KEY',
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'secret', 'YOUR_CRON_SECRET'
        )
      ) as request_id;
    $$
);

-- View all scheduled jobs
SELECT * FROM cron.job;

-- To delete the job later (if needed):
-- SELECT cron.unschedule('data-retention-cleanup');
