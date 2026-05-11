// openai-realtime-token — mints an OpenAI Realtime ephemeral token for
// the Summit (live voice) section, gated by the caller's Pulse plan
// + monthly usage. Clients that bring their own OpenAI key never reach
// this endpoint; this path is hosted-minutes only.
//
// Gates in order:
//   1. JWT valid
//   2. workspace_id present + caller is a member
//   3. Pulse access (apps.pulse must be 'team' or 'growth', or is_trialing)
//   4. monthly usage < cap (trial = 15 min total; Team/Growth = plan cap)
//   5. mint via OpenAI, return token + max_session_sec + meter
//
// Error envelope: { error: <message>, code: <machine-readable> }
// Codes: NO_SUBSCRIPTION, OVER_CAP, TRIAL_CAP, WRONG_TIER, NOT_MEMBER,
//        UPSTREAM_ERROR. The client switches UX on the code.

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

// Trial-time tighter caps, enforced at runtime since trial users still ride
// the pulse_team plan row (which has the paid Team caps).
const TRIAL_MINUTES_PER_MONTH = 15;
const TRIAL_SESSION_SEC = 300;
// Hard ceilings if a plan somehow lands without explicit caps.
const FALLBACK_SESSION_SEC = 900;

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
    const { data: { user }, error: getUserError } = await userClient.auth.getUser(userToken);
    if (!user) {
      console.warn('[openai-realtime-token] getUser rejected:', getUserError?.message ?? 'unknown');
      return json({ error: 'Invalid or expired token' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const workspace_id = String(body.workspace_id ?? '');
    const model = String(body.model ?? 'gpt-4o-realtime-preview');
    const voice = String(body.voice ?? 'alloy');
    // BYO bypass: when a personal OpenAI key is supplied, we use it for the
    // mint and skip every gate. OpenAI bills the user directly and nothing
    // touches Pulse's quota or Stripe metering. The key is never logged.
    const byoKeyRaw = body.byo_key;
    const byoKey =
      typeof byoKeyRaw === 'string' && byoKeyRaw.startsWith('sk-') && byoKeyRaw.length >= 20
        ? byoKeyRaw
        : null;

    if (!byoKey && !workspace_id) {
      return json({ error: 'workspace_id required', code: 'NOT_MEMBER' }, 400);
    }

    const serverOpenaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!byoKey && !serverOpenaiKey) {
      console.error('[openai-realtime-token] OPENAI_API_KEY env var not set');
      return json({ error: 'OpenAI API key not configured', code: 'UPSTREAM_ERROR' }, 500);
    }
    const mintingKey = byoKey ?? serverOpenaiKey!;

    // ── Tier + usage gate (hosted mode only) ──────────────────────
    // BYO mode skips all gating — OpenAI bills the user directly.
    let pulseTier = 'byo';
    let isTrialing = false;
    let used = 0;
    let cap = 0;
    let max_session_sec = 1800; // BYO defaults to 30-min safety ceiling

    if (!byoKey) {
      // Service-role client so the workspace_members + entitlements +
      // usage_records reads don't fight RLS for this gating logic.
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
        return json({ error: 'Not a member of this workspace', code: 'NOT_MEMBER' }, 403);
      }

      const { data: ent } = await adminClient
        .from('entitlements')
        .select('apps, is_trialing, max_summit_minutes_mo, max_summit_session_sec')
        .eq('workspace_id', workspace_id)
        .maybeSingle();

      pulseTier = (ent?.apps?.pulse as string | undefined) ?? 'free';
      isTrialing = ent?.is_trialing === true;

      if (pulseTier === 'free' && !isTrialing) {
        return json({
          error: 'Summit requires a Pulse Team or Growth subscription.',
          code: 'NO_SUBSCRIPTION',
        }, 402);
      }
      if (pulseTier !== 'team' && pulseTier !== 'growth' && !isTrialing) {
        return json({
          error: 'Summit is available on Pulse Team and Growth plans.',
          code: 'WRONG_TIER',
        }, 402);
      }

      // Current month usage. Period is calendar month, UTC.
      const now = new Date();
      const periodStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;

      const { data: usageRow } = await adminClient
        .from('usage_records')
        .select('quantity')
        .eq('workspace_id', workspace_id)
        .eq('metric', 'summit_minutes')
        .eq('period_start', periodStart)
        .maybeSingle();
      used = Number(usageRow?.quantity ?? 0);

      if (isTrialing) {
        cap = TRIAL_MINUTES_PER_MONTH;
        max_session_sec = TRIAL_SESSION_SEC;
      } else {
        cap = Number(ent?.max_summit_minutes_mo ?? 0);
        max_session_sec = Number(ent?.max_summit_session_sec ?? FALLBACK_SESSION_SEC);
      }

      if (cap <= 0) {
        return json({
          error: 'Summit is not included in this plan.',
          code: 'WRONG_TIER',
        }, 402);
      }
      if (used >= cap) {
        return json({
          error: isTrialing
            ? 'Trial Summit minutes used up. Upgrade to Pulse Team for 60 min/month.'
            : 'Summit monthly minutes used up. Upgrade your plan or wait for the next period.',
          code: isTrialing ? 'TRIAL_CAP' : 'OVER_CAP',
          used_minutes: used,
          cap_minutes: cap,
        }, 402);
      }
    }

    // ── Mint the ephemeral token ──────────────────────────────────
    // BYO uses mintingKey = user's personal sk-...; hosted uses the server's
    // OPENAI_API_KEY. The key value itself never appears in logs — only the
    // mode + tier + meter.
    console.log(`[openai-realtime-token] user=${user.id} mode=${byoKey ? 'byo' : 'hosted'} ws=${byoKey ? '-' : workspace_id} tier=${pulseTier} trial=${isTrialing} used=${used}/${cap}`);

    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mintingKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, voice }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[openai-realtime-token] OpenAI API error:', response.status, errorText);
      let errorMessage = `OpenAI API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      return json({ error: errorMessage, code: 'UPSTREAM_ERROR' }, response.status);
    }

    const data = await response.json();
    const token = data.client_secret?.value || data.value;
    if (!token) {
      return json({ error: 'No token in response', code: 'UPSTREAM_ERROR' }, 500);
    }

    return json({
      token,
      expiresAt: data.client_secret?.expires_at,
      max_session_sec,
      used_minutes: used,
      cap_minutes: cap,
      is_trialing: isTrialing,
      is_byo: !!byoKey,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[openai-realtime-token] Edge function error:', msg);
    return json({ error: msg, code: 'UPSTREAM_ERROR' }, 500);
  }
});
