// Supabase Edge Function: billing-portal
// Opens a Stripe Customer Portal session for self-service billing management.
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

  try {
    // Authenticate user
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const { return_url, workspace_id } = await req.json();

    if (!return_url || !workspace_id) {
      return json({ error: 'Missing required fields: return_url, workspace_id' }, 400);
    }

    // Verify admin/owner role
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

    // Get workspace's Stripe customer
    const { data: workspace } = await adminClient
      .from('workspaces')
      .select('stripe_customer_id')
      .eq('id', workspace_id)
      .single();

    if (!workspace?.stripe_customer_id) {
      return json({ error: 'No billing account found. Please subscribe to a plan first.' }, 400);
    }

    // Create portal session
    const portalParams: Stripe.BillingPortal.SessionCreateParams = {
      customer: workspace.stripe_customer_id,
      return_url,
    };

    if (PORTAL_CONFIG_ID) {
      portalParams.configuration = PORTAL_CONFIG_ID;
    }

    const session = await stripe.billingPortal.sessions.create(portalParams);

    return json({ portal_url: session.url });
  } catch (err) {
    console.error('[billing-portal] Error:', err);
    return json({ error: 'Failed to create portal session' }, 500);
  }
});
