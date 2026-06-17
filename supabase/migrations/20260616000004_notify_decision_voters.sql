-- Migration: 20260616000004_notify_decision_voters.sql
-- Real cross-device dispatch for "Remind" on a decision (launch-readiness 0.6).
--
-- Problem: DecisionDetail.handleSendReminder called notificationService
-- .notifyDecisionEvent(), which fires a LOCAL browser notification on the
-- SENDER's own device and writes to the sender's localStorage — it never
-- reaches the voters, yet the UI always toasted "Reminder sent". This wires the
-- reminder to the real Web Push pipeline (push_subscriptions + send-push edge fn),
-- the exact pattern already proven for inbound DMs in notify_on_pulse_message().
--
-- Recipients = workspace members of the decision's workspace who (a) are not the
-- caller, (b) have NOT yet voted on this decision, and (c) have an active push
-- subscription. The RPC returns that count so the client can show an HONEST toast
-- ("Reminder sent to N" / "no one to remind") instead of an unconditional success.
--
-- Schema ground-truth (verified live, 2026-06-16):
--   decisions.workspace_id        uuid NULL ; decisions.proposal_text text (the title)
--   workspace_members.user_id     uuid      ; push_subscriptions.user_id uuid ; is_active bool
--   decision_votes.user_id        TEXT  <-- cast wm.user_id::text to compare (Pulse inconsistency)
--   user_has_workspace_access(uuid) -> bool (SECURITY DEFINER) gates the caller
--   vault `cron_secret` exists; send-push accepts it as CRON_SECRET (Bearer).
--
-- Safety: SECURITY DEFINER with pinned search_path (DB security baseline). The
-- caller is authorized via user_has_workspace_access before any dispatch. Solo
-- decisions (workspace_id IS NULL) have no teammates -> return 0, no HTTP call.

CREATE OR REPLACE FUNCTION public.notify_decision_voters(p_decision_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, vault, pg_temp
AS $$
DECLARE
  v_workspace_id uuid;
  v_title        text;
  v_preview      text;
  v_secret       text;
  v_ids          uuid[];
  v_count        integer;
BEGIN
  SELECT workspace_id, proposal_text
    INTO v_workspace_id, v_title
  FROM public.decisions
  WHERE id = p_decision_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'decision % not found', p_decision_id;
  END IF;

  -- Solo decision: no teammates to remind.
  IF v_workspace_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Authorize the caller: must have workspace access to this decision.
  IF NOT public.user_has_workspace_access(v_workspace_id) THEN
    RAISE EXCEPTION 'not authorized for workspace %', v_workspace_id;
  END IF;

  -- Target = members who haven't voted, aren't the caller, and can receive a push.
  -- decision_votes.user_id is TEXT; cast the uuid member id to compare.
  SELECT array_agg(DISTINCT wm.user_id)
    INTO v_ids
  FROM public.workspace_members wm
  WHERE wm.workspace_id = v_workspace_id
    AND wm.user_id <> auth.uid()
    AND wm.user_id::text NOT IN (
      SELECT dv.user_id FROM public.decision_votes dv WHERE dv.decision_id = p_decision_id
    )
    AND EXISTS (
      SELECT 1 FROM public.push_subscriptions ps
      WHERE ps.user_id = wm.user_id AND ps.is_active = true
    );

  v_count := COALESCE(array_length(v_ids, 1), 0);
  IF v_count = 0 THEN
    RETURN 0;  -- nobody to remind; no round-trip
  END IF;

  -- Internal dispatch secret (same vault entry the DM-push trigger uses).
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1;
  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'push dispatch not configured (vault cron_secret missing)';
  END IF;

  v_preview := CASE
    WHEN v_title IS NULL OR length(v_title) = 0 THEN 'A decision needs your vote'
    WHEN length(v_title) > 140 THEN left(v_title, 139) || chr(8230)
    ELSE v_title
  END;

  PERFORM net.http_post(
    url     := 'https://ucaeuszgoihoyrvhewxk.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body    := jsonb_build_object(
      'user_ids', to_jsonb(v_ids),
      'notification', jsonb_build_object(
        'title',     'A decision needs your vote',
        'body',      v_preview,
        'tag',       'decision-vote-' || p_decision_id::text,
        'priority',  'high',
        'actionUrl', '/?view=decisions&id=' || p_decision_id::text,
        'data', jsonb_build_object(
          'type', 'decision',
          'decisionId', p_decision_id
        )
      )
    )
  );

  RETURN v_count;
END;
$$;

-- Least privilege: Supabase's ALTER DEFAULT PRIVILEGES auto-grants EXECUTE on new
-- public functions to anon+authenticated, so REVOKE FROM PUBLIC alone leaves anon
-- with access. Explicitly revoke anon; only authenticated callers may invoke (and
-- they are still gated by user_has_workspace_access inside).
REVOKE ALL ON FUNCTION public.notify_decision_voters(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_decision_voters(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.notify_decision_voters(uuid) TO authenticated;
