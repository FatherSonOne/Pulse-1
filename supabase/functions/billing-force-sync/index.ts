// Supabase Edge Function: billing-force-sync
//
// Recovery helper for when the Stripe webhook hasn't run (e.g., webhook not yet
// configured in Stripe Dashboard). For a given workspace_id, fetches the latest
// active/trialing subscription from Stripe and upserts it into the local
// subscriptions table, then rebuilds entitlements.
//
// Auth: requires authenticated workspace admin/owner.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || '';
const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })
  : null;

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
  if (!stripe) return json({ error: 'STRIPE_SECRET_KEY not set' }, 500);

  try {
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader) return json({ error: 'Unauthorized — no auth header' }, 401);

    const token = authHeader.replace('Bearer ', '');
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) return json({ error: 'Unauthorized — invalid token' }, 401);

    const { workspace_id } = await req.json();
    if (!workspace_id) return json({ error: 'workspace_id required' }, 400);

    // Verify caller is admin/owner of the workspace
    const { data: member } = await adminClient
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();
    if (!member || !['owner', 'admin'].includes(member.role)) {
      return json({ error: 'Only workspace admins can sync billing' }, 403);
    }

    // Get workspace's stripe customer
    const { data: workspace } = await adminClient
      .from('workspaces')
      .select('id, stripe_customer_id')
      .eq('id', workspace_id)
      .single();
    if (!workspace?.stripe_customer_id) {
      return json({ error: 'Workspace has no stripe_customer_id' }, 404);
    }

    // List subscriptions for this customer in Stripe (most recent first)
    const subs = await stripe.subscriptions.list({
      customer: workspace.stripe_customer_id,
      status: 'all',
      limit: 10,
    });

    // Prefer active or trialing; fall back to most recent
    const sub =
      subs.data.find((s) => s.status === 'active' || s.status === 'trialing') ||
      subs.data[0];

    if (!sub) {
      return json({
        error: 'No Stripe subscriptions found for this customer',
        customer_id: workspace.stripe_customer_id,
      }, 404);
    }

    // Drop any synthetic pre-Stripe trial row first
    await adminClient
      .from('subscriptions')
      .delete()
      .eq('workspace_id', workspace_id)
      .like('stripe_subscription_id', 'trial_%');

    // Upsert the subscription row
    const { data: row, error: subError } = await adminClient
      .from('subscriptions')
      .upsert(
        {
          workspace_id,
          stripe_subscription_id: sub.id,
          status: sub.status,
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          cancel_at_period_end: sub.cancel_at_period_end,
          canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
          trial_start: sub.trial_start ? new Date(sub.trial_start * 1000).toISOString() : null,
          trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'stripe_subscription_id' }
      )
      .select('id')
      .single();

    if (subError || !row) {
      return json({ error: 'Upsert failed', detail: subError?.message }, 500);
    }

    // Sync subscription items
    await adminClient.from('subscription_items').delete().eq('subscription_id', row.id);

    const itemResults: Array<Record<string, unknown>> = [];
    for (const item of sub.items.data) {
      const priceId = typeof item.price === 'string' ? item.price : item.price.id;
      const { data: plan } = await adminClient
        .from('plans')
        .select('id')
        .or('stripe_price_monthly.eq.' + priceId + ',stripe_price_yearly.eq.' + priceId)
        .maybeSingle();

      if (plan) {
        await adminClient.from('subscription_items').insert({
          subscription_id: row.id,
          plan_id: plan.id,
          stripe_subscription_item_id: item.id,
          quantity: item.quantity || 1,
        });
        itemResults.push({ price_id: priceId, plan_id: plan.id, ok: true });
      } else {
        itemResults.push({ price_id: priceId, plan_id: null, warn: 'no matching plan' });
      }
    }

    // Rebuild entitlements
    const { error: rebuildErr } = await adminClient.rpc('rebuild_entitlements', {
      p_workspace_id: workspace_id,
    });

    return json({
      ok: true,
      workspace_id,
      subscription_id: sub.id,
      status: sub.status,
      items: itemResults,
      rebuild_error: rebuildErr?.message ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: 'Sync failed', detail: message }, 500);
  }
});
