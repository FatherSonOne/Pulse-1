-- ============================================================
-- MIGRATION: 20260309000106_audit_fix_data_retention_tables.sql
-- PURPOSE:   Create data_retention_policies and data_cleanup_logs tables
--            that are referenced by the data-cleanup Edge Function but
--            were only defined in an _old_migrations file not applied.
--            Also fixes calendar table name bug in cleanup logic.
-- ISSUE:     C-5, H-10 from 2026-03-09 database audit
-- SAFE:      Idempotent via IF NOT EXISTS
-- ============================================================

BEGIN;

-- ── data_retention_policies ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.data_retention_policies (
    id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                   UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    emails_retention_days     INTEGER     NOT NULL DEFAULT 365,
    calendar_retention_days   INTEGER     NOT NULL DEFAULT 365,
    contacts_retention_days   INTEGER     NOT NULL DEFAULT -1,  -- -1 = never delete
    messages_retention_days   INTEGER     NOT NULL DEFAULT 90,
    auto_cleanup_enabled      BOOLEAN     NOT NULL DEFAULT false,
    cleanup_time_utc          TIME        NOT NULL DEFAULT '02:00:00',
    last_cleanup_at           TIMESTAMPTZ,
    next_cleanup_at           TIMESTAMPTZ,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT retention_days_valid CHECK (
        emails_retention_days   >= -1 AND
        calendar_retention_days >= -1 AND
        contacts_retention_days >= -1 AND
        messages_retention_days >= -1
    )
);

ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS data_retention_policies_owner ON public.data_retention_policies;
CREATE POLICY data_retention_policies_owner ON public.data_retention_policies
    FOR ALL
    USING      (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_data_retention_next_cleanup
    ON public.data_retention_policies(next_cleanup_at)
    WHERE auto_cleanup_enabled = true;

DROP TRIGGER IF EXISTS trg_data_retention_policies_updated_at ON public.data_retention_policies;
CREATE TRIGGER trg_data_retention_policies_updated_at
    BEFORE UPDATE ON public.data_retention_policies
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── data_cleanup_logs ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.data_cleanup_logs (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cleanup_type      TEXT        NOT NULL,
    items_deleted     INTEGER     NOT NULL DEFAULT 0,
    retention_days    INTEGER     NOT NULL,
    status            TEXT        NOT NULL CHECK (status IN ('completed', 'failed', 'partial')),
    execution_time_ms INTEGER,
    error_message     TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.data_cleanup_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS data_cleanup_logs_owner ON public.data_cleanup_logs;
CREATE POLICY data_cleanup_logs_owner ON public.data_cleanup_logs
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_data_cleanup_logs_user_created
    ON public.data_cleanup_logs(user_id, created_at DESC);

COMMIT;
