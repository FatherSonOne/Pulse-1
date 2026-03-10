-- ============================================================
-- MIGRATION: 20260309000112_cleanup_video_vox_rls_index.sql
-- PURPOSE:   Add composite index on video_vox_messages(id, conversation_id)
--            to speed up the 2-table JOIN inside RLS policies on
--            video_vox_reactions, video_vox_bookmarks, and
--            video_vox_read_receipts. Without this index, PostgreSQL
--            does a sequential scan on video_vox_messages for every
--            row evaluated in those policies.
-- ISSUE:     M-3 from 2026-03-09 database audit
-- SAFE:      CREATE INDEX IF NOT EXISTS — zero downtime, online build
-- ============================================================

BEGIN;

-- Composite index satisfying: WHERE id = <message_id> lookup + JOIN to conversation_id
CREATE INDEX IF NOT EXISTS idx_video_vox_messages_id_conversation
    ON public.video_vox_messages(id, conversation_id);

-- Ensure conversation_id alone is also indexed (used in other join paths)
CREATE INDEX IF NOT EXISTS idx_video_vox_messages_conversation_id
    ON public.video_vox_messages(conversation_id);

COMMIT;
