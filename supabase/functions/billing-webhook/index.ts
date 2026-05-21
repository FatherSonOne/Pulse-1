// Supabase Edge Function: billing-webhook
// Receives Stripe webhook events and syncs billing state to the database.
// Handles: checkout completion, subscription lifecycle, invoices, customer updates,
// trial reminders, and dunning — and fires transactional emails via Resend at
// key moments in the customer lifecycle.
//
// Setup in Stripe Dashboard:
//   URL: https://YOUR_PROJECT.supabase.co/functions/v1/billing-webhook
//   Events:
//     checkout.session.completed
//     customer.subscription.created
//     customer.subscription.updated
//     customer.subscription.deleted
//     customer.subscription.trial_will_end
//     invoice.paid
//     invoice.finalized
//     invoice.payment_failed
//     customer.updated
//   Secret: set STRIPE_WEBHOOK_SECRET env var
//
// Secrets required:
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY  (optional — emails are skipped and logged if missing)

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';
import {
  sendEmail,
  trialWillEndEmail,
  subscriptionCanceledEmail,
  invoicePaidEmail,
  paymentFailedEmail,
} from './emails.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

type SupabaseClient = ReturnType<typeof createClient>;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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
    console.error('[billing-webhook] Signature verification failed:', (err as Error).message);
    return json({ error: 'Invalid signature' }, 401);
  }

  // Idempotency check — Stripe retries events; we must not double-process.
  const { data: existing } = await supabase
    .from('processed_stripe_events')
    .select('event_id')
    .eq('event_id', event.id)
    .maybeSingle();

  if (existing) {
    console.log('[billing-webhook] Event ' + event.id + ' already processed, skipping');
    return json({ received: true, duplicate: true });
  }

  console.log('[billing-webhook] Processing event: ' + event.type + ' (' + event.id + ')');

  try {
    // Route event to handler
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(supabase, event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(supabase, event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(supabase, event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(supabase, event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(supabase, event.data.object as Stripe.Subscription);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(supabase, event.data.object as Stripe.Invoice);
        break;

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
        console.log('[billing-webhook] Unhandled event type: ' + event.type);
    }

    // Mark event as processed ONLY if the handler succeeded. On partial writes
    // this row is skipped, so Stripe will retry the event.
    await supabase.from('processed_stripe_events').insert({
      event_id: event.id,
      event_type: event.type,
    });

    return json({ received: true });
  } catch (err) {
    console.error('[billing-webhook] Handler error for ' + event.type + ':', err);
    // Do NOT mark processed — let Stripe retry.
    return json({ error: 'Webhook handler failed' }, 500);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════════════

/**
 * Look up the workspace for a Stripe customer ID + a contact email we can send
 * billing notifications to. Prefers `workspaces.billing_email`, falls back to
 * the workspace owner's auth email.
 */
async function getWorkspaceForCustomer(
  supabase: SupabaseClient,
  customerId: string
): Promise<{
  workspaceId: string;
  workspaceName: string | null;
  email: string | null;
} | null> {
  const { data: workspace, error: wsErr } = await supabase
    .from('workspaces')
    .select('id, name, billing_email')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (wsErr || !workspace) {
    console.warn('[billing-webhook] No workspace for customer ' + customerId);
    return null;
  }

  let email: string | null = workspace.billing_email ?? null;

  if (!email) {
    // Fall back to the workspace owner's auth email.
    const { data: owner } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspace.id)
      .eq('role', 'owner')
      .maybeSingle();

    if (owner?.user_id) {
      const { data: authUser } = await supabase.auth.admin.getUserById(owner.user_id);
      email = authUser?.user?.email ?? null;
    }
  }

  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name ?? null,
    email,
  };
}

/**
 * Remove the synthetic pre-Stripe trial row created by
 * `start_pulse_team_trial()` when the workspace was first created. Prevents
 * stale `trial_*` rows from cluttering entitlement queries once a real
 * Stripe subscription takes over.
 */
async function deleteSyntheticTrial(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<void> {
  const { error } = await supabase
    .from('subscriptions')
    .delete()
    .eq('workspace_id', workspaceId)
    .like('stripe_subscription_id', 'trial_%');

  if (error) {
    console.warn(
      '[billing-webhook] Failed to clear synthetic trial for ' + workspaceId + ':',
      error.message
    );
  }
}

async function rebuildEntitlements(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<void> {
  const { error } = await supabase.rpc('rebuild_entitlements', {
    p_workspace_id: workspaceId,
  });
  if (error) {
    console.error(
      '[billing-webhook] rebuild_entitlements failed for ' + workspaceId + ':',
      error.message
    );
  }
}

/**
 * Upsert a Stripe.Subscription into `subscriptions` + sync its items.
 * Returns the internal subscription row id + workspace id.
 */
async function upsertSubscription(
  supabase: SupabaseClient,
  subscription: Stripe.Subscription
): Promise<{ workspaceId: string; subscriptionId: string } | null> {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (!workspace) {
    console.error('[billing-webhook] No workspace found for customer ' + customerId);
    return null;
  }

  // Clean up the synthetic pre-Stripe trial row, if any.
  await deleteSyntheticTrial(supabase, workspace.id);

  // In newer Stripe API/billing modes, current_period_start/end live on the
  // subscription ITEM, not the subscription. Fall through to the item if the
  // top-level fields are missing — otherwise new Date(undefined * 1000) crashes
  // the handler, Stripe retries forever, and the row never moves off the old plan.
  const firstItem = subscription.items?.data?.[0] as
    | (Stripe.SubscriptionItem & { current_period_start?: number; current_period_end?: number })
    | undefined;
  const periodStartSec =
    subscription.current_period_start ?? firstItem?.current_period_start ?? subscription.billing_cycle_anchor;
  const periodEndSec =
    subscription.current_period_end ?? firstItem?.current_period_end ?? null;

  if (!periodStartSec || !periodEndSec) {
    console.error(
      '[billing-webhook] Missing period start/end on subscription ' + subscription.id +
        ' (and on its first item) — refusing to upsert with invalid timestamps'
    );
    return null;
  }

  const { data: sub, error: subError } = await supabase
    .from('subscriptions')
    .upsert(
      {
        workspace_id: workspace.id,
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        current_period_start: new Date(periodStartSec * 1000).toISOString(),
        current_period_end: new Date(periodEndSec * 1000).toISOString(),
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
      },
      { onConflict: 'stripe_subscription_id' }
    )
    .select('id')
    .single();

  if (subError || !sub) {
    console.error('[billing-webhook] Error upserting subscription:', subError);
    return null;
  }

  // Sync subscription items
  if (subscription.items?.data) {
    await supabase.from('subscription_items').delete().eq('subscription_id', sub.id);

    for (const item of subscription.items.data) {
      const priceId = typeof item.price === 'string' ? item.price : item.price.id;

      const { data: plan } = await supabase
        .from('plans')
        .select('id')
        .or('stripe_price_monthly.eq.' + priceId + ',stripe_price_yearly.eq.' + priceId)
        .maybeSingle();

      if (plan) {
        await supabase.from('subscription_items').insert({
          subscription_id: sub.id,
          plan_id: plan.id,
          stripe_subscription_item_id: item.id,
          quantity: item.quantity || 1,
        });
      } else {
        console.warn('[billing-webhook] No plan found for price ' + priceId);
      }
    }
  }

  // The DB trigger already rebuilds entitlements on subscription / item changes,
  // but we also call the RPC explicitly so callers can rely on fresh state when
  // this function returns.
  await rebuildEntitlements(supabase, workspace.id);

  return { workspaceId: workspace.id, subscriptionId: sub.id };
}

// ════════════════════════════════════════════════════════════════════════════
// Handlers
// ════════════════════════════════════════════════════════════════════════════

async function handleCheckoutCompleted(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session
) {
  const workspaceId = session.metadata?.workspace_id;
  if (!workspaceId) {
    console.error(
      '[billing-webhook] checkout.session.completed missing workspace_id metadata'
    );
    return;
  }

  console.log('[billing-webhook] checkout.session.completed for workspace ' + workspaceId);

  // Link Stripe customer to workspace if not already
  if (session.customer) {
    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer.id;

    await supabase
      .from('workspaces')
      .update({
        stripe_customer_id: customerId,
        billing_email: session.customer_email || undefined,
      })
      .eq('id', workspaceId);
  }

  // Drop any synthetic pre-Stripe trial row for this workspace.
  await deleteSyntheticTrial(supabase, workspaceId);

  // If the checkout created a subscription, upsert it now rather than
  // waiting for customer.subscription.created (which may race).
  if (session.subscription) {
    const subId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription.id;

    try {
      const sub = await stripe.subscriptions.retrieve(subId);
      await upsertSubscription(supabase, sub);
    } catch (err) {
      console.error(
        '[billing-webhook] Failed to retrieve subscription ' + subId + ':',
        err
      );
    }
  } else {
    // One-time purchase or setup-mode session — just rebuild entitlements.
    await rebuildEntitlements(supabase, workspaceId);
  }
}

async function handleSubscriptionCreated(
  supabase: SupabaseClient,
  subscription: Stripe.Subscription
) {
  const result = await upsertSubscription(supabase, subscription);
  if (result) {
    console.log(
      '[billing-webhook] customer.subscription.created for workspace ' + result.workspaceId
    );
  }
}

async function handleSubscriptionUpdated(
  supabase: SupabaseClient,
  subscription: Stripe.Subscription
) {
  const result = await upsertSubscription(supabase, subscription);
  if (!result) return;

  console.log(
    '[billing-webhook] customer.subscription.updated for workspace ' +
      result.workspaceId +
      ' (status=' +
      subscription.status +
      ')'
  );
}

async function handleSubscriptionDeleted(
  supabase: SupabaseClient,
  subscription: Stripe.Subscription
) {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

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
    throw error; // bubble up so Stripe retries
  }

  // Rebuild entitlements — the cancel will flip apps.pulse off.
  const ctx = await getWorkspaceForCustomer(supabase, customerId);
  if (ctx) {
    await rebuildEntitlements(supabase, ctx.workspaceId);

    console.log(
      '[billing-webhook] customer.subscription.deleted for workspace ' + ctx.workspaceId
    );

    // Notify owner — failure must not block webhook.
    if (ctx.email) {
      const { subject, html, text } = subscriptionCanceledEmail({
        workspaceName: ctx.workspaceName,
      });
      const r = await sendEmail({ to: ctx.email, subject, html, text });
      if (!r.ok) {
        console.warn('[billing-webhook] subscriptionCanceled email failed:', r.error);
      }
    }
  }
}

async function handleTrialWillEnd(
  supabase: SupabaseClient,
  subscription: Stripe.Subscription
) {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

  const ctx = await getWorkspaceForCustomer(supabase, customerId);
  if (!ctx) return;

  console.log(
    '[billing-webhook] customer.subscription.trial_will_end for workspace ' +
      ctx.workspaceId
  );

  if (!ctx.email) {
    console.warn(
      '[billing-webhook] No billing email for workspace ' +
        ctx.workspaceId +
        ' — cannot send trial_will_end email'
    );
    return;
  }

  const trialEnd = subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toISOString()
    : null;

  const { subject, html, text } = trialWillEndEmail({
    workspaceName: ctx.workspaceName,
    trialEndsAt: trialEnd,
  });

  const r = await sendEmail({ to: ctx.email, subject, html, text });
  if (!r.ok) {
    console.warn('[billing-webhook] trialWillEnd email failed:', r.error);
  }
}

async function handleInvoice(supabase: SupabaseClient, invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

  if (!customerId) return;

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (!workspace) return;

  await supabase.from('invoices').upsert(
    {
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
    },
    { onConflict: 'stripe_invoice_id' }
  );

  // If invoice is paid, ensure subscription is active
  if (invoice.status === 'paid' && invoice.subscription) {
    const subId =
      typeof invoice.subscription === 'string'
        ? invoice.subscription
        : invoice.subscription.id;

    await supabase
      .from('subscriptions')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', subId);
  }

  console.log('[billing-webhook] Invoice ' + invoice.id + ' synced (' + invoice.status + ')');
}

async function handleInvoicePaid(supabase: SupabaseClient, invoice: Stripe.Invoice) {
  // Mirror the invoice + flip subscription to active
  await handleInvoice(supabase, invoice);

  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const ctx = await getWorkspaceForCustomer(supabase, customerId);
  if (!ctx) return;

  // Rebuild entitlements in case this invoice.paid rescued a past_due sub.
  await rebuildEntitlements(supabase, ctx.workspaceId);

  console.log(
    '[billing-webhook] invoice.paid for workspace ' + ctx.workspaceId + ' — sending receipt'
  );

  // Skip receipts for zero-amount invoices (trial conversions with 100% coupons,
  // etc.) — they're not meaningful as receipts.
  if (invoice.amount_paid <= 0) {
    return;
  }

  if (!ctx.email) return;

  const { subject, html, text } = invoicePaidEmail({
    workspaceName: ctx.workspaceName,
    amountPaid: invoice.amount_paid,
    currency: invoice.currency,
    invoiceUrl: invoice.hosted_invoice_url,
    invoicePdf: invoice.invoice_pdf,
    periodEnd: invoice.period_end
      ? new Date(invoice.period_end * 1000).toISOString()
      : null,
  });

  const r = await sendEmail({ to: ctx.email, subject, html, text });
  if (!r.ok) {
    console.warn('[billing-webhook] invoicePaid email failed:', r.error);
  }
}

async function handlePaymentFailed(supabase: SupabaseClient, invoice: Stripe.Invoice) {
  // Mirror the invoice
  await handleInvoice(supabase, invoice);

  // Mark subscription as past_due + record when it went past_due
  if (invoice.subscription) {
    const subId =
      typeof invoice.subscription === 'string'
        ? invoice.subscription
        : invoice.subscription.id;

    // Check if already past_due (to avoid resetting the timestamp)
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('status, metadata')
      .eq('stripe_subscription_id', subId)
      .maybeSingle();

    const metadata = (existingSub?.metadata as Record<string, unknown>) || {};
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

    const pastDueSince = metadata.past_due_since
      ? new Date(metadata.past_due_since as string)
      : new Date();
    const daysPastDue = Math.floor(
      (Date.now() - pastDueSince.getTime()) / (1000 * 60 * 60 * 24)
    );
    console.log(
      '[billing-webhook] invoice.payment_failed for subscription ' +
        subId +
        ', past_due for ' +
        daysPastDue +
        ' day(s)'
    );
  }

  // Send dunning email — we do NOT cancel yet. Stripe will retry, and if all
  // retries fail Stripe will fire customer.subscription.deleted.
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const ctx = await getWorkspaceForCustomer(supabase, customerId);
  if (!ctx || !ctx.email) return;

  const { subject, html, text } = paymentFailedEmail({
    workspaceName: ctx.workspaceName,
    amountDue: invoice.amount_due,
    currency: invoice.currency,
    invoiceUrl: invoice.hosted_invoice_url,
  });

  const r = await sendEmail({ to: ctx.email, subject, html, text });
  if (!r.ok) {
    console.warn('[billing-webhook] paymentFailed email failed:', r.error);
  }
}

async function handleCustomerUpdated(
  supabase: SupabaseClient,
  customer: Stripe.Customer
) {
  await supabase
    .from('workspaces')
    .update({
      billing_email: customer.email || undefined,
      billing_name: customer.name || undefined,
    })
    .eq('stripe_customer_id', customer.id);

  console.log('[billing-webhook] customer.updated for ' + customer.id);
}
