-- 20260521000009_billing_select_rls_to_user_has_permission.sql
-- Issue #42 Sub-PR 4g — migrate billing-related SELECT policies that gate
-- on workspace_members.role to user_has_permission(workspace_id, 'billing.read').
--
-- Policies migrated
--   billing_drift_log.billing_drift_log_select   (SELECT, role IN ('owner','admin'))
--   invoices.invoices_select                      (SELECT, role IN ('owner','admin'))
--
-- Policies untouched
--   billing_drift_log_insert  — WITH CHECK false; service_role only
--   subscriptions_select      — membership only, no role gate
--   subscription_items_select — same
--   plans_select              — public catalog (is_active = true)
--   user_subscriptions / pulse_channel_subscriptions / push_subscriptions
--                             — owned by individual user, not workspace
--
-- Per catalog seed: owner + admin have billing.read; member + viewer don't.
-- billing.write is owner-only but no app-side policy enforces it — Stripe
-- writes via service_role; the matrix card surfaces the distinction.

BEGIN;

DROP POLICY IF EXISTS billing_drift_log_select ON public.billing_drift_log;
CREATE POLICY billing_drift_log_select
  ON public.billing_drift_log
  FOR SELECT
  TO authenticated
  USING (
    public.user_has_permission(workspace_id, 'billing.read')
  );

DROP POLICY IF EXISTS invoices_select ON public.invoices;
CREATE POLICY invoices_select
  ON public.invoices
  FOR SELECT
  TO authenticated
  USING (
    public.user_has_permission(workspace_id, 'billing.read')
  );

COMMIT;
