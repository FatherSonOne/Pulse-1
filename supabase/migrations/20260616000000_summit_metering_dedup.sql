-- Summit hosted-minutes metering: per-session dedup ledger + idempotent wrapper.
--
-- Background: increment_usage() is ADDITIVE (ON CONFLICT ... DO UPDATE SET
-- quantity = usage_records.quantity + p_quantity), so calling the metering path
-- twice for the same session double-counts. The Summit client previously fired
-- metering once, fire-and-forget, with no retry — a dropped end-event lost the
-- minutes entirely (revenue/quota leak) AND blocked any safe retry/beacon
-- (a retry would double-bill).
--
-- This migration makes Summit metering IDEMPOTENT PER SESSION:
--   * summit_metered_sessions records which session_ids have already been billed.
--   * record_summit_minutes() inserts the session_id (ON CONFLICT DO NOTHING) and
--     only calls increment_usage() when the row is new — so retries, page-hide
--     beacons, and next-load replays of the SAME session are safe no-ops.
-- increment_usage() itself is left untouched; its additive semantics are preserved.

CREATE TABLE IF NOT EXISTS public.summit_metered_sessions (
  session_id   uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  minutes      integer NOT NULL,
  period_start date NOT NULL,
  applied_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS summit_metered_sessions_ws_period_idx
  ON public.summit_metered_sessions (workspace_id, period_start);

-- Server-only ledger: written exclusively by record_summit_minutes() via the
-- service role. RLS on with NO client policies = deny-all to anon/authenticated,
-- which is correct for a server-only table (DB security baseline: every public
-- table is RLS-on).
ALTER TABLE public.summit_metered_sessions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.record_summit_minutes(
  p_session_id   uuid,
  p_workspace_id uuid,
  p_quantity     bigint,
  p_period_start date,
  p_period_end   date
)
RETURNS boolean   -- true = minutes applied (new session); false = duplicate (skipped)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_rows int;
BEGIN
  INSERT INTO public.summit_metered_sessions (session_id, workspace_id, minutes, period_start)
  VALUES (p_session_id, p_workspace_id, p_quantity, p_period_start)
  ON CONFLICT (session_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;   -- 1 = inserted (new), 0 = duplicate

  IF v_rows > 0 THEN
    PERFORM public.increment_usage(p_workspace_id, 'summit_minutes', p_quantity, p_period_start, p_period_end);
  END IF;

  RETURN v_rows > 0;
END;
$$;

-- The wrapper is the server-only entry point; only the edge function (service
-- role) should call it. Keep it out of reach of anon/authenticated RPC.
REVOKE ALL ON FUNCTION public.record_summit_minutes(uuid, uuid, bigint, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_summit_minutes(uuid, uuid, bigint, date, date) TO service_role;
