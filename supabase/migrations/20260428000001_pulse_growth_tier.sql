-- ============================================================
-- MIGRATION: 20260428000001_pulse_growth_tier.sql
-- PURPOSE:   Add the Pulse Growth tier — 5× metered caps, 10×
--            storage, plus premium-only feature unlocks (SSO,
--            API, custom branding, audit retention, priority
--            support, advanced AI budget controls).
--
--            - Inserts pulse_growth plan at tier=2.
--            - Updates rebuild_entitlements() so tier 2 + app=pulse
--              maps to 'growth' (not the legacy 'pro' name).
--            - Adds workspaces_plan_check to accept 'growth'.
-- DATE:      2026-04-28
-- DEPENDS:   20260427000002_child_workspaces.sql
-- SAFE:      Idempotent. Reuses ON CONFLICT DO UPDATE on plans.
-- ============================================================
--
-- BEFORE APPLYING:
-- 1. Run `node scripts/setup-pulse-growth-stripe.mjs` to create the Stripe product.
-- 2. Paste the returned monthly + yearly price IDs into this file where marked.
-- ============================================================

BEGIN;

-- ============================================================
-- SECTION 1: Insert Pulse Growth plan
-- ============================================================
-- Tier 2 for app='pulse' is mapped to 'growth' (see rebuild_entitlements update below).
-- Caps: 5× metered, 10× storage vs. Pulse Team.
-- Features: SSO is gated behind 'sso' flag — UI advertises it as "coming soon"
-- until the SAML implementation lands. Other unlocks ship live with this migration.

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
  'pulse_growth', 'pulse', 'Pulse Growth',
  'price_1TR0g4Gb3AGXe9w8ynrjcmXk',  -- Stripe product prod_UPqMaH6ngGPvEA — monthly $300 / 30-day trial
  'price_1TR0g4Gb3AGXe9w8yJX37RsK',  -- yearly $3,000 / 30-day trial
  2,                                            -- tier 2 + app=pulse → 'growth' in rebuild_entitlements
  NULL,                                         -- unlimited seats
  10000,                                        -- 10,000 AI messages / month (5× Team)
  2500,                                         -- 2,500 SMS / month (5× Team)
  536870912000,                                 -- 500 GB (500 * 1024^3) (10× Team)
  2500,                                         -- 2,500 Voxer minutes / month (5× Team)
  NULL, NULL, NULL, NULL, NULL,                -- contacts/pipelines/workflows unlimited
  '{
    "voxer": true,
    "video_vox": true,
    "pulse_radio": true,
    "email": true,
    "campaigns": true,
    "messaging": true,
    "calendar": true,
    "studio_rag": true,
    "analytics_advanced": true,
    "sso": true,
    "sso_coming_soon": true,
    "api_access": true,
    "custom_branding": true,
    "audit_log_extended": true,
    "ai_budget_controls": true,
    "priority_support": true
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
-- SECTION 2: Update workspaces_plan_check to accept 'growth'
-- ============================================================

ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_plan_check;
ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_plan_check
  CHECK (plan IN ('free', 'team', 'growth', 'starter', 'pro', 'business', 'ecosystem'));

-- ============================================================
-- SECTION 3: Update rebuild_entitlements
-- ============================================================
-- Changes from 20260427000002:
--   - tier 2 + app='pulse' now maps to 'growth' (not 'pro').
--   - Comparison ranks include 'growth' at level 2.

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
  v_billing_workspace_id UUID;
BEGIN
  SELECT COALESCE(parent_workspace_id, id)
    INTO v_billing_workspace_id
    FROM public.workspaces
   WHERE id = p_workspace_id;

  IF v_billing_workspace_id IS NULL THEN
    RETURN;
  END IF;

  SELECT s.status, s.trial_end
    INTO v_sub
    FROM public.subscriptions s
   WHERE s.workspace_id = v_billing_workspace_id
     AND s.status IN ('active', 'trialing')
   ORDER BY s.created_at DESC
   LIMIT 1;

  IF v_sub IS NOT NULL AND v_sub.status = 'trialing' THEN
    v_is_trialing := true;
    v_trial_ends := v_sub.trial_end;
  END IF;

  FOR v_plan IN
    SELECT p.*
      FROM public.subscription_items si
      JOIN public.subscriptions s ON s.id = si.subscription_id
      JOIN public.plans p        ON p.id = si.plan_id
     WHERE s.workspace_id = v_billing_workspace_id
       AND s.status IN ('active', 'trialing')
  LOOP
    -- Map tier number to name.
    -- Pulse: tier 1 = 'team', tier 2 = 'growth', tier 3 reserved for future Enterprise.
    -- Other apps (LV, Entomate): tier 1 = 'starter', 2 = 'pro', 3 = 'business' as before.
    CASE v_plan.tier
      WHEN 1 THEN
        v_tier_name := CASE WHEN v_plan.app = 'pulse' THEN 'team' ELSE 'starter' END;
      WHEN 2 THEN
        v_tier_name := CASE WHEN v_plan.app = 'pulse' THEN 'growth' ELSE 'pro' END;
      WHEN 3 THEN v_tier_name := 'business';
      ELSE v_tier_name := 'free';
    END CASE;

    IF v_plan.app IN ('pulse', 'bundle') THEN
      IF NOT v_apps ? 'pulse' OR v_plan.tier > COALESCE((
        SELECT CASE v_apps->>'pulse'
          WHEN 'business' THEN 3
          WHEN 'growth' THEN 2
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

    v_features := v_features || v_plan.features;
  END LOOP;

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
-- SECTION 4: Rebuild entitlements for all existing workspaces
-- ============================================================

DO $$
DECLARE
  v_ws_id UUID;
BEGIN
  FOR v_ws_id IN SELECT id FROM public.workspaces WHERE deleted_at IS NULL LOOP
    PERFORM public.rebuild_entitlements(v_ws_id);
  END LOOP;
END $$;

COMMIT;
