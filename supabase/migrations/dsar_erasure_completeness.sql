-- ============================================================
-- MIGRATION: dsar_erasure_completeness.sql
-- PURPOSE:   Make delete_user_account() a COMPLETE erasure so the
--            self-serve delete-account edge function can subsequently
--            remove auth.users without FK violations, and so no user
--            content survives.
-- ISSUE:     #111 — GDPR Art. 17 / CCPA right-to-delete (DSAR).
-- SAFE:      CREATE OR REPLACE (idempotent; supersedes
--            20260309000103_audit_fix_delete_user_account_rpc.sql).
--
-- WHAT CHANGED (2026-05-27, #111):
--   1. KEEPS the auth.uid() guard + every existing DELETE verbatim.
--   2. ADDS manual deletes for tables with NO FK to auth.users
--      (they would NOT cascade when auth.users is removed):
--        team_vox_messages, broadcasts, decisions, decision_tasks,
--        decision_votes, contact_circles, contact_goals, saved_searches,
--        event_rsvp, in_app_messages, relationship_profiles,
--        push_subscriptions, oauth_connected_apps, and the canonical
--        pulse_users row.
--   3. CLEARS the 13 NO-ACTION ('a') FK columns that would otherwise
--      BLOCK auth.admin.deleteUser(). Policy: the user's own content is
--      DELETEd; a record someone else owns that the user merely acted on
--      is SET NULL.
--   4. ADDS pulse_users (auth_user_id has no FK → would otherwise
--      survive as an orphaned canonical profile).
--
-- ORDERING: auth.users deletion happens in the EDGE FUNCTION after this
--   RPC returns, so ordering within the RPC is flexible. The auth.uid()
--   guard MUST stay first. All referenced tables are verified to exist in
--   the live pulse-chat DB (ref ucaeuszgoihoyrvhewxk), so plain statements
--   are used (no per-statement undefined_table guards needed).
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only allow users to delete their own account
    IF auth.uid() != target_user_id THEN
        RAISE EXCEPTION 'Not authorized to delete this account';
    END IF;

    -- ── Messaging ──────────────────────────────────────────────
    DELETE FROM pulse_messages          WHERE sender_id    = target_user_id
                                           OR recipient_id = target_user_id;
    DELETE FROM pulse_conversations     WHERE user1_id     = target_user_id
                                           OR user2_id     = target_user_id;
    -- team_vox_messages has NO auth.users FK → will not cascade; delete here.
    DELETE FROM team_vox_messages       WHERE sender_id    = target_user_id;
    -- broadcasts has NO auth.users FK → will not cascade; delete here.
    DELETE FROM broadcasts              WHERE author_id    = target_user_id;
    -- in_app_messages has NO auth.users FK → will not cascade; delete here.
    DELETE FROM in_app_messages         WHERE created_by   = target_user_id;

    -- ── Voxer ──────────────────────────────────────────────────
    DELETE FROM voxer_recordings        WHERE user_id      = target_user_id;
    DELETE FROM quick_vox_messages      WHERE sender_id    = target_user_id;
    DELETE FROM quick_vox_favorites     WHERE user_id      = target_user_id;
    DELETE FROM quick_vox_status        WHERE user_id      = target_user_id;
    DELETE FROM vox_notes               WHERE user_id      = target_user_id;
    DELETE FROM vox_drops               WHERE user_id      = target_user_id;
    DELETE FROM vox_notifications       WHERE user_id      = target_user_id;

    -- ── Email ──────────────────────────────────────────────────
    DELETE FROM emails                  WHERE user_id      = target_user_id;
    DELETE FROM email_campaigns         WHERE user_id      = target_user_id;
    DELETE FROM email_segments          WHERE user_id      = target_user_id;

    -- ── Calendar / Tasks ───────────────────────────────────────
    DELETE FROM calendar_events         WHERE user_id      = target_user_id;
    DELETE FROM tasks                   WHERE user_id      = target_user_id;
    -- event_rsvp has NO auth.users FK → will not cascade; delete here.
    DELETE FROM event_rsvp              WHERE user_id      = target_user_id;
    -- subtasks.created_by / completed_by are NO-ACTION FKs that would BLOCK
    -- the auth.users delete. Own content → delete; other people's subtasks
    -- this user merely completed → null out the actor reference.
    DELETE FROM subtasks                WHERE created_by   = target_user_id;
    UPDATE subtasks SET completed_by = NULL
                                        WHERE completed_by = target_user_id;
    -- task_activity.user_id is a NO-ACTION FK blocker → delete the rows.
    DELETE FROM task_activity           WHERE user_id      = target_user_id;

    -- ── Decisions ──────────────────────────────────────────────
    -- None of these have an auth.users FK → none cascade; delete in
    -- child→parent order (votes/tasks before the decisions themselves).
    DELETE FROM decision_votes          WHERE user_id      = target_user_id;
    DELETE FROM decision_tasks          WHERE created_by   = target_user_id;
    DELETE FROM decisions               WHERE created_by   = target_user_id;

    -- ── AI Lab ─────────────────────────────────────────────────
    DELETE FROM ai_lab_workflows        WHERE user_id      = target_user_id;
    DELETE FROM ai_lab_templates        WHERE user_id      = target_user_id;
    DELETE FROM ai_lab_outputs          WHERE user_id      = target_user_id;

    -- ── AI Sessions / Intelligence ─────────────────────────────
    DELETE FROM brainstorm_sessions     WHERE user_id      = target_user_id;
    DELETE FROM conversation_summaries  WHERE user_id      = target_user_id;

    -- ── Attention / Focus ──────────────────────────────────────
    DELETE FROM attention_logs          WHERE user_id      = target_user_id;
    DELETE FROM attention_settings      WHERE user_id      = target_user_id;
    DELETE FROM focus_sessions          WHERE user_id      = target_user_id;

    -- ── Archives / Search ──────────────────────────────────────
    -- archives.created_by is a NO-ACTION FK blocker; extend the existing
    -- user_id delete to also catch rows the user created.
    DELETE FROM archives                WHERE user_id      = target_user_id
                                           OR created_by   = target_user_id;
    -- saved_searches has NO auth.users FK → will not cascade; delete here.
    DELETE FROM saved_searches          WHERE user_id      = target_user_id;

    -- ── CRM / Contacts ─────────────────────────────────────────
    DELETE FROM contacts                WHERE user_id      = target_user_id;
    DELETE FROM relationships           WHERE user_id      = target_user_id;
    -- The following have NO auth.users FK → will not cascade; delete here.
    DELETE FROM contact_circles         WHERE user_id      = target_user_id;
    DELETE FROM contact_goals           WHERE user_id      = target_user_id;
    DELETE FROM relationship_profiles   WHERE user_id      = target_user_id;
    -- crm_actions.triggered_by_user_id is a NO-ACTION FK blocker → delete.
    DELETE FROM crm_actions             WHERE triggered_by_user_id = target_user_id;
    -- crm_contacts.pulse_user_id / crm_deals.linked_chat_id are NO-ACTION
    -- blockers pointing at the *acting* user, not ownership → null them out.
    UPDATE crm_contacts SET pulse_user_id = NULL
                                        WHERE pulse_user_id = target_user_id;
    UPDATE crm_deals    SET linked_chat_id = NULL
                                        WHERE linked_chat_id = target_user_id;
    -- crm_integrations.workspace_id→auth.users is a legacy quirk FK; the row
    -- is the user's own integration → delete it.
    DELETE FROM crm_integrations        WHERE workspace_id = target_user_id;

    -- ── Ecosystem / Org / Sharing (NO-ACTION FK blockers) ──────
    UPDATE ecosystem_alerts SET acknowledged_by = NULL
                                        WHERE acknowledged_by = target_user_id;
    DELETE FROM org_invites             WHERE invited_by   = target_user_id;
    UPDATE org_members  SET invited_by = NULL
                                        WHERE invited_by   = target_user_id;
    UPDATE share_invites SET accepted_by = NULL
                                        WHERE accepted_by  = target_user_id;
    UPDATE user_sessions SET revoked_by_user_id = NULL
                                        WHERE revoked_by_user_id = target_user_id;

    -- ── Connected apps / Push ──────────────────────────────────
    -- No auth.users FK on these → will not cascade; delete here.
    DELETE FROM push_subscriptions      WHERE user_id      = target_user_id;
    DELETE FROM oauth_connected_apps    WHERE user_id      = target_user_id;

    -- ── Settings / Subscriptions ───────────────────────────────
    DELETE FROM user_settings           WHERE user_id      = target_user_id;
    DELETE FROM team_invites            WHERE invited_by   = target_user_id;
    DELETE FROM user_subscriptions      WHERE user_id      = target_user_id;

    -- ── Workspace membership ───────────────────────────────────
    -- Remove user from all workspaces they're a member of
    DELETE FROM workspace_members       WHERE user_id      = target_user_id;

    -- Delete workspaces owned by this user that have no remaining members
    DELETE FROM workspaces
    WHERE owner_id = target_user_id
      AND NOT EXISTS (
          SELECT 1 FROM workspace_members wm
          WHERE wm.workspace_id = workspaces.id
      );

    -- ── Canonical user / Profile (last) ────────────────────────
    -- pulse_users.auth_user_id has NO FK → it would survive as an orphaned
    -- canonical profile (display_name/handle/avatar) unless deleted here.
    DELETE FROM pulse_users             WHERE auth_user_id = target_user_id;
    -- user_profiles.id → auth.users (kept verbatim from prior migration).
    DELETE FROM user_profiles           WHERE id           = target_user_id;

    -- NOTE: auth.users deletion is handled by the delete-account edge
    -- function via supabase.auth.admin.deleteUser() AFTER this RPC returns.
    -- ON DELETE CASCADE / SET NULL FKs auto-clean the remaining references;
    -- the NO-ACTION blockers above have already been cleared.
END;
$$;

COMMIT;
