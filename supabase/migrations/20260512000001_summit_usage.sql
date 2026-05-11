-- Migration: 20260512000001_summit_usage.sql
-- Summit Phase 3 — tier-gated hosted minutes.
--
-- Adds:
--   - 'summit_minutes' to usage_records.metric CHECK (monthly counter)
--   - max_summit_minutes_mo + max_summit_session_sec columns on plans
--   - same two columns on entitlements (rolled-up caps)
--   - rebuild_entitlements() updated to propagate them
--   - plan seeds for pulse_team (60 min / 15-min sessions) and pulse_growth
--     (240 min / 30-min sessions)
--
-- Trial-time tighter caps (15 min / 5-min sessions) are enforced
-- runtime-only by the openai-realtime-token edge function, not stored on
-- the plan row, since trial users still ride the pulse_team plan.

BEGIN;

-- ────────────────────────────────────────────────────────────────────
-- 1. Allow 'summit_minutes' in usage_records.metric
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE public.usage_records
  DROP CONSTRAINT IF EXISTS usage_records_metric_check;
ALTER TABLE public.usage_records
  ADD CONSTRAINT usage_records_metric_check
  CHECK (metric IN (
    'ai_messages',
    'sms_sent',
    'storage_bytes',
    'voxer_minutes',
    'workflow_runs',
    'summit_minutes'
  ));

-- ────────────────────────────────────────────────────────────────────
-- 2. Plan / entitlement cap columns
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS max_summit_minutes_mo  INTEGER,
  ADD COLUMN IF NOT EXISTS max_summit_session_sec INTEGER;

ALTER TABLE public.entitlements
  ADD COLUMN IF NOT EXISTS max_summit_minutes_mo  INTEGER,
  ADD COLUMN IF NOT EXISTS max_summit_session_sec INTEGER;

-- ────────────────────────────────────────────────────────────────────
-- 3. Seed plan caps
-- Team:   60 min / month, 15-min sessions
-- Growth: 240 min / month, 30-min sessions
-- ────────────────────────────────────────────────────────────────────
UPDATE public.plans
   SET max_summit_minutes_mo = 60,
       max_summit_session_sec = 900
 WHERE id = 'pulse_team';

UPDATE public.plans
   SET max_summit_minutes_mo = 240,
       max_summit_session_sec = 1800
 WHERE id = 'pulse_growth';

-- ────────────────────────────────────────────────────────────────────
-- 4. rebuild_entitlements — add the two new fields
-- Mirrors the structure from 20260428000001_pulse_growth_tier.sql;
-- only the GREATEST blocks + INSERT/ON CONFLICT lists are extended.
-- ────────────────────────────────────────────────────────────────────
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
  -- Summit defaults: zero on free / unsupported plans. Trial uses the seeded
  -- pulse_team values; the edge function tightens further for trialing users.
  v_max_summit_minutes INT := 0;
  v_max_summit_session_sec INT := 0;
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

    -- Summit: NULL on plan = no Summit access; preserve 0 default until we see
    -- a plan that explicitly grants minutes.
    IF v_plan.max_summit_minutes_mo IS NOT NULL THEN
      v_max_summit_minutes := GREATEST(v_max_summit_minutes, v_plan.max_summit_minutes_mo);
    END IF;
    IF v_plan.max_summit_session_sec IS NOT NULL THEN
      v_max_summit_session_sec := GREATEST(v_max_summit_session_sec, v_plan.max_summit_session_sec);
    END IF;

    v_features := v_features || v_plan.features;
  END LOOP;

  INSERT INTO public.entitlements (
    workspace_id, apps, max_users, max_ai_messages_mo, max_sms_mo,
    max_storage_bytes, max_voxer_minutes_mo, max_contacts, max_pipelines, max_workflows,
    max_workflow_runs_mo, max_integrations,
    max_summit_minutes_mo, max_summit_session_sec,
    features, is_trialing,
    trial_ends_at, updated_at
  ) VALUES (
    p_workspace_id, v_apps, v_max_users, v_max_ai_messages, v_max_sms,
    v_max_storage, v_max_voxer_minutes, v_max_contacts, v_max_pipelines, v_max_workflows,
    v_max_workflow_runs, v_max_integrations,
    v_max_summit_minutes, v_max_summit_session_sec,
    v_features, v_is_trialing,
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
    max_summit_minutes_mo = EXCLUDED.max_summit_minutes_mo,
    max_summit_session_sec = EXCLUDED.max_summit_session_sec,
    features = EXCLUDED.features,
    is_trialing = EXCLUDED.is_trialing,
    trial_ends_at = EXCLUDED.trial_ends_at,
    updated_at = now();
END;
$$;

-- ────────────────────────────────────────────────────────────────────
-- 5. Backfill existing entitlements rows with the new caps
-- ────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_ws_id UUID;
BEGIN
  FOR v_ws_id IN SELECT id FROM public.workspaces WHERE deleted_at IS NULL LOOP
    PERFORM public.rebuild_entitlements(v_ws_id);
  END LOOP;
END $$;

COMMIT;
