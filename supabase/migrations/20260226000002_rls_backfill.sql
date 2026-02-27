-- ============================================================
-- BACKFILL SCRIPT: 20260226000002_rls_backfill.sql
-- PURPOSE: Populate user_id columns added by 20260226000001_rls_lockdown.sql
-- RUN AFTER: 20260226000001_rls_lockdown.sql
-- CREATED: 2026-02-26
-- ============================================================
--
-- IMPORTANT: Review each section carefully before running in production.
-- Some backfills require manual intervention or business logic decisions.
-- Rows that still have NULL user_id after this script will be INVISIBLE
-- to authenticated users once RLS policies are enforced.
--
-- INSTRUCTIONS:
--   1. Run in Supabase SQL editor (NOT via CLI -- requires manual review of
--      admin UUIDs and business logic decisions before executing)
--   2. Verify row counts after each section using the commented SELECT statements
--   3. Run as service_role to bypass RLS during backfill
--   4. Confirm 20260226000001_rls_lockdown.sql has already been applied
--
-- TABLES COVERED:
--   [AUTO]    customer_alerts        -- backfill from acknowledged_by / resolved_by
--   [AUTO]    predictions            -- backfill via extracted_tasks and crm_integrations joins
--   [AUTO]    integration_logs       -- backfill via integrations join
--   [MANUAL]  integrations           -- no source of truth; admin must assign
--   [MANUAL]  webhooks               -- no source of truth; admin must assign
--   [MANUAL]  customer_health        -- no auth-user mapping without business logic
--   [MANUAL]  customer_health_history-- no auth-user mapping without business logic
--   [MANUAL]  customer_sentiment     -- no auth-user mapping without business logic
-- ============================================================

BEGIN;

-- ============================================================
-- Section 1: customer_alerts
-- Strategy A: backfill user_id from acknowledged_by (the user who
--             acknowledged the alert is the most direct owner signal).
-- Strategy B: fall back to resolved_by for rows that were resolved
--             but never formally acknowledged via the acknowledge_alert()
--             function.
-- Net effect: any alert touched by a known Pulse user gets attributed.
-- Remaining NULLs = alerts that were created but never actioned by any user.
-- ============================================================

-- Pass 1: use acknowledged_by as the primary signal
UPDATE public.customer_alerts
SET    user_id = acknowledged_by
WHERE  user_id        IS NULL
  AND  acknowledged_by IS NOT NULL;

-- Pass 2: use resolved_by as a fallback for rows still unattributed
UPDATE public.customer_alerts
SET    user_id = resolved_by
WHERE  user_id   IS NULL
  AND  resolved_by IS NOT NULL;

-- Verify:
-- SELECT
--     count(*)                                    AS total_rows,
--     count(*) FILTER (WHERE user_id IS NOT NULL) AS backfilled,
--     count(*) FILTER (WHERE user_id IS NULL)     AS still_null
-- FROM public.customer_alerts;


-- ============================================================
-- Section 2: predictions (entity_type = 'task')
-- entity_id is stored as 'task:<uuid>' (enforced by the
-- predictions_entity_id_has_colon CHECK constraint).
-- Strip the 'task:' prefix and join to extracted_tasks.workspace_id,
-- which maps to the Pulse user in Phase 1 of the auth model.
-- ============================================================

UPDATE public.predictions p
SET    user_id = et.workspace_id
FROM   public.extracted_tasks et
WHERE  p.user_id     IS NULL
  AND  p.entity_type  = 'task'
  AND  p.entity_id    = 'task:' || et.id::text
  AND  et.workspace_id IS NOT NULL;

-- Verify (task predictions):
-- SELECT
--     count(*)                                    AS task_predictions_total,
--     count(*) FILTER (WHERE user_id IS NOT NULL) AS backfilled,
--     count(*) FILTER (WHERE user_id IS NULL)     AS still_null
-- FROM public.predictions
-- WHERE entity_type = 'task';


-- ============================================================
-- Section 3: predictions (entity_type = 'deal')
-- entity_id is stored as 'deal:<uuid>'.
-- Strip the 'deal:' prefix, join to crm_deals on the UUID, then
-- join crm_deals.crm_id -> crm_integrations.id to reach
-- crm_integrations.workspace_id (the Pulse user who set up the CRM).
-- ============================================================

UPDATE public.predictions p
SET    user_id = ci.workspace_id
FROM   public.crm_deals      cd
JOIN   public.crm_integrations ci
    ON ci.id = cd.crm_id
WHERE  p.user_id     IS NULL
  AND  p.entity_type  = 'deal'
  AND  p.entity_id    = 'deal:' || cd.id::text
  AND  ci.workspace_id IS NOT NULL;

-- Verify (deal predictions):
-- SELECT
--     count(*)                                    AS deal_predictions_total,
--     count(*) FILTER (WHERE user_id IS NOT NULL) AS backfilled,
--     count(*) FILTER (WHERE user_id IS NULL)     AS still_null
-- FROM public.predictions
-- WHERE entity_type = 'deal';


-- ============================================================
-- Section 4: integration_logs
-- Log rows whose source_type = 'integration' can be linked to the
-- owning user via the integrations table, provided integrations.user_id
-- was already populated in Section 6 or pre-exists.
-- NOTE: If integrations.user_id is still NULL (see Section 6 below),
-- this UPDATE will produce no rows for those integration_logs.
-- Re-run this section AFTER manually backfilling integrations.user_id.
-- ============================================================

UPDATE public.integration_logs il
SET    user_id = i.user_id
FROM   public.integrations i
WHERE  il.user_id    IS NULL
  AND  il.source_type = 'integration'
  AND  il.source_id   = i.id
  AND  i.user_id      IS NOT NULL;

-- Verify:
-- SELECT
--     count(*)                                    AS total_rows,
--     count(*) FILTER (WHERE user_id IS NOT NULL) AS backfilled,
--     count(*) FILTER (WHERE user_id IS NULL)     AS still_null
-- FROM public.integration_logs;


-- ============================================================
-- Section 5: integrations  [MANUAL ACTION REQUIRED]
-- ============================================================
-- WARNING: integrations.user_id is NULL for ALL existing rows.
-- No reliable source-of-truth exists in the current schema
-- (there is no created_by column and no audit trail).
--
-- Rows with NULL user_id will be INVISIBLE to users after RLS lockdown.
-- Choose ONE of the options below and uncomment it:
--
-- Option A (recommended for small teams): assign all legacy integrations
--   to a known admin/service user so they remain accessible:
--
--   UPDATE public.integrations
--   SET    user_id = '<your-admin-user-uuid>'
--   WHERE  user_id IS NULL;
--
-- Option B: delete stale integrations and ask users to reconnect.
--   This is the cleanest option if users should own their own integrations:
--
--   DELETE FROM public.integrations WHERE user_id IS NULL;
--
-- Option C: temporarily disable RLS on integrations while backfilling,
--   populate user_id from your external admin tooling, then re-enable:
--
--   ALTER TABLE public.integrations DISABLE ROW LEVEL SECURITY;
--   -- (backfill here via admin tooling or Supabase dashboard)
--   ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
--
-- After choosing an option, re-run Section 4 (integration_logs)
-- to cascade the user attribution down to log rows.
-- ============================================================


-- ============================================================
-- Section 6: webhooks  [MANUAL ACTION REQUIRED]
-- ============================================================
-- WARNING: webhooks.user_id is NULL for ALL existing rows.
-- The webhooks table has no created_by column or any other user signal.
--
-- Rows with NULL user_id will be INVISIBLE to users after RLS lockdown.
-- Choose ONE of the options below and uncomment it:
--
-- Option A: assign all webhooks to a known admin/service user:
--
--   UPDATE public.webhooks
--   SET    user_id = '<your-admin-user-uuid>'
--   WHERE  user_id IS NULL;
--
-- Option B: delete legacy webhooks and ask users to recreate them:
--
--   DELETE FROM public.webhooks WHERE user_id IS NULL;
-- ============================================================


-- ============================================================
-- Section 7: customer_health  [MANUAL ACTION REQUIRED]
-- ============================================================
-- WARNING: customer_health.user_id is NULL for ALL existing rows.
-- customer_health.customer_id is an EXTERNAL CRM identifier (text),
-- not a Pulse auth user UUID. There is no schema-level mapping from
-- CRM customer IDs to Pulse auth.users.id without external business logic.
--
-- Rows with NULL user_id will be INVISIBLE after RLS lockdown.
--
-- Manual option: if you know which Pulse user manages a set of CRM
-- customers, run a targeted update such as:
--
--   UPDATE public.customer_health
--   SET    user_id = '<pulse-user-uuid>'
--   WHERE  customer_id IN ('crm-customer-id-1', 'crm-customer-id-2');
--
-- Alternatively, consider whether customer_health should use a
-- workspace/org-level ownership model rather than per-user, and
-- update the RLS policy in 20260226000001_rls_lockdown.sql accordingly.
-- ============================================================


-- ============================================================
-- Section 8: customer_health_history  [MANUAL ACTION REQUIRED]
-- ============================================================
-- Same situation as customer_health: customer_id is an external CRM
-- identifier with no direct mapping to auth.users.
--
-- Manual option: if you know the Pulse user for a set of customers:
--
--   UPDATE public.customer_health_history
--   SET    user_id = '<pulse-user-uuid>'
--   WHERE  customer_id IN ('crm-customer-id-1', 'crm-customer-id-2');
--
-- Consider linking via customer_health once that table is backfilled:
--
--   UPDATE public.customer_health_history chh
--   SET    user_id = ch.user_id
--   FROM   public.customer_health ch
--   WHERE  chh.user_id   IS NULL
--     AND  chh.customer_id = ch.customer_id
--     AND  ch.user_id     IS NOT NULL;
-- ============================================================


-- ============================================================
-- Section 9: customer_sentiment  [MANUAL ACTION REQUIRED]
-- ============================================================
-- customer_sentiment.customer_id is the same external CRM identifier.
-- No automated backfill is possible without an external customer->user map.
--
-- Manual option: once customer_health is backfilled, cascade to sentiment:
--
--   UPDATE public.customer_sentiment cs
--   SET    user_id = ch.user_id
--   FROM   public.customer_health ch
--   WHERE  cs.user_id    IS NULL
--     AND  cs.customer_id = ch.customer_id
--     AND  ch.user_id     IS NOT NULL;
-- ============================================================

COMMIT;


-- ============================================================
-- VERIFICATION QUERIES
-- Run these manually AFTER the backfill to audit NULL user_id counts.
-- Rows shown here will be INVISIBLE to users under RLS.
-- ============================================================
--
-- SELECT
--     'integrations'           AS table_name,
--     count(*)                 AS null_user_id_rows
-- FROM public.integrations WHERE user_id IS NULL
-- UNION ALL
-- SELECT
--     'webhooks',
--     count(*)
-- FROM public.webhooks WHERE user_id IS NULL
-- UNION ALL
-- SELECT
--     'predictions',
--     count(*)
-- FROM public.predictions WHERE user_id IS NULL
-- UNION ALL
-- SELECT
--     'customer_health',
--     count(*)
-- FROM public.customer_health WHERE user_id IS NULL
-- UNION ALL
-- SELECT
--     'customer_health_history',
--     count(*)
-- FROM public.customer_health_history WHERE user_id IS NULL
-- UNION ALL
-- SELECT
--     'customer_alerts',
--     count(*)
-- FROM public.customer_alerts WHERE user_id IS NULL
-- UNION ALL
-- SELECT
--     'customer_sentiment',
--     count(*)
-- FROM public.customer_sentiment WHERE user_id IS NULL
-- UNION ALL
-- SELECT
--     'integration_logs',
--     count(*)
-- FROM public.integration_logs WHERE user_id IS NULL
-- ORDER BY table_name;


-- ============================================================
-- EMERGENCY ROLLBACK
-- If RLS is breaking the application after this migration, disable
-- row-level security on the affected tables temporarily while you
-- complete the manual backfill steps above, then re-enable.
-- ============================================================
--
-- Disable RLS (emergency only):
--   ALTER TABLE public.integrations           DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.webhooks               DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.predictions            DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.customer_health        DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.customer_health_history DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.customer_alerts        DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.customer_sentiment     DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.integration_logs       DISABLE ROW LEVEL SECURITY;
--
-- Re-enable RLS (after backfill is complete):
--   ALTER TABLE public.integrations           ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.webhooks               ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.predictions            ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.customer_health        ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.customer_health_history ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.customer_alerts        ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.customer_sentiment     ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.integration_logs       ENABLE ROW LEVEL SECURITY;
