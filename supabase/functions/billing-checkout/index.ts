// Supabase Edge Function: billing-checkout
// Creates a Stripe Checkout Session for plan purchases.
// Auth: Bearer token (must be workspace admin/owner)

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || '';
const STRIPE_KEY_MODE = STRIPE_SECRET_KEY.startsWith('sk_live_')
  ? 'live'
  : STRIPE_SECRET_KEY.startsWith('sk_test_')
    ? 'test'
    : 'missing-or-invalid';

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })
  : null;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const PORTAL_CONFIG_ID = Deno.env.get('STRIPE_CUSTOMER_PORTAL_ID');

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

  // Track which step we're in so failures pinpoint the cause.
  let step = 'init';

  try {
    if (!stripe) {
      console.error('[billing-checkout] STRIPE_SECRET_KEY not set or invalid');
      return json({
        error: 'Stripe is not configured on the server',
        detail: `STRIPE_SECRET_KEY is ${STRIPE_KEY_MODE}. Set it in Supabase project secrets.`,
        step: 'stripe-init',
      }, 500);
    }

    // Authenticate user — use service-role client + explicit token validation.
    // This is the same pattern as ai-router and avoids Deno/session-storage issues
    // that can make the implicit getUser() call fail in Edge Functions.
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader) {
      console.error('[billing-checkout] Missing Authorization header');
      return json({ error: 'Unauthorized — no auth header' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) {
      console.error('[billing-checkout] Token validation failed:', authError?.message);
      return json({ error: 'Unauthorized — invalid token' }, 401);
    }

    console.log('[billing-checkout] Authenticated user:', user.id);

    // Parse request
    const { plan_id, billing_cycle, success_url, cancel_url, workspace_id } = await req.json();

    if (!plan_id || !billing_cycle || !success_url || !cancel_url || !workspace_id) {
      return json({ error: 'Missing required fields: plan_id, billing_cycle, success_url, cancel_url, workspace_id' }, 400);
    }

    if (!['monthly', 'yearly'].includes(billing_cycle)) {
      return json({ error: 'billing_cycle must be "monthly" or "yearly"' }, 400);
    }

    // Verify user is admin/owner of workspace (reuse the admin client created above)
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

    // Seat quantity. Pulse Team is PER-SEAT ($15/seat) — bill the current
    // active member count (minimum 2 seats). billing-sync-seats /
    // billing-reconcile-seats keep the quantity in sync after invites/removals.
    // Solo (flat $20, 1 seat) and Growth (flat) stay quantity 1.
    let seatQuantity = 1;
    if (plan_id === 'pulse_team') {
      const { count: memberCount } = await adminClient
        .from('workspace_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('workspace_id', workspace_id);
      seatQuantity = Math.max(2, memberCount ?? 1);
    }

    // Get or create Stripe customer
    const { data: workspace } = await adminClient
      .from('workspaces')
      .select('id, stripe_customer_id, billing_email, name')
      .eq('id', workspace_id)
      .single();

    if (!workspace) return json({ error: 'Workspace not found' }, 404);

    let customerId = workspace.stripe_customer_id;

    // Verify the stored customer still exists in THIS Stripe mode (test/live).
    // If someone switches STRIPE_SECRET_KEY from live to test (or vice versa),
    // the old customer ID won't resolve — create a fresh one instead of failing.
    if (customerId) {
      step = 'stripe-customers-retrieve';
      try {
        const existing = await stripe.customers.retrieve(customerId);
        if ((existing as { deleted?: boolean }).deleted) {
          console.log('[billing-checkout] Stored customer was deleted; creating new');
          customerId = null;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('No such customer')) {
          console.log('[billing-checkout] Stored customer missing in this Stripe mode; creating new');
          customerId = null;
        } else {
          throw e;
        }
      }
    }

    if (!customerId) {
      step = 'stripe-customers-create';
      const customerEmail = workspace.billing_email || user.email;
      if (!customerEmail) {
        return json({
          error: 'No billing email available',
          detail: 'Workspace has no billing_email and user has no email on file.',
          step,
        }, 400);
      }
      const customer = await stripe.customers.create({
        email: customerEmail,
        name: workspace.name,
        metadata: { workspace_id: workspace.id },
      });

      customerId = customer.id;

      await adminClient
        .from('workspaces')
        .update({ stripe_customer_id: customerId })
        .eq('id', workspace_id);
    }

    // Duplicate-subscription guard. If this customer already has a real Stripe
    // subscription that's active/trialing/past_due, refuse to create a second
    // one — return a Customer Portal URL instead so the user changes plan in
    // place (Stripe handles proration, no double-billing). Synthetic pre-Stripe
    // trials (stripe_subscription_id starting with 'trial_') never appear in
    // this list because they don't exist in Stripe — checkout to convert them
    // is allowed and falls through to the normal path below.
    step = 'stripe-subscriptions-list';
    const existingSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10,
    });
    const blockingSub = existingSubs.data.find((s) =>
      ['active', 'trialing', 'past_due'].includes(s.status),
    );
    if (blockingSub) {
      console.log('[billing-checkout] Existing Stripe sub found; redirecting to portal', {
        existing_sub_id: blockingSub.id,
        existing_status: blockingSub.status,
        requested_plan: plan_id,
      });
      step = 'stripe-portal-create';
      const portalParams: Stripe.BillingPortal.SessionCreateParams = {
        customer: customerId,
        return_url: success_url,
      };

      if (PORTAL_CONFIG_ID) {
        portalParams.configuration = PORTAL_CONFIG_ID;
      }

      const portalSession = await stripe.billingPortal.sessions.create(portalParams);
      // 200 with portal URL in `checkout_url` so the client redirects there
      // unchanged. `action: 'portal'` lets future clients distinguish if needed.
      return json({
        checkout_url: portalSession.url,
        action: 'portal',
        reason: 'already_subscribed',
        existing_subscription_id: blockingSub.id,
        existing_status: blockingSub.status,
      });
    }

    // Check whether this workspace has already had a trial. Stripe allows only
    // one trial per customer per subscription; we also don't want double-dipping
    // via the synthetic pre-Stripe trial we created on workspace creation.
    const { data: priorSub } = await adminClient
      .from('subscriptions')
      .select('trial_end, status, stripe_subscription_id')
      .eq('workspace_id', workspace_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Eligible for a trial if: no prior subscription, OR prior was a synthetic
    // trial (stripe_subscription_id starts with 'trial_') that's still active.
    const isSyntheticTrial = priorSub?.stripe_subscription_id?.startsWith('trial_');
    const trialStillValid = priorSub?.trial_end && new Date(priorSub.trial_end) > new Date();
    const eligibleForTrial = !priorSub || (isSyntheticTrial && trialStillValid);

    // If the synthetic trial is partway through, give them the REMAINING days
    // so they don't get a fresh 30-day window on top.
    let trialPeriodDays: number | undefined;
    if (eligibleForTrial) {
      if (isSyntheticTrial && priorSub?.trial_end) {
        const remainingMs = new Date(priorSub.trial_end).getTime() - Date.now();
        const remainingDays = Math.max(1, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
        trialPeriodDays = Math.min(30, remainingDays);
      } else {
        trialPeriodDays = 30;
      }
    }

    // Create Checkout Session
    step = 'stripe-checkout-create';
    console.log('[billing-checkout] Creating session', {
      mode: STRIPE_KEY_MODE,
      priceId,
      customerId,
      trialPeriodDays,
    });
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: seatQuantity }],
      success_url,
      cancel_url,
      metadata: { workspace_id },
      subscription_data: {
        metadata: { workspace_id },
        ...(trialPeriodDays ? { trial_period_days: trialPeriodDays } : {}),
      },
      allow_promotion_codes: true,
    });

    return json({ checkout_url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stripeCode = (err as { code?: string; type?: string })?.code;
    const stripeType = (err as { code?: string; type?: string })?.type;
    console.error('[billing-checkout] Error at step', step, ':', message, { stripeCode, stripeType });
    return json({
      error: 'Failed to create checkout session',
      detail: message,
      step,
      stripe_mode: STRIPE_KEY_MODE,
      stripe_code: stripeCode,
      stripe_type: stripeType,
    }, 500);
  }
});
