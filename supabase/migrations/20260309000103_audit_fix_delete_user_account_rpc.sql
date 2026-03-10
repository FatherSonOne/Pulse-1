-- ============================================================
-- MIGRATION: 20260309000103_audit_fix_delete_user_account_rpc.sql
-- PURPOSE:   Fix delete_user_account() RPC with:
--            1. Correct table name (pulse_profiles → user_profiles)
--            2. Complete cascade covering all user-owned tables
--            3. Workspace cleanup (remove from workspace_members;
--               delete owned workspaces if no other members)
-- ISSUE:     C-2 from 2026-03-09 database audit
-- SAFE:      CREATE OR REPLACE
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
    DELETE FROM archives                WHERE user_id      = target_user_id;

    -- ── CRM / Contacts ─────────────────────────────────────────
    DELETE FROM contacts                WHERE user_id      = target_user_id;
    DELETE FROM relationships           WHERE user_id      = target_user_id;

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

    -- ── Profile (last) ─────────────────────────────────────────
    -- CORRECTED: table is user_profiles, not pulse_profiles
    DELETE FROM user_profiles           WHERE id           = target_user_id;

    -- NOTE: auth.users deletion must be handled via supabase.auth.admin.deleteUser()
    -- or by the client calling supabase.auth.signOut() then admin API.
END;
$$;

COMMIT;
