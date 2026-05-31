-- Block destructive deletes when a live Stripe subscription would keep charging.
--
-- Context (verified 2026-05-31): billing is per-WORKSPACE — paid subs live in
-- public.subscriptions.workspace_id -> stripe_subscription_id, and the Stripe
-- customer is workspaces.stripe_customer_id. BUT neither delete path touched
-- Stripe:
--   * hard_delete_workspace() just `DELETE FROM workspaces` (sub row cascades
--     away locally, Stripe keeps billing the now-deleted workspace).
--   * delete_user_account() deletes the user's owned workspaces, same leak.
-- Result: the card keeps getting charged for a workspace that no longer exists,
-- with no in-app way to cancel it (chargeback / FTC negative-option risk).
--
-- There is NO refund/cancel code in the app — cancellation happens only through
-- Stripe's Customer Portal (Settings -> Billing -> Manage Subscription), where
-- the operator's portal config defines the actual cancel/refund/proration
-- policy. So the safe v1 fix is to BLOCK deletion while a live sub exists and
-- point the user at the portal; once they cancel, the billing webhook flips the
-- sub to 'canceled' and deletion proceeds.
--
-- "Live" = stripe_subscription_id IS NOT NULL AND status IN
-- ('active','trialing','past_due','unpaid'). trialing counts: it auto-converts
-- to a charge, so a stranded trial still bills later. canceled/paused do not block.

-- 1) Org hard-delete guard ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.hard_delete_workspace(p_workspace_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_legal_hold boolean;
begin
  select legal_hold
    into v_legal_hold
  from public.workspaces
  where id = p_workspace_id
    and owner_id = auth.uid();

  if not found then
    raise exception 'Permission denied: only the workspace owner can permanently delete';
  end if;

  if v_legal_hold then
    raise exception 'Cannot permanently delete: workspace is under legal hold. Disable legal hold first.';
  end if;

  if exists (
    select 1 from public.subscriptions s
    where s.workspace_id = p_workspace_id
      and s.stripe_subscription_id is not null
      and s.status in ('active','trialing','past_due','unpaid')
  ) then
    raise exception 'Cannot delete: this organization has an active subscription. Cancel your plan first (Settings -> Billing -> Manage Subscription), then delete.'
      using errcode = 'check_violation',
            hint = 'Cancel the Stripe subscription via the Customer Portal before deleting.';
  end if;

  delete from public.workspaces
  where id = p_workspace_id;
end;
$function$;

-- 2) Account-erasure guard ---------------------------------------------------
-- Identical predicate, but across EVERY workspace the user owns. Placed right
-- after the auth check so it fails fast before any data is deleted. The rest of
-- the body is the 2026-05-31 validated erasure (see
-- 20260531010000_fix_delete_user_account_fk_order.sql for the bug history).
CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    uid_text text := target_user_id::text;
BEGIN
    IF auth.uid() != target_user_id THEN
        RAISE EXCEPTION 'Not authorized to delete this account';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.subscriptions s
        JOIN public.workspaces w ON w.id = s.workspace_id
        WHERE w.owner_id = target_user_id
          AND s.stripe_subscription_id IS NOT NULL
          AND s.status IN ('active','trialing','past_due','unpaid')
    ) THEN
        RAISE EXCEPTION 'Cannot delete account: you own an organization with an active subscription. Cancel your plan first (Settings -> Billing -> Manage Subscription), then delete your account.'
          USING ERRCODE = 'check_violation',
                HINT = 'Cancel the Stripe subscription via the Customer Portal before erasing the account.';
    END IF;

    -- Self-erasure legitimately removes the sole owner of the user's OWN
    -- workspaces; bypass the last-owner protection trigger for this txn only.
    PERFORM set_config('app.skip_last_owner_check', 'on', true);

    DELETE FROM pulse_conversations     WHERE user1_id = target_user_id OR user2_id = target_user_id;
    DELETE FROM pulse_messages          WHERE sender_id = target_user_id OR recipient_id = target_user_id;
    DELETE FROM team_vox_messages       WHERE sender_id = target_user_id;
    DELETE FROM broadcasts              WHERE author_id = target_user_id;
    DELETE FROM in_app_messages         WHERE created_by = target_user_id;

    DELETE FROM voxer_recordings        WHERE user_id = uid_text;            -- TEXT
    DELETE FROM quick_vox_messages      WHERE sender_id = target_user_id;
    DELETE FROM quick_vox_favorites     WHERE user_id = target_user_id;
    DELETE FROM quick_vox_status        WHERE user_id = target_user_id;
    DELETE FROM vox_notes               WHERE user_id = target_user_id;
    DELETE FROM vox_drops               WHERE sender_id = target_user_id;    -- no user_id col
    DELETE FROM vox_notifications       WHERE user_id = target_user_id;

    DELETE FROM emails                  WHERE user_id = uid_text;            -- TEXT
    DELETE FROM email_campaigns         WHERE user_id = target_user_id;
    DELETE FROM email_segments          WHERE user_id = target_user_id;

    DELETE FROM calendar_events         WHERE user_id = uid_text;            -- TEXT
    DELETE FROM tasks                   WHERE user_id = uid_text;            -- TEXT
    DELETE FROM event_rsvp              WHERE user_id = uid_text;            -- TEXT
    DELETE FROM subtasks                WHERE created_by = target_user_id;
    UPDATE subtasks SET completed_by = NULL WHERE completed_by = target_user_id;
    DELETE FROM task_activity           WHERE user_id = target_user_id;

    DELETE FROM decision_votes          WHERE user_id = uid_text;            -- TEXT
    DELETE FROM decision_tasks          WHERE created_by = target_user_id;
    DELETE FROM decisions               WHERE created_by = uid_text;         -- TEXT

    DELETE FROM ai_lab_workflows        WHERE user_id = target_user_id;
    DELETE FROM ai_lab_templates        WHERE user_id = target_user_id;
    DELETE FROM ai_lab_outputs          WHERE user_id = target_user_id;

    DELETE FROM brainstorm_sessions     WHERE owner_id = target_user_id;     -- no user_id col
    DELETE FROM conversation_summaries  WHERE user_id = target_user_id;

    DELETE FROM attention_logs          WHERE user_id = target_user_id;
    DELETE FROM attention_settings      WHERE user_id = target_user_id;
    DELETE FROM focus_sessions          WHERE user_id = target_user_id;

    DELETE FROM archives                WHERE user_id = uid_text OR created_by = target_user_id;  -- user_id TEXT
    DELETE FROM saved_searches          WHERE user_id = target_user_id;

    DELETE FROM contacts                WHERE user_id = uid_text;            -- TEXT
    DELETE FROM relationships           WHERE created_by = uid_text;         -- TEXT, no user_id col
    DELETE FROM contact_circles         WHERE user_id = uid_text;            -- TEXT
    DELETE FROM contact_goals           WHERE user_id = target_user_id;
    DELETE FROM relationship_profiles   WHERE user_id = target_user_id;
    DELETE FROM crm_actions             WHERE triggered_by_user_id = target_user_id;
    UPDATE crm_contacts SET pulse_user_id = NULL WHERE pulse_user_id = target_user_id;
    UPDATE crm_deals    SET linked_chat_id = NULL WHERE linked_chat_id = target_user_id;
    DELETE FROM crm_integrations        WHERE workspace_id = target_user_id;

    UPDATE ecosystem_alerts SET acknowledged_by = NULL WHERE acknowledged_by = target_user_id;
    DELETE FROM org_invites             WHERE invited_by = target_user_id;
    UPDATE org_members  SET invited_by = NULL WHERE invited_by = target_user_id;
    UPDATE share_invites SET accepted_by = NULL WHERE accepted_by = target_user_id;
    UPDATE user_sessions SET revoked_by_user_id = NULL WHERE revoked_by_user_id = target_user_id;

    DELETE FROM push_subscriptions      WHERE user_id = target_user_id;
    DELETE FROM oauth_connected_apps    WHERE user_id = target_user_id;

    DELETE FROM user_settings           WHERE user_id = target_user_id;
    DELETE FROM user_subscriptions      WHERE user_id = target_user_id;

    DELETE FROM workspace_members       WHERE user_id = target_user_id;
    DELETE FROM workspaces WHERE owner_id = target_user_id
      AND NOT EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = workspaces.id);

    DELETE FROM pulse_users             WHERE auth_user_id = target_user_id;
    DELETE FROM user_profiles           WHERE id = target_user_id;
END;
$function$;
