// =====================================================
// ECOSYSTEM NOTIFY SERVICE
// Thin client-side wrapper around the `ecosystem-outbound` edge function.
// All methods are fire-and-forget by default — caller should NOT await
// unless they need the delivery result, since cross-app notifications
// are non-blocking side effects of local operations.
// =====================================================

import { supabase } from './supabase';

type TargetApp = 'entomate' | 'logos_vision';

async function invokeOutbound(
  eventType: string,
  targetApp: TargetApp,
  data: Record<string, unknown>,
  entity?: { entityType?: string; entityId?: string },
): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('ecosystem-outbound', {
      body: {
        eventType,
        targetApp,
        entityType: entity?.entityType,
        entityId: entity?.entityId,
        data,
      },
    });
    if (error) {
      console.warn(`[ecosystemNotify] ${eventType} → ${targetApp} failed:`, error.message);
    }
  } catch (err) {
    console.warn(`[ecosystemNotify] ${eventType} → ${targetApp} threw:`, err);
  }
}

const UUID_RE = /@[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;

function extractMentionedIds(content: string): string[] {
  const matches = content.match(UUID_RE);
  if (!matches) return [];
  const ids = new Set<string>();
  for (const raw of matches) ids.add(raw.slice(1));
  return Array.from(ids);
}

/**
 * Find Pulse contact UUIDs in a message body that are mapped to a remote app's
 * contact via ecosystem_entity_map. Returns only the IDs that have a mapping —
 * unmapped mentions are not relevant cross-app.
 */
async function resolveMappedContactMentions(
  content: string,
  remoteApp: TargetApp,
): Promise<string[]> {
  const candidateIds = extractMentionedIds(content);
  if (candidateIds.length === 0) return [];

  const { data, error } = await supabase
    .from('ecosystem_entity_map')
    .select('local_entity_id')
    .eq('local_entity_type', 'contact')
    .eq('remote_app', remoteApp)
    .in('local_entity_id', candidateIds);

  if (error || !data) return [];
  return data.map(row => row.local_entity_id as string);
}

export const ecosystemNotifyService = {
  /**
   * Fire one `message.mention` event per Pulse contact that was @-mentioned in
   * `content` and has a mapping to the target app.
   */
  async notifyMessageMentions(opts: {
    content: string;
    channelName: string;
    mentionedBy: string;
    targetApp?: TargetApp;
  }): Promise<void> {
    const target = opts.targetApp || 'logos_vision';
    const mappedContactIds = await resolveMappedContactMentions(opts.content, target);
    if (mappedContactIds.length === 0) return;

    const preview = opts.content.length > 200 ? opts.content.slice(0, 200) + '…' : opts.content;

    await Promise.all(
      mappedContactIds.map(contactId =>
        invokeOutbound(
          'message.mention',
          target,
          {
            contactId,
            channelName: opts.channelName,
            messagePreview: preview,
            mentionedBy: opts.mentionedBy,
          },
          { entityType: 'contact', entityId: contactId },
        ),
      ),
    );
  },

  /**
   * Notify Entomate that a Pulse workspace logged a decision. Entomate
   * caches it in intelligence_context_cache so the MIP context assembler
   * can surface "the team decided X" when prepping a related meeting.
   */
  async notifyDecisionCreated(opts: {
    decisionId: string;
    workspaceId: string;
    title: string;
    description?: string | null;
    decisionType?: string | null;
    proposedBy: string;
    targetApp?: TargetApp;
  }): Promise<void> {
    await invokeOutbound(
      'decision.created',
      opts.targetApp || 'entomate',
      {
        decisionId: opts.decisionId,
        workspaceId: opts.workspaceId,
        title: opts.title,
        description: opts.description ?? null,
        decisionType: opts.decisionType ?? 'general',
        proposedBy: opts.proposedBy,
      },
      { entityType: 'decision', entityId: opts.decisionId },
    );
  },

  /**
   * Notify Entomate that a Pulse workspace extracted a task. Same MIP-cache
   * intent as notifyDecisionCreated. Pulse tasks are not sync-mirrored as
   * Entomate action_items — they're context only.
   */
  async notifyTaskCreated(opts: {
    taskId: string;
    workspaceId: string;
    title: string;
    description?: string | null;
    assigneeId?: string | null;
    deadline?: string | null;
    priority?: string | null;
    originMessageId?: string | null;
    targetApp?: TargetApp;
  }): Promise<void> {
    await invokeOutbound(
      'task.created',
      opts.targetApp || 'entomate',
      {
        taskId: opts.taskId,
        workspaceId: opts.workspaceId,
        title: opts.title,
        description: opts.description ?? null,
        assigneeId: opts.assigneeId ?? null,
        deadline: opts.deadline ?? null,
        priority: opts.priority ?? 'medium',
        originMessageId: opts.originMessageId ?? null,
      },
      { entityType: 'task', entityId: opts.taskId },
    );
  },

  /**
   * Send a periodic engagement digest for a channel (intended for a cron or
   * admin trigger, not a per-message hot path). LV uses this to update
   * contact engagement scores.
   */
  async notifyChannelActivitySummary(opts: {
    channelId: string;
    channelName: string;
    periodStart: string;
    periodEnd: string;
    messageCount: number;
    activeUserCount: number;
    contactIds?: string[];
    targetApp?: TargetApp;
  }): Promise<void> {
    await invokeOutbound(
      'channel.activity_summary',
      opts.targetApp || 'logos_vision',
      {
        channelId: opts.channelId,
        channelName: opts.channelName,
        periodStart: opts.periodStart,
        periodEnd: opts.periodEnd,
        messageCount: opts.messageCount,
        activeUserCount: opts.activeUserCount,
        contactIds: opts.contactIds || [],
      },
      { entityType: 'channel', entityId: opts.channelId },
    );
  },
};

export default ecosystemNotifyService;
