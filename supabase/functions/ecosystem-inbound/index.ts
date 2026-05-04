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

    // Senders may use `id` or `correlationId`; fall back to a fresh UUID so the
    // NOT NULL `event_id` constraint never silently drops the row.
    const eventId =
      event.id ||
      (event as any).correlationId ||
      crypto.randomUUID();

    // Normalize source label — accept both `logos-vision` and `logos_vision`
    // since LV's bridge has historically sent the hyphenated form.
    const sourceLabel: EcosystemEvent['source'] =
      (event.source as string) === 'logos-vision' ? 'logos_vision' : event.source;

    // Log the inbound event. If this fails (constraint violation, etc.), surface
    // it instead of silently dropping — earlier this caused 46 LV→Pulse contact
    // events to be lost while still returning 200 to the sender.
    const { error: logInsertError } = await supabase.from('ecosystem_events').insert({
      event_id: eventId,
      source: sourceLabel,
      event_type: event.eventType,
      entity_type: event.entityType,
      entity_id: event.entityId,
      direction: 'inbound',
      status: 'received',
      payload: event.data,
    });

    if (logInsertError) {
      console.error('[ecosystem-inbound] Failed to log inbound event:', logInsertError, {
        eventId,
        source: sourceLabel,
        eventType: event.eventType,
      });
      return new Response(
        JSON.stringify({ error: 'Failed to log event', detail: logInsertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
      .eq('event_id', eventId)
      .eq('direction', 'inbound');

    if (status === 'failed') {
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ received: true, eventId }),
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

    case 'meeting.recordings_list':
      return handleRecordingsListRequest(supabase, event);

    case 'meeting.export_request':
      return handleExportRequest(supabase, event);

    case 'meeting.recording_request':
      return handleRecordingRequest(supabase, event);

    case 'donation.received':
      return handleDonationReceived(supabase, event);

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
const LOGOS_VISION_BOT_ID = '10905151-0000-0000-0000-100000000001';

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

/**
 * Handle meeting.recordings_list — Entomate requests available Pulse recordings.
 * Returns a list of recent recordings that Entomate can then request individually
 * via meeting.export events, or that can be auto-synced.
 */
async function handleRecordingsListRequest(supabase: any, event: EcosystemEvent): Promise<void> {
  const { workspaceId, since, limit: reqLimit } = event.data;
  if (!workspaceId) throw new Error('workspaceId required');

  const maxRecordings = Math.min(reqLimit || 20, 50);
  const sinceDate = since ? new Date(since).toISOString() : new Date(Date.now() - 30 * 86400000).toISOString();

  // Fetch recent video room recordings
  const { data: videoRooms } = await supabase
    .from('pulse_video_rooms')
    .select('id, title, created_at, duration_seconds, recording_url, transcript, summary')
    .eq('status', 'ended')
    .gte('created_at', sinceDate)
    .not('recording_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(maxRecordings);

  // Fetch legacy meeting recordings
  const { data: legacyMeetings } = await supabase
    .from('meetings')
    .select('id, title, start_time, duration_minutes, audio_file_url, transcript, summary, attendees')
    .gte('created_at', sinceDate)
    .not('audio_file_url', 'is', null)
    .order('start_time', { ascending: false })
    .limit(maxRecordings);

  // Check which have already been exported
  const allIds = [
    ...(videoRooms || []).map((r: any) => r.id),
    ...(legacyMeetings || []).map((r: any) => r.id),
  ];

  const { data: exportedEvents } = allIds.length > 0
    ? await supabase
        .from('ecosystem_events')
        .select('payload')
        .eq('event_type', 'meeting.export')
        .eq('direction', 'outbound')
        .eq('status', 'processed')
    : { data: [] };

  const exportedIds = new Set(
    (exportedEvents || [])
      .map((e: any) => e.payload?.meetingId)
      .filter(Boolean)
  );

  const recordings = [
    ...(videoRooms || []).map((r: any) => ({
      id: r.id,
      title: r.title || 'Pulse Meeting',
      recordedAt: r.created_at,
      durationMinutes: r.duration_seconds ? Math.round(r.duration_seconds / 60) : null,
      hasAudio: !!r.recording_url,
      hasTranscript: !!r.transcript,
      source: 'pulse_video',
      alreadyExported: exportedIds.has(r.id),
    })),
    ...(legacyMeetings || []).map((r: any) => ({
      id: r.id,
      title: r.title,
      recordedAt: r.start_time || r.created_at,
      durationMinutes: r.duration_minutes,
      hasAudio: !!r.audio_file_url,
      hasTranscript: !!r.transcript,
      attendeeCount: Array.isArray(r.attendees) ? r.attendees.length : 0,
      source: 'ai_scribe',
      alreadyExported: exportedIds.has(r.id),
    })),
  ];

  // Post the recordings list to #entomate-meetings channel
  const channelId = await resolveOrCreateBotChannel(supabase, workspaceId, 'meetings');
  const unexported = recordings.filter(r => !r.alreadyExported);

  if (unexported.length > 0) {
    const listText = unexported.slice(0, 10).map((r: any) =>
      `• **${r.title}** — ${new Date(r.recordedAt).toLocaleDateString()}${r.durationMinutes ? ` (${r.durationMinutes} min)` : ''}`
    ).join('\n');

    await insertBotMessage(supabase, {
      workspaceId,
      channelId,
      senderId: ENTOMATE_BOT_ID,
      content: `## 🎙️ Recordings Available for Export\n\n${unexported.length} recording${unexported.length !== 1 ? 's' : ''} not yet sent to Entomate:\n\n${listText}${unexported.length > 10 ? `\n\n...and ${unexported.length - 10} more` : ''}`,
      messageType: 'recordings_list',
      metadata: {
        recordings: unexported,
        totalCount: unexported.length,
        requestedBy: event.source,
      },
      actions: [
        { label: 'Export All to Entomate', action: 'export_all_recordings' },
      ],
    });
  }
}

async function handleHeartbeat(supabase: any, event: EcosystemEvent): Promise<void> {
  // No-op handler — token validation already passed upstream.
  // The calling app's heartbeat function updates last_heartbeat on success.
  console.log(`[ecosystem-inbound] Heartbeat received from ${event.source}`);
}

async function handleDonationReceived(supabase: any, event: EcosystemEvent): Promise<void> {
  const { workspaceId, donation, logos_url } = event.data;
  if (!workspaceId) throw new Error('workspaceId required in event.data');
  if (!donation) throw new Error('donation object required in event.data');

  const channelId = await resolveOrCreateBotChannel(supabase, workspaceId, 'donations', 'logos_vision');

  const amount = donation.amount != null ? `$${Number(donation.amount).toLocaleString()}` : 'Unknown amount';
  const donor = donation.donor_name || donation.donorName || donation.client_name || donation.clientName || 'Anonymous donor';
  const donorLine = donation.donor_email || donation.donorEmail
    ? `\n*${donation.donor_email || donation.donorEmail}*`
    : '';
  const dateStr = donation.donation_date || donation.donationDate || donation.date;
  const dateLine = dateStr ? `\n**Date:** ${new Date(dateStr).toLocaleDateString()}` : '';
  const fundLine = donation.fund || donation.campaign ? `\n**Fund:** ${donation.fund || donation.campaign}` : '';
  const noteLine = donation.notes || donation.message ? `\n\n> ${donation.notes || donation.message}` : '';

  const content = `## 💚 New Donation Received\n\n**${donor}** — **${amount}**${donorLine}${dateLine}${fundLine}${noteLine}\n\n---\n*From Logos Vision${logos_url ? ` • [View in CRM](${logos_url})` : ''}*`;

  await insertBotMessage(supabase, {
    workspaceId,
    channelId,
    senderId: LOGOS_VISION_BOT_ID,
    botApp: 'logos_vision',
    content,
    messageType: 'donation_alert',
    metadata: {
      donationId: donation.id || event.entityId,
      amount: donation.amount,
      donor,
      sourceUrl: logos_url,
    },
    actions: logos_url ? [{ label: 'View in Logos Vision', action: 'open_url', url: logos_url }] : [],
  });
}

// =====================================================
// SERVICE-TO-SERVICE OUTBOUND
// =====================================================

/**
 * Send an event directly to another app's inbound endpoint.
 * Used for service-to-service communication (no user JWT needed).
 */
async function sendServiceEvent(
  supabase: any,
  targetApp: string,
  event: {
    eventType: string;
    entityType?: string;
    entityId?: string;
    data: Record<string, any>;
  }
): Promise<{ success: boolean; error?: string }> {
  const { data: config, error: configError } = await supabase
    .from('ecosystem_config')
    .select('api_url, service_token, features, enabled')
    .eq('app_name', targetApp)
    .single();

  if (configError || !config || !config.enabled) {
    return { success: false, error: `Target app '${targetApp}' not configured` };
  }

  const eventId = crypto.randomUUID();
  const payload = {
    id: eventId,
    source: 'pulse',
    timestamp: new Date().toISOString(),
    serviceToken: config.service_token,
    eventType: event.eventType,
    entityType: event.entityType,
    entityId: event.entityId,
    data: event.data,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Ecosystem-Token': config.service_token,
    'X-Ecosystem-Source': 'pulse',
    'X-Ecosystem-Event-Id': eventId,
  };
  if (config.features?.gateway_key) {
    headers['Authorization'] = `Bearer ${config.features.gateway_key}`;
  }

  const resp = await fetch(config.api_url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    console.error(`[sendServiceEvent] POST to ${targetApp} failed (${resp.status}):`, errBody);
    return { success: false, error: `Delivery failed: ${resp.status}` };
  }

  await supabase.from('ecosystem_events').insert({
    event_id: eventId,
    source: 'pulse',
    event_type: event.eventType,
    entity_type: event.entityType,
    entity_id: event.entityId,
    direction: 'outbound',
    status: 'processed',
    payload: event.data,
  });

  return { success: true };
}

// =====================================================
// EXPORT REQUEST HANDLER
// =====================================================

/**
 * Handle meeting.recording_request — search Pulse recordings by query/timeframe.
 *
 * Complements meeting.recordings_list (which returns recent unexported
 * recordings) and meeting.export_request (which fetches a known recording by id).
 * Posts matching recordings to the bot channel so users can pick one to export.
 *
 * Payload: { workspaceId, query?, since?, before?, limit? }
 *   - query: substring match against recording title (case-insensitive)
 *   - since / before: ISO timestamps bounding the search window
 *   - limit: max results (default 10, max 50)
 */
async function handleRecordingRequest(supabase: any, event: EcosystemEvent): Promise<void> {
  const { workspaceId, query, since, before, limit: reqLimit } = event.data;
  if (!workspaceId) throw new Error('workspaceId required');

  const max = Math.min(reqLimit || 10, 50);
  const sinceIso = since ? new Date(since).toISOString() : null;
  const beforeIso = before ? new Date(before).toISOString() : null;

  // Build pulse_video_rooms query
  let videoQuery = supabase
    .from('pulse_video_rooms')
    .select('id, title, created_at, duration_seconds, recording_url, transcript')
    .eq('status', 'ended')
    .not('recording_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(max);
  if (sinceIso) videoQuery = videoQuery.gte('created_at', sinceIso);
  if (beforeIso) videoQuery = videoQuery.lte('created_at', beforeIso);
  if (query) videoQuery = videoQuery.ilike('title', `%${query}%`);
  const { data: videoRooms } = await videoQuery;

  // Build legacy meetings query
  let legacyQuery = supabase
    .from('meetings')
    .select('id, title, start_time, duration_minutes, audio_file_url, transcript, attendees')
    .not('audio_file_url', 'is', null)
    .order('start_time', { ascending: false })
    .limit(max);
  if (sinceIso) legacyQuery = legacyQuery.gte('created_at', sinceIso);
  if (beforeIso) legacyQuery = legacyQuery.lte('created_at', beforeIso);
  if (query) legacyQuery = legacyQuery.ilike('title', `%${query}%`);
  const { data: legacyMeetings } = await legacyQuery;

  const matches = [
    ...(videoRooms || []).map((r: any) => ({
      id: r.id,
      title: r.title || 'Pulse Meeting',
      recordedAt: r.created_at,
      durationMinutes: r.duration_seconds ? Math.round(r.duration_seconds / 60) : null,
      hasAudio: !!r.recording_url,
      hasTranscript: !!r.transcript,
      source: 'pulse_video',
    })),
    ...(legacyMeetings || []).map((r: any) => ({
      id: r.id,
      title: r.title,
      recordedAt: r.start_time || r.created_at,
      durationMinutes: r.duration_minutes,
      hasAudio: !!r.audio_file_url,
      hasTranscript: !!r.transcript,
      attendeeCount: Array.isArray(r.attendees) ? r.attendees.length : 0,
      source: 'ai_scribe',
    })),
  ].slice(0, max);

  // Surface the result in the bot channel.
  const channelId = await resolveOrCreateBotChannel(supabase, workspaceId, 'meetings');
  const queryDesc = [
    query ? `matching "${query}"` : null,
    sinceIso ? `after ${new Date(sinceIso).toLocaleDateString()}` : null,
    beforeIso ? `before ${new Date(beforeIso).toLocaleDateString()}` : null,
  ].filter(Boolean).join(' ') || 'all available';

  if (matches.length === 0) {
    await insertBotMessage(supabase, {
      workspaceId, channelId,
      senderId: ENTOMATE_BOT_ID,
      content: `## 🔍 No recordings found\n\nNo Pulse recordings matched the criteria: ${queryDesc}.`,
      messageType: 'recordings_list',
      metadata: { query, since: sinceIso, before: beforeIso, requestedBy: event.source },
      actions: [],
    });
    return;
  }

  const listText = matches.map((r: any) =>
    `• **${r.title}** — ${new Date(r.recordedAt).toLocaleDateString()}${r.durationMinutes ? ` (${r.durationMinutes} min)` : ''}`
  ).join('\n');

  await insertBotMessage(supabase, {
    workspaceId, channelId,
    senderId: ENTOMATE_BOT_ID,
    content: `## 🎙️ Recordings Found (${matches.length})\n\nMatching: ${queryDesc}\n\n${listText}\n\n*Reply with the title or ID to export to ${event.source}.*`,
    messageType: 'recordings_list',
    metadata: {
      recordings: matches,
      totalCount: matches.length,
      query, since: sinceIso, before: beforeIso,
      requestedBy: event.source,
    },
    actions: matches.length === 1
      ? [{ label: `Export to ${event.source}`, action: 'export_recording', url: undefined }]
      : [{ label: 'Export All', action: 'export_all_recordings' }],
  });
}

/**
 * Handle meeting.export_request — Entomate requests a specific recording.
 * Looks up the recording in Pulse and sends it back as meeting.export.
 */
async function handleExportRequest(supabase: any, event: EcosystemEvent): Promise<void> {
  const { recordingId, source: requestedSource } = event.data;
  if (!recordingId) throw new Error('recordingId required');

  let recording: any = null;
  let source = 'pulse_video';

  // Try pulse_video_rooms first
  const { data: videoRoom } = await supabase
    .from('pulse_video_rooms')
    .select('id, title, created_at, duration_seconds, recording_url, transcript, summary')
    .eq('id', recordingId)
    .single();

  if (videoRoom) {
    recording = {
      id: videoRoom.id,
      title: videoRoom.title || 'Pulse Meeting',
      audioUrl: videoRoom.recording_url || null,
      transcript: videoRoom.transcript || null,
      durationMinutes: videoRoom.duration_seconds ? Math.round(videoRoom.duration_seconds / 60) : 0,
      recordedAt: videoRoom.created_at,
      attendees: [],
    };
  }

  // Fallback: legacy meetings table
  if (!recording) {
    const { data: legacyMeeting } = await supabase
      .from('meetings')
      .select('id, title, start_time, duration_minutes, audio_file_url, transcript, attendees')
      .eq('id', recordingId)
      .single();

    if (legacyMeeting) {
      source = 'ai_scribe';
      recording = {
        id: legacyMeeting.id,
        title: legacyMeeting.title,
        audioUrl: legacyMeeting.audio_file_url || null,
        transcript: legacyMeeting.transcript || null,
        durationMinutes: legacyMeeting.duration_minutes || 0,
        recordedAt: legacyMeeting.start_time || legacyMeeting.created_at,
        attendees: (legacyMeeting.attendees || []).map((name: string) => ({ name })),
      };
    }
  }

  if (!recording) {
    throw new Error(`Recording ${recordingId} not found`);
  }

  if (!recording.audioUrl && !recording.transcript) {
    throw new Error(`Recording ${recordingId} has no audio or transcript`);
  }

  // Send meeting.export back to the requesting app
  const result = await sendServiceEvent(supabase, event.source, {
    eventType: 'meeting.export',
    entityType: 'meeting',
    entityId: recording.id,
    data: {
      meetingId: recording.id,
      title: recording.title,
      audioUrl: recording.audioUrl,
      transcript: recording.transcript,
      attendees: recording.attendees,
      durationMinutes: recording.durationMinutes,
      recordedAt: recording.recordedAt,
      source: requestedSource || source,
    },
  });

  if (!result.success) {
    throw new Error(`Failed to send recording to ${event.source}: ${result.error}`);
  }
}

// =====================================================
// HELPERS
// =====================================================

async function resolveOrCreateBotChannel(
  supabase: any,
  workspaceId: string,
  purpose: string,
  botApp: string = 'entomate'
): Promise<string> {
  // Check existing registration
  const { data: existing } = await supabase
    .from('ecosystem_bot_channels')
    .select('channel_id')
    .eq('workspace_id', workspaceId)
    .eq('bot_app', botApp)
    .eq('channel_purpose', purpose)
    .single();

  if (existing) return existing.channel_id;

  // Create the channel
  const channelPrefix = botApp === 'logos_vision' ? 'logos' : botApp;
  const nameMap: Record<string, Record<string, { name: string; description: string }>> = {
    entomate: {
      meetings: { name: 'entomate-meetings', description: 'Meeting summaries and action items from Entomate' },
      alerts: { name: 'entomate-alerts', description: 'Automation alerts and notifications from Entomate' },
      action_items: { name: 'entomate-tasks', description: 'Task assignments and updates from Entomate' },
      automations: { name: 'entomate-automations', description: 'Automation workflow updates from Entomate' },
    },
    logos_vision: {
      alerts: { name: 'logos-alerts', description: 'CRM alerts and notifications from Logos Vision' },
      donations: { name: 'logos-donations', description: 'Donation activity from Logos Vision' },
    },
  };

  const channelInfo = nameMap[botApp]?.[purpose]
    || { name: `${channelPrefix}-${purpose}`, description: `${botApp} ${purpose} feed` };

  const senderId = botApp === 'logos_vision' ? LOGOS_VISION_BOT_ID : ENTOMATE_BOT_ID;

  const { data: channel, error } = await supabase
    .from('message_channels')
    .insert({
      workspace_id: workspaceId,
      name: channelInfo.name,
      description: channelInfo.description,
      is_public: true,
      is_group: false,
      is_bot_channel: true,
      bot_app: botApp,
      created_by: senderId,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create bot channel: ${error.message}`);

  await supabase.from('ecosystem_bot_channels').insert({
    workspace_id: workspaceId,
    bot_app: botApp,
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
  botApp?: string;
}): Promise<string> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      workspace_id: opts.workspaceId,
      channel_id: opts.channelId,
      sender_id: opts.senderId,
      bot_content: opts.content,
      is_bot_message: true,
      bot_app: opts.botApp || 'entomate',
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
