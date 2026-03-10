-- ============================================================
-- MIGRATION: 20260309000108_gemini_rate_limit_table.sql
-- PURPOSE:   Replace gemini-proxy in-memory rate limiter (Map<>) with
--            a database-backed atomic counter. Edge function instances
--            don't share memory, so the Map allowed N×limit requests
--            where N = number of live Deno isolates.
-- ISSUE:     H-4 from 2026-03-09 database audit
-- SAFE:      Idempotent via IF NOT EXISTS / CREATE OR REPLACE
-- ============================================================

BEGIN;

-- ── Rate limit tracking table ────────────────────────────────
-- Keyed by (user_id, window_start) where window_start is the
-- truncated start of the current 1-minute bucket.

CREATE TABLE IF NOT EXISTS public.gemini_rate_limits (
    user_id       TEXT        NOT NULL,
    window_start  TIMESTAMPTZ NOT NULL,
    request_count INTEGER     NOT NULL DEFAULT 1,
    PRIMARY KEY (user_id, window_start)
);

-- Index for efficient cleanup of expired windows
CREATE INDEX IF NOT EXISTS idx_gemini_rate_limits_window
    ON public.gemini_rate_limits(window_start);

-- No RLS: table is only ever accessed via SECURITY DEFINER function
-- below (called from service_role in the Edge Function).

-- ── Atomic increment function ────────────────────────────────
-- Returns the new request count for this user in the current window.
-- Deletes stale windows (> 2 min old) for the user on each call
-- to keep the table lean without a separate cron job.

CREATE OR REPLACE FUNCTION public.check_and_increment_gemini_rate_limit(
    p_user_id      TEXT,
    p_window_start TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Prune expired windows for this user
    DELETE FROM public.gemini_rate_limits
    WHERE user_id = p_user_id
      AND window_start < (now() - INTERVAL '2 minutes');

    -- Atomic upsert: insert new window row or increment existing
    INSERT INTO public.gemini_rate_limits (user_id, window_start, request_count)
    VALUES (p_user_id, p_window_start, 1)
    ON CONFLICT (user_id, window_start)
    DO UPDATE SET request_count = gemini_rate_limits.request_count + 1
    RETURNING request_count INTO v_count;

    RETURN v_count;
END;
$$;

REVOKE ALL   ON FUNCTION public.check_and_increment_gemini_rate_limit(TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_increment_gemini_rate_limit(TEXT, TIMESTAMPTZ) TO service_role;

COMMIT;
