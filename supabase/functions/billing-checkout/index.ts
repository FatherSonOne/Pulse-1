// Supabase Edge Function: billing-checkout
// Creates a Stripe Checkout Session for plan purchases.
// Auth: Bearer token (must be workspace admin/owner)

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    // Authenticate user
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    // Parse request
    const { plan_id, billing_cycle, success_url, cancel_url, workspace_id } = await req.json();

    if (!plan_id || !billing_cycle || !success_url || !cancel_url || !workspace_id) {
      return json({ error: 'Missing required fields: plan_id, billing_cycle, success_url, cancel_url, workspace_id' }, 400);
    }

    if (!['monthly', 'yearly'].includes(billing_cycle)) {
      return json({ error: 'billing_cycle must be "monthly" or "yearly"' }, 400);
    }

    // Verify user is admin/owner of workspace
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: member } = await adminClient
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return json({ error: 'Only workspace admins can manage billing' }, 403);
    }

    // Look up plan
    const { data: plan } = await adminClient
      .from('plans')
      .select('*')
      .eq('id', plan_id)
      .eq('is_active', true)
      .single();

    if (!plan) return json({ error: 'Plan not found' }, 404);

    const priceId = billing_cycle === 'yearly'
      ? plan.stripe_price_yearly
      : plan.stripe_price_monthly;

    // Get or create Stripe customer
    const { data: workspace } = await adminClient
      .from('workspaces')
      .select('id, stripe_customer_id, billing_email, name')
      .eq('id', workspace_id)
      .single();

    if (!workspace) return json({ error: 'Workspace not found' }, 404);

    let customerId = workspace.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: workspace.billing_email || user.email,
        name: workspace.name,
        metadata: { workspace_id: workspace.id },
      });

      customerId = customer.id;

      await adminClient
        .from('workspaces')
        .update({ stripe_customer_id: customerId })
        .eq('id', workspace_id);
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url,
      cancel_url,
      metadata: { workspace_id },
      subscription_data: {
        metadata: { workspace_id },
      },
      allow_promotion_codes: true,
    });

    return json({ checkout_url: session.url });
  } catch (err) {
    console.error('[billing-checkout] Error:', err);
    return json({ error: 'Failed to create checkout session' }, 500);
  }
});
