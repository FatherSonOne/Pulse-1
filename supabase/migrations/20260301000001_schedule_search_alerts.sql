-- Migration: Schedule search alert checks via pg_cron
-- Requires pg_cron extension (enabled by default on Supabase Pro/Team plans)
--
-- Runs the check-search-alerts edge function every hour.
-- The function internally decides whether each alert is "due" based on
-- the user's chosen frequency (instant=hourly, daily, weekly).

-- Enable pg_cron if not already enabled
create extension if not exists pg_cron;

-- Remove any existing job with this name (idempotent)
select cron.unschedule('check-search-alerts')
where exists (
  select 1 from cron.job where jobname = 'check-search-alerts'
);

-- Schedule: every hour at :00
select cron.schedule(
  'check-search-alerts',                     -- job name
  '0 * * * *',                               -- cron expression: every hour
  $$
  select net.http_post(
    url    := current_setting('app.supabase_url') || '/functions/v1/check-search-alerts',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
    ),
    body   := '{}'::jsonb
  ) as request_id;
  $$
);
