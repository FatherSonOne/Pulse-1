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
  max_contacts: number | null;
  max_pipelines: number | null;
  max_workflows: number | null;
  max_workflow_runs_mo: number | null;
  max_integrations: number | null;
  features: Record<string, boolean>;
  stripe_price_monthly: string;
  stripe_price_yearly: string;
}

export interface Entitlements {
  workspace_id: string;
  apps: Record<string, string | null>; // { pulse: "pro", logos_vision: "starter", entomate: null }
  max_users: number | null;
  max_ai_messages_mo: number | null;
  max_sms_mo: number | null;
  max_storage_bytes: number | null;
  max_contacts: number | null;
  max_pipelines: number | null;
  max_workflows: number | null;
  max_workflow_runs_mo: number | null;
  max_integrations: number | null;
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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

async function callEdgeFunction(name: string, body?: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Edge function call failed');
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
      .single();

    if (error || !data) {
      // Return free-tier defaults
      return {
        workspace_id: workspaceId,
        apps: {},
        max_users: 5,
        max_ai_messages_mo: 500,
        max_sms_mo: 100,
        max_storage_bytes: 5368709120,
        max_contacts: 1000,
        max_pipelines: 2,
        max_workflows: 5,
        max_workflow_runs_mo: 500,
        max_integrations: 3,
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
      .single();

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
      case 'workflow_runs': limit = entitlements.max_workflow_runs_mo; break;
    }

    if (limit === null) return false;
    return usage >= limit * 0.8;
  },

};

export default billingService;
