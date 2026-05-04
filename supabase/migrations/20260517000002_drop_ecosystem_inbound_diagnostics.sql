-- Drop ecosystem_inbound_diagnostics
--
-- This temp table was created ad-hoc during the 2026-05-03 token-rotation
-- incident to capture every inbound caller's auth headers. The table comment
-- said "Drop after resolution" — the rotation is closed and the corresponding
-- diagnostic insert in the ecosystem-inbound edge function is being removed
-- in the same change.

DROP TABLE IF EXISTS public.ecosystem_inbound_diagnostics;
