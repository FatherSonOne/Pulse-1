// =====================================================
// ECOSYSTEM OUTBOUND EDGE FUNCTION
// Sends events FROM Pulse TO other ecosystem apps.
// Called by the Pulse frontend (authenticated via Supabase JWT).
// Looks up the target app's inbound URL and service token,
// then POSTs the event on behalf of the user.
//
// Supported event types:
//   meeting.feedback — User rates a meeting summary (→ Entomate)
//   meeting.export   — Export a Pulse recording to Entomate for AI processing
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OutboundRequest {
  eventType: string;
  targetApp: 'entomate' | 'logos_vision';
  entityType?: string;
  entityId?: string;
  data: Record<string, any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // Authenticate the calling user via JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body: OutboundRequest = await req.json();
    const { eventType, targetApp, data } = body;

    if (!eventType || !targetApp) {
      return json({ error: 'eventType and targetApp are required' }, 400);
    }

    // Allowed outbound event types (whitelist to prevent abuse)
    const ALLOWED_EVENTS = ['meeting.feedback', 'meeting.export', 'meeting.export_request'];
    if (!ALLOWED_EVENTS.includes(eventType)) {
      return json({ error: `Event type '${eventType}' is not allowed for outbound` }, 403);
    }

    // Look up target app config
    const { data: config, error: configError } = await supabase
      .from('ecosystem_config')
      .select('api_url, service_token, features, enabled')
      .eq('app_name', targetApp)
      .single();

    if (configError || !config || !config.enabled) {
      return json({ error: `Target app '${targetApp}' is not configured or disabled` }, 404);
    }

    // Build the ecosystem event payload
    const event: Record<string, unknown> = {
      id: crypto.randomUUID(),
      source: 'pulse',
      timestamp: new Date().toISOString(),
      serviceToken: config.service_token,
      eventType,
      entityType: body.entityType || undefined,
      entityId: body.entityId || undefined,
      data: {
        ...data,
        userId: user.id, // Always set from JWT, not from client
      },
    };

    // POST to target app's inbound endpoint
    const outboundHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Ecosystem-Token': config.service_token,
      'X-Ecosystem-Source': 'pulse',
      'X-Ecosystem-Event-Id': event.id as string,
    };
    // Supabase edge functions require an anon key to pass the API gateway
    if (config.features?.gateway_key) {
      outboundHeaders['Authorization'] = `Bearer ${config.features.gateway_key}`;
    }

    const resp = await fetch(config.api_url, {
      method: 'POST',
      headers: outboundHeaders,
      body: JSON.stringify(event),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error(`[ecosystem-outbound] POST to ${targetApp} failed (${resp.status}):`, errBody);
      return json({ error: 'Failed to deliver event to target app' }, 502);
    }

    // Log outbound event
    await supabase.from('ecosystem_events').insert({
      event_id: event.id,
      source: 'pulse',
      event_type: eventType,
      direction: 'outbound',
      status: 'processed',
      payload: data,
    });

    return json({ sent: true, eventId: event.id });
  } catch (err) {
    console.error('[ecosystem-outbound] Error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
