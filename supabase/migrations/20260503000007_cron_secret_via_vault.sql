-- Migration: 20260503000007_cron_secret_via_vault.sql
-- Issue #34: Switch pg_cron + security-alert trigger from app.cron_secret /
-- app.supabase_url GUCs to vault.decrypted_secrets.
--
-- Background: 20260503000005 wired the cron jobs and trigger to read
-- `app.cron_secret` via current_setting(). Setting that GUC requires
-- ALTER DATABASE, which is blocked for the postgres role on hosted Supabase
-- (permission denied to set parameter). Vault is the supported path: it's
-- encrypted at rest, the secret value never leaves the database in plaintext,
-- and we don't need superuser privileges.
--
-- ⚠️ MANUAL STEPS REQUIRED AFTER APPLYING THIS MIGRATION
--   1. In the Supabase SQL Editor (one-time, NOT in a migration), run:
--        SELECT vault.create_secret(
--          '<paste-64-char-hex>',
--          'cron_secret',
--          'CRON_SECRET for pg_cron → edge function auth (issue #34)'
--        );
--      To rotate later:
--        SELECT vault.update_secret(
--          (SELECT id FROM vault.secrets WHERE name = 'cron_secret'),
--          '<new-hex>'
--        );
--   2. Set CRON_SECRET = same hex in Supabase Dashboard:
--        Project Settings → Edge Functions → Secrets → CRON_SECRET
--   3. Verify next cron run succeeds:
--        SELECT jobname, status, return_message, start_time
--        FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
--
-- The supabase_url is hardcoded (it is not sensitive — already public).

BEGIN;

-- ────────────────────────────────────────────────────────────────────
-- 1. check-search-alerts cron — read CRON_SECRET from vault
-- ────────────────────────────────────────────────────────────────────
SELECT cron.unschedule('check-search-alerts')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-search-alerts');

SELECT cron.schedule(
  'check-search-alerts',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ucaeuszgoihoyrvhewxk.supabase.co/functions/v1/check-search-alerts',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'cron_secret' LIMIT 1
      )
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ────────────────────────────────────────────────────────────────────
-- 2. ecosystem-heartbeat cron — read CRON_SECRET from vault
-- ────────────────────────────────────────────────────────────────────
SELECT cron.unschedule('ecosystem-heartbeat')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ecosystem-heartbeat');

SELECT cron.schedule(
  'ecosystem-heartbeat',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ucaeuszgoihoyrvhewxk.supabase.co/functions/v1/ecosystem-heartbeat',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'cron_secret' LIMIT 1
      )
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ────────────────────────────────────────────────────────────────────
-- 3. trigger_security_alert_email — read CRON_SECRET from vault
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_security_alert_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email TEXT;
  settings_row RECORD;
  v_cron_secret TEXT;
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

  SELECT decrypted_secret INTO v_cron_secret
  FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1;

  IF v_cron_secret IS NULL THEN
    NEW.email_status := 'skipped:no-cron-secret';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := 'https://ucaeuszgoihoyrvhewxk.supabase.co/functions/v1/send-security-alert',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_cron_secret
    ),
    body    := jsonb_build_object(
      'alert_id',      NEW.id,
      'user_email',    user_email,
      'alert_title',   NEW.title,
      'alert_message', NEW.description,
      'alert_level',   NEW.alert_level,
      'alert_type',    NEW.alert_type,
      'metadata',      NEW.metadata
    )
  );

  RETURN NEW;
END;
$$;

COMMIT;
