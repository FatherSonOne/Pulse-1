-- Migration: 20260613000000_push_on_pulse_message.sql
-- Wire Web Push to inbound messages (launch-readiness: the notification gap).
--
-- Problem: both Pulse-native DMs (send_pulse_message RPC) and Slack-grounded
-- DMs (ingest_slack_inbound_message RPC) terminate at an INSERT INTO
-- public.pulse_messages, but nothing ever dispatched a push on that insert.
-- The send-push VAPID dispatcher existed but was only ever called by the
-- saved-search-alerts cron, so a user with the tab closed never learned about
-- a new message. This closes that gap for both channels in ONE seam.
--
-- Pattern: identical to public.trigger_security_alert_email() — a SECURITY
-- DEFINER trigger that reads the internal dispatch secret from Vault and calls
-- an edge function via net.http_post (pg_net). send-push was widened (v10) to
-- accept CRON_SECRET in addition to PUSH_DISPATCH_SECRET, so this trigger reuses
-- the existing vault `cron_secret` — no new project secret is introduced.
--
-- Safety: the function NEVER aborts the message insert. Push delivery is
-- best-effort — any failure (no secret, send-push down, net error) is swallowed.
-- It also short-circuits before the HTTP call when the recipient has no active
-- push subscription, so users who never enabled push pay no round-trip.
--
-- Out of scope (deliberate): email push (Gmail sync is client-side; needs a
-- server-side Gmail watch/Pub-Sub) and Slack *channel* push (noisy, flag OFF;
-- a sibling trigger on slack_channel_messages can be added later).

CREATE OR REPLACE FUNCTION public.notify_on_pulse_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, vault, pg_temp
AS $$
DECLARE
  v_secret      text;
  v_sender_name text;
  v_preview     text;
  v_thread      text;
BEGIN
  -- Skip soft-deleted rows (won't be true on a fresh insert, but defensive).
  IF NEW.is_deleted IS TRUE THEN
    RETURN NEW;
  END IF;

  -- Cheapest exit first: no active subscription for the recipient → no push.
  IF NOT EXISTS (
    SELECT 1 FROM public.push_subscriptions
    WHERE user_id = NEW.recipient_id AND is_active = true
  ) THEN
    RETURN NEW;
  END IF;

  -- Internal dispatch secret (same vault entry the cron + security-alert
  -- trigger use; send-push v10 accepts it as CRON_SECRET).
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1;
  IF v_secret IS NULL THEN
    RETURN NEW;  -- push not configured; never block the insert
  END IF;

  -- Sender display name (pulse_users keyed by auth_user_id; exclude bots).
  SELECT COALESCE(NULLIF(display_name, ''), NULLIF(handle, ''), 'New message')
    INTO v_sender_name
  FROM public.pulse_users
  WHERE auth_user_id = NEW.sender_id AND is_bot IS NOT TRUE
  LIMIT 1;
  IF v_sender_name IS NULL THEN
    v_sender_name := 'New message';
  END IF;

  -- Body preview: trimmed text; non-text payloads get a generic label.
  v_preview := CASE
    WHEN COALESCE(NEW.content_type, 'text') <> 'text'
      THEN 'Sent you a ' || COALESCE(NEW.content_type, 'message')
    WHEN length(COALESCE(NEW.content, '')) = 0
      THEN 'New message'
    WHEN length(NEW.content) > 140
      THEN left(NEW.content, 139) || chr(8230)
    ELSE NEW.content
  END;

  v_thread := COALESCE(NEW.thread_id::text, NEW.sender_id::text);

  PERFORM net.http_post(
    url     := 'https://ucaeuszgoihoyrvhewxk.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body    := jsonb_build_object(
      'user_id', NEW.recipient_id,
      'notification', jsonb_build_object(
        'title',     v_sender_name,
        'body',      v_preview,
        'tag',       'pulse-dm-' || v_thread,
        'priority',  'normal',
        'actionUrl', '/?view=messages&thread=' || v_thread,
        'data', jsonb_build_object(
          'type', 'message',
          'messageId', NEW.id,
          'threadId', NEW.thread_id,
          'senderId', NEW.sender_id
        )
      )
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- A push failure must NEVER abort the message insert.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_on_pulse_message ON public.pulse_messages;
CREATE TRIGGER notify_on_pulse_message
  AFTER INSERT ON public.pulse_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_pulse_message();
