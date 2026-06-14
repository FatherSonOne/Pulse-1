-- Migration: 20260614000000_schedule_gmail_watch_renew.sql
-- Email push (renewal cron). Gmail users.watch expires <=7 days, so re-arm it
-- daily by POSTing the gmail-watch-renew edge function with the vault cron_secret.
-- Mirrors the check-search-alerts / security-alert cron pattern
-- (20260503000007_cron_secret_via_vault.sql). Idempotent: unschedule-if-exists
-- before scheduling so re-applying the migration doesn't duplicate the job.
--
-- Prereq: the edge secrets GMAIL_OAUTH_CLIENT_ID/SECRET + GMAIL_PUSH_TOPIC and the
-- Google Cloud Pub/Sub topic + gmail-api-push publisher binding must be in place,
-- or the function returns a graceful skip. See
-- docs/EMAIL_PUSH_PLAN_HANDOFF_2026-06-13.md.

SELECT cron.unschedule('gmail-watch-renew')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gmail-watch-renew');

SELECT cron.schedule(
  'gmail-watch-renew',
  '0 6 * * *',                              -- daily 06:00 UTC (watch TTL is 7 days)
  $cron$
  SELECT net.http_post(
    url     := 'https://ucaeuszgoihoyrvhewxk.supabase.co/functions/v1/gmail-watch-renew',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'cron_secret' LIMIT 1
      )
    ),
    body    := '{}'::jsonb
  );
  $cron$
);
