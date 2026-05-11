// summit-session-end — increments summit_minutes usage for the calling user's workspace.
//
// Auth: user JWT. The user can only inflate their own workspace's quota,
// which only hurts themselves — so trusting the client-reported duration
// here is acceptable. The edge function still verifies the user is a
// member of the workspace they're reporting against (RLS-style check)
// so a hijacked session can't burn an unrelated workspace's cap.
//
// Why a dedicated function (not billing-usage):
//   billing-usage is gateway-secret-only — clients can't call it directly.
//   This function is the client-facing wrapper for the Summit-specific
//   metric. It calls increment_usage() via service-role, after verifying
//   workspace membership.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Authentication required' }, 401);
    }
    const userToken = authHeader.slice(7);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser(userToken);
    if (!user) return json({ error: 'Invalid or expired token' }, 401);

    const body = await req.json().catch(() => ({}));
    const workspace_id = String(body.workspace_id ?? '');
    const duration_sec = Number(body.duration_sec ?? 0);

    if (!workspace_id) return json({ error: 'workspace_id required' }, 400);
    if (!Number.isFinite(duration_sec) || duration_sec <= 0) {
      return json({ error: 'duration_sec must be a positive number' }, 400);
    }
    // Defensive ceiling — no single session should report more than 1 hour.
    // A reported value above this is almost certainly a bug or abuse attempt.
    const clamped_sec = Math.min(Math.floor(duration_sec), 3600);
    const minutes = Math.max(1, Math.ceil(clamped_sec / 60));

    // Service-role client for the membership check + increment_usage call.
    // increment_usage itself is SECURITY DEFINER but we hop to service role
    // so we can read workspace_members without RLS friction.
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: member } = await adminClient
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!member) {
      return json({ error: 'Not a member of this workspace' }, 403);
    }

    const now = new Date();
    const periodStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
    const periodEndDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    const periodEnd = periodEndDate.toISOString().slice(0, 10);

    const { error: incError } = await adminClient.rpc('increment_usage', {
      p_workspace_id: workspace_id,
      p_metric: 'summit_minutes',
      p_quantity: minutes,
      p_period_start: periodStart,
      p_period_end: periodEnd,
    });

    if (incError) {
      console.error('[summit-session-end] increment_usage failed:', incError.message);
      return json({ error: 'Failed to record usage', detail: incError.message }, 500);
    }

    // Return the new monthly total so the client can refresh its meter
    // without a separate round-trip.
    const { data: usageRow } = await adminClient
      .from('usage_records')
      .select('quantity')
      .eq('workspace_id', workspace_id)
      .eq('metric', 'summit_minutes')
      .eq('period_start', periodStart)
      .maybeSingle();

    return json({
      ok: true,
      minutes_added: minutes,
      total_minutes: Number(usageRow?.quantity ?? minutes),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[summit-session-end] Edge function error:', msg);
    return json({ error: msg }, 500);
  }
});
