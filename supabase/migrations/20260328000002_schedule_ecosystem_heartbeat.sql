-- Migration: Schedule ecosystem heartbeat via pg_cron
-- Pings all enabled ecosystem connections every 15 minutes
-- to validate tokens and update last_heartbeat timestamps.
-- Requires pg_cron extension (enabled by default on Supabase Pro/Team plans)

create extension if not exists pg_cron;

-- Remove any existing job with this name (idempotent)
select cron.unschedule('ecosystem-heartbeat')
where exists (
  select 1 from cron.job where jobname = 'ecosystem-heartbeat'
);

-- Schedule: every 15 minutes
select cron.schedule(
  'ecosystem-heartbeat',
  '*/15 * * * *',
  $$
  select net.http_post(
    url    := current_setting('app.supabase_url') || '/functions/v1/ecosystem-heartbeat',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
    ),
    body   := '{}'::jsonb
  ) as request_id;
  $$
);
