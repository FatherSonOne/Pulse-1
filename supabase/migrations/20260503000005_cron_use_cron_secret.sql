-- ============================================================
-- Update cron schedules + alert trigger to pass app.cron_secret
-- ============================================================
-- The PR-15 edge-function hardening (deployed today) requires
-- callers to pass an x-cron-secret OR Authorization Bearer header
-- whose value matches the CRON_SECRET env var on Supabase. The
-- existing pg_cron jobs and the security-alert trigger were sending
-- app.supabase_anon_key (publicly known) instead. This migration
-- rewires them to use a Postgres GUC `app.cron_secret`.
--
-- ⚠️ MANUAL CONFIGURATION REQUIRED
-- After applying this migration, the operator MUST:
--
--   1. Generate a strong random secret (32+ bytes hex) — e.g.
--        openssl rand -hex 32
--
--   2. Set the Postgres GUC so pg_cron + the alert trigger pick it up:
--        ALTER DATABASE postgres SET app.cron_secret = '<the-secret>';
--
--   3. Set the same value as a Supabase Edge Functions env var so the
--      functions accept it. In the Supabase dashboard:
--        Project Settings → Edge Functions → Secrets → CRON_SECRET = <the-secret>
--
-- Until both are set with matching values, the cron jobs for
-- check-search-alerts, ecosystem-heartbeat, and the security-alert
-- email trigger will return 401 (which is the safe failure mode —
-- previously they were running with a publicly-known token).

-- ────────────────────────────────────────────────────────────────────
-- 1. check-search-alerts cron — pass cron_secret instead of anon_key
-- ────────────────────────────────────────────────────────────────────
SELECT cron.unschedule('check-search-alerts')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-search-alerts');

SELECT cron.schedule(
  'check-search-alerts',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/check-search-alerts',
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'Authorization',  'Bearer ' || current_setting('app.cron_secret', true)
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ────────────────────────────────────────────────────────────────────
-- 2. ecosystem-heartbeat cron — pass cron_secret instead of anon_key
-- ────────────────────────────────────────────────────────────────────
SELECT cron.unschedule('ecosystem-heartbeat')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ecosystem-heartbeat');

SELECT cron.schedule(
  'ecosystem-heartbeat',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/ecosystem-heartbeat',
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'Authorization',  'Bearer ' || current_setting('app.cron_secret', true)
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ────────────────────────────────────────────────────────────────────
-- 3. trigger_security_alert_email — same swap
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_security_alert_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email TEXT;
  settings_row RECORD;
BEGIN
  IF NEW.alert_level NOT IN ('high', 'critical') THEN
    RETURN NEW;
  END IF;

  SELECT email INTO user_email FROM auth.users WHERE id = NEW.user_id;

  SELECT * INTO settings_row FROM public.security_settings WHERE user_id = NEW.user_id;
  IF settings_row IS NULL OR settings_row.alerts_enabled = FALSE THEN
    NEW.email_status := 'skipped';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/send-security-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
    ),
    body := jsonb_build_object(
      'alert_id',     NEW.id,
      'user_email',   user_email,
      'alert_title',  NEW.title,
      'alert_message', NEW.description,
      'alert_level',  NEW.alert_level,
      'alert_type',   NEW.alert_type,
      'metadata',     NEW.metadata
    )
  );

  RETURN NEW;
END;
$$;
