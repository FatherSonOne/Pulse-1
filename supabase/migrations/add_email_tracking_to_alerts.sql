-- Add email tracking fields to security_alerts table

ALTER TABLE public.security_alerts
ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS email_status VARCHAR(20) DEFAULT 'pending' CHECK (email_status IN ('pending', 'sent', 'failed', 'skipped'));

-- Add index for email status queries
CREATE INDEX IF NOT EXISTS idx_security_alerts_email_status ON public.security_alerts(email_status, created_at);

-- Create a trigger to automatically send emails for high/critical alerts
CREATE OR REPLACE FUNCTION public.trigger_security_alert_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email TEXT;
  settings_row RECORD;
BEGIN
  -- Only trigger for high and critical alerts
  IF NEW.alert_level NOT IN ('high', 'critical') THEN
    RETURN NEW;
  END IF;

  -- Get user email
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  -- Check if user has email alerts enabled
  SELECT * INTO settings_row
  FROM public.security_settings
  WHERE user_id = NEW.user_id;

  IF settings_row IS NULL OR settings_row.alerts_enabled = FALSE THEN
    -- Mark as skipped
    NEW.email_status := 'skipped';
    RETURN NEW;
  END IF;

  -- Call the Edge Function to send email (async via pg_net extension)
  -- Note: This requires pg_net extension to be enabled
  PERFORM
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/send-security-alert',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
      ),
      body := jsonb_build_object(
        'alert_id', NEW.id,
        'user_email', user_email,
        'alert_title', NEW.title,
        'alert_message', NEW.description,
        'alert_level', NEW.alert_level,
        'alert_type', NEW.alert_type,
        'metadata', NEW.metadata
      )
    );

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS send_security_alert_email ON public.security_alerts;
CREATE TRIGGER send_security_alert_email
  AFTER INSERT ON public.security_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_security_alert_email();

-- Note: To enable automatic email sending, you need to:
-- 1. Enable pg_net extension: CREATE EXTENSION IF NOT EXISTS pg_net;
-- 2. Set your Supabase URL: ALTER DATABASE postgres SET app.supabase_url = 'https://your-project.supabase.co';
-- 3. Set your anon key: ALTER DATABASE postgres SET app.supabase_anon_key = 'your-anon-key';
