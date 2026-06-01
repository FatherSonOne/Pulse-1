// Supabase Edge Function: billing-sync-seats
// Synchronizes a workspace's Stripe subscription quantity with its actual
// active member count. Called from the client after invite acceptance and
// member removal so Stripe always reflects the true seat usage.
//
// Auth: Bearer token (must be workspace admin/owner)
//
// Request: { workspace_id: string }
// Response: { quantity: number, skipped?: string, subscription_id?: string }

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader) return json({ error: 'Unauthorized — no auth header' }, 401);

    const token = authHeader.replace('Bearer ', '');
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) {
      return json({ error: 'Unauthorized — invalid token' }, 401);
    }

    const { workspace_id } = await req.json();
    if (!workspace_id) return json({ error: 'workspace_id required' }, 400);

    // Authorize: caller must be owner or admin of this workspace.
    const { data: membership } = await admin
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return json({ error: 'Forbidden — admin role required' }, 403);
    }

    // Count active (non-deleted) members.
    const { count: memberCount, error: countError } = await admin
      .from('workspace_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('workspace_id', workspace_id);

    if (countError) {
      console.error('[billing-sync-seats] count error:', countError.message);
      return json({ error: 'Failed to count members' }, 500);
    }

    // Provisional count for the pre-Stripe early returns; the AUTHORITATIVE
    // quantity is computed below once we know the plan (per-seat vs flat).
    const provisionalQty = Math.max(memberCount ?? 1, 1);

    // Fetch the active subscription for this workspace.
    const { data: subRow } = await admin
      .from('subscriptions')
      .select('stripe_subscription_id, status')
      .eq('workspace_id', workspace_id)
      .in('status', ['trialing', 'active', 'past_due'])
      .order('current_period_end', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (!subRow?.stripe_subscription_id) {
      return json({ quantity: provisionalQty, skipped: 'no_active_subscription' });
    }

    // Local-only placeholder subs (e.g., 'trial_*' used before checkout) have
    // no Stripe counterpart — skip the Stripe API call but still return the count.
    if (subRow.stripe_subscription_id.startsWith('trial_')) {
      return json({
        quantity: provisionalQty,
        skipped: 'local_trial',
        subscription_id: subRow.stripe_subscription_id,
      });
    }

    // Pull the live subscription and its first item, then update quantity.
    const subscription = await stripe.subscriptions.retrieve(subRow.stripe_subscription_id);
    const item = subscription.items?.data?.[0];
    if (!item) {
      return json({ error: 'Subscription has no items to update' }, 500);
    }

    // Plan-aware seat model (Model A — seats = active members):
    //   • Per-seat plan (Pulse Team, price metadata per_seat='true'): Stripe
    //     quantity tracks the active member count, floored at 2 (Team min-2 —
    //     a 1-seat Team at $15 would undercut Solo $20).
    //   • Flat plan (Solo / Growth): quantity MUST stay 1 regardless of member
    //     count — multiplying a flat price by members would massively overbill.
    const isPerSeat = item.price?.metadata?.per_seat === 'true';
    if (!isPerSeat) {
      if (item.quantity !== 1) {
        await stripe.subscriptionItems.update(item.id, {
          quantity: 1,
          proration_behavior: 'create_prorations',
        });
        console.log('[billing-sync-seats] flat plan — reset quantity to 1', {
          workspace_id, subscription_id: subscription.id, from: item.quantity,
        });
      }
      return json({ quantity: 1, skipped: 'flat_plan', subscription_id: subscription.id });
    }

    const quantity = Math.max(memberCount ?? 1, 2);

    if (item.quantity === quantity) {
      return json({ quantity, skipped: 'unchanged', subscription_id: subscription.id });
    }

    await stripe.subscriptionItems.update(item.id, {
      quantity,
      proration_behavior: 'create_prorations',
    });

    console.log('[billing-sync-seats] updated', {
      workspace_id,
      subscription_id: subscription.id,
      from: item.quantity,
      to: quantity,
    });

    return json({ quantity, subscription_id: subscription.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[billing-sync-seats] error:', msg);
    return json({ error: msg }, 500);
  }
});
