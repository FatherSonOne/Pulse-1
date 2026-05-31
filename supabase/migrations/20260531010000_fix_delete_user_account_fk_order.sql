-- Fix delete_user_account: FK-ordering bug + reference to a non-existent table.
--
-- Two bugs caused the self-serve GDPR erasure (delete-account edge fn) to 500
-- and erase NOTHING (verified 2026-05-31 via a throwaway-account test):
--
-- 1. FK ORDER: the function deleted from pulse_messages BEFORE pulse_conversations,
--    but pulse_conversations.last_message_id has a NO-ACTION FK -> pulse_messages.
--    Deleting a message still referenced as a conversation's last_message_id raised
--    "violates foreign key constraint pulse_conversations_last_message_id_fkey" and
--    aborted the whole (single-transaction) RPC. Fix: delete pulse_conversations
--    first (it's matched by user1_id/user2_id regardless), which clears the
--    last_message_id references before the messages are removed. The other 5 FKs
--    into pulse_messages (annotations, bookmarks, highlights, reactions, starred)
--    are ON DELETE CASCADE and need no handling.
--
-- 2. DEAD TABLE: the function referenced `team_invites`, which does not exist in
--    this database (the real table is org_invites, already handled). Left in place
--    it would raise undefined_table once bug #1 was fixed. Removed.
--
-- Everything else is preserved verbatim from the prior definition.

CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Only allow users to delete their own account
    IF auth.uid() != target_user_id THEN
        RAISE EXCEPTION 'Not authorized to delete this account';
    END IF;

    -- Messaging
    -- Conversations FIRST: pulse_conversations.last_message_id is a NO-ACTION FK
    -- into pulse_messages, so the conversation rows (which reference this user's
    -- messages as "last message") must go before the messages themselves.
    DELETE FROM pulse_conversations     WHERE user1_id     = target_user_id
                                           OR user2_id     = target_user_id;
    DELETE FROM pulse_messages          WHERE sender_id    = target_user_id
                                           OR recipient_id = target_user_id;
    DELETE FROM team_vox_messages       WHERE sender_id    = target_user_id;
    DELETE FROM broadcasts              WHERE author_id    = target_user_id;
    DELETE FROM in_app_messages         WHERE created_by   = target_user_id;

    -- Voxer
    DELETE FROM voxer_recordings        WHERE user_id      = target_user_id;
    DELETE FROM quick_vox_messages      WHERE sender_id    = target_user_id;
    DELETE FROM quick_vox_favorites     WHERE user_id      = target_user_id;
    DELETE FROM quick_vox_status        WHERE user_id      = target_user_id;
    DELETE FROM vox_notes               WHERE user_id      = target_user_id;
    DELETE FROM vox_drops               WHERE user_id      = target_user_id;
    DELETE FROM vox_notifications       WHERE user_id      = target_user_id;

    -- Email
    DELETE FROM emails                  WHERE user_id      = target_user_id;
    DELETE FROM email_campaigns         WHERE user_id      = target_user_id;
    DELETE FROM email_segments          WHERE user_id      = target_user_id;

    -- Calendar / Tasks
    DELETE FROM calendar_events         WHERE user_id      = target_user_id;
    DELETE FROM tasks                   WHERE user_id      = target_user_id;
    DELETE FROM event_rsvp              WHERE user_id      = target_user_id;
    DELETE FROM subtasks                WHERE created_by   = target_user_id;
    UPDATE subtasks SET completed_by = NULL
                                        WHERE completed_by = target_user_id;
    DELETE FROM task_activity           WHERE user_id      = target_user_id;

    -- Decisions (child -> parent)
    DELETE FROM decision_votes          WHERE user_id      = target_user_id;
    DELETE FROM decision_tasks          WHERE created_by   = target_user_id;
    DELETE FROM decisions               WHERE created_by   = target_user_id;

    -- AI Lab
    DELETE FROM ai_lab_workflows        WHERE user_id      = target_user_id;
    DELETE FROM ai_lab_templates        WHERE user_id      = target_user_id;
    DELETE FROM ai_lab_outputs          WHERE user_id      = target_user_id;

    -- AI Sessions / Intelligence
    DELETE FROM brainstorm_sessions     WHERE user_id      = target_user_id;
    DELETE FROM conversation_summaries  WHERE user_id      = target_user_id;

    -- Attention / Focus
    DELETE FROM attention_logs          WHERE user_id      = target_user_id;
    DELETE FROM attention_settings      WHERE user_id      = target_user_id;
    DELETE FROM focus_sessions          WHERE user_id      = target_user_id;

    -- Archives / Search
    DELETE FROM archives                WHERE user_id      = target_user_id
                                           OR created_by   = target_user_id;
    DELETE FROM saved_searches          WHERE user_id      = target_user_id;

    -- CRM / Contacts
    DELETE FROM contacts                WHERE user_id      = target_user_id;
    DELETE FROM relationships           WHERE user_id      = target_user_id;
    DELETE FROM contact_circles         WHERE user_id      = target_user_id;
    DELETE FROM contact_goals           WHERE user_id      = target_user_id;
    DELETE FROM relationship_profiles   WHERE user_id      = target_user_id;
    DELETE FROM crm_actions             WHERE triggered_by_user_id = target_user_id;
    UPDATE crm_contacts SET pulse_user_id = NULL
                                        WHERE pulse_user_id = target_user_id;
    UPDATE crm_deals    SET linked_chat_id = NULL
                                        WHERE linked_chat_id = target_user_id;
    DELETE FROM crm_integrations        WHERE workspace_id = target_user_id;

    -- Ecosystem / Org / Sharing (NO-ACTION FK blockers)
    UPDATE ecosystem_alerts SET acknowledged_by = NULL
                                        WHERE acknowledged_by = target_user_id;
    DELETE FROM org_invites             WHERE invited_by   = target_user_id;
    UPDATE org_members  SET invited_by = NULL
                                        WHERE invited_by   = target_user_id;
    UPDATE share_invites SET accepted_by = NULL
                                        WHERE accepted_by  = target_user_id;
    UPDATE user_sessions SET revoked_by_user_id = NULL
                                        WHERE revoked_by_user_id = target_user_id;

    -- Connected apps / Push
    DELETE FROM push_subscriptions      WHERE user_id      = target_user_id;
    DELETE FROM oauth_connected_apps    WHERE user_id      = target_user_id;

    -- Settings / Subscriptions
    DELETE FROM user_settings           WHERE user_id      = target_user_id;
    DELETE FROM user_subscriptions      WHERE user_id      = target_user_id;

    -- Workspace membership
    DELETE FROM workspace_members       WHERE user_id      = target_user_id;
    DELETE FROM workspaces
    WHERE owner_id = target_user_id
      AND NOT EXISTS (
          SELECT 1 FROM workspace_members wm
          WHERE wm.workspace_id = workspaces.id
      );

    -- Canonical user / Profile (last)
    DELETE FROM pulse_users             WHERE auth_user_id = target_user_id;
    DELETE FROM user_profiles           WHERE id           = target_user_id;
END;
$function$;
