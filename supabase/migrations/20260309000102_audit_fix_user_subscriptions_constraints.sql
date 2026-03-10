-- ============================================================
-- MIGRATION: 20260309000102_audit_fix_user_subscriptions_constraints.sql
-- PURPOSE:   Add missing CHECK constraints to user_subscriptions.
--            status and plan_id accept any text value — add validation.
-- ISSUE:     H-6 from 2026-03-09 database audit
-- SAFE:      Idempotent via DROP CONSTRAINT IF EXISTS
-- ============================================================

BEGIN;

ALTER TABLE public.user_subscriptions
    DROP CONSTRAINT IF EXISTS user_subscriptions_status_check,
    DROP CONSTRAINT IF EXISTS user_subscriptions_plan_id_check;

ALTER TABLE public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_status_check
        CHECK (status IN ('active', 'inactive', 'cancelled', 'past_due', 'trialing')),
    ADD CONSTRAINT user_subscriptions_plan_id_check
        CHECK (plan_id IN ('free', 'pro', 'team', 'enterprise'));

-- Also ensure updated_at trigger exists for this table
ALTER TABLE public.user_subscriptions
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_user_subscriptions_updated_at ON public.user_subscriptions;

CREATE TRIGGER trg_user_subscriptions_updated_at
    BEFORE UPDATE ON public.user_subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
