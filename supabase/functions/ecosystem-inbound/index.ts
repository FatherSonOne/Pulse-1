// =====================================================
// ECOSYSTEM INBOUND EDGE FUNCTION
// Receives cross-app events from Entomate and Logos Vision
// Validates service tokens, logs events, routes to handlers
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleContextRequest } from './contextHandler.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ecosystem-token, x-ecosystem-source, x-ecosystem-event-id',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface EcosystemEvent {
  id: string;
  source: 'entomate' | 'pulse' | 'logos_vision';
  timestamp: string;
  serviceToken: string;
  eventType: string;
  entityType?: string;
  entityId?: string;
  data: Record<string, any>;
  targetApp?: string;
  replyTo?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const startTime = Date.now();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Lightweight health probe (no token required — confirms function is reachable)
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ status: 'ok', app: 'pulse', timestamp: new Date().toISOString() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Validate service token from header or body
    const token = req.headers.get('X-Ecosystem-Token');
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing X-Ecosystem-Token header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look up which app this token belongs to
    const { data: config, error: configError } = await supabase
      .from('ecosystem_config')
      .select('*')
      .eq('inbound_token', token)
      .eq('enabled', true)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized — invalid or disabled token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const event: EcosystemEvent = await req.json();

    // Log the inbound event
    await supabase.from('ecosystem_events').insert({
      event_id: event.id,
      source: event.source,
      event_type: event.eventType,
      entity_type: event.entityType,
      entity_id: event.entityId,
      direction: 'inbound',
      status: 'received',
      payload: event.data,
    });

    // Route to handler
    const processingStart = Date.now();
    let status = 'processed';
    let errorMessage: string | null = null;

    try {
      await routeEvent(supabase, event, config);
    } catch (err) {
      status = 'failed';
      errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[ecosystem-inbound] Handler failed for ${event.eventType}:`, err);
    }

    // Update event log with final status
    await supabase
      .from('ecosystem_events')
      .update({
        status,
        error_message: errorMessage,
        processing_time_ms: Date.now() - processingStart,
      })
      .eq('event_id', event.id)
      .eq('direction', 'inbound');

    if (status === 'failed') {
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ received: true, eventId: event.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[ecosystem-inbound] Fatal error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// =====================================================
// EVENT ROUTER
// =====================================================

async function routeEvent(
  supabase: any,
  event: EcosystemEvent,
  config: any
): Promise<void> {
  switch (event.eventType) {
    case 'meeting.processed':
      return handleMeetingProcessed(supabase, event);

    case 'meeting.action_items_extracted':
      return handleActionItemsExtracted(supabase, event);

    case 'meeting.briefing':
      return handleMeetingBriefing(supabase, event);

    case 'context.request':
      return handleContextRequest(supabase, event);

    case 'task.created':
    case 'task.updated':
    case 'task.completed':
      return handleTaskEvent(supabase, event);

    case 'message.bot_post':
      return handleBotPost(supabase, event);

    case 'notification.send':
      return handleNotification(supabase, event);

    case 'agent.action_completed':
      return handleAgentAction(supabase, event);

    case 'automation.triggered':
      return handleAutomationEvent(supabase, event);

    case 'contact.updated':
    case 'contact.created':
      return handleContactEvent(supabase, event);

    case 'heartbeat':
      return handleHeartbeat(supabase, event);

    default:
      console.log(`[ecosystem-inbound] No handler for event type: ${event.eventType}`);
      // Not an error — just mark as received (already logged)
  }
}

// =====================================================
// HANDLERS
// =====================================================

const ENTOMATE_BOT_ID = 'e0000000-0000-0000-0000-e00000000001';

async function handleMeetingProcessed(supabase: any, event: EcosystemEvent): Promise<void> {
  const {
    workspaceId, meetingTitle, summary, keyDecisions,
    actionItems, sentiment, attendees, entomate_url,
    // MIP fields (optional — backward compatible)
    intelligenceProfile, profileSections, contextUsed, outputQualityScore,
  } = event.data;

  if (!workspaceId) throw new Error('workspaceId required in event.data');

  const channelId = await resolveOrCreateBotChannel(supabase, workspaceId, 'meetings');

  // Build content — profile-shaped when MIP data is present, generic otherwise
  let content: string;

  if (intelligenceProfile && profileSections?.length) {
    // ── MIP-enriched recap ──
    const qualityStars = outputQualityScore != null
      ? '★'.repeat(Math.round(outputQualityScore * 5)) + '☆'.repeat(5 - Math.round(outputQualityScore * 5))
      : '';
    const qualityLine = qualityStars ? ` | **Quality:** ${qualityStars}` : '';

    const profileHeader = `## ${intelligenceProfile.icon || '📋'} ${intelligenceProfile.name} — Meeting Summary: ${meetingTitle}`;
    const profileBadge = `**Profile:** ${intelligenceProfile.icon || '📋'} ${intelligenceProfile.name}${qualityLine}`;

    const sections = profileSections
      .map((s: any) => `### ${s.title}\n${s.content}`)
      .join('\n\n');

    const actionItemsText = actionItems?.length
      ? `\n\n### Action Items (${actionItems.length})\n${actionItems.map((a: any) => `• ${a.description}${a.assignee ? ` → ${a.assignee}` : ''}${a.dueDate ? ` (due ${a.dueDate})` : ''}`).join('\n')}`
      : '';

    const contextLine = contextUsed
      ? `*Context: ${contextUsed.participantCount || 0} contacts, ${contextUsed.pastMeetingsReferenced || 0} past meetings, ${contextUsed.conversationThreadsUsed || 0} Pulse thread${(contextUsed.conversationThreadsUsed || 0) !== 1 ? 's' : ''} referenced*`
      : '';

    content = `${profileHeader}\n\n${profileBadge}\n\n${sections}${actionItemsText}\n\n---\n*Processed by Entomate with ${intelligenceProfile.name} intelligence profile*\n${contextLine}`;
  } else {
    // ── Generic recap (backward compatible) ──
    const sentimentEmoji = sentiment === 'positive' ? '😊' : sentiment === 'negative' ? '😔' : '😐';
    const decisionsText = keyDecisions?.length
      ? `\n\n**Key Decisions**\n${keyDecisions.map((d: string) => `• ${d}`).join('\n')}`
      : '';
    const actionItemsText = actionItems?.length
      ? `\n\n**Action Items (${actionItems.length})**\n${actionItems.map((a: any) => `• ${a.description}${a.assignee ? ` → ${a.assignee}` : ''}`).join('\n')}`
      : '';

    content = `## 📋 Meeting Summary: ${meetingTitle}\n\n**Sentiment:** ${sentimentEmoji} ${sentiment || 'neutral'}\n\n**Summary**\n${summary}${decisionsText}${actionItemsText}\n\n---\n*Processed by Entomate${entomate_url ? ` • [View Full Meeting](${entomate_url})` : ''}*`;
  }

  // Build actions — add MIP actions when profile is present
  const actions: Array<{ label: string; action: string; url?: string; meetingId?: string; profileSlug?: string }> = [];
  if (entomate_url) {
    actions.push({ label: 'View Full Meeting', action: 'open_meeting', url: entomate_url });
  }
  if (intelligenceProfile) {
    actions.push({ label: 'Rate This Summary', action: 'rate_meeting', meetingId: event.entityId });
    actions.push({ label: 'View Profile', action: 'view_profile', profileSlug: intelligenceProfile.slug });
  }

  await insertBotMessage(supabase, {
    workspaceId,
    channelId,
    senderId: ENTOMATE_BOT_ID,
    content,
    messageType: 'meeting_recap',
    metadata: {
      meetingId: event.entityId,
      actionItems,
      keyDecisions,
      sentiment,
      sourceUrl: entomate_url,
      // MIP metadata for frontend rendering
      ...(intelligenceProfile && { intelligenceProfile }),
      ...(profileSections && { profileSections }),
      ...(contextUsed && { contextUsed }),
      ...(outputQualityScore != null && { outputQualityScore }),
    },
    actions,
  });

  // Notify attendees
  if (attendees?.length) {
    const userIds = attendees.map((a: any) => a.userId).filter(Boolean);
    const profileNote = intelligenceProfile ? ` (${intelligenceProfile.name})` : '';
    await sendBotNotifications(supabase, userIds, `Meeting recap available: ${meetingTitle}${profileNote}`, {
      type: 'meeting_recap',
      meetingId: event.entityId,
    });
  }
}

async function handleMeetingBriefing(supabase: any, event: EcosystemEvent): Promise<void> {
  const {
    workspaceId, meetingId, meetingTitle, scheduledAt,
    profileName, profileIcon, participants,
    contextHighlights, openActionItems, entomate_url,
  } = event.data;

  if (!workspaceId) throw new Error('workspaceId required in event.data');

  const channelId = await resolveOrCreateBotChannel(supabase, workspaceId, 'meetings');

  // Calculate time until meeting
  const meetingTime = scheduledAt ? new Date(scheduledAt) : null;
  const now = new Date();
  let timeLabel = '';
  if (meetingTime) {
    const diffMs = meetingTime.getTime() - now.getTime();
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin > 0 && diffMin < 60) timeLabel = `Starting in ${diffMin} minute${diffMin !== 1 ? 's' : ''}`;
    else if (diffMin >= 60) timeLabel = `Starting in ${Math.round(diffMin / 60)} hour${Math.round(diffMin / 60) !== 1 ? 's' : ''}`;
    else timeLabel = 'Starting soon';
  }

  // Build participant lines
  const participantLines = (participants || [])
    .map((p: any) => `• ${p.name}${p.role ? ` — ${p.role}` : ''}${p.meetingCount ? ` (${p.meetingCount} previous meeting${p.meetingCount !== 1 ? 's' : ''})` : ''}`)
    .join('\n');

  // Build context highlights
  const highlightLines = (contextHighlights || [])
    .map((h: string) => `• ${h}`)
    .join('\n');

  // Build open action items
  const actionItemLines = (openActionItems || [])
    .map((item: any) => {
      const due = item.dueDate ? ` (due ${item.dueDate})` : '';
      const warn = item.dueDate && new Date(item.dueDate) <= new Date(Date.now() + 3 * 86400000) ? ' ⚠️' : '';
      return `• ${item.description}${item.assignee ? ` → ${item.assignee}` : ''}${due}${warn}`;
    })
    .join('\n');

  const profileLine = profileName ? ` | ${profileIcon || '📋'} ${profileName} profile active` : '';
  const timeLine = timeLabel ? `**${timeLabel}**` : '';

  let content = `## 🔮 Meeting Briefing: ${meetingTitle}\n${timeLine}${profileLine}\n`;

  if (participantLines) {
    content += `\n### Participants\n${participantLines}\n`;
  }
  if (highlightLines) {
    content += `\n### Context Highlights\n${highlightLines}\n`;
  }
  if (actionItemLines) {
    content += `\n### Open Items Going In\n${actionItemLines}\n`;
  }

  content += `\n---\n*Intelligence assembled by Entomate${entomate_url ? ` • [Open in Entomate](${entomate_url})` : ''}*`;

  const actions: Array<{ label: string; action: string; url?: string }> = [];
  if (entomate_url) {
    actions.push({ label: 'Open in Entomate', action: 'open_meeting', url: entomate_url });
  }

  await insertBotMessage(supabase, {
    workspaceId,
    channelId,
    senderId: ENTOMATE_BOT_ID,
    content,
    messageType: 'meeting_briefing',
    metadata: {
      meetingId,
      scheduledAt,
      profileName,
      participants,
      openActionItems,
      sourceUrl: entomate_url,
    },
    actions,
  });

  // Notify participant user IDs if provided
  const userIds = (participants || []).map((p: any) => p.userId).filter(Boolean);
  if (userIds.length) {
    await sendBotNotifications(supabase, userIds, `Meeting briefing ready: ${meetingTitle}`, {
      type: 'meeting_briefing',
      meetingId,
    });
  }
}

async function handleActionItemsExtracted(supabase: any, event: EcosystemEvent): Promise<void> {
  const { workspaceId, meetingTitle, actionItems, entomate_url } = event.data;
  if (!workspaceId || !actionItems?.length) return;

  const channelId = await resolveOrCreateBotChannel(supabase, workspaceId, 'action_items');

  for (const item of actionItems) {
    const content = `## ✅ New Task Assigned\n\n**${item.description}**\nAssigned to: **${item.assignee || 'Unassigned'}**\nPriority: ${item.priority || 'Normal'}\n${item.dueDate ? `Due: ${item.dueDate}` : ''}\n\nFrom meeting: ${meetingTitle}${entomate_url ? `\n\n---\n*[View in Entomate](${entomate_url})*` : ''}`;

    await insertBotMessage(supabase, {
      workspaceId,
      channelId,
      senderId: ENTOMATE_BOT_ID,
      content,
      messageType: 'action_items',
      metadata: {
        actionItemId: item.id,
        meetingId: event.entityId,
        assignee: item.assignee,
        priority: item.priority,
        dueDate: item.dueDate,
        sourceUrl: entomate_url,
      },
      actions: entomate_url ? [{ label: 'View Task', action: 'view_task', url: entomate_url }] : [],
    });
  }
}

async function handleTaskEvent(supabase: any, event: EcosystemEvent): Promise<void> {
  const { workspaceId, taskTitle, status, assignee, entomate_url } = event.data;
  if (!workspaceId) return;

  const channelId = await resolveOrCreateBotChannel(supabase, workspaceId, 'action_items');
  const statusEmoji = event.eventType === 'task.completed' ? '✅' : event.eventType === 'task.created' ? '🆕' : '🔄';
  const verb = event.eventType === 'task.completed' ? 'completed' : event.eventType === 'task.created' ? 'created' : 'updated';

  const content = `${statusEmoji} **Task ${verb}:** ${taskTitle}${assignee ? `\nAssigned to: ${assignee}` : ''}${status ? `\nStatus: ${status}` : ''}`;

  await insertBotMessage(supabase, {
    workspaceId, channelId,
    senderId: ENTOMATE_BOT_ID,
    content, messageType: 'alert',
    metadata: { taskId: event.entityId, sourceUrl: entomate_url },
    actions: entomate_url ? [{ label: 'View Task', action: 'view_task', url: entomate_url }] : [],
  });
}

async function handleBotPost(supabase: any, event: EcosystemEvent): Promise<void> {
  const { workspaceId, channelPurpose, channelId: directChannelId, content, messageType, metadata, actions, notifyUsers } = event.data;
  if (!workspaceId) throw new Error('workspaceId required');

  const channelId = directChannelId || await resolveOrCreateBotChannel(supabase, workspaceId, channelPurpose || 'alerts');

  await insertBotMessage(supabase, {
    workspaceId, channelId,
    senderId: ENTOMATE_BOT_ID,
    content: content || '',
    messageType: messageType || 'text',
    metadata: metadata || {},
    actions: actions || [],
  });

  if (notifyUsers?.length) {
    await sendBotNotifications(supabase, notifyUsers, content, metadata);
  }
}

async function handleNotification(supabase: any, event: EcosystemEvent): Promise<void> {
  const { userIds, content, metadata } = event.data;
  if (!userIds?.length) return;
  await sendBotNotifications(supabase, userIds, content, metadata || {});
}

async function handleAgentAction(supabase: any, event: EcosystemEvent): Promise<void> {
  const { workspaceId, agentName, actionDescription, status, entomate_url } = event.data;
  if (!workspaceId) return;

  const channelId = await resolveOrCreateBotChannel(supabase, workspaceId, 'alerts');
  const statusEmoji = status === 'success' ? '✅' : status === 'failed' ? '❌' : '⚡';

  const content = `${statusEmoji} **Agent Action Completed**\n\n**Agent:** ${agentName || 'Entomate Agent'}\n**Action:** ${actionDescription}\n**Status:** ${status}`;

  await insertBotMessage(supabase, {
    workspaceId, channelId,
    senderId: ENTOMATE_BOT_ID,
    content, messageType: 'alert',
    metadata: { agentActionId: event.entityId, sourceUrl: entomate_url },
    actions: entomate_url ? [{ label: 'View Details', action: 'open_meeting', url: entomate_url }] : [],
  });
}

async function handleAutomationEvent(supabase: any, event: EcosystemEvent): Promise<void> {
  const { workspaceId, automationName, status, triggerDescription, actionCount, entomate_url } = event.data;
  if (!workspaceId) return;

  const channelId = await resolveOrCreateBotChannel(supabase, workspaceId, 'automations');
  const statusEmoji = status === 'success' ? '✅' : status === 'failed' ? '❌' : '⚡';

  const content = `## ⚡ Automation: ${automationName}\n\nStatus: ${statusEmoji} ${status}\n${triggerDescription ? `Trigger: ${triggerDescription}\n` : ''}${actionCount ? `Actions completed: ${actionCount}` : ''}`;

  await insertBotMessage(supabase, {
    workspaceId, channelId,
    senderId: ENTOMATE_BOT_ID,
    content, messageType: 'alert',
    metadata: { automationId: event.entityId, sourceUrl: entomate_url },
    actions: entomate_url ? [{ label: 'View Automation', action: 'open_meeting', url: entomate_url }] : [],
  });
}

async function handleContactEvent(supabase: any, event: EcosystemEvent): Promise<void> {
  // Store entity mapping for cross-app contact linking
  // (No bot message — contact events are silent by default)
  if (event.data.localContactId) {
    await supabase.from('ecosystem_entity_map').upsert({
      local_entity_type: 'contact',
      local_entity_id: event.data.localContactId,
      remote_app: event.source,
      remote_entity_type: 'contact',
      remote_entity_id: event.entityId,
    }, { onConflict: 'local_entity_type,local_entity_id,remote_app' });
  }
}

async function handleHeartbeat(supabase: any, event: EcosystemEvent): Promise<void> {
  // No-op handler — token validation already passed upstream.
  // The calling app's heartbeat function updates last_heartbeat on success.
  console.log(`[ecosystem-inbound] Heartbeat received from ${event.source}`);
}

// =====================================================
// HELPERS
// =====================================================

async function resolveOrCreateBotChannel(
  supabase: any,
  workspaceId: string,
  purpose: string
): Promise<string> {
  // Check existing registration
  const { data: existing } = await supabase
    .from('ecosystem_bot_channels')
    .select('channel_id')
    .eq('workspace_id', workspaceId)
    .eq('bot_app', 'entomate')
    .eq('channel_purpose', purpose)
    .single();

  if (existing) return existing.channel_id;

  // Create the channel
  const nameMap: Record<string, { name: string; description: string }> = {
    meetings: { name: 'entomate-meetings', description: 'Meeting summaries and action items from Entomate' },
    alerts: { name: 'entomate-alerts', description: 'Automation alerts and notifications from Entomate' },
    action_items: { name: 'entomate-tasks', description: 'Task assignments and updates from Entomate' },
    automations: { name: 'entomate-automations', description: 'Automation workflow updates from Entomate' },
  };

  const channelInfo = nameMap[purpose] || { name: `entomate-${purpose}`, description: `Entomate ${purpose} feed` };

  const { data: channel, error } = await supabase
    .from('message_channels')
    .insert({
      workspace_id: workspaceId,
      name: channelInfo.name,
      description: channelInfo.description,
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

async function insertBotMessage(supabase: any, opts: {
  workspaceId: string;
  channelId: string;
  senderId: string;
  content: string;
  messageType: string;
  metadata: Record<string, any>;
  actions: Array<{ label: string; action: string; url?: string }>;
}): Promise<string> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      workspace_id: opts.workspaceId,
      channel_id: opts.channelId,
      sender_id: opts.senderId,
      bot_content: opts.content,
      is_bot_message: true,
      bot_app: 'entomate',
      bot_message_type: opts.messageType,
      bot_metadata: opts.metadata,
      bot_actions: opts.actions,
      // encrypted_content and nonce are NULL — bot messages are plaintext
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to insert bot message: ${error.message}`);
  return data.id;
}

async function sendBotNotifications(
  supabase: any,
  userIds: string[],
  content: string,
  metadata: Record<string, any>
): Promise<void> {
  if (!userIds?.length) return;

  const notifications = userIds.map((userId) => ({
    user_id: userId,
    type: 'ecosystem',
    content: content?.slice(0, 200) || 'New notification from Entomate',
    metadata: { source: 'entomate', ...metadata },
    read: false,
  }));

  await supabase.from('pulse_notifications').insert(notifications);
}
