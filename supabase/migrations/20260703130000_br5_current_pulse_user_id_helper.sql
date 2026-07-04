-- BR5 Option 1, Phase 1: canonical-identity resolver for Radio RLS.
--
-- Context: pulse_users was keyed two contradictory ways — Regime A (id == auth.uid(),
-- which the Radio tables' RLS + FKs demanded) and Regime B (random id linked by
-- auth_user_id, the canonical bootstrap used everywhere else). Divergent users
-- (id != auth uid, 13/16 live) could never satisfy Regime A, so they could not own
-- a channel, broadcast, or subscribe. This helper is the pivot for unifying Radio
-- onto Regime B: it returns the caller's canonical pulse_users.id.
--
-- For the 2 legacy "clean" users (id == auth_user_id) it returns a value equal to
-- auth.uid(), so no existing ownership row changes value. For divergent users it
-- returns their real canonical id — the exact value the FK to pulse_users.id needs.
--
-- See docs/deep-dives/HANDOFF-BR5-identity-regime-map-2026-07-03.md (Option 1).
CREATE OR REPLACE FUNCTION public.current_pulse_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id FROM public.pulse_users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_pulse_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_pulse_user_id() TO authenticated;

COMMENT ON FUNCTION public.current_pulse_user_id() IS
  'BR5: resolves auth.uid() -> canonical pulse_users.id via auth_user_id. Used by Radio RLS (pulse_channels/broadcasts/pulse_channel_subscriptions) so ownership works for divergent users whose id != auth uid.';
