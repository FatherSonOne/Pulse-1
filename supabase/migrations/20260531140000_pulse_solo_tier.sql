-- ============================================================
-- MIGRATION: 20260531140000_pulse_solo_tier.sql
-- ============================================================
-- 2026 Pulse pricing re-structure (#119 decision → #126 implementation).
--
--   - Adds the NEW "Pulse Solo" plan ($20/mo, $200/yr) — the Lane-A
--     solo-operator hero tier. 1 seat.
--   - Repoints "Pulse Team" from the old $100 FLAT price to the new
--     $15/seat PER-SEAT price (Stripe per-seat = quantity × unit_amount;
--     quantity is set by billing-checkout to the member count and kept in
--     sync by billing-sync-seats / billing-reconcile-seats).
--   - Pulse Growth is UNCHANGED ($300/mo).
--
-- Stripe price IDs (TEST mode, minted 2026-05-31 via
-- scripts/setup-pulse-pricing-2026.mjs):
--   Solo product:        prod_UcSvG40DOMl4Pb
--   Solo monthly ($20):  price_1TdDzjGb3AGXe9w86fBuX5Kh
--   Solo yearly  ($200): price_1TdDzjGb3AGXe9w8KyIZBspq
--   Team per-seat mo:    price_1TdEIxGb3AGXe9w8nL85q7mM   ($15/seat)
--   Team per-seat yr:    price_1TdEIxGb3AGXe9w8krIDmRiK   ($150/seat)
-- ⚠️ When going LIVE, re-run the script with sk_live_ and replace these IDs.
--
-- DESIGN NOTE (two intentional v1 simplifications — do NOT rewrite
-- rebuild_entitlements here; its current definition lives in
-- 20260512000001_summit_usage.sql and a full CREATE OR REPLACE risks
-- clobbering later changes):
--   1. Solo is inserted at tier=1, so rebuild_entitlements maps it to the
--      'team' app-access name in `entitlements.apps.pulse`. That's
--      functionally correct (Solo unlocks the Pulse app; its dollar caps
--      come from THIS plan row via the GREATEST() merge). The subscription
--      still carries plan_id='pulse_solo', so billing + UI show "Solo".
--      A dedicated 'solo' app-tier name is a future polish, not needed for v1.
--   2. rebuild_entitlements floors max_users at 5 (the free-tier default) via
--      GREATEST(), so Solo's max_users=1 below is INTENT, not a hard cap —
--      a Solo workspace can technically still seat up to 5. Solo is billed
--      FLAT $20 (checkout quantity=1), positioned as 1 seat, and the upgrade
--      path is Team (per-seat). HARD 1-seat enforcement (lowering the floor
--      or special-casing solo + hiding invite UI) is a tracked #126 follow-up.
-- ============================================================

-- ============================================================
-- SECTION 1: Insert the Pulse Solo plan
-- ============================================================
INSERT INTO public.plans (
  id, app, name,
  stripe_price_monthly, stripe_price_yearly,
  tier,
  max_users,
  max_ai_messages_mo,
  max_sms_mo,
  max_storage_bytes,
  max_voxer_minutes_mo,
  max_contacts, max_pipelines, max_workflows, max_workflow_runs_mo, max_integrations,
  features,
  is_active
) VALUES (
  'pulse_solo', 'pulse', 'Pulse Solo',
  'price_1TdDzjGb3AGXe9w86fBuX5Kh',  -- monthly $20 / 30-day trial
  'price_1TdDzjGb3AGXe9w8KyIZBspq',  -- yearly $200 / 30-day trial
  1,                                  -- tier 1 → 'team' app-access (see DESIGN NOTE #1)
  1,                                  -- 1 seat (intent; see DESIGN NOTE #2)
  1500,                               -- 1,500 AI messages / month (vs Team 2,000)
  100,                                -- 100 SMS / month (SMS hidden v1 #100 anyway)
  26843545600,                        -- 25 GB (25 * 1024^3)
  300,                                -- 300 Voxer minutes / month
  NULL, NULL, NULL, NULL, NULL,      -- contacts/pipelines/workflows unlimited (non-Pulse concerns)
  '{
    "voxer": true,
    "video_vox": true,
    "pulse_radio": true,
    "email": true,
    "messaging": true,
    "calendar": true,
    "studio_rag": true
  }'::jsonb,
  true
)
ON CONFLICT (id) DO UPDATE SET
  stripe_price_monthly = EXCLUDED.stripe_price_monthly,
  stripe_price_yearly = EXCLUDED.stripe_price_yearly,
  tier = EXCLUDED.tier,
  max_users = EXCLUDED.max_users,
  max_ai_messages_mo = EXCLUDED.max_ai_messages_mo,
  max_sms_mo = EXCLUDED.max_sms_mo,
  max_storage_bytes = EXCLUDED.max_storage_bytes,
  max_voxer_minutes_mo = EXCLUDED.max_voxer_minutes_mo,
  features = EXCLUDED.features,
  is_active = true;

-- ============================================================
-- SECTION 2: Repoint Pulse Team at the per-seat prices
-- ============================================================
-- Caps unchanged (per-workspace); only the Stripe price changes from the old
-- $100 flat to $15/seat. Existing subs on the old flat price keep billing
-- until migrated; new Team checkouts use the per-seat price with quantity =
-- member count (billing-checkout) + ongoing sync (billing-sync-seats).
UPDATE public.plans
SET stripe_price_monthly = 'price_1TdEIxGb3AGXe9w8nL85q7mM',  -- $15/seat/mo
    stripe_price_yearly  = 'price_1TdEIxGb3AGXe9w8krIDmRiK'   -- $150/seat/yr
WHERE id = 'pulse_team';

-- ============================================================
-- SECTION 3: Allow 'solo' as a workspaces.plan value
-- ============================================================
-- Defensive / forward-compatible: nothing sets workspaces.plan='solo' today
-- (Solo maps to 'team' app-access per DESIGN NOTE #1), but allow it so a
-- future solo-aware path doesn't trip the CHECK constraint.
ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_plan_check;
ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_plan_check
  CHECK (plan IN ('free', 'solo', 'team', 'growth', 'starter', 'pro', 'business', 'ecosystem'));
