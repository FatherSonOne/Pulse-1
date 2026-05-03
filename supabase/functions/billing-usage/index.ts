// Supabase Edge Function: billing-usage
// Increments usage counters for metered billing.
// Auth: Service-to-service via x-gateway-secret header (internal only)

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GATEWAY_SECRET = Deno.env.get('ECOSYSTEM_GATEWAY_SECRET') || Deno.env.get('GATEWAY_SECRET');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-gateway-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const VALID_METRICS = ['ai_messages', 'sms_sent', 'storage_bytes', 'voxer_minutes', 'workflow_runs'];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    // Verify internal call via gateway secret. Fail closed when the
    // secret is unset on the server — otherwise anyone could call this
    // endpoint and burn any workspace's AI cap.
    if (!GATEWAY_SECRET) {
      console.error('[billing-usage] GATEWAY_SECRET not configured — refusing to process');
      return json({ error: 'Server misconfiguration: GATEWAY_SECRET not set' }, 500);
    }
    const gatewayHeader = req.headers.get('x-gateway-secret') || '';
    if (gatewayHeader !== GATEWAY_SECRET) {
      return json({ error: 'Unauthorized — internal use only' }, 401);
    }

    const { workspace_id, metric, quantity = 1 } = await req.json();

    if (!workspace_id || !metric) {
      return json({ error: 'Missing required fields: workspace_id, metric' }, 400);
    }

    if (!VALID_METRICS.includes(metric)) {
      return json({ error: `Invalid metric. Must be one of: ${VALID_METRICS.join(', ')}` }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Calculate current period (first/last of month)
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString().split('T')[0];
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString().split('T')[0];

    // Atomic upsert — increment quantity
    const { data, error } = await supabase.rpc('increment_usage', {
      p_workspace_id: workspace_id,
      p_metric: metric,
      p_quantity: quantity,
      p_period_start: periodStart,
      p_period_end: periodEnd,
    });

    // Fallback if RPC doesn't exist yet — use raw upsert
    if (error?.message?.includes('function') || error?.code === '42883') {
      const { error: upsertError } = await supabase
        .from('usage_records')
        .upsert({
          workspace_id,
          metric,
          quantity,
          period_start: periodStart,
          period_end: periodEnd,
        }, {
          onConflict: 'workspace_id,metric,period_start',
        });

      if (upsertError) {
        // If row exists, manually increment
        const { data: existing } = await supabase
          .from('usage_records')
          .select('id, quantity')
          .eq('workspace_id', workspace_id)
          .eq('metric', metric)
          .eq('period_start', periodStart)
          .single();

        if (existing) {
          await supabase
            .from('usage_records')
            .update({ quantity: existing.quantity + quantity })
            .eq('id', existing.id);
        }
      }
    }

    // Check if at limit
    const { data: entitlement } = await supabase
      .from('entitlements')
      .select('*')
      .eq('workspace_id', workspace_id)
      .single();

    const { data: currentUsage } = await supabase
      .from('usage_records')
      .select('quantity')
      .eq('workspace_id', workspace_id)
      .eq('metric', metric)
      .eq('period_start', periodStart)
      .single();

    let limit: number | null = null;
    let currentQty = currentUsage?.quantity || 0;

    if (entitlement) {
      switch (metric) {
        case 'ai_messages': limit = entitlement.max_ai_messages_mo; break;
        case 'sms_sent': limit = entitlement.max_sms_mo; break;
        case 'storage_bytes': limit = entitlement.max_storage_bytes; break;
        case 'workflow_runs': limit = entitlement.max_workflow_runs_mo; break;
      }
    }

    const atLimit = limit !== null && currentQty >= limit;
    const nearLimit = limit !== null && currentQty >= limit * 0.8;

    return json({
      workspace_id,
      metric,
      current: currentQty,
      limit,
      at_limit: atLimit,
      near_limit: nearLimit,
    });
  } catch (err) {
    console.error('[billing-usage] Error:', err);
    return json({ error: 'Failed to record usage' }, 500);
  }
});
