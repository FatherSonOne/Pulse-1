// Supabase Edge Function: billing-entitlements
// Returns current entitlements for a workspace.
// Auth: Bearer token (any workspace member)

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  try {
    // Authenticate user
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    // Get workspace_id from query param
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get('workspace_id');

    if (!workspaceId) {
      return json({ error: 'Missing workspace_id query parameter' }, 400);
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Verify user is a member of this workspace
    const { data: member } = await adminClient
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return json({ error: 'Not a member of this workspace' }, 403);
    }

    // Get entitlements
    const { data: entitlement } = await adminClient
      .from('entitlements')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single();

    // If no entitlements row exists, return free-tier defaults
    if (!entitlement) {
      return json({
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
      });
    }

    // Get current period usage
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString().split('T')[0];

    const { data: usageRecords } = await adminClient
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

    return json({
      ...entitlement,
      usage,
    });
  } catch (err) {
    console.error('[billing-entitlements] Error:', err);
    return json({ error: 'Failed to fetch entitlements' }, 500);
  }
});
