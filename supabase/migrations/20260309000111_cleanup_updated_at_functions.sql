-- ============================================================
-- MIGRATION: 20260309000111_cleanup_updated_at_functions.sql
-- PURPOSE:   Remove 3 table-specific updated_at trigger functions
--            that are identical to the generic update_updated_at_column().
--            Each trigger is first updated to use the generic function,
--            then the redundant function is dropped.
--
--            Redundant functions removed:
--              - update_video_vox_updated_at()
--              - set_workspaces_updated_at()
--              - update_brainstorm_session_updated_at()
--
-- ISSUE:     M-2 from 2026-03-09 database audit
-- SAFE:      Triggers are replaced before functions are dropped
-- ============================================================

BEGIN;

-- ── video_vox_conversations ──────────────────────────────────
-- Drop any existing trigger by either known name, then create canonical one.

DROP TRIGGER IF EXISTS update_video_vox_conversations_updated_at
    ON public.video_vox_conversations;
DROP TRIGGER IF EXISTS trigger_update_video_vox_conversations_updated_at
    ON public.video_vox_conversations;

CREATE TRIGGER update_video_vox_conversations_updated_at
    BEFORE UPDATE ON public.video_vox_conversations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CASCADE in case any other trigger names still depend on this function.
DROP FUNCTION IF EXISTS public.update_video_vox_updated_at() CASCADE;

-- ── workspaces ───────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_workspaces_updated_at ON public.workspaces;
DROP TRIGGER IF EXISTS trigger_workspaces_updated_at ON public.workspaces;
DROP TRIGGER IF EXISTS set_workspaces_updated_at ON public.workspaces;

CREATE TRIGGER trg_workspaces_updated_at
    BEFORE UPDATE ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP FUNCTION IF EXISTS public.set_workspaces_updated_at() CASCADE;

-- ── brainstorm_sessions ──────────────────────────────────────

DROP TRIGGER IF EXISTS update_brainstorm_session_timestamp
    ON public.brainstorm_sessions;
DROP TRIGGER IF EXISTS trigger_update_brainstorm_session_timestamp
    ON public.brainstorm_sessions;

CREATE TRIGGER update_brainstorm_session_timestamp
    BEFORE UPDATE ON public.brainstorm_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP FUNCTION IF EXISTS public.update_brainstorm_session_updated_at() CASCADE;

COMMIT;
