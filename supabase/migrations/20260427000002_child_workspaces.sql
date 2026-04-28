-- ============================================================
-- MIGRATION: 20260427000002_child_workspaces.sql
-- PURPOSE:   Introduce child workspaces. A workspace with
--            parent_workspace_id set is a "sub-context" under a
--            paid primary workspace and inherits the parent's
--            plan + entitlements without its own subscription.
--
--            - Adds parent_workspace_id column on workspaces.
--            - Updates rebuild_entitlements() so child workspaces
--              resolve subscriptions through their parent.
--            - Adds create_child_workspace() RPC for owner-only
--              creation that skips Stripe trial setup entirely.
-- DATE:      2026-04-27
-- DEPENDS:   20260423000001_pulse_team_tier.sql
-- SAFE:      Idempotent. parent_workspace_id is nullable (existing
--            workspaces remain primaries by default).
-- ============================================================

BEGIN;

-- ============================================================
-- SECTION 1: Schema — parent_workspace_id column + index
-- ============================================================

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS parent_workspace_id UUID
    REFERENCES public.workspaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS workspaces_parent_idx
  ON public.workspaces(parent_workspace_id)
  WHERE parent_workspace_id IS NOT NULL;

COMMENT ON COLUMN public.workspaces.parent_workspace_id IS
  'When set, this workspace is a child sub-context under a paid primary workspace. '
  'Children inherit the parent''s plan + entitlements and have no subscription of their own. '
  'NULL = primary (billed) workspace.';

-- A child cannot itself be a parent (one level of nesting only).
ALTER TABLE public.workspaces
  DROP CONSTRAINT IF EXISTS workspaces_no_grandchildren_check;

-- We can't enforce "parent has no parent" as a CHECK (cross-row), so use a trigger.
CREATE OR REPLACE FUNCTION public.workspaces_enforce_single_nesting()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent_has_parent BOOLEAN;
BEGIN
  IF NEW.parent_workspace_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT (parent_workspace_id IS NOT NULL)
    INTO v_parent_has_parent
    FROM public.workspaces
   WHERE id = NEW.parent_workspace_id;

  IF v_parent_has_parent THEN
    RAISE EXCEPTION 'Child workspaces cannot themselves be parents (workspace % has parent %)',
      NEW.parent_workspace_id, NEW.parent_workspace_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workspaces_single_nesting_trg ON public.workspaces;
CREATE TRIGGER workspaces_single_nesting_trg
  BEFORE INSERT OR UPDATE OF parent_workspace_id ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.workspaces_enforce_single_nesting();

-- ============================================================
-- SECTION 2: Update rebuild_entitlements to follow parent
-- ============================================================
-- Children have no subscriptions of their own — they resolve
-- through the parent's billing relationship. Same caps, same
-- feature gates, no extra Stripe row.

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
  -- Resolve billing workspace: child workspaces follow their parent's
  -- subscription. Primaries (parent_workspace_id IS NULL) bill themselves.
  SELECT COALESCE(parent_workspace_id, id)
    INTO v_billing_workspace_id
    FROM public.workspaces
   WHERE id = p_workspace_id;

  IF v_billing_workspace_id IS NULL THEN
    -- Workspace doesn't exist; nothing to rebuild.
    RETURN;
  END IF;

  -- Check active subscription / trial state on the billing workspace.
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

  -- Scan all active subscription items and resolve highest tier per app.
  FOR v_plan IN
    SELECT p.*
      FROM public.subscription_items si
      JOIN public.subscriptions s ON s.id = si.subscription_id
      JOIN public.plans p        ON p.id = si.plan_id
     WHERE s.workspace_id = v_billing_workspace_id
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
-- SECTION 3: create_child_workspace RPC
-- ============================================================
-- Owner-only creation of a sub-context under a primary workspace.
-- - Validates caller is owner of the parent.
-- - Inserts the workspace with parent_workspace_id set, plan inherited.
-- - Adds caller as owner member.
-- - Triggers entitlements rebuild (which resolves through parent).
-- - Does NOT create a subscription row (parent's covers it).

CREATE OR REPLACE FUNCTION public.create_child_workspace(
  p_parent_id UUID,
  p_name TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS public.workspaces
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_is_owner BOOLEAN;
  v_parent RECORD;
  v_slug TEXT;
  v_new_workspace public.workspaces;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Workspace name is required';
  END IF;

  -- Load parent and verify it is a primary (cannot nest children of children).
  SELECT id, plan, parent_workspace_id, owner_id
    INTO v_parent
    FROM public.workspaces
   WHERE id = p_parent_id
     AND deleted_at IS NULL;

  IF v_parent.id IS NULL THEN
    RAISE EXCEPTION 'Parent workspace not found';
  END IF;

  IF v_parent.parent_workspace_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot create a child of a child workspace';
  END IF;

  -- Verify the caller is owner of the parent.
  SELECT EXISTS(
    SELECT 1 FROM public.workspace_members
     WHERE workspace_id = p_parent_id
       AND user_id = v_caller
       AND role = 'owner'
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'Only the parent workspace owner can create child workspaces';
  END IF;

  -- Slug: name-slugified plus base36 timestamp for uniqueness.
  v_slug := COALESCE(NULLIF(regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'), ''), 'workspace');
  v_slug := trim(both '-' from v_slug);
  v_slug := substr(v_slug, 1, 40) || '-' || lower(to_hex(extract(epoch from now())::bigint));

  -- Insert child workspace inheriting parent's plan.
  INSERT INTO public.workspaces (
    name, slug, description, owner_id, plan, parent_workspace_id
  ) VALUES (
    trim(p_name), v_slug, p_description, v_caller, v_parent.plan, p_parent_id
  )
  RETURNING * INTO v_new_workspace;

  -- Caller becomes owner of the child workspace as well.
  INSERT INTO public.workspace_members (workspace_id, user_id, role, invited_by)
  VALUES (v_new_workspace.id, v_caller, 'owner', NULL);

  -- Materialize entitlements (resolves through parent).
  PERFORM public.rebuild_entitlements(v_new_workspace.id);

  RETURN v_new_workspace;
END;
$$;

REVOKE ALL ON FUNCTION public.create_child_workspace(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_child_workspace(UUID, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.create_child_workspace IS
  'Creates a child workspace under a primary. Owner-only. Skips Stripe trial '
  '(child inherits the parent''s plan + entitlements via rebuild_entitlements).';

-- ============================================================
-- SECTION 4: Rebuild entitlements for all existing workspaces
-- ============================================================
-- Picks up the new parent-resolution logic for any future child rows.

DO $$
DECLARE
  v_ws_id UUID;
BEGIN
  FOR v_ws_id IN SELECT id FROM public.workspaces WHERE deleted_at IS NULL LOOP
    PERFORM public.rebuild_entitlements(v_ws_id);
  END LOOP;
END $$;

COMMIT;
