-- Migration: 20260613010000_email_watch_state.sql
-- Email push (foundation): watch bookkeeping for the Gmail users.watch lifecycle.
--
-- New mail reaches Pulse only when the tab is open and emailSyncService.fullSync()
-- runs client-side, so there is no server-side insert to trigger a push on (unlike
-- pulse_messages). Server-side email push uses Gmail users.watch -> Google Cloud
-- Pub/Sub -> a gmail-push-receiver edge fn -> send-push. That lifecycle needs watch
-- state persisted per user; email_sync_state already owns history_id, so the watch
-- cursors live alongside it. See docs/EMAIL_PUSH_PLAN_HANDOFF_2026-06-13.md.
--
-- Purely additive (ADD COLUMN IF NOT EXISTS); no policy changes — the receiver +
-- renewal edge fns act with the service-role key, which bypasses RLS, same as the
-- backend's other Gmail server-side paths.

ALTER TABLE public.email_sync_state
  ADD COLUMN IF NOT EXISTS watch_expiration   timestamptz,  -- Gmail watch expiry (epoch ms from users.watch, stored as tstz); renewal cron keys off this
  ADD COLUMN IF NOT EXISTS watch_history_id   text,         -- historyId returned by users.watch; floor for the first history.list after a (re)watch
  ADD COLUMN IF NOT EXISTS watch_topic        text,         -- the Pub/Sub topic this mailbox is watched on (audit / multi-topic safety)
  ADD COLUMN IF NOT EXISTS watch_last_renewed timestamptz;  -- when the renewal job last re-issued the watch
