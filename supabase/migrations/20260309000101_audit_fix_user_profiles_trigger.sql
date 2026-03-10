-- ============================================================
-- MIGRATION: 20260309000101_audit_fix_user_profiles_trigger.sql
-- PURPOSE:   Add missing updated_at auto-maintenance trigger to
--            user_profiles table. The table has an updated_at column
--            but no trigger to keep it current on UPDATE.
-- ISSUE:     H-8 from 2026-03-09 database audit
-- SAFE:      Idempotent via DROP TRIGGER IF EXISTS
-- ============================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON public.user_profiles;

CREATE TRIGGER trg_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
