-- Fix delete_user_account: FIVE classes of bug that made the GDPR self-erasure
-- (delete-account edge fn) return 500 and erase NOTHING. Verified 2026-05-31 via
-- a throwaway-account test: the edge fn 500'd and the account stayed fully intact.
--
-- The RPC runs as ONE transaction, so the first failure aborted everything and
-- masked every bug behind it. Each was found by replaying the full body inside a
-- rolled-back transaction until it reached a sentinel with zero errors. This file
-- matches the validated, deployed function verbatim.
--
-- 1. FK ORDER: deleted pulse_messages BEFORE pulse_conversations, but
--    pulse_conversations.last_message_id is a NO-ACTION FK -> pulse_messages.
--    Deleting a message still referenced as a conversation's last_message_id raised
--    "violates foreign key constraint pulse_conversations_last_message_id_fkey".
--    Fix: delete pulse_conversations first (matched by user1_id/user2_id). The other
--    5 FKs into pulse_messages (annotations/bookmarks/highlights/reactions/starred)
--    are ON DELETE CASCADE and self-clean.
--
-- 2. DEAD TABLE: referenced team_invites, which does not exist (real table is
--    org_invites, already handled). Removed.
--
-- 3. WRONG / MISSING COLUMNS — three tables have no user_id; the correct keys are:
--      vox_drops           -> sender_id      (no user_id/creator_id)
--      brainstorm_sessions -> owner_id       (no user_id/created_by)
--      relationships       -> created_by     (TEXT; no user_id/owner_user_id)
--    (vox_notes DOES have user_id and is left as-is.)
--
-- 4. TEXT vs UUID: 10 columns store the id as TEXT, not uuid, so comparing to a
--    uuid raised "operator does not exist: text = uuid":
--      archives.user_id, calendar_events.user_id, contact_circles.user_id,
--      contacts.user_id, decision_votes.user_id, decisions.created_by, emails.user_id,
--      event_rsvp.user_id, tasks.user_id, voxer_recordings.user_id
--      (+ relationships.created_by from #3). Compared against target_user_id::text.
--
-- 5. LAST-OWNER GUARD: the workspace_members_protect_last_owner() trigger blocked
--    removing the user's membership in a workspace they solely own ("cannot remove
--    or demote the last owner"). For a self-erasure that's correct to bypass — the
--    trigger exposes an app.skip_last_owner_check GUC for exactly this. We set it
--    for the txn, delete the membership, then drop any now-empty owned workspaces
--    (shared workspaces with other members are preserved).

CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    uid_text text := target_user_id::text;  -- for columns that store the id as TEXT
BEGIN
    -- Only allow users to delete their own account
    IF auth.uid() != target_user_id THEN
        RAISE EXCEPTION 'Not authorized to delete this account';
    END IF;

    -- Self-erasure legitimately removes the sole owner of the user's OWN
    -- workspaces; bypass the last-owner protection trigger for this txn only.
    PERFORM set_config('app.skip_last_owner_check', 'on', true);

    -- Messaging
    -- Conversations FIRST: pulse_conversations.last_message_id is a NO-ACTION FK
    -- into pulse_messages, so conversation rows must go before the messages.
    DELETE FROM pulse_conversations     WHERE user1_id = target_user_id OR user2_id = target_user_id;
    DELETE FROM pulse_messages          WHERE sender_id = target_user_id OR recipient_id = target_user_id;
    DELETE FROM team_vox_messages       WHERE sender_id = target_user_id;
    DELETE FROM broadcasts              WHERE author_id = target_user_id;
    DELETE FROM in_app_messages         WHERE created_by = target_user_id;

    -- Voxer
    DELETE FROM voxer_recordings        WHERE user_id = uid_text;            -- user_id is TEXT
    DELETE FROM quick_vox_messages      WHERE sender_id = target_user_id;
    DELETE FROM quick_vox_favorites     WHERE user_id = target_user_id;
    DELETE FROM quick_vox_status        WHERE user_id = target_user_id;
    DELETE FROM vox_notes               WHERE user_id = target_user_id;
    DELETE FROM vox_drops               WHERE sender_id = target_user_id;    -- no user_id col
    DELETE FROM vox_notifications       WHERE user_id = target_user_id;

    -- Email
    DELETE FROM emails                  WHERE user_id = uid_text;            -- TEXT
    DELETE FROM email_campaigns         WHERE user_id = target_user_id;
    DELETE FROM email_segments          WHERE user_id = target_user_id;

    -- Calendar / Tasks
    DELETE FROM calendar_events         WHERE user_id = uid_text;            -- TEXT
    DELETE FROM tasks                   WHERE user_id = uid_text;            -- TEXT
    DELETE FROM event_rsvp              WHERE user_id = uid_text;            -- TEXT
    DELETE FROM subtasks                WHERE created_by = target_user_id;
    UPDATE subtasks SET completed_by = NULL WHERE completed_by = target_user_id;
    DELETE FROM task_activity           WHERE user_id = target_user_id;

    -- Decisions (child -> parent)
    DELETE FROM decision_votes          WHERE user_id = uid_text;            -- TEXT
    DELETE FROM decision_tasks          WHERE created_by = target_user_id;
    DELETE FROM decisions               WHERE created_by = uid_text;         -- TEXT

    -- AI Lab
    DELETE FROM ai_lab_workflows        WHERE user_id = target_user_id;
    DELETE FROM ai_lab_templates        WHERE user_id = target_user_id;
    DELETE FROM ai_lab_outputs          WHERE user_id = target_user_id;

    -- AI Sessions / Intelligence (brainstorm_sessions keyed by owner_id)
    DELETE FROM brainstorm_sessions     WHERE owner_id = target_user_id;
    DELETE FROM conversation_summaries  WHERE user_id = target_user_id;

    -- Attention / Focus
    DELETE FROM attention_logs          WHERE user_id = target_user_id;
    DELETE FROM attention_settings      WHERE user_id = target_user_id;
    DELETE FROM focus_sessions          WHERE user_id = target_user_id;

    -- Archives / Search
    DELETE FROM archives                WHERE user_id = uid_text OR created_by = target_user_id;  -- user_id TEXT
    DELETE FROM saved_searches          WHERE user_id = target_user_id;

    -- CRM / Contacts (relationships keyed by created_by, which is TEXT)
    DELETE FROM contacts                WHERE user_id = uid_text;            -- TEXT
    DELETE FROM relationships           WHERE created_by = uid_text;         -- TEXT
    DELETE FROM contact_circles         WHERE user_id = uid_text;            -- TEXT
    DELETE FROM contact_goals           WHERE user_id = target_user_id;
    DELETE FROM relationship_profiles   WHERE user_id = target_user_id;
    DELETE FROM crm_actions             WHERE triggered_by_user_id = target_user_id;
    UPDATE crm_contacts SET pulse_user_id = NULL WHERE pulse_user_id = target_user_id;
    UPDATE crm_deals    SET linked_chat_id = NULL WHERE linked_chat_id = target_user_id;
    DELETE FROM crm_integrations        WHERE workspace_id = target_user_id;

    -- Ecosystem / Org / Sharing (NO-ACTION FK blockers)
    UPDATE ecosystem_alerts SET acknowledged_by = NULL WHERE acknowledged_by = target_user_id;
    DELETE FROM org_invites             WHERE invited_by = target_user_id;
    UPDATE org_members  SET invited_by = NULL WHERE invited_by = target_user_id;
    UPDATE share_invites SET accepted_by = NULL WHERE accepted_by = target_user_id;
    UPDATE user_sessions SET revoked_by_user_id = NULL WHERE revoked_by_user_id = target_user_id;

    -- Connected apps / Push
    DELETE FROM push_subscriptions      WHERE user_id = target_user_id;
    DELETE FROM oauth_connected_apps    WHERE user_id = target_user_id;

    -- Settings / Subscriptions
    DELETE FROM user_settings           WHERE user_id = target_user_id;
    DELETE FROM user_subscriptions      WHERE user_id = target_user_id;

    -- Workspace membership first (guard bypassed above), then drop now-empty
    -- owned workspaces (shared workspaces with other members are preserved).
    DELETE FROM workspace_members       WHERE user_id = target_user_id;
    DELETE FROM workspaces
    WHERE owner_id = target_user_id
      AND NOT EXISTS (
          SELECT 1 FROM workspace_members wm
          WHERE wm.workspace_id = workspaces.id
      );

    -- Canonical user / Profile (last)
    DELETE FROM pulse_users             WHERE auth_user_id = target_user_id;
    DELETE FROM user_profiles           WHERE id = target_user_id;
END;
$function$;
