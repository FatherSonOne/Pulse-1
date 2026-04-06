// Supabase Edge Function: billing-webhook
// Receives Stripe webhook events and syncs billing state to the database.
// Handles: checkout completion, subscription lifecycle, invoices, customer updates.
//
// Setup in Stripe Dashboard:
//   URL: https://YOUR_PROJECT.supabase.co/functions/v1/billing-webhook
//   Events: checkout.session.completed, customer.subscription.*, invoice.*, customer.updated
//   Secret: set STRIPE_WEBHOOK_SECRET env var

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Verify Stripe signature
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return json({ error: 'Missing stripe-signature header' }, 401);
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, WEBHOOK_SECRET);
    } catch (err) {
      console.error('[billing-webhook] Signature verification failed:', err.message);
      return json({ error: 'Invalid signature' }, 401);
    }

    // Idempotency check
    const { data: existing } = await supabase
      .from('processed_stripe_events')
      .select('event_id')
      .eq('event_id', event.id)
      .single();

    if (existing) {
      console.log(`[billing-webhook] Event ${event.id} already processed, skipping`);
      return json({ received: true, duplicate: true });
    }

    console.log(`[billing-webhook] Processing event: ${event.type} (${event.id})`);

    // Route event to handler
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(supabase, event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpsert(supabase, event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(supabase, event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(supabase, event.data.object as Stripe.Subscription);
        break;

      case 'invoice.paid':
      case 'invoice.finalized':
        await handleInvoice(supabase, event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(supabase, event.data.object as Stripe.Invoice);
        break;

      case 'customer.updated':
        await handleCustomerUpdated(supabase, event.data.object as Stripe.Customer);
        break;

      default:
        console.log(`[billing-webhook] Unhandled event type: ${event.type}`);
    }

    // Mark event as processed
    await supabase.from('processed_stripe_events').insert({
      event_id: event.id,
      event_type: event.type,
    });

    return json({ received: true });
  } catch (err) {
    console.error('[billing-webhook] Error:', err);
    return json({ error: 'Webhook handler failed' }, 500);
  }
});

// ── Handlers ──────────────────────────────────────────────────────────

async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createClient>,
  session: Stripe.Checkout.Session
) {
  const workspaceId = session.metadata?.workspace_id;
  if (!workspaceId) {
    console.error('[billing-webhook] checkout.session.completed missing workspace_id metadata');
    return;
  }

  // Link Stripe customer to workspace if not already
  if (session.customer) {
    const customerId = typeof session.customer === 'string'
      ? session.customer
      : session.customer.id;

    await supabase
      .from('workspaces')
      .update({
        stripe_customer_id: customerId,
        billing_email: session.customer_email || undefined,
      })
      .eq('id', workspaceId);
  }

  // Subscription is created via customer.subscription.created event
  console.log(`[billing-webhook] Checkout completed for workspace ${workspaceId}`);
}

async function handleSubscriptionUpsert(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription
) {
  // Find workspace by stripe_customer_id
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!workspace) {
    console.error(`[billing-webhook] No workspace found for customer ${customerId}`);
    return;
  }

  // Upsert subscription
  const { data: sub, error: subError } = await supabase
    .from('subscriptions')
    .upsert({
      workspace_id: workspace.id,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
      trial_start: subscription.trial_start
        ? new Date(subscription.trial_start * 1000).toISOString()
        : null,
      trial_end: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'stripe_subscription_id',
    })
    .select('id')
    .single();

  if (subError) {
    console.error('[billing-webhook] Error upserting subscription:', subError);
    return;
  }

  // Sync subscription items
  if (subscription.items?.data) {
    // Remove old items
    await supabase
      .from('subscription_items')
      .delete()
      .eq('subscription_id', sub.id);

    // Look up plan IDs by Stripe price ID
    for (const item of subscription.items.data) {
      const priceId = typeof item.price === 'string' ? item.price : item.price.id;

      const { data: plan } = await supabase
        .from('plans')
        .select('id')
        .or(`stripe_price_monthly.eq.${priceId},stripe_price_yearly.eq.${priceId}`)
        .single();

      if (plan) {
        await supabase.from('subscription_items').insert({
          subscription_id: sub.id,
          plan_id: plan.id,
          stripe_subscription_item_id: item.id,
          quantity: item.quantity || 1,
        });
      } else {
        console.warn(`[billing-webhook] No plan found for price ${priceId}`);
      }
    }
  }

  // Entitlements are rebuilt automatically by the database trigger
  console.log(`[billing-webhook] Subscription ${subscription.id} upserted for workspace ${workspace.id}`);
}

async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription
) {
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('[billing-webhook] Error canceling subscription:', error);
  }

  // Entitlements are rebuilt automatically by the trigger (will downgrade to free defaults)
  console.log(`[billing-webhook] Subscription ${subscription.id} canceled`);
}

async function handleTrialWillEnd(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription
) {
  // Find workspace for notification purposes
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, owner_id, billing_email')
    .eq('stripe_customer_id', customerId)
    .single();

  if (workspace) {
    console.log(`[billing-webhook] Trial ending soon for workspace ${workspace.id}`);
    // TODO: Send trial-ending notification email via your email service
  }
}

async function handleInvoice(
  supabase: ReturnType<typeof createClient>,
  invoice: Stripe.Invoice
) {
  const customerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : invoice.customer?.id;

  if (!customerId) return;

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!workspace) return;

  await supabase.from('invoices').upsert({
    workspace_id: workspace.id,
    stripe_invoice_id: invoice.id,
    amount_due: invoice.amount_due,
    amount_paid: invoice.amount_paid,
    currency: invoice.currency,
    status: invoice.status || 'draft',
    invoice_url: invoice.hosted_invoice_url || null,
    invoice_pdf: invoice.invoice_pdf || null,
    period_start: invoice.period_start
      ? new Date(invoice.period_start * 1000).toISOString()
      : null,
    period_end: invoice.period_end
      ? new Date(invoice.period_end * 1000).toISOString()
      : null,
  }, {
    onConflict: 'stripe_invoice_id',
  });

  // If invoice is paid, ensure subscription is active
  if (invoice.status === 'paid' && invoice.subscription) {
    const subId = typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription.id;

    await supabase
      .from('subscriptions')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', subId);
  }

  console.log(`[billing-webhook] Invoice ${invoice.id} synced (${invoice.status})`);
}

async function handlePaymentFailed(
  supabase: ReturnType<typeof createClient>,
  invoice: Stripe.Invoice
) {
  // Mirror the invoice
  await handleInvoice(supabase, invoice);

  // Mark subscription as past_due + record when it went past_due
  if (invoice.subscription) {
    const subId = typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription.id;

    // Check if already past_due (to avoid resetting the timestamp)
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('status, metadata')
      .eq('stripe_subscription_id', subId)
      .single();

    const metadata = existingSub?.metadata || {};
    if (existingSub?.status !== 'past_due') {
      // First time going past_due — record the timestamp for grace period tracking
      metadata.past_due_since = new Date().toISOString();
    }

    await supabase
      .from('subscriptions')
      .update({
        status: 'past_due',
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subId);

    // Check grace period: if past_due for more than 3 days, Stripe will cancel.
    // We log it here for monitoring; actual cancellation comes via subscription.deleted event.
    const pastDueSince = metadata.past_due_since ? new Date(metadata.past_due_since) : new Date();
    const daysPastDue = Math.floor((Date.now() - pastDueSince.getTime()) / (1000 * 60 * 60 * 24));
    console.log(`[billing-webhook] Payment failed for subscription ${subId}, past_due for ${daysPastDue} day(s)`);
  }
}

async function handleCustomerUpdated(
  supabase: ReturnType<typeof createClient>,
  customer: Stripe.Customer
) {
  await supabase
    .from('workspaces')
    .update({
      billing_email: customer.email || undefined,
      billing_name: customer.name || undefined,
    })
    .eq('stripe_customer_id', customer.id);

  console.log(`[billing-webhook] Customer ${customer.id} updated`);
}
