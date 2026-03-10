-- ============================================================
-- MIGRATION: 20260309000109_cleanup_brainstorm_retention.sql
-- PURPOSE:   Add retention support to brainstorm_sessions:
--            1. Add expires_at column (default 90 days from now)
--            2. Add brainstorm_retention_days to data_retention_policies
--            3. Index for efficient cleanup queries
-- ISSUE:     M-4 from 2026-03-09 database audit
-- SAFE:      Idempotent via IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- ============================================================

BEGIN;

-- ── 1. Add expires_at to brainstorm_sessions ─────────────────
-- Existing rows get a 90-day window starting from NOW()
-- so they are not immediately eligible for deletion.

ALTER TABLE public.brainstorm_sessions
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ
        NOT NULL DEFAULT (now() + INTERVAL '90 days');

CREATE INDEX IF NOT EXISTS idx_brainstorm_sessions_expires_at
    ON public.brainstorm_sessions(expires_at)
    WHERE expires_at IS NOT NULL;

-- ── 2. Add brainstorm_retention_days to data_retention_policies ──
-- Default 90 days; -1 means never delete.

ALTER TABLE public.data_retention_policies
    ADD COLUMN IF NOT EXISTS brainstorm_retention_days INTEGER NOT NULL DEFAULT 90;

ALTER TABLE public.data_retention_policies
    DROP CONSTRAINT IF EXISTS retention_days_valid;

ALTER TABLE public.data_retention_policies
    ADD CONSTRAINT retention_days_valid CHECK (
        emails_retention_days   >= -1 AND
        calendar_retention_days >= -1 AND
        contacts_retention_days >= -1 AND
        messages_retention_days >= -1 AND
        brainstorm_retention_days >= -1
    );

COMMIT;
