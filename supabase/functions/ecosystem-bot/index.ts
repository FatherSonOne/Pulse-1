// =====================================================
// ECOSYSTEM BOT EDGE FUNCTION
// Two endpoints:
//   POST /ecosystem-bot/message  — Post a bot message
//   POST /ecosystem-bot/setup    — Create default bot channels for a workspace
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ecosystem-token',
};

const ENTOMATE_BOT_ID = 'e0000000-0000-0000-0000-e00000000001';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Validate service token
  const token = req.headers.get('X-Ecosystem-Token');
  if (!token) {
    return json({ error: 'Missing X-Ecosystem-Token' }, 401);
  }

  const { data: config } = await supabase
    .from('ecosystem_config')
    .select('*')
    .eq('service_token', token)
    .eq('enabled', true)
    .single();

  // Also accept inbound tokens (for cross-app calls via ecosystem-inbound)
  const { data: configByInbound } = !config
    ? await supabase.from('ecosystem_config').select('*').eq('inbound_token', token).eq('enabled', true).single()
    : { data: null };

  if (!config && !configByInbound) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();
  const body = await req.json();

  try {
    if (path === 'setup') {
      return await handleSetup(supabase, body);
    } else {
      // Default: post a bot message
      return await handleBotMessage(supabase, body);
    }
  } catch (err) {
    console.error('[ecosystem-bot] Error:', err);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});

// =====================================================
// POST /ecosystem-bot/message
// =====================================================

async function handleBotMessage(supabase: any, body: {
  serviceToken?: string;
  workspaceId: string;
  channelPurpose?: string;
  channelId?: string;
  content: string;
  messageType?: string;
  metadata?: Record<string, any>;
  actions?: Array<{ label: string; action: string; url?: string }>;
  notifyUsers?: string[];
}): Promise<Response> {
  const { workspaceId, channelPurpose, channelId: directChannelId, content, messageType, metadata, actions, notifyUsers } = body;

  if (!workspaceId) return json({ error: 'workspaceId required' }, 400);
  if (!content) return json({ error: 'content required' }, 400);

  // Resolve channel
  let channelId = directChannelId;
  if (!channelId && channelPurpose) {
    channelId = await resolveOrCreateBotChannel(supabase, workspaceId, channelPurpose);
  }
  if (!channelId) return json({ error: 'No channel specified or resolved' }, 400);

  // Insert bot message
  const { data: message, error } = await supabase
    .from('chat_messages')
    .insert({
      workspace_id: workspaceId,
      channel_id: channelId,
      sender_id: ENTOMATE_BOT_ID,
      bot_content: content,
      is_bot_message: true,
      bot_app: 'entomate',
      bot_message_type: messageType || 'text',
      bot_metadata: metadata || {},
      bot_actions: actions || [],
    })
    .select('id')
    .single();

  if (error) return json({ error: error.message }, 500);

  // Send notifications
  let notificationsSent = 0;
  if (notifyUsers?.length) {
    const notifications = notifyUsers.map((userId) => ({
      user_id: userId,
      type: 'ecosystem',
      content: content.slice(0, 200),
      metadata: { source: 'entomate', channelId, ...metadata },
      read: false,
    }));
    const { error: notifError } = await supabase.from('pulse_notifications').insert(notifications);
    if (!notifError) notificationsSent = notifications.length;
  }

  return json({ success: true, messageId: message.id, channelId, notificationsSent });
}

// =====================================================
// POST /ecosystem-bot/setup
// Creates default bot channels for a workspace
// =====================================================

async function handleSetup(supabase: any, body: {
  serviceToken?: string;
  workspaceId: string;
  botApp?: string;
  channels?: Array<{ purpose: string; name: string; description: string }>;
}): Promise<Response> {
  const { workspaceId } = body;
  if (!workspaceId) return json({ error: 'workspaceId required' }, 400);

  const defaultChannels = body.channels || [
    { purpose: 'meetings', name: 'entomate-meetings', description: 'Meeting summaries and action items' },
    { purpose: 'alerts', name: 'entomate-alerts', description: 'Automation alerts and notifications' },
    { purpose: 'action_items', name: 'entomate-tasks', description: 'Task assignments and updates' },
    { purpose: 'automations', name: 'entomate-automations', description: 'Automation workflow updates' },
  ];

  const created: Array<{ purpose: string; channelId: string; name: string }> = [];
  const existing: Array<{ purpose: string; channelId: string }> = [];

  for (const ch of defaultChannels) {
    // Check if already exists
    const { data: existingReg } = await supabase
      .from('ecosystem_bot_channels')
      .select('channel_id')
      .eq('workspace_id', workspaceId)
      .eq('bot_app', 'entomate')
      .eq('channel_purpose', ch.purpose)
      .single();

    if (existingReg) {
      existing.push({ purpose: ch.purpose, channelId: existingReg.channel_id });
      continue;
    }

    // Create channel
    const { data: channel, error: chError } = await supabase
      .from('message_channels')
      .insert({
        workspace_id: workspaceId,
        name: ch.name,
        description: ch.description,
        is_public: true,
        is_group: false,
        is_bot_channel: true,
        bot_app: 'entomate',
        created_by: ENTOMATE_BOT_ID,
      })
      .select('id')
      .single();

    if (chError) {
      console.error(`Failed to create channel ${ch.name}:`, chError);
      continue;
    }

    await supabase.from('ecosystem_bot_channels').insert({
      workspace_id: workspaceId,
      bot_app: 'entomate',
      channel_id: channel.id,
      channel_purpose: ch.purpose,
    });

    created.push({ purpose: ch.purpose, channelId: channel.id, name: ch.name });
  }

  return json({ success: true, workspaceId, created, existing });
}

// =====================================================
// HELPERS
// =====================================================

async function resolveOrCreateBotChannel(
  supabase: any,
  workspaceId: string,
  purpose: string
): Promise<string> {
  const { data: existing } = await supabase
    .from('ecosystem_bot_channels')
    .select('channel_id')
    .eq('workspace_id', workspaceId)
    .eq('bot_app', 'entomate')
    .eq('channel_purpose', purpose)
    .single();

  if (existing) return existing.channel_id;

  const nameMap: Record<string, { name: string; description: string }> = {
    meetings: { name: 'entomate-meetings', description: 'Meeting summaries from Entomate' },
    alerts: { name: 'entomate-alerts', description: 'Automation alerts from Entomate' },
    action_items: { name: 'entomate-tasks', description: 'Task assignments from Entomate' },
    automations: { name: 'entomate-automations', description: 'Automation updates from Entomate' },
  };
  const info = nameMap[purpose] || { name: `entomate-${purpose}`, description: `Entomate ${purpose}` };

  const { data: channel, error } = await supabase
    .from('message_channels')
    .insert({
      workspace_id: workspaceId,
      name: info.name,
      description: info.description,
      is_public: true,
      is_group: false,
      is_bot_channel: true,
      bot_app: 'entomate',
      created_by: ENTOMATE_BOT_ID,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create bot channel: ${error.message}`);

  await supabase.from('ecosystem_bot_channels').insert({
    workspace_id: workspaceId,
    bot_app: 'entomate',
    channel_id: channel.id,
    channel_purpose: purpose,
  });

  return channel.id;
}

function json(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
