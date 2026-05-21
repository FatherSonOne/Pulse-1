-- Add decided_at to public.decisions.
--
-- The application code (src/services/decisionService.ts, DecisionVelocityTile,
-- decisionAnalyticsService, channelExportService, types.ts) has always written
-- and read a `decided_at` column on `public.decisions`, but the column was
-- never present in the live schema. Every write succeeded silently (PostgREST
-- ignores unknown keys on update? no — it returns 400; the writes were also
-- failing, just nobody noticed) and every read returned 400 Bad Request,
-- including the Dashboard's Decision Velocity tile on first load.
--
-- The closest existing columns are `resolved_at` (set on any resolution,
-- not just status='decided') and `consensus_reached_at` (set only on
-- consensus). Neither is a clean substitute, so we add the column the code
-- expects and backfill from `resolved_at` where status='decided'.

ALTER TABLE public.decisions
  ADD COLUMN IF NOT EXISTS decided_at timestamptz;

UPDATE public.decisions
   SET decided_at = resolved_at
 WHERE status = 'decided'
   AND decided_at IS NULL
   AND resolved_at IS NOT NULL;

-- DecisionVelocityTile filters by workspace_id + status + decided_at range
-- and orders by decided_at; a partial index on decided decisions keeps that
-- query plan tight as the table grows.
CREATE INDEX IF NOT EXISTS idx_decisions_workspace_decided_at
  ON public.decisions (workspace_id, decided_at)
  WHERE status = 'decided';
