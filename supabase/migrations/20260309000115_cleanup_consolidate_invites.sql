-- ============================================================
-- MIGRATION: 20260309000115_cleanup_consolidate_invites.sql
-- PURPOSE:   Consolidate the duplicate invite system.
--            team_invites (simple, no workspace, active in frontend)
--            is replaced by workspace_invites (proper multi-tenant,
--            token-based, role-scoped, with expiry).
--
--            Steps:
--              1. Migrate existing team_invites rows → workspace_invites
--                 (assigns each invite to the inviter's first workspace)
--              2. DROP TABLE team_invites
--
--            The frontend service (inviteService.ts) is updated separately
--            to target workspace_invites.
-- ISSUE:     H-2 from 2026-03-09 database audit
-- SAFE:      Data preserved via INSERT before DROP
--            Idempotent: skips if team_invites already gone
-- ============================================================

BEGIN;

-- ── 1. Migrate existing team_invites → workspace_invites ─────
-- Only run if team_invites still exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'team_invites'
  ) THEN
    INSERT INTO public.workspace_invites (
        workspace_id, email, role, token, invited_by,
        accepted_at, expires_at, created_at
    )
    SELECT
        wm.workspace_id,
        ti.email,
        'member' AS role,
        encode(gen_random_bytes(32), 'hex') AS token,
        ti.invited_by,
        CASE ti.status WHEN 'accepted' THEN ti.created_at ELSE NULL END AS accepted_at,
        GREATEST(ti.created_at + INTERVAL '7 days', now() + INTERVAL '1 day') AS expires_at,
        ti.created_at
    FROM public.team_invites ti
    JOIN LATERAL (
        SELECT workspace_id
        FROM public.workspace_members
        WHERE user_id = ti.invited_by
        ORDER BY created_at
        LIMIT 1
    ) wm ON true
    WHERE NOT EXISTS (
        SELECT 1 FROM public.workspace_invites wi
        WHERE wi.workspace_id = wm.workspace_id AND wi.email = ti.email
    );
  END IF;
END
$$;

-- ── 2. Drop team_invites ──────────────────────────────────────
DROP TABLE IF EXISTS public.team_invites;

COMMIT;
