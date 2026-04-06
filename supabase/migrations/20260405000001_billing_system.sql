-- ============================================================
-- MIGRATION: 20260405000001_billing_system.sql
-- PURPOSE:   Complete billing system for QntmEcos ecosystem.
--            Creates plans, subscriptions, subscription_items,
--            entitlements, usage_records, invoices tables.
--            Adds Stripe billing columns to workspaces.
--            Builds entitlement rebuild trigger.
-- DATE:      2026-04-05
-- DEPENDS:   20260226000003_workspace_members.sql (workspaces table)
-- SAFE:      Fully idempotent via IF NOT EXISTS / CREATE OR REPLACE
-- ============================================================

BEGIN;

-- ============================================================
-- SECTION 1: Add billing columns to workspaces
-- ============================================================

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS billing_email TEXT,
  ADD COLUMN IF NOT EXISTS billing_name TEXT,
  ADD COLUMN IF NOT EXISTS tax_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_address JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_cycle_anchor TIMESTAMPTZ;

-- Update plan check constraint to include new tiers
-- Drop old constraint and add new one
ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_plan_check;
ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_plan_check
  CHECK (plan IN ('free', 'starter', 'pro', 'business', 'ecosystem'));

-- ============================================================
-- SECTION 2: plans (reference table)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.plans (
  id TEXT PRIMARY KEY,
  app TEXT NOT NULL,
  name TEXT NOT NULL,
  stripe_price_monthly TEXT NOT NULL,
  stripe_price_yearly TEXT NOT NULL,
  tier INT NOT NULL DEFAULT 0,
  max_users INT,
  max_ai_messages_mo INT,
  max_sms_mo INT,
  max_storage_bytes BIGINT,
  max_contacts INT,
  max_pipelines INT,
  max_workflows INT,
  max_workflow_runs_mo INT,
  max_integrations INT,
  features JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.plans IS
  'Reference table of all available billing plans across Pulse, Logos Vision, Entomate, and bundles.';

-- ============================================================
-- SECTION 3: subscriptions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace
  ON public.subscriptions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe
  ON public.subscriptions(stripe_subscription_id);

-- ============================================================
-- SECTION 4: subscription_items
-- ============================================================

CREATE TABLE IF NOT EXISTS public.subscription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES public.plans(id),
  stripe_subscription_item_id TEXT UNIQUE,
  quantity INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_items_sub
  ON public.subscription_items(subscription_id);

-- ============================================================
-- SECTION 5: entitlements (materialized for fast reads)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.entitlements (
  workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  apps JSONB DEFAULT '{}',
  max_users INT DEFAULT 5,
  max_ai_messages_mo INT DEFAULT 500,
  max_sms_mo INT DEFAULT 100,
  max_storage_bytes BIGINT DEFAULT 5368709120,
  max_contacts INT DEFAULT 1000,
  max_pipelines INT DEFAULT 2,
  max_workflows INT DEFAULT 5,
  max_workflow_runs_mo INT DEFAULT 500,
  max_integrations INT DEFAULT 3,
  features JSONB DEFAULT '{}',
  is_trialing BOOLEAN DEFAULT false,
  trial_ends_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.entitlements IS
  'Materialized entitlements per workspace. Rebuilt by trigger on subscription changes. Read by all apps for feature gating.';

-- ============================================================
-- SECTION 6: usage_records
-- ============================================================

CREATE TABLE IF NOT EXISTS public.usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  metric TEXT NOT NULL
    CHECK (metric IN ('ai_messages', 'sms_sent', 'storage_bytes', 'voxer_minutes', 'workflow_runs')),
  quantity BIGINT NOT NULL DEFAULT 1,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, metric, period_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_workspace_period
  ON public.usage_records(workspace_id, period_start);

-- ============================================================
-- SECTION 7: invoices (mirror of Stripe)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT UNIQUE NOT NULL,
  amount_due INT NOT NULL,
  amount_paid INT NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL
    CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  invoice_url TEXT,
  invoice_pdf TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_workspace
  ON public.invoices(workspace_id);

-- ============================================================
-- SECTION 8: processed_stripe_events (idempotency)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.processed_stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT,
  processed_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SECTION 9: Entitlement rebuild function
-- Scans all active subscription_items for a workspace,
-- joins to plans, and takes MAX(tier) per app to determine
-- the effective entitlements.
-- ============================================================

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
  -- Check if workspace has any active subscriptions
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
    JOIN public.plans p ON p.id = si.plan_id
    WHERE s.workspace_id = p_workspace_id
      AND s.status IN ('active', 'trialing')
  LOOP
    -- Map tier number to name
    CASE v_plan.tier
      WHEN 1 THEN v_tier_name := 'starter';
      WHEN 2 THEN v_tier_name := 'pro';
      WHEN 3 THEN v_tier_name := 'business';
      ELSE v_tier_name := 'free';
    END CASE;

    -- Set app tiers (highest wins)
    IF v_plan.app IN ('pulse', 'bundle') THEN
      IF NOT v_apps ? 'pulse' OR v_plan.tier > COALESCE((
        SELECT CASE v_apps->>'pulse'
          WHEN 'business' THEN 3 WHEN 'pro' THEN 2 WHEN 'starter' THEN 1 ELSE 0 END
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

    -- Take the highest limits across all plans
    IF v_plan.max_users IS NULL OR v_max_users IS NULL THEN
      v_max_users := NULL; -- unlimited
    ELSE
      v_max_users := GREATEST(v_max_users, v_plan.max_users);
    END IF;

    IF v_plan.max_ai_messages_mo IS NULL OR v_max_ai_messages IS NULL THEN
      v_max_ai_messages := NULL;
    ELSE
      v_max_ai_messages := GREATEST(v_max_ai_messages, v_plan.max_ai_messages_mo);
    END IF;

    IF v_plan.max_sms_mo IS NULL OR v_max_sms IS NULL THEN
      v_max_sms := NULL;
    ELSE
      v_max_sms := GREATEST(v_max_sms, v_plan.max_sms_mo);
    END IF;

    IF v_plan.max_storage_bytes IS NULL OR v_max_storage IS NULL THEN
      v_max_storage := NULL;
    ELSE
      v_max_storage := GREATEST(v_max_storage, v_plan.max_storage_bytes);
    END IF;

    IF v_plan.max_contacts IS NULL OR v_max_contacts IS NULL THEN
      v_max_contacts := NULL;
    ELSE
      v_max_contacts := GREATEST(v_max_contacts, v_plan.max_contacts);
    END IF;

    IF v_plan.max_pipelines IS NULL OR v_max_pipelines IS NULL THEN
      v_max_pipelines := NULL;
    ELSE
      v_max_pipelines := GREATEST(v_max_pipelines, v_plan.max_pipelines);
    END IF;

    IF v_plan.max_workflows IS NULL OR v_max_workflows IS NULL THEN
      v_max_workflows := NULL;
    ELSE
      v_max_workflows := GREATEST(v_max_workflows, v_plan.max_workflows);
    END IF;

    IF v_plan.max_workflow_runs_mo IS NULL OR v_max_workflow_runs IS NULL THEN
      v_max_workflow_runs := NULL;
    ELSE
      v_max_workflow_runs := GREATEST(v_max_workflow_runs, v_plan.max_workflow_runs_mo);
    END IF;

    IF v_plan.max_integrations IS NULL OR v_max_integrations IS NULL THEN
      v_max_integrations := NULL;
    ELSE
      v_max_integrations := GREATEST(v_max_integrations, v_plan.max_integrations);
    END IF;

    -- Merge features (union of all feature flags)
    v_features := v_features || v_plan.features;
  END LOOP;

  -- Upsert entitlements
  INSERT INTO public.entitlements (
    workspace_id, apps, max_users, max_ai_messages_mo, max_sms_mo,
    max_storage_bytes, max_contacts, max_pipelines, max_workflows,
    max_workflow_runs_mo, max_integrations, features, is_trialing,
    trial_ends_at, updated_at
  ) VALUES (
    p_workspace_id, v_apps, v_max_users, v_max_ai_messages, v_max_sms,
    v_max_storage, v_max_contacts, v_max_pipelines, v_max_workflows,
    v_max_workflow_runs, v_max_integrations, v_features, v_is_trialing,
    v_trial_ends, now()
  )
  ON CONFLICT (workspace_id) DO UPDATE SET
    apps = EXCLUDED.apps,
    max_users = EXCLUDED.max_users,
    max_ai_messages_mo = EXCLUDED.max_ai_messages_mo,
    max_sms_mo = EXCLUDED.max_sms_mo,
    max_storage_bytes = EXCLUDED.max_storage_bytes,
    max_contacts = EXCLUDED.max_contacts,
    max_pipelines = EXCLUDED.max_pipelines,
    max_workflows = EXCLUDED.max_workflows,
    max_workflow_runs_mo = EXCLUDED.max_workflow_runs_mo,
    max_integrations = EXCLUDED.max_integrations,
    features = EXCLUDED.features,
    is_trialing = EXCLUDED.is_trialing,
    trial_ends_at = EXCLUDED.trial_ends_at,
    updated_at = now();

  -- Also update workspace plan field to highest tier
  UPDATE public.workspaces
  SET plan = COALESCE(
    CASE GREATEST(
      COALESCE((SELECT CASE v_apps->>'pulse'
        WHEN 'business' THEN 3 WHEN 'pro' THEN 2 WHEN 'starter' THEN 1 ELSE 0 END), 0),
      COALESCE((SELECT CASE v_apps->>'logos_vision'
        WHEN 'business' THEN 3 WHEN 'pro' THEN 2 WHEN 'starter' THEN 1 ELSE 0 END), 0),
      COALESCE((SELECT CASE v_apps->>'entomate'
        WHEN 'business' THEN 3 WHEN 'pro' THEN 2 WHEN 'starter' THEN 1 ELSE 0 END), 0)
    )
      WHEN 3 THEN 'business'
      WHEN 2 THEN 'pro'
      WHEN 1 THEN 'starter'
      ELSE 'free'
    END,
    'free'
  ),
  updated_at = now()
  WHERE id = p_workspace_id;
END;
$$;

-- ============================================================
-- SECTION 10: Triggers to auto-rebuild entitlements
-- ============================================================

CREATE OR REPLACE FUNCTION public.trigger_rebuild_entitlements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workspace_id UUID;
BEGIN
  -- Get workspace_id from the subscription
  IF TG_TABLE_NAME = 'subscriptions' THEN
    v_workspace_id := COALESCE(NEW.workspace_id, OLD.workspace_id);
  ELSIF TG_TABLE_NAME = 'subscription_items' THEN
    SELECT s.workspace_id INTO v_workspace_id
    FROM public.subscriptions s
    WHERE s.id = COALESCE(NEW.subscription_id, OLD.subscription_id);
  END IF;

  IF v_workspace_id IS NOT NULL THEN
    PERFORM public.rebuild_entitlements(v_workspace_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger on subscriptions changes
DROP TRIGGER IF EXISTS trg_rebuild_entitlements_on_sub ON public.subscriptions;
CREATE TRIGGER trg_rebuild_entitlements_on_sub
  AFTER INSERT OR UPDATE OR DELETE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_rebuild_entitlements();

-- Trigger on subscription_items changes
DROP TRIGGER IF EXISTS trg_rebuild_entitlements_on_items ON public.subscription_items;
CREATE TRIGGER trg_rebuild_entitlements_on_items
  AFTER INSERT OR UPDATE OR DELETE ON public.subscription_items
  FOR EACH ROW EXECUTE FUNCTION public.trigger_rebuild_entitlements();

-- ============================================================
-- SECTION 11: RLS Policies
-- ============================================================

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_stripe_events ENABLE ROW LEVEL SECURITY;

-- Plans: everyone can read active plans
CREATE POLICY plans_select ON public.plans
  FOR SELECT USING (is_active = true);

-- Subscriptions: workspace members can read their workspace's subscriptions
CREATE POLICY subscriptions_select ON public.subscriptions
  FOR SELECT USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
  );

-- Subscription items: same as subscriptions
CREATE POLICY subscription_items_select ON public.subscription_items
  FOR SELECT USING (
    subscription_id IN (
      SELECT s.id FROM public.subscriptions s
      WHERE s.workspace_id IN (
        SELECT wm.workspace_id FROM public.workspace_members wm
        WHERE wm.user_id = auth.uid()
      )
    )
  );

-- Entitlements: workspace members can read their workspace's entitlements
CREATE POLICY entitlements_select ON public.entitlements
  FOR SELECT USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
  );

-- Usage records: workspace members can read
CREATE POLICY usage_records_select ON public.usage_records
  FOR SELECT USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
  );

-- Invoices: workspace admins/owners can read
CREATE POLICY invoices_select ON public.invoices
  FOR SELECT USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

-- Processed events: no client access (service role only)
-- No SELECT policy = no client access

-- ============================================================
-- SECTION 12: Usage increment RPC (atomic)
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_usage(
  p_workspace_id UUID,
  p_metric TEXT,
  p_quantity BIGINT,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.usage_records (workspace_id, metric, quantity, period_start, period_end)
  VALUES (p_workspace_id, p_metric, p_quantity, p_period_start, p_period_end)
  ON CONFLICT (workspace_id, metric, period_start)
  DO UPDATE SET quantity = usage_records.quantity + p_quantity;
END;
$$;

-- ============================================================
-- SECTION 13: Seed plans table
-- ============================================================

INSERT INTO public.plans (id, app, name, stripe_price_monthly, stripe_price_yearly, tier, max_users, max_ai_messages_mo, max_sms_mo, max_storage_bytes, max_contacts, max_pipelines, max_workflows, max_workflow_runs_mo, max_integrations, features) VALUES

-- Pulse plans
('pulse_starter', 'pulse', 'Pulse Starter',
  'price_1TIi4XGb3AGXe9w8Zd4xKSI0', 'price_1TIi4XGb3AGXe9w8iHicncCt',
  1, 5, 500, 100, 5368709120, NULL, NULL, NULL, NULL, NULL,
  '{"voxer": true, "email": true, "messaging": true, "calendar": true}'::jsonb),

('pulse_pro', 'pulse', 'Pulse Professional',
  'price_1TIi6EGb3AGXe9w8VFr6tvmg', 'price_1TIi6EGb3AGXe9w8IyHxK0RO',
  2, 15, 2000, 500, 26843545600, NULL, NULL, NULL, NULL, NULL,
  '{"voxer": true, "video_vox": true, "pulse_radio": true, "email": true, "campaigns": true, "messaging": true, "calendar": true, "studio_rag": true, "analytics_advanced": true}'::jsonb),

('pulse_business', 'pulse', 'Pulse Business',
  'price_1TIi6uGb3AGXe9w8zrjZOLvr', 'price_1TIi6uGb3AGXe9w8w8GobOxg',
  3, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  '{"voxer": true, "video_vox": true, "pulse_radio": true, "email": true, "campaigns": true, "messaging": true, "calendar": true, "studio_rag": true, "analytics_advanced": true, "analytics_predictive": true, "white_label": true, "priority_support": true}'::jsonb),

-- Logos Vision plans
('lv_starter', 'logos_vision', 'Logos Vision Starter',
  'price_1TIi95Gb3AGXe9w8iqEZFDIV', 'price_1TIi95Gb3AGXe9w8CW7FTW8q',
  1, 5, NULL, NULL, 2147483648, 1000, 2, NULL, NULL, NULL,
  '{"contacts": true, "pipelines": true, "tasks": true}'::jsonb),

('lv_pro', 'logos_vision', 'Logos Vision Professional',
  'price_1TIi9iGb3AGXe9w8l2OA0aap', 'price_1TIi9iGb3AGXe9w85v5esjaC',
  2, 15, NULL, NULL, 16106127360, 10000, 10, NULL, NULL, NULL,
  '{"contacts": true, "pipelines": true, "tasks": true, "crm_integrations": true, "reporting": true, "automations": true}'::jsonb),

('lv_business', 'logos_vision', 'Logos Vision Business',
  'price_1TIiAGGb3AGXe9w8rWpQlQbh', 'price_1TIiAGGb3AGXe9w8hH282o1v',
  3, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  '{"contacts": true, "pipelines": true, "tasks": true, "crm_integrations": true, "reporting": true, "automations": true, "api_access": true, "white_label": true, "priority_support": true}'::jsonb),

-- Entomate plans
('ent_starter', 'entomate', 'Entomate Starter',
  'price_1TIiAmGb3AGXe9w8pQABSusv', 'price_1TIiAmGb3AGXe9w8MuJUwbsP',
  1, 5, NULL, NULL, NULL, NULL, NULL, 5, 500, 3,
  '{"workflows": true, "triggers": true, "basic_integrations": true}'::jsonb),

('ent_pro', 'entomate', 'Entomate Professional',
  'price_1TIiBGGb3AGXe9w8nLYuctg8', 'price_1TIiBGGb3AGXe9w8coh1rQtf',
  2, 15, NULL, NULL, NULL, NULL, NULL, 25, 5000, 10,
  '{"workflows": true, "triggers": true, "basic_integrations": true, "advanced_integrations": true, "webhooks": true, "scheduling": true}'::jsonb),

('ent_business', 'entomate', 'Entomate Business',
  'price_1TIiBnGb3AGXe9w8RKwqwc6y', 'price_1TIiBnGb3AGXe9w8vtrS9kIJ',
  3, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  '{"workflows": true, "triggers": true, "basic_integrations": true, "advanced_integrations": true, "webhooks": true, "scheduling": true, "api_access": true, "custom_functions": true, "priority_support": true}'::jsonb),

-- Full Ecosystem bundles
('bundle_starter', 'bundle', 'Full Ecosystem Starter',
  'price_1TIiCdGb3AGXe9w8SgW6qVmw', 'price_1TIiCdGb3AGXe9w8zlJ7RYIW',
  1, 5, 500, 100, 5368709120, 1000, 2, 5, 500, 3,
  '{"voxer": true, "email": true, "messaging": true, "calendar": true, "contacts": true, "pipelines": true, "tasks": true, "workflows": true, "triggers": true, "basic_integrations": true}'::jsonb),

('bundle_pro', 'bundle', 'Full Ecosystem Pro',
  'price_1TIiDCGb3AGXe9w8KbI0Obiu', 'price_1TIiDCGb3AGXe9w8G3SwetsI',
  2, 15, 2000, 500, 26843545600, 10000, 10, 25, 5000, 10,
  '{"voxer": true, "video_vox": true, "pulse_radio": true, "email": true, "campaigns": true, "messaging": true, "calendar": true, "studio_rag": true, "analytics_advanced": true, "contacts": true, "pipelines": true, "tasks": true, "crm_integrations": true, "reporting": true, "automations": true, "workflows": true, "triggers": true, "basic_integrations": true, "advanced_integrations": true, "webhooks": true, "scheduling": true}'::jsonb),

('bundle_business', 'bundle', 'Full Ecosystem Business',
  'price_1TIiDiGb3AGXe9w8lfTkbx7F', 'price_1TIiDiGb3AGXe9w8qPhrCsxg',
  3, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  '{"voxer": true, "video_vox": true, "pulse_radio": true, "email": true, "campaigns": true, "messaging": true, "calendar": true, "studio_rag": true, "analytics_advanced": true, "analytics_predictive": true, "contacts": true, "pipelines": true, "tasks": true, "crm_integrations": true, "reporting": true, "automations": true, "workflows": true, "triggers": true, "basic_integrations": true, "advanced_integrations": true, "webhooks": true, "scheduling": true, "api_access": true, "custom_functions": true, "white_label": true, "priority_support": true}'::jsonb)

ON CONFLICT (id) DO UPDATE SET
  stripe_price_monthly = EXCLUDED.stripe_price_monthly,
  stripe_price_yearly = EXCLUDED.stripe_price_yearly,
  tier = EXCLUDED.tier,
  max_users = EXCLUDED.max_users,
  max_ai_messages_mo = EXCLUDED.max_ai_messages_mo,
  max_sms_mo = EXCLUDED.max_sms_mo,
  max_storage_bytes = EXCLUDED.max_storage_bytes,
  max_contacts = EXCLUDED.max_contacts,
  max_pipelines = EXCLUDED.max_pipelines,
  max_workflows = EXCLUDED.max_workflows,
  max_workflow_runs_mo = EXCLUDED.max_workflow_runs_mo,
  max_integrations = EXCLUDED.max_integrations,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active;

COMMIT;
