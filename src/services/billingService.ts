// billingService.ts — Stripe-backed billing for QntmEcos ecosystem
import { supabase } from './supabase';

// ── Types ────────────────────────────────────────────────────────────

export interface Plan {
  id: string;
  app: string;
  name: string;
  tier: number;
  max_users: number | null;
  max_ai_messages_mo: number | null;
  max_sms_mo: number | null;
  max_storage_bytes: number | null;
  max_voxer_minutes_mo: number | null;
  max_contacts: number | null;
  max_pipelines: number | null;
  max_workflows: number | null;
  max_workflow_runs_mo: number | null;
  max_integrations: number | null;
  max_summit_minutes_mo: number | null;
  max_summit_session_sec: number | null;
  features: Record<string, boolean>;
  stripe_price_monthly: string;
  stripe_price_yearly: string;
}

export interface Entitlements {
  workspace_id: string;
  apps: Record<string, string | null>; // { pulse: "team", logos_vision: "starter", entomate: null }
  max_users: number | null;
  max_ai_messages_mo: number | null;
  max_sms_mo: number | null;
  max_storage_bytes: number | null;
  max_voxer_minutes_mo: number | null;
  max_contacts: number | null;
  max_pipelines: number | null;
  max_workflows: number | null;
  max_workflow_runs_mo: number | null;
  max_integrations: number | null;
  // Summit (live voice) caps. NULL until the workspace has a plan that grants
  // Summit access; trial users override to tighter values at runtime in the
  // edge function. See migration 20260512000001_summit_usage.sql.
  max_summit_minutes_mo: number | null;
  max_summit_session_sec: number | null;
  features: Record<string, boolean>;
  is_trialing: boolean;
  trial_ends_at: string | null;
  usage?: Record<string, number>;
}

export interface Subscription {
  id: string;
  workspace_id: string;
  stripe_subscription_id: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused';
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  trial_start: string | null;
  trial_end: string | null;
}

export interface Invoice {
  id: string;
  stripe_invoice_id: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  invoice_url: string | null;
  invoice_pdf: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

async function callEdgeFunction(name: string, body?: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  // Use supabase.functions.invoke — handles both apikey + Authorization headers
  // that the Supabase edge function gateway requires.
  const { data, error } = await supabase.functions.invoke(name, { body: body || {} });

  if (error) {
    // FunctionsHttpError exposes .context.response for non-2xx responses
    const ctx = (error as { context?: { response?: Response } }).context;
    const response = ctx?.response;

    let bodyData: Record<string, unknown> | null = null;
    if (response) {
      try { bodyData = await response.clone().json(); } catch { /* not JSON */ }
    }

    // Log the full body so DevTools Console shows the actual Stripe error
    if (bodyData) {
      console.error(`[${name}] server response:`, bodyData);
    }

    const errorMsg = (bodyData?.error as string) || (error as Error).message;
    const detail = bodyData?.detail as string | undefined;
    const combined = detail ? `${errorMsg} — ${detail}` : errorMsg;
    throw new Error(`${name}: ${combined}`);
  }
  return data;
}

// ── Service ──────────────────────────────────────────────────────────

const billingService = {
  // -- Plans --

  async getAvailablePlans(app?: string): Promise<Plan[]> {
    let query = supabase.from('plans').select('*').eq('is_active', true);
    if (app) query = query.or(`app.eq.${app},app.eq.bundle`);

    const { data, error } = await query.order('tier');
    if (error) throw error;
    return data || [];
  },

  // -- Entitlements --

  async getEntitlements(workspaceId: string): Promise<Entitlements> {
    const { data, error } = await supabase
      .from('entitlements')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (error || !data) {
      // No entitlements row = no active subscription/trial.
      // Every limit is 0 (all AI/SMS/storage/Relay blocked) and no features flipped on.
      // UI should detect apps.pulse === undefined and render TrialExpiredBlock.
      return {
        workspace_id: workspaceId,
        apps: {},
        max_users: 0,
        max_ai_messages_mo: 0,
        max_sms_mo: 0,
        max_storage_bytes: 0,
        max_voxer_minutes_mo: 0,
        max_contacts: 0,
        max_pipelines: 0,
        max_workflows: 0,
        max_workflow_runs_mo: 0,
        max_integrations: 0,
        max_summit_minutes_mo: 0,
        max_summit_session_sec: 0,
        features: {},
        is_trialing: false,
        trial_ends_at: null,
      };
    }

    // Fetch current period usage
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString().split('T')[0];

    const { data: usageRecords } = await supabase
      .from('usage_records')
      .select('metric, quantity')
      .eq('workspace_id', workspaceId)
      .eq('period_start', periodStart);

    const usage: Record<string, number> = {};
    if (usageRecords) {
      for (const record of usageRecords) {
        usage[record.metric] = record.quantity;
      }
    }

    return { ...data, usage };
  },

  // -- Subscriptions --

  async getSubscription(workspaceId: string): Promise<Subscription | null> {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .in('status', ['active', 'trialing', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  },

  // -- Checkout --

  async createCheckout(params: {
    workspaceId: string;
    planId: string;
    billingCycle: 'monthly' | 'yearly';
    successUrl?: string;
    cancelUrl?: string;
  }): Promise<string> {
    const { checkout_url } = await callEdgeFunction('billing-checkout', {
      workspace_id: params.workspaceId,
      plan_id: params.planId,
      billing_cycle: params.billingCycle,
      success_url: params.successUrl || `${window.location.origin}/settings?billing=success`,
      cancel_url: params.cancelUrl || `${window.location.origin}/settings?billing=canceled`,
    });
    return checkout_url;
  },

  // -- Customer Portal --

  async openCustomerPortal(workspaceId: string): Promise<string> {
    const { portal_url } = await callEdgeFunction('billing-portal', {
      workspace_id: workspaceId,
      return_url: `${window.location.origin}/settings`,
    });
    return portal_url;
  },

  // -- Invoices --

  async getInvoices(workspaceId: string): Promise<Invoice[]> {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(24);

    if (error) throw error;
    return data || [];
  },

  // -- Feature checks --

  canUseFeature(entitlements: Entitlements, feature: string): boolean {
    return !!entitlements.features[feature];
  },

  isAtLimit(entitlements: Entitlements, metric: string): boolean {
    const usage = entitlements.usage?.[metric] || 0;
    let limit: number | null = null;

    switch (metric) {
      case 'ai_messages': limit = entitlements.max_ai_messages_mo; break;
      case 'sms_sent': limit = entitlements.max_sms_mo; break;
      case 'storage_bytes': limit = entitlements.max_storage_bytes; break;
      case 'voxer_minutes': limit = entitlements.max_voxer_minutes_mo; break;
      case 'workflow_runs': limit = entitlements.max_workflow_runs_mo; break;
    }

    if (limit === null) return false; // unlimited
    return usage >= limit;
  },

  isNearLimit(entitlements: Entitlements, metric: string): boolean {
    const usage = entitlements.usage?.[metric] || 0;
    let limit: number | null = null;

    switch (metric) {
      case 'ai_messages': limit = entitlements.max_ai_messages_mo; break;
      case 'sms_sent': limit = entitlements.max_sms_mo; break;
      case 'storage_bytes': limit = entitlements.max_storage_bytes; break;
      case 'voxer_minutes': limit = entitlements.max_voxer_minutes_mo; break;
      case 'workflow_runs': limit = entitlements.max_workflow_runs_mo; break;
    }

    if (limit === null) return false;
    return usage >= limit * 0.8;
  },

  // -- Trial / access state --

  /**
   * Whether the workspace has an active Pulse subscription (trialing or paid).
   * False means the trial has expired OR no subscription has ever been created.
   * UI should render TrialExpiredBlock when this is false.
   */
  hasActivePulseAccess(entitlements: Entitlements): boolean {
    return !!entitlements.apps?.pulse;
  },

  /**
   * Starts a 30-day Pulse Team trial for a freshly created workspace.
   * Idempotent — calling twice is safe. Called from workspaceService.createWorkspace.
   */
  async startPulseTeamTrial(workspaceId: string): Promise<void> {
    const { error } = await supabase.rpc('start_pulse_team_trial', {
      p_workspace_id: workspaceId,
    });
    if (error) {
      console.error('[billingService] start_pulse_team_trial failed:', error.message);
      throw error;
    }
  },

  /**
   * Pushes the current workspace member count into Stripe as the subscription
   * quantity. Called after invite acceptance and member removal so billing
   * tracks the true seat count. Fire-and-forget — failures are logged and
   * swallowed so membership operations never break because of Stripe hiccups.
   *
   * Returns the new quantity (or 1 when no Stripe sub exists yet).
   */
  async syncSeats(workspaceId: string): Promise<number> {
    try {
      const result = await callEdgeFunction('billing-sync-seats', {
        workspace_id: workspaceId,
      });
      return (result?.quantity as number) ?? 1;
    } catch (err) {
      console.warn('[billingService] syncSeats failed (non-fatal):', err);
      return 1;
    }
  },

};

export default billingService;
