-- ============================================================
-- DEFINER LOCKDOWN — close legacy "trust caller-supplied user_id"
-- ============================================================
-- The 20260119062007_remote_schema.sql baseline shipped a cluster of
-- SECURITY DEFINER functions that take a `p_user_id` / `p_sender_id` /
-- `p_actor_id` parameter and use it directly without verifying it
-- equals auth.uid(). DEFINER means RLS is bypassed; combined with
-- caller-supplied identity, this lets any authenticated user (and in
-- some cases anon) impersonate any other user.
--
-- Plus several recently added (today's batch) RPCs lacked workspace
-- membership checks: get_workspace_unread_count, get_enriched_workspace_members,
-- write_workspace_audit, start_pulse_team_trial, rebuild_entitlements.
--
-- Strategy
-- --------
-- Keep parameter signatures stable so existing call sites keep working.
-- At the top of each function, raise a 'forbidden' exception if the
-- caller-supplied identity does NOT match auth.uid() (or, for workspace
-- ops, if the caller is not a member of the target workspace).
--
-- Special cases
-- -------------
--   send_pulse_message: also verify recipient sharing — TODO follow-up
--     (this migration only blocks the sender impersonation; whether
--     a sender can DM a non-contact is a separate product question).
--   rebuild_entitlements: REVOKE FROM PUBLIC and only allow service_role.
--   start_pulse_team_trial: must be owner or admin of target workspace.

-- ────────────────────────────────────────────────────────────────────
-- Helper: assert caller matches a given user_id, or raise
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._assert_caller_is(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF p_user_id IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'forbidden: caller-supplied user_id does not match authenticated user'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public._assert_caller_is(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._assert_caller_is(uuid) TO authenticated, anon, service_role;

-- ════════════════════════════════════════════════════════════════════
-- N2: send_pulse_message — drop sender impersonation
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.send_pulse_message(
  p_sender_id uuid,
  p_recipient_id uuid,
  p_content text,
  p_content_type text DEFAULT 'text',
  p_media_url text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    msg_id UUID;
    conv_id UUID;
BEGIN
    PERFORM public._assert_caller_is(p_sender_id);

    conv_id := get_or_create_conversation(p_sender_id, p_recipient_id);

    INSERT INTO public.pulse_messages (sender_id, recipient_id, thread_id, content, content_type, media_url)
    VALUES (p_sender_id, p_recipient_id, conv_id, p_content, p_content_type, p_media_url)
    RETURNING id INTO msg_id;

    UPDATE public.pulse_conversations
    SET
        last_message_id = msg_id,
        last_message_at = NOW(),
        last_message_preview = LEFT(p_content, 100),
        user1_unread_count = CASE WHEN user1_id = p_recipient_id THEN user1_unread_count + 1 ELSE user1_unread_count END,
        user2_unread_count = CASE WHEN user2_id = p_recipient_id THEN user2_unread_count + 1 ELSE user2_unread_count END,
        updated_at = NOW()
    WHERE id = conv_id;

    RETURN msg_id;
END;
$$;

-- ════════════════════════════════════════════════════════════════════
-- N3: mark_messages_read
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.mark_messages_read(p_user_id uuid, p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    PERFORM public._assert_caller_is(p_user_id);

    UPDATE public.pulse_messages
    SET is_read = true, read_at = NOW()
    WHERE thread_id = p_conversation_id
    AND recipient_id = p_user_id
    AND is_read = false;

    UPDATE public.pulse_conversations
    SET
        user1_unread_count = CASE WHEN user1_id = p_user_id THEN 0 ELSE user1_unread_count END,
        user2_unread_count = CASE WHEN user2_id = p_user_id THEN 0 ELSE user2_unread_count END,
        updated_at = NOW()
    WHERE id = p_conversation_id;
END;
$$;

-- ════════════════════════════════════════════════════════════════════
-- N4: update_user_presence
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.update_user_presence(p_user_id uuid, p_status text DEFAULT 'online')
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    PERFORM public._assert_caller_is(p_user_id);

    UPDATE public.user_profiles
    SET
        online_status = p_status,
        last_active_at = NOW(),
        last_seen_at = CASE WHEN p_status = 'offline' THEN NOW() ELSE last_seen_at END,
        updated_at = NOW()
    WHERE id = p_user_id;
END;
$$;

-- ════════════════════════════════════════════════════════════════════
-- N5: get_workspace_unread_count — add workspace membership check
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_workspace_unread_count(
  p_workspace_id UUID,
  p_user_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  PERFORM public._assert_caller_is(p_user_id);
  IF NOT public.user_has_workspace_access(p_workspace_id) THEN
    RAISE EXCEPTION 'forbidden: not a member of workspace'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT COALESCE(SUM(unread)::integer, 0) INTO v_count
  FROM (
    SELECT
      (
        SELECT COUNT(*)::integer
        FROM channel_messages cm
        WHERE cm.channel_id = mc.id
          AND cm.sender_id <> p_user_id
          AND NOT EXISTS (
            SELECT 1 FROM message_reads mr
            WHERE mr.message_id = cm.id AND mr.user_id = p_user_id
          )
      ) AS unread
    FROM message_channels mc
    INNER JOIN channel_members chm
      ON chm.channel_id = mc.id AND chm.user_id = p_user_id
    WHERE mc.workspace_id = p_workspace_id
  ) sub;

  RETURN v_count;
END;
$$;

-- ════════════════════════════════════════════════════════════════════
-- N6: get_batch_thread_unread_counts
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_batch_thread_unread_counts(
  p_thread_ids uuid[],
  p_user_id uuid
) RETURNS TABLE(thread_id uuid, unread_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public._assert_caller_is(p_user_id);

  RETURN QUERY
  SELECT
    m.thread_id,
    COUNT(*)::INTEGER as unread_count
  FROM voice_thread_messages m
  WHERE
    m.thread_id = ANY(p_thread_ids)
    AND NOT (p_user_id = ANY(m.read_by))
    AND m.sender_id != p_user_id
    AND m.is_deleted = false
  GROUP BY m.thread_id;
END;
$$;
-- Drop EXECUTE from anon
REVOKE EXECUTE ON FUNCTION public.get_batch_thread_unread_counts(uuid[], uuid) FROM anon;

-- ════════════════════════════════════════════════════════════════════
-- N7: get_enriched_workspace_members — add workspace check
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_enriched_workspace_members(p_workspace_id UUID)
RETURNS TABLE (
  workspace_id UUID,
  user_id      UUID,
  role         TEXT,
  invited_by   UUID,
  joined_at    TIMESTAMPTZ,
  display_name TEXT,
  full_name    TEXT,
  avatar_url   TEXT,
  email        TEXT,
  handle       TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.user_has_workspace_access(p_workspace_id) THEN
    RAISE EXCEPTION 'forbidden: not a member of workspace'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    wm.workspace_id,
    wm.user_id,
    wm.role,
    wm.invited_by,
    wm.joined_at,
    up.display_name,
    up.full_name,
    up.avatar_url,
    au.email,
    up.handle
  FROM workspace_members wm
  LEFT JOIN user_profiles up ON up.id = wm.user_id
  LEFT JOIN auth.users    au ON au.id = wm.user_id
  WHERE wm.workspace_id = p_workspace_id
  ORDER BY
    CASE wm.role
      WHEN 'owner'  THEN 0
      WHEN 'admin'  THEN 1
      WHEN 'member' THEN 2
      WHEN 'viewer' THEN 3
      ELSE 4
    END,
    wm.joined_at ASC;
END;
$$;

-- ════════════════════════════════════════════════════════════════════
-- N8: write_workspace_audit — drop actor_id forging + workspace check
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.write_workspace_audit(
  p_workspace_id UUID,
  p_actor_id     UUID,
  p_action       TEXT,
  p_target_id    TEXT DEFAULT NULL,
  p_metadata     JSONB DEFAULT '{}'
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_caller_is(p_actor_id);
  IF NOT public.user_has_workspace_access(p_workspace_id) THEN
    RAISE EXCEPTION 'forbidden: not a member of workspace'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO workspace_audit_log (workspace_id, actor_id, action, target_id, metadata)
  VALUES (p_workspace_id, p_actor_id, p_action, p_target_id, p_metadata);
END;
$$;

-- ════════════════════════════════════════════════════════════════════
-- N9: start_pulse_team_trial — caller must be owner/admin
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.start_pulse_team_trial(p_workspace_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_subscription_id UUID;
  v_existing UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'forbidden: only workspace owner or admin can start a trial'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT id INTO v_existing
    FROM public.subscriptions
   WHERE workspace_id = p_workspace_id
     AND status IN ('trialing', 'active')
   LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.subscriptions (
    workspace_id, stripe_subscription_id, status,
    trial_start, trial_end
  ) VALUES (
    p_workspace_id,
    'trial_' || p_workspace_id::text || '_' || extract(epoch from now())::bigint,
    'trialing',
    now(),
    now() + interval '30 days'
  )
  RETURNING id INTO v_subscription_id;

  INSERT INTO public.subscription_items (subscription_id, plan_id, quantity)
  VALUES (v_subscription_id, 'pulse_team', 1);

  PERFORM public.rebuild_entitlements(p_workspace_id);
END;
$$;

-- ════════════════════════════════════════════════════════════════════
-- N10: rebuild_entitlements — REVOKE from PUBLIC (service_role + triggers only)
-- ════════════════════════════════════════════════════════════════════
REVOKE ALL ON FUNCTION public.rebuild_entitlements(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rebuild_entitlements(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.rebuild_entitlements(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_entitlements(uuid) TO service_role;

-- ════════════════════════════════════════════════════════════════════
-- N25: legacy thread/annotation/conversation helpers
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_or_create_thread_actions(p_user_id uuid, p_conversation_id uuid)
RETURNS thread_actions
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_actions thread_actions;
BEGIN
  PERFORM public._assert_caller_is(p_user_id);

  SELECT * INTO v_actions
  FROM thread_actions
  WHERE user_id = p_user_id AND conversation_id = p_conversation_id;

  IF NOT FOUND THEN
    INSERT INTO thread_actions (user_id, conversation_id)
    VALUES (p_user_id, p_conversation_id)
    RETURNING * INTO v_actions;
  END IF;

  RETURN v_actions;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_annotation(p_user_id uuid, p_target_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    annotation_id UUID;
BEGIN
    PERFORM public._assert_caller_is(p_user_id);

    SELECT id INTO annotation_id
    FROM public.user_contact_annotations
    WHERE user_id = p_user_id AND target_user_id = p_target_user_id;

    IF annotation_id IS NULL THEN
        INSERT INTO public.user_contact_annotations (user_id, target_user_id)
        VALUES (p_user_id, p_target_user_id)
        RETURNING id INTO annotation_id;
    END IF;

    RETURN annotation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_conversation(user_a uuid, user_b uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    conv_id UUID;
BEGIN
    -- The caller must be one of the two participants. Without this,
    -- attackers could pre-create conversations between arbitrary user
    -- pairs, polluting other users' DM lists.
    IF auth.uid() IS NOT NULL AND auth.uid() NOT IN (user_a, user_b) THEN
      RAISE EXCEPTION 'forbidden: caller must be one of the conversation participants'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT id INTO conv_id
    FROM public.pulse_conversations
    WHERE (user1_id = LEAST(user_a, user_b) AND user2_id = GREATEST(user_a, user_b));

    IF conv_id IS NULL THEN
        INSERT INTO public.pulse_conversations (user1_id, user2_id)
        VALUES (LEAST(user_a, user_b), GREATEST(user_a, user_b))
        RETURNING id INTO conv_id;
    END IF;

    RETURN conv_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_thread_archive(p_user_id uuid, p_conversation_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_is_archived BOOLEAN;
BEGIN
  PERFORM public._assert_caller_is(p_user_id);

  PERFORM get_or_create_thread_actions(p_user_id, p_conversation_id);
  UPDATE thread_actions SET is_archived = NOT is_archived, archived_at = CASE WHEN NOT is_archived THEN NOW() ELSE NULL END, updated_at = NOW()
  WHERE user_id = p_user_id AND conversation_id = p_conversation_id RETURNING is_archived INTO v_is_archived;
  RETURN v_is_archived;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_thread_mute(p_user_id uuid, p_conversation_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_is_muted BOOLEAN;
BEGIN
  PERFORM public._assert_caller_is(p_user_id);

  PERFORM get_or_create_thread_actions(p_user_id, p_conversation_id);
  UPDATE thread_actions SET is_muted = NOT is_muted, muted_at = CASE WHEN NOT is_muted THEN NOW() ELSE NULL END, updated_at = NOW()
  WHERE user_id = p_user_id AND conversation_id = p_conversation_id RETURNING is_muted INTO v_is_muted;
  RETURN v_is_muted;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_thread_pin(p_user_id uuid, p_conversation_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_is_pinned BOOLEAN;
BEGIN
  PERFORM public._assert_caller_is(p_user_id);

  PERFORM get_or_create_thread_actions(p_user_id, p_conversation_id);
  UPDATE thread_actions
  SET is_pinned = NOT is_pinned, pinned_at = CASE WHEN NOT is_pinned THEN NOW() ELSE NULL END, updated_at = NOW()
  WHERE user_id = p_user_id AND conversation_id = p_conversation_id RETURNING is_pinned INTO v_is_pinned;
  RETURN v_is_pinned;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_thread_star(p_user_id uuid, p_conversation_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_is_starred BOOLEAN;
BEGIN
  PERFORM public._assert_caller_is(p_user_id);

  PERFORM get_or_create_thread_actions(p_user_id, p_conversation_id);
  UPDATE thread_actions SET is_starred = NOT is_starred, starred_at = CASE WHEN NOT is_starred THEN NOW() ELSE NULL END, updated_at = NOW()
  WHERE user_id = p_user_id AND conversation_id = p_conversation_id RETURNING is_starred INTO v_is_starred;
  RETURN v_is_starred;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_all_engagement_scores(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_contact RECORD;
  v_new_score NUMERIC;
BEGIN
  PERFORM public._assert_caller_is(p_user_id);

  FOR v_contact IN
    SELECT * FROM analytics_contact_engagement WHERE user_id = p_user_id
  LOOP
    v_new_score := calculate_engagement_score(
      v_contact.total_messages_sent + v_contact.total_messages_received,
      COALESCE(v_contact.response_rate, 50),
      COALESCE(v_contact.avg_response_time_minutes, 60),
      v_contact.days_since_last_contact,
      COALESCE(v_contact.avg_sentiment, 0)
    );

    UPDATE analytics_contact_engagement
    SET
      engagement_score = v_new_score,
      updated_at = NOW()
    WHERE id = v_contact.id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_user_stat(p_user_id uuid, p_stat_name text, p_increment integer DEFAULT 1)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  PERFORM public._assert_caller_is(p_user_id);

  INSERT INTO user_message_statistics (user_id, messages_sent, fast_responses, tasks_created, decisions_made)
  VALUES (p_user_id,
    CASE WHEN p_stat_name = 'messages_sent' THEN p_increment ELSE 0 END,
    CASE WHEN p_stat_name = 'fast_responses' THEN p_increment ELSE 0 END,
    CASE WHEN p_stat_name = 'tasks_created' THEN p_increment ELSE 0 END,
    CASE WHEN p_stat_name = 'decisions_made' THEN p_increment ELSE 0 END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    messages_sent = user_message_statistics.messages_sent +
      CASE WHEN p_stat_name = 'messages_sent' THEN p_increment ELSE 0 END,
    fast_responses = user_message_statistics.fast_responses +
      CASE WHEN p_stat_name = 'fast_responses' THEN p_increment ELSE 0 END,
    tasks_created = user_message_statistics.tasks_created +
      CASE WHEN p_stat_name = 'tasks_created' THEN p_increment ELSE 0 END,
    decisions_made = user_message_statistics.decisions_made +
      CASE WHEN p_stat_name = 'decisions_made' THEN p_increment ELSE 0 END,
    updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.update_contact_recency(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  PERFORM public._assert_caller_is(p_user_id);

  UPDATE analytics_contact_engagement
  SET
    days_since_last_contact = EXTRACT(DAY FROM (NOW() - last_interaction_at))::INTEGER,
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND last_interaction_at IS NOT NULL;
END;
$$;

-- ════════════════════════════════════════════════════════════════════
-- N34: contact goal helpers
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.advance_contact_goal(p_goal_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_frequency VARCHAR(20);
    v_days      INT;
BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM contact_goals WHERE id = p_goal_id AND user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'forbidden: not your goal'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT frequency INTO v_frequency FROM contact_goals WHERE id = p_goal_id;
    v_days := CASE v_frequency
        WHEN 'weekly' THEN 7 WHEN 'biweekly' THEN 14 WHEN 'monthly' THEN 30
        WHEN 'quarterly' THEN 90 WHEN 'annually' THEN 365 ELSE 30 END;
    UPDATE contact_goals
    SET last_completed_at = NOW(),
        next_action_at    = NOW() + (v_days * INTERVAL '1 day'),
        updated_at        = NOW()
    WHERE id = p_goal_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_due_autopilot_goals(p_user_id uuid)
RETURNS SETOF contact_goals
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    PERFORM public._assert_caller_is(p_user_id);

    RETURN QUERY SELECT * FROM contact_goals
    WHERE user_id = p_user_id AND autopilot_enabled = true AND next_action_at <= NOW();
END;
$$;

-- Cleanup helper — restrict to service_role
REVOKE ALL ON FUNCTION public.cleanup_expired_feed_items() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_expired_feed_items() FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_feed_items() TO service_role;
