-- ============================================================
-- MIGRATION: 20260309000107_audit_fix_soft_delete_trigger.sql
-- PURPOSE:   Harden the pulse_conversations dual soft-delete trigger:
--            1. Add SECURITY DEFINER + SET search_path
--            2. Add advisory lock to prevent race-condition double-delete
--            3. Use pg_try_advisory_xact_lock to be non-blocking
-- ISSUE:     C-6 from 2026-03-09 database audit
-- SAFE:      CREATE OR REPLACE + DROP TRIGGER IF EXISTS
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.delete_conversation_when_both_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only proceed if both flags are now set
    IF NEW.is_deleted_by_user1 = TRUE AND NEW.is_deleted_by_user2 = TRUE THEN
        -- Advisory transaction lock scoped to this conversation id
        -- Prevents concurrent transactions from both executing the DELETE
        -- hashtext() maps the UUID to a stable integer key
        IF pg_try_advisory_xact_lock(hashtext(NEW.id::text)) THEN
            -- Re-check inside the lock to guard against TOCTOU
            -- (the row may already have been deleted by a concurrent tx)
            IF EXISTS (
                SELECT 1 FROM public.pulse_conversations
                WHERE id = NEW.id
            ) THEN
                DELETE FROM public.pulse_conversations WHERE id = NEW.id;
            END IF;
        END IF;
    END IF;

    -- AFTER trigger return value is ignored by Postgres — return NEW is fine
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_conversation_both_deleted ON public.pulse_conversations;

CREATE TRIGGER trg_conversation_both_deleted
    AFTER UPDATE OF is_deleted_by_user1, is_deleted_by_user2
    ON public.pulse_conversations
    FOR EACH ROW
    EXECUTE FUNCTION public.delete_conversation_when_both_deleted();

COMMIT;
