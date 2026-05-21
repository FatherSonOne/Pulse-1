// Supabase Edge Function: billing-reconcile-seats
//
// Scans every workspace with an active Stripe subscription, diffs the
// member count (workspace_members) against the Stripe subscription
// quantity, and updates Stripe when they disagree.  Marks any open
// billing_drift_log rows resolved when reconciled.
//
// Intended to run on cron (~daily) but is idempotent and safe to call
// any time.
//
// Auth: requires the SUPABASE_SERVICE_ROLE_KEY as a bearer token.
//       This is NOT for end-user calls — only the cron job invokes it.
//
// Request:  body is optional. { workspace_ids?: string[], dry_run?: boolean }
//           Pass workspace_ids to limit to specific workspaces (used by
//           the on-demand admin "force reconcile" path); dry_run reports
//           what would change without calling Stripe.
//
// Response: { scanned, drifted, updated, errors, dry_run }
//
// Guardrails:
//   - Any single workspace where drift > 20% of the existing Stripe
//     quantity is logged but NOT auto-corrected.  A drift that large is
//     almost certainly a bug, not a true seat change.
//   - Local placeholder subs (stripe_subscription_id starting 'trial_')
//     are skipped.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const LARGE_DRIFT_THRESHOLD = 0.2; // 20% drift skipped + logged

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

type ReconcileRequest = {
  workspace_ids?: string[];
  dry_run?: boolean;
};

type ReconcileSummary = {
  workspace_id: string;
  subscription_id: string;
  expected: number;
  observed: number;
  action: 'unchanged' | 'updated' | 'large_drift_skipped' | 'error';
  detail?: string;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Auth: must present the service-role key.  Anything else is rejected.
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token || token !== SUPABASE_SERVICE_KEY) {
    return json({ error: 'Forbidden — service role required' }, 403);
  }

  let body: ReconcileRequest = {};
  try {
    body = (await req.json()) as ReconcileRequest;
  } catch {
    body = {};
  }
  const dryRun = body.dry_run === true;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // 1. Pull every active subscription, optionally narrowed to specific workspaces.
    let query = admin
      .from('subscriptions')
      .select('workspace_id, stripe_subscription_id, status')
      .in('status', ['trialing', 'active', 'past_due']);

    if (body.workspace_ids && body.workspace_ids.length > 0) {
      query = query.in('workspace_id', body.workspace_ids);
    }

    const { data: subs, error: subsErr } = await query;
    if (subsErr) {
      console.error('[reconcile-seats] subscriptions query failed:', subsErr.message);
      return json({ error: 'subscriptions query failed', detail: subsErr.message }, 500);
    }

    const summaries: ReconcileSummary[] = [];
    let updated = 0;
    let drifted = 0;
    let errors = 0;

    for (const sub of subs ?? []) {
      const wsId = sub.workspace_id as string;
      const stripeSubId = sub.stripe_subscription_id as string;

      // Skip local placeholder subs (no Stripe counterpart).
      if (!stripeSubId || stripeSubId.startsWith('trial_')) continue;

      try {
        // 2. Count current members from workspace_members.
        const { count: memberCount, error: countErr } = await admin
          .from('workspace_members')
          .select('user_id', { count: 'exact', head: true })
          .eq('workspace_id', wsId);

        if (countErr) {
          throw new Error(`count error: ${countErr.message}`);
        }
        const expected = Math.max(memberCount ?? 1, 1);

        // 3. Pull live Stripe state for the first item on the subscription.
        const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
        const item = stripeSub.items?.data?.[0];
        if (!item) {
          summaries.push({
            workspace_id: wsId,
            subscription_id: stripeSubId,
            expected,
            observed: 0,
            action: 'error',
            detail: 'subscription has no items',
          });
          errors += 1;
          continue;
        }

        const observed = item.quantity ?? 0;

        if (observed === expected) {
          summaries.push({
            workspace_id: wsId,
            subscription_id: stripeSubId,
            expected,
            observed,
            action: 'unchanged',
          });
          // Mark any open drift rows for this workspace resolved.
          await admin
            .from('billing_drift_log')
            .update({ resolved_at: new Date().toISOString(), resolved_by: 'reconciler' })
            .eq('workspace_id', wsId)
            .is('resolved_at', null);
          continue;
        }

        drifted += 1;

        // 4. Guardrail: if the drift is large vs current Stripe quantity,
        //    log + skip; almost certainly a bug rather than real seat usage.
        const observedSafe = observed === 0 ? 1 : observed;
        const driftRatio = Math.abs(expected - observed) / observedSafe;
        if (driftRatio > LARGE_DRIFT_THRESHOLD) {
          await admin.from('billing_drift_log').insert({
            workspace_id: wsId,
            source: 'reconciler_diff',
            expected_quantity: expected,
            observed_quantity: observed,
            error_message: `large drift (${(driftRatio * 100).toFixed(1)}%) skipped`,
            metadata: { subscription_id: stripeSubId, dry_run: dryRun },
          });
          summaries.push({
            workspace_id: wsId,
            subscription_id: stripeSubId,
            expected,
            observed,
            action: 'large_drift_skipped',
            detail: `${(driftRatio * 100).toFixed(1)}% drift`,
          });
          continue;
        }

        // 5. Apply (or dry-run).
        if (!dryRun) {
          await stripe.subscriptionItems.update(item.id, {
            quantity: expected,
            proration_behavior: 'create_prorations',
          });
          updated += 1;

          // Mark all open drift entries for this workspace resolved.
          await admin
            .from('billing_drift_log')
            .update({ resolved_at: new Date().toISOString(), resolved_by: 'reconciler' })
            .eq('workspace_id', wsId)
            .is('resolved_at', null);

          // Audit row capturing the fix (gives the admin UI a trail).
          await admin.from('billing_drift_log').insert({
            workspace_id: wsId,
            source: 'reconciler_diff',
            expected_quantity: expected,
            observed_quantity: observed,
            error_message: 'reconciled by cron',
            metadata: { subscription_id: stripeSubId },
            resolved_at: new Date().toISOString(),
            resolved_by: 'reconciler',
          });
        }

        summaries.push({
          workspace_id: wsId,
          subscription_id: stripeSubId,
          expected,
          observed,
          action: dryRun ? 'unchanged' : 'updated',
          detail: dryRun ? 'dry_run' : undefined,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[reconcile-seats] workspace error', wsId, msg);
        await admin.from('billing_drift_log').insert({
          workspace_id: wsId,
          source: 'reconciler_diff',
          error_message: msg,
          metadata: { subscription_id: stripeSubId },
        });
        summaries.push({
          workspace_id: wsId,
          subscription_id: stripeSubId,
          expected: 0,
          observed: 0,
          action: 'error',
          detail: msg,
        });
        errors += 1;
      }
    }

    return json({
      scanned: subs?.length ?? 0,
      drifted,
      updated,
      errors,
      dry_run: dryRun,
      summaries,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[reconcile-seats] top-level error:', msg);
    return json({ error: msg }, 500);
  }
});
