// Supabase Edge Function: delete-account
// Self-serve account deletion (GDPR Art. 17 / CCPA right-to-delete).
//
// Unlike admin-manage-user, this is NOT admin-gated: it deletes the
// CALLER's own account. Flow:
//   1. Authenticate the caller from their JWT.
//   2. Run delete_user_account(target_user_id) AS THE USER so the RPC's
//      auth.uid() guard passes and the user's content + canonical
//      pulse_users row + NO-ACTION FK blockers are cleared.
//   3. Remove the auth identity with the service role
//      (auth.admin.deleteUser); CASCADE/SET NULL FKs auto-clean the rest.
//   4. Best-effort audit log; never fail the response on a log error.

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
    // ── Authenticate the caller ────────────────────────────────────
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

    // ── Delete the user's data AS THE USER ─────────────────────────
    // Calling the RPC through the JWT-bound client means auth.uid() inside
    // delete_user_account() equals user.id, so the self-delete guard passes.
    const { error: rpcErr } = await anonClient.rpc('delete_user_account', {
      target_user_id: user.id,
    });
    if (rpcErr) {
      console.error('[delete-account] Data deletion RPC failed:', rpcErr);
      return json({ error: `Failed to delete account data: ${rpcErr.message}` }, 500);
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ── Best-effort audit log BEFORE removing the identity ─────────
    // admin_activity_logs.actor_id FKs auth.users, so this must be written
    // while the auth row still exists (after deleteUser it would 23503).
    // Never fail the response on a log error.
    try {
      await adminClient.from('admin_activity_logs').insert({
        action: 'self_account_deleted',
        actor_id: user.id,
        actor_name: user.user_metadata?.full_name || user.email || 'User',
        target_id: user.id,
        details: 'User self-deleted account via privacy settings (GDPR Art. 17 / CCPA)',
      });
    } catch (logErr) {
      console.error('[delete-account] Audit log insert failed (non-fatal):', logErr);
    }

    // ── Delete the auth identity (service role) ────────────────────
    const { error: authErr } = await adminClient.auth.admin.deleteUser(user.id);
    if (authErr) {
      console.error('[delete-account] Failed to delete auth user:', authErr);
      return json({ error: `Failed to delete auth identity: ${authErr.message}` }, 500);
    }

    return json({ success: true });
  } catch (err) {
    console.error('[delete-account] Unexpected error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});
