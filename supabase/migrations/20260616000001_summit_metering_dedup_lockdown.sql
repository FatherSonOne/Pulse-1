-- Lock down record_summit_minutes so it is callable ONLY by the edge function
-- (service role). The base migration (20260616000000) granted EXECUTE to
-- service_role and revoked PUBLIC, but Supabase separately grants EXECUTE to
-- the anon + authenticated roles on functions in the public schema, so the
-- wrapper was still reachable via /rest/v1/rpc/record_summit_minutes.
--
-- That matters because record_summit_minutes is SECURITY DEFINER and does NOT
-- verify workspace membership (the summit-session-end edge function does that
-- before calling it). A direct RPC caller could therefore inflate an ARBITRARY
-- workspace's summit_minutes usage and push it over its cap. Revoke from the
-- client-facing roles; only service_role retains EXECUTE.

REVOKE EXECUTE ON FUNCTION public.record_summit_minutes(uuid, uuid, bigint, date, date) FROM anon, authenticated;
