-- ============================================================
-- MIGRATION: 20260423000001_pulse_team_tier.sql
-- PURPOSE:   Collapse Pulse's three tiers (starter/pro/business) into
--            a single Pulse Team tier at $100/mo with hard caps
--            (2000 AI msgs / 500 SMS / 50GB / 500 Voxer min).
--            Adds voxer_minutes column to plans + entitlements.
--            Updates rebuild_entitlements to map pulse tier 1 → 'team'.
-- DATE:      2026-04-23
-- DEPENDS:   20260405000001_billing_system.sql
-- SAFE:      Idempotent. Archives old pulse plans rather than deleting.
-- ============================================================
--
-- BEFORE APPLYING:
-- 1. Run `node scripts/setup-pulse-team-stripe.mjs` to create the Stripe product.
-- 2. Paste the returned monthly + yearly price IDs into this file where marked.
-- 3. Then: `npx supabase db push` or apply via the dashboard.
-- ============================================================

BEGIN;

-- ============================================================
-- SECTION 1: Schema additions — max_voxer_minutes_mo column
-- ============================================================

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS max_voxer_minutes_mo INT;

ALTER TABLE public.entitlements
  ADD COLUMN IF NOT EXISTS max_voxer_minutes_mo INT DEFAULT 500;

COMMENT ON COLUMN public.plans.max_voxer_minutes_mo IS
  'Monthly Voxer minute cap. NULL = unlimited. Metered via usage_records.metric = ''voxer_minutes''.';

-- ============================================================
-- SECTION 2: Deactivate old Pulse plans
-- ============================================================
-- Keep the rows so existing subscriptions/history stay intact,
-- but set is_active = false so they no longer appear in plan selectors.

UPDATE public.plans
   SET is_active = false
 WHERE id IN ('pulse_starter', 'pulse_pro', 'pulse_business');

-- ============================================================
-- SECTION 3: Insert Pulse Team plan
-- ============================================================
-- Tier 1 for app='pulse' is now mapped to 'team' (see rebuild_entitlements update below).
-- Features: every gate flipped on. Hard caps on metered resources.

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
  'pulse_team', 'pulse', 'Pulse Team',
  'price_1TPOGTGb3AGXe9w8MX23te9s',  -- Stripe product prod_UOAbah3j7Nv0Ks — monthly $100 / 30-day trial
  'price_1TPOGTGb3AGXe9w8a0n6kOd8',  -- yearly $1,000 / 30-day trial
  1,                                  -- tier 1 + app=pulse → 'team' in rebuild_entitlements
  NULL,                               -- unlimited seats
  2000,                               -- 2,000 AI messages / month
  500,                                -- 500 SMS / month
  53687091200,                        -- 50 GB (50 * 1024^3)
  500,                                -- 500 Voxer minutes / month
  NULL, NULL, NULL, NULL, NULL,      -- contacts/pipelines/workflows unlimited (non-Pulse concerns)
  '{
    "voxer": true,
    "video_vox": true,
    "pulse_radio": true,
    "email": true,
    "campaigns": true,
    "messaging": true,
    "calendar": true,
    "studio_rag": true,
    "analytics_advanced": true
  }'::jsonb,
  true
)
ON CONFLICT (id) DO UPDATE SET
  stripe_price_monthly = EXCLUDED.stripe_price_monthly,
  stripe_price_yearly = EXCLUDED.stripe_price_yearly,
  max_ai_messages_mo = EXCLUDED.max_ai_messages_mo,
  max_sms_mo = EXCLUDED.max_sms_mo,
  max_storage_bytes = EXCLUDED.max_storage_bytes,
  max_voxer_minutes_mo = EXCLUDED.max_voxer_minutes_mo,
  features = EXCLUDED.features,
  is_active = true;

-- ============================================================
-- SECTION 4: Update workspaces_plan_check to accept 'team'
-- ============================================================

ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_plan_check;
ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_plan_check
  CHECK (plan IN ('free', 'team', 'starter', 'pro', 'business', 'ecosystem'));

-- ============================================================
-- SECTION 5: Update rebuild_entitlements
-- ============================================================
-- Changes from 20260405000001:
--   - tier 1 + app = 'pulse' now maps to 'team' (not 'starter')
--   - Adds v_max_voxer_minutes tracking
--   - Comparison ranks include 'team' at level 1

CREATE OR REPLACE FUNCTION public.rebuild_entitlements(p_workspace_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_apps JSONB := '{}';
  v_max_users INT := 5;
  v_max_ai_messages INT := 500;
  v_max_sms INT := 100;
  v_max_storage BIGINT := 5368709120;
  v_max_voxer_minutes INT := 0;
  v_max_contacts INT := 1000;
  v_max_pipelines INT := 2;
  v_max_workflows INT := 5;
  v_max_workflow_runs INT := 500;
  v_max_integrations INT := 3;
  v_features JSONB := '{}';
  v_is_trialing BOOLEAN := false;
  v_trial_ends TIMESTAMPTZ;
  v_plan RECORD;
  v_sub RECORD;
  v_tier_name TEXT;
BEGIN
  -- Check active subscription / trial state
  SELECT s.status, s.trial_end
    INTO v_sub
    FROM public.subscriptions s
   WHERE s.workspace_id = p_workspace_id
     AND s.status IN ('active', 'trialing')
   ORDER BY s.created_at DESC
   LIMIT 1;

  IF v_sub IS NOT NULL AND v_sub.status = 'trialing' THEN
    v_is_trialing := true;
    v_trial_ends := v_sub.trial_end;
  END IF;

  -- Scan all active subscription items and resolve highest tier per app
  FOR v_plan IN
    SELECT p.*
      FROM public.subscription_items si
      JOIN public.subscriptions s ON s.id = si.subscription_id
      JOIN public.plans p        ON p.id = si.plan_id
     WHERE s.workspace_id = p_workspace_id
       AND s.status IN ('active', 'trialing')
  LOOP
    -- Map tier number to name.
    -- For Pulse, tier 1 is now 'team' (the single consolidated tier).
    -- For other apps (LV, Entomate), tier 1 = 'starter' as before.
    CASE v_plan.tier
      WHEN 1 THEN
        v_tier_name := CASE WHEN v_plan.app = 'pulse' THEN 'team' ELSE 'starter' END;
      WHEN 2 THEN v_tier_name := 'pro';
      WHEN 3 THEN v_tier_name := 'business';
      ELSE v_tier_name := 'free';
    END CASE;

    -- Pulse apps: set tier if it's higher than current.
    -- Rank: team/starter = 1, pro = 2, business = 3. team and starter tie because
    -- only ONE of them can be active for Pulse at a time post-refactor.
    IF v_plan.app IN ('pulse', 'bundle') THEN
      IF NOT v_apps ? 'pulse' OR v_plan.tier > COALESCE((
        SELECT CASE v_apps->>'pulse'
          WHEN 'business' THEN 3
          WHEN 'pro' THEN 2
          WHEN 'team' THEN 1
          WHEN 'starter' THEN 1
          ELSE 0
        END
      ), 0) THEN
        v_apps := jsonb_set(v_apps, '{pulse}', to_jsonb(v_tier_name));
      END IF;
    END IF;

    IF v_plan.app IN ('logos_vision', 'bundle') THEN
      IF NOT v_apps ? 'logos_vision' OR v_plan.tier > COALESCE((
        SELECT CASE v_apps->>'logos_vision'
          WHEN 'business' THEN 3 WHEN 'pro' THEN 2 WHEN 'starter' THEN 1 ELSE 0 END
      ), 0) THEN
        v_apps := jsonb_set(v_apps, '{logos_vision}', to_jsonb(v_tier_name));
      END IF;
    END IF;

    IF v_plan.app IN ('entomate', 'bundle') THEN
      IF NOT v_apps ? 'entomate' OR v_plan.tier > COALESCE((
        SELECT CASE v_apps->>'entomate'
          WHEN 'business' THEN 3 WHEN 'pro' THEN 2 WHEN 'starter' THEN 1 ELSE 0 END
      ), 0) THEN
        v_apps := jsonb_set(v_apps, '{entomate}', to_jsonb(v_tier_name));
      END IF;
    END IF;

    -- Take the highest limits across all plans. NULL = unlimited beats finite.
    IF v_plan.max_users IS NULL OR v_max_users IS NULL THEN v_max_users := NULL;
    ELSE v_max_users := GREATEST(v_max_users, v_plan.max_users); END IF;

    IF v_plan.max_ai_messages_mo IS NULL OR v_max_ai_messages IS NULL THEN v_max_ai_messages := NULL;
    ELSE v_max_ai_messages := GREATEST(v_max_ai_messages, v_plan.max_ai_messages_mo); END IF;

    IF v_plan.max_sms_mo IS NULL OR v_max_sms IS NULL THEN v_max_sms := NULL;
    ELSE v_max_sms := GREATEST(v_max_sms, v_plan.max_sms_mo); END IF;

    IF v_plan.max_storage_bytes IS NULL OR v_max_storage IS NULL THEN v_max_storage := NULL;
    ELSE v_max_storage := GREATEST(v_max_storage, v_plan.max_storage_bytes); END IF;

    IF v_plan.max_voxer_minutes_mo IS NULL OR v_max_voxer_minutes IS NULL THEN v_max_voxer_minutes := NULL;
    ELSE v_max_voxer_minutes := GREATEST(v_max_voxer_minutes, v_plan.max_voxer_minutes_mo); END IF;

    IF v_plan.max_contacts IS NULL OR v_max_contacts IS NULL THEN v_max_contacts := NULL;
    ELSE v_max_contacts := GREATEST(v_max_contacts, v_plan.max_contacts); END IF;

    IF v_plan.max_pipelines IS NULL OR v_max_pipelines IS NULL THEN v_max_pipelines := NULL;
    ELSE v_max_pipelines := GREATEST(v_max_pipelines, v_plan.max_pipelines); END IF;

    IF v_plan.max_workflows IS NULL OR v_max_workflows IS NULL THEN v_max_workflows := NULL;
    ELSE v_max_workflows := GREATEST(v_max_workflows, v_plan.max_workflows); END IF;

    IF v_plan.max_workflow_runs_mo IS NULL OR v_max_workflow_runs IS NULL THEN v_max_workflow_runs := NULL;
    ELSE v_max_workflow_runs := GREATEST(v_max_workflow_runs, v_plan.max_workflow_runs_mo); END IF;

    IF v_plan.max_integrations IS NULL OR v_max_integrations IS NULL THEN v_max_integrations := NULL;
    ELSE v_max_integrations := GREATEST(v_max_integrations, v_plan.max_integrations); END IF;

    -- Merge features (union of all feature flags)
    v_features := v_features || v_plan.features;
  END LOOP;

  -- Upsert entitlements
  INSERT INTO public.entitlements (
    workspace_id, apps, max_users, max_ai_messages_mo, max_sms_mo,
    max_storage_bytes, max_voxer_minutes_mo, max_contacts, max_pipelines, max_workflows,
    max_workflow_runs_mo, max_integrations, features, is_trialing,
    trial_ends_at, updated_at
  ) VALUES (
    p_workspace_id, v_apps, v_max_users, v_max_ai_messages, v_max_sms,
    v_max_storage, v_max_voxer_minutes, v_max_contacts, v_max_pipelines, v_max_workflows,
    v_max_workflow_runs, v_max_integrations, v_features, v_is_trialing,
    v_trial_ends, now()
  )
  ON CONFLICT (workspace_id) DO UPDATE SET
    apps = EXCLUDED.apps,
    max_users = EXCLUDED.max_users,
    max_ai_messages_mo = EXCLUDED.max_ai_messages_mo,
    max_sms_mo = EXCLUDED.max_sms_mo,
    max_storage_bytes = EXCLUDED.max_storage_bytes,
    max_voxer_minutes_mo = EXCLUDED.max_voxer_minutes_mo,
    max_contacts = EXCLUDED.max_contacts,
    max_pipelines = EXCLUDED.max_pipelines,
    max_workflows = EXCLUDED.max_workflows,
    max_workflow_runs_mo = EXCLUDED.max_workflow_runs_mo,
    max_integrations = EXCLUDED.max_integrations,
    features = EXCLUDED.features,
    is_trialing = EXCLUDED.is_trialing,
    trial_ends_at = EXCLUDED.trial_ends_at,
    updated_at = now();
END;
$$;

-- ============================================================
-- SECTION 6: RPC to start a 30-day trial on workspace creation
-- ============================================================
-- Called from the client via supabase.rpc('start_pulse_team_trial', {...})
-- after a workspace is created. Inserts a dummy trialing subscription
-- (no Stripe customer yet — that gets created when they upgrade), plus a
-- subscription_item pointing at pulse_team, then rebuilds entitlements.

CREATE OR REPLACE FUNCTION public.start_pulse_team_trial(p_workspace_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription_id UUID;
  v_existing UUID;
BEGIN
  -- Idempotency: if a trial already exists for this workspace, do nothing.
  SELECT id INTO v_existing
    FROM public.subscriptions
   WHERE workspace_id = p_workspace_id
     AND status IN ('trialing', 'active')
   LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN;
  END IF;

  -- Create the trialing subscription row.
  -- stripe_subscription_id is a synthetic value for pre-Stripe trials.
  INSERT INTO public.subscriptions (
    workspace_id, stripe_subscription_id, status,
    trial_start, trial_end
  ) VALUES (
    p_workspace_id,
    'trial_' || p_workspace_id::text || '_' || extract(epoch from now())::bigint,
    'trialing',
    now(),
    now() + interval '30 days'
  )
  RETURNING id INTO v_subscription_id;

  -- Link to pulse_team plan.
  INSERT INTO public.subscription_items (subscription_id, plan_id, quantity)
  VALUES (v_subscription_id, 'pulse_team', 1);

  -- Rebuild materialized entitlements for this workspace.
  PERFORM public.rebuild_entitlements(p_workspace_id);
END;
$$;

REVOKE ALL ON FUNCTION public.start_pulse_team_trial(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_pulse_team_trial(UUID) TO authenticated;

COMMENT ON FUNCTION public.start_pulse_team_trial IS
  'Starts a 30-day Pulse Team trial for a newly created workspace. Idempotent.';

-- ============================================================
-- SECTION 7: Rebuild entitlements for all existing workspaces
-- ============================================================
-- Ensures the new voxer_minutes column + 'team' tier naming takes effect immediately.

DO $$
DECLARE
  v_ws_id UUID;
BEGIN
  FOR v_ws_id IN SELECT id FROM public.workspaces LOOP
    PERFORM public.rebuild_entitlements(v_ws_id);
  END LOOP;
END $$;

COMMIT;
