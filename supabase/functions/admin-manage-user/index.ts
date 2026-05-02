// Supabase Edge Function: admin-manage-user
// Privileged admin operations that require the service role key.
// Actions: delete_user, ban_user, unban_user
//
// All actions verify the caller is an admin via user_profiles.role before proceeding.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
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
    // ── Verify caller is admin ────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401);

    const token = authHeader.replace('Bearer ', '');
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // supabase-js v2: pass the JWT explicitly. getUser() with no argument
    // looks for a session in client-side storage and returns null on the server.
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const { data: profile } = await anonClient
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return json({ error: 'Forbidden: admin role required' }, 403);
    }

    // ── Service role client for privileged operations ──────────────
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { action, userId, ...params } = await req.json();

    if (!action) return json({ error: 'Missing action' }, 400);

    switch (action) {
      // ── Delete user (profile + auth) ────────────────────────────
      case 'delete_user': {
        if (!userId) return json({ error: 'Missing userId' }, 400);

        // Delete profile data first
        const { error: profileErr } = await adminClient
          .from('user_profiles')
          .delete()
          .eq('id', userId);

        if (profileErr) {
          console.error('[admin-manage-user] Failed to delete profile:', profileErr);
        }

        // Delete auth user
        const { error: authErr } = await adminClient.auth.admin.deleteUser(userId);
        if (authErr) {
          console.error('[admin-manage-user] Failed to delete auth user:', authErr);
          return json({ error: `Failed to delete auth user: ${authErr.message}` }, 500);
        }

        // Log the action
        await adminClient.from('admin_activity_logs').insert({
          action: 'user_deleted',
          actor_id: user.id,
          actor_name: user.user_metadata?.full_name || user.email || 'Admin',
          target_id: userId,
          details: 'User account deleted via admin panel',
        });

        return json({ success: true, message: 'User deleted' });
      }

      // ── Ban user ────────────────────────────────────────────────
      case 'ban_user': {
        if (!userId) return json({ error: 'Missing userId' }, 400);

        // Ban auth user (prevents login)
        const { error: banErr } = await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: params.duration || '876000h', // ~100 years default
        });

        if (banErr) {
          console.error('[admin-manage-user] Failed to ban user:', banErr);
          return json({ error: `Failed to ban user: ${banErr.message}` }, 500);
        }

        // Update profile status
        await adminClient
          .from('user_profiles')
          .update({ status: 'suspended', updated_at: new Date().toISOString() })
          .eq('id', userId);

        // Log the action
        await adminClient.from('admin_activity_logs').insert({
          action: 'user_suspended',
          actor_id: user.id,
          actor_name: user.user_metadata?.full_name || user.email || 'Admin',
          target_id: userId,
          details: 'User banned via admin panel',
        });

        return json({ success: true, message: 'User banned' });
      }

      // ── Unban user ──────────────────────────────────────────────
      case 'unban_user': {
        if (!userId) return json({ error: 'Missing userId' }, 400);

        const { error: unbanErr } = await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: 'none',
        });

        if (unbanErr) {
          return json({ error: `Failed to unban user: ${unbanErr.message}` }, 500);
        }

        await adminClient
          .from('user_profiles')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('id', userId);

        await adminClient.from('admin_activity_logs').insert({
          action: 'user_activated',
          actor_id: user.id,
          actor_name: user.user_metadata?.full_name || user.email || 'Admin',
          target_id: userId,
          details: 'User unbanned via admin panel',
        });

        return json({ success: true, message: 'User unbanned' });
      }

      // ── Billing: rebuild entitlements ─────────────────────────────
      case 'rebuild_entitlements': {
        const workspaceId = params.workspace_id;
        if (!workspaceId) return json({ error: 'Missing workspace_id' }, 400);

        await adminClient.rpc('rebuild_entitlements', { p_workspace_id: workspaceId });

        await adminClient.from('admin_activity_logs').insert({
          action: 'entitlements_rebuilt',
          actor_id: user.id,
          actor_name: user.user_metadata?.full_name || user.email || 'Admin',
          target_id: workspaceId,
          details: 'Entitlements manually rebuilt via admin panel',
        });

        return json({ success: true, message: 'Entitlements rebuilt' });
      }

      // ── Billing: get workspace billing status ───────────────────
      case 'get_billing_status': {
        const wsId = params.workspace_id;
        if (!wsId) return json({ error: 'Missing workspace_id' }, 400);

        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

        const [subResult, entResult, usageResult, invoiceResult] = await Promise.all([
          adminClient.from('subscriptions')
            .select('*')
            .eq('workspace_id', wsId)
            .in('status', ['active', 'trialing', 'past_due'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single(),
          adminClient.from('entitlements')
            .select('*')
            .eq('workspace_id', wsId)
            .single(),
          adminClient.from('usage_records')
            .select('*')
            .eq('workspace_id', wsId)
            .eq('period_start', periodStart),
          adminClient.from('invoices')
            .select('*')
            .eq('workspace_id', wsId)
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

        return json({
          subscription: subResult.data,
          entitlements: entResult.data,
          usage: usageResult.data,
          recent_invoices: invoiceResult.data,
        });
      }

      // ── Billing: cleanup old processed events ───────────────────
      case 'cleanup_stripe_events': {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { error: delErr, count } = await adminClient
          .from('processed_stripe_events')
          .delete()
          .lt('processed_at', thirtyDaysAgo);

        return json({ success: true, deleted: count || 0 });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error('[admin-manage-user] Unexpected error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});
