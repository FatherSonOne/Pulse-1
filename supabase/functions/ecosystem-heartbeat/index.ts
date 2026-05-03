// =====================================================
// ECOSYSTEM HEARTBEAT EDGE FUNCTION
// Pings all enabled ecosystem connections to validate
// tokens and update last_heartbeat timestamps.
// Called by pg_cron every 15 minutes.
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  // Auth — require CRON_SECRET. Without this, anyone with the URL
  // could trigger outbound POSTs that leak service_tokens in payloads
  // to attacker-controlled webhook URLs from ecosystem_config rows.
  const CRON_SECRET = Deno.env.get('CRON_SECRET');
  if (!CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'CRON_SECRET not configured' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
  const provided = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (provided !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: configs } = await supabase
    .from('ecosystem_config')
    .select('*')
    .eq('enabled', true);

  const results: { ok: string[]; failed: string[] } = { ok: [], failed: [] };

  for (const config of configs ?? []) {
    const eventId = crypto.randomUUID();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Ecosystem-Token': config.service_token,
        // Receivers (entomate, logos_vision) require these on every event:
        'X-Ecosystem-Source': 'pulse',
        'X-Ecosystem-Event-Id': eventId,
      };
      // Supabase edge functions require an anon/publishable key to pass the
      // API gateway. Send via both `Authorization: Bearer` and `apikey` to
      // satisfy strict receivers that check the `apikey` header explicitly.
      if (config.features?.gateway_key) {
        headers['Authorization'] = `Bearer ${config.features.gateway_key}`;
        headers['apikey'] = config.features.gateway_key;
      }

      const resp = await fetch(config.api_url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: eventId,
          source: 'pulse',
          timestamp: new Date().toISOString(),
          serviceToken: config.service_token,
          eventType: 'heartbeat',
          data: { app: 'pulse' },
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (resp.ok) {
        await supabase
          .from('ecosystem_config')
          .update({ last_heartbeat: new Date().toISOString() })
          .eq('id', config.id);
        results.ok.push(config.app_name);
      } else {
        await logFailure(supabase, eventId, config.app_name, `HTTP ${resp.status}`);
        results.failed.push(config.app_name);
      }
    } catch (err: any) {
      await logFailure(supabase, eventId, config.app_name, err.message || 'Network error');
      results.failed.push(config.app_name);
    }
  }

  console.log('[ecosystem-heartbeat]', JSON.stringify(results));

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  });
});

async function logFailure(
  supabase: any,
  eventId: string,
  appName: string,
  errorMessage: string
): Promise<void> {
  await supabase.from('ecosystem_events').insert({
    event_id: eventId,
    source: 'pulse',
    event_type: 'heartbeat',
    direction: 'outbound',
    status: 'failed',
    error_message: errorMessage,
    payload: { target: appName },
  });
}
