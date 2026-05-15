-- ============================================================
-- Migration: eta_shares
--
-- Live ETA share — a Pulse user creates a tokenized public link
-- ("share your live ETA to Acme HQ for the next 2 hours") that
-- anyone with the token can open to see the sharer's moving pin
-- and a live travel-time estimate.
--
-- Position + ETA update via locationService.startLocationBroadcast
-- on its 15s debounce tick. Sharers can have multiple active shares
-- at once (e.g., heading to a meeting + sharing arrival with a
-- different contact in parallel).
--
-- Recipient auth: token-only — no Pulse account required. The
-- get_eta_share_by_token SECURITY DEFINER RPC bypasses RLS so
-- unauthenticated viewers can read the row by token.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.eta_shares (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Unguessable URL-safe token (generated client-side via crypto.randomUUID,
  -- 36 chars). Indexed unique so the public viewer can fetch in O(1).
  token                 TEXT        NOT NULL UNIQUE,

  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Destination geometry. Captured at share creation so the recipient
  -- always sees the same target even if the contact's address changes.
  destination_lat       DOUBLE PRECISION NOT NULL,
  destination_lng       DOUBLE PRECISION NOT NULL,
  destination_label     TEXT,

  -- Optional context (for the sharer's record / future analytics)
  recipient_contact_id  TEXT,
  recipient_label       TEXT,

  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMPTZ NOT NULL,
  ended_at              TIMESTAMPTZ,

  status                TEXT        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'arrived', 'canceled', 'expired')),

  -- Latest tracked position + computed ETA. Updated on the 15s broadcast
  -- tick by locationService while the share is 'active'.
  last_lat              DOUBLE PRECISION,
  last_lng              DOUBLE PRECISION,
  last_eta_seconds      INTEGER,
  last_distance_m       DOUBLE PRECISION,
  last_updated_at       TIMESTAMPTZ,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS eta_shares_user_active_idx
  ON public.eta_shares (user_id, status)
  WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- RLS — owner-only direct access. Recipients read via the SECURITY DEFINER
-- RPC below, which is the only path that doesn't require auth.
-- ---------------------------------------------------------------------------

ALTER TABLE public.eta_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eta_shares_select_owner ON public.eta_shares;
DROP POLICY IF EXISTS eta_shares_insert_owner ON public.eta_shares;
DROP POLICY IF EXISTS eta_shares_update_owner ON public.eta_shares;
DROP POLICY IF EXISTS eta_shares_delete_owner ON public.eta_shares;

CREATE POLICY eta_shares_select_owner ON public.eta_shares
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY eta_shares_insert_owner ON public.eta_shares
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY eta_shares_update_owner ON public.eta_shares
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY eta_shares_delete_owner ON public.eta_shares
  FOR DELETE USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Public viewer RPC — by token, returns a sanitized projection.
--
-- Only returns active or recently-ended shares (5-minute grace so the
-- recipient sees "Arrived" / "Canceled" instead of an abrupt 404).
-- Hard-expired and long-canceled shares return NULL.
--
-- Returns SETOF so a missing row produces zero rows (vs. NULL columns).
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_eta_share_by_token(TEXT);

CREATE FUNCTION public.get_eta_share_by_token(p_token TEXT)
RETURNS TABLE (
  id                UUID,
  token             TEXT,
  destination_lat   DOUBLE PRECISION,
  destination_lng   DOUBLE PRECISION,
  destination_label TEXT,
  recipient_label   TEXT,
  status            TEXT,
  started_at        TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  last_lat          DOUBLE PRECISION,
  last_lng          DOUBLE PRECISION,
  last_eta_seconds  INTEGER,
  last_distance_m   DOUBLE PRECISION,
  last_updated_at   TIMESTAMPTZ
)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT
    s.id, s.token,
    s.destination_lat, s.destination_lng, s.destination_label,
    s.recipient_label,
    s.status, s.started_at, s.expires_at, s.ended_at,
    s.last_lat, s.last_lng, s.last_eta_seconds, s.last_distance_m, s.last_updated_at
  FROM public.eta_shares s
  WHERE s.token = p_token
    AND s.expires_at > NOW() - INTERVAL '5 minutes'
    AND (s.ended_at IS NULL OR s.ended_at > NOW() - INTERVAL '5 minutes');
$$;

GRANT EXECUTE ON FUNCTION public.get_eta_share_by_token(TEXT) TO anon, authenticated;

COMMIT;
