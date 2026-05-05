// =====================================================
// CONTEXT HANDLER
// Handles context.request events from Entomate (MIP pre-meeting briefings).
// Assembles conversation context from Pulse's chat_messages and
// POSTs a context.response event back to Entomate's ecosystem-inbound.
//
// EVENT FLOW:
//   Entomate → Pulse: context.request  (which participants, lookback window, topics)
//   Pulse → Entomate: context.response (structured conversation summaries + participant activity)
// =====================================================

interface ContextRequest {
  requestId: string;
  meetingId?: string;
  profileSlug?: string;
  participants: string[];
  participantEmails?: string[];
  contextDepth?: 'quick' | 'standard' | 'deep';
  lookbackDays?: number;
  topics?: string[];
}

interface ConversationSummary {
  channelId: string;
  channelName: string;
  participants: string[];
  messageCount: number;
  lastActivity: string;
  topicSummary: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  keyMessages: Array<{ content: string; date: string; sender: string }>;
  openThreads: number;
}

interface ParticipantActivity {
  name: string;
  totalMessages: number;
  lastActive: string;
  engagementScore: number;
  recentTopics: string[];
}

const POSITIVE_WORDS = ['great', 'excellent', 'good', 'happy', 'thank', 'appreciate', 'perfect', 'agree', 'approved', 'confirmed'];
const NEGATIVE_WORDS = ['issue', 'problem', 'concern', 'delay', 'failed', 'disagree', 'difficult', 'cancel', 'overdue', 'blocked'];

function inferSentiment(text: string): 'positive' | 'neutral' | 'negative' {
  const lower = text.toLowerCase();
  const pos = POSITIVE_WORDS.filter((w) => lower.includes(w)).length;
  const neg = NEGATIVE_WORDS.filter((w) => lower.includes(w)).length;
  if (pos > neg + 1) return 'positive';
  if (neg > pos + 1) return 'negative';
  return 'neutral';
}

export async function handleContextRequest(
  supabase: any,
  event: any
): Promise<void> {
  const data: ContextRequest = event.data;
  const {
    requestId,
    participants = [],
    lookbackDays = 30,
    topics = [],
  } = data;

  if (!requestId) {
    console.warn('[contextHandler] context.request missing requestId — ignoring');
    return;
  }

  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);

  // -------------------------------------------------------
  // 1. Fetch recent messages by participants (by sender_name)
  // -------------------------------------------------------
  if (participants.length === 0) {
    console.warn('[contextHandler] context.request has no participants — nothing to assemble');
    await sendContextResponse(supabase, requestId, data, [], []);
    return;
  }

  // Build OR conditions: sender_name ilike %Name%
  const nameFilter = participants.map((name: string) => `sender_name.ilike.%${name}%`).join(',');

  const { data: messages, error: msgError } = await supabase
    .from('chat_messages')
    .select('id, channel_id, sender_id, sender_name, bot_content, content, created_at, thread_id, is_bot_message')
    .gte('created_at', lookbackDate.toISOString())
    .eq('is_bot_message', false)
    .or(nameFilter)
    .order('created_at', { ascending: false })
    .limit(300);

  if (msgError) {
    console.error('[contextHandler] Error fetching messages:', msgError.message);
    return;
  }

  const rows: any[] = messages || [];

  if (rows.length === 0) {
    await sendContextResponse(supabase, requestId, data, [], participants.map((name) => ({
      name,
      totalMessages: 0,
      lastActive: '',
      engagementScore: 0,
      recentTopics: [],
    })));
    return;
  }

  // -------------------------------------------------------
  // 2. Group messages by channel and build summaries
  // -------------------------------------------------------
  const channelMap = new Map<string, any[]>();
  for (const msg of rows) {
    if (!channelMap.has(msg.channel_id)) channelMap.set(msg.channel_id, []);
    channelMap.get(msg.channel_id)!.push(msg);
  }

  // Resolve channel names in one query
  const channelIds = Array.from(channelMap.keys());
  const { data: channels } = await supabase
    .from('message_channels')
    .select('id, name')
    .in('id', channelIds);

  const channelNameMap = new Map<string, string>(
    (channels || []).map((c: any) => [c.id, c.name])
  );

  // Track per-participant activity across all channels
  const participantActivity = new Map<string, { totalMessages: number; lastActive: string }>();

  const conversations: ConversationSummary[] = [];

  for (const [channelId, msgs] of channelMap.entries()) {
    const channelName = channelNameMap.get(channelId) || channelId;

    // Sort newest first for key messages
    const sorted = [...msgs].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const keyMessages = sorted.slice(0, 5).map((m: any) => ({
      content: String(m.bot_content || m.content || '').slice(0, 250),
      date: m.created_at.slice(0, 10),
      sender: m.sender_name || 'Unknown',
    }));

    const allText = msgs.map((m: any) => String(m.bot_content || m.content || '')).join(' ');
    const matchedTopics = topics.filter((t: string) => allText.toLowerCase().includes(t.toLowerCase()));
    const topicSummary = matchedTopics.length > 0
      ? `Discussion about: ${matchedTopics.join(', ')}`
      : `${msgs.length} messages in the last ${lookbackDays} days`;

    const sentiment = inferSentiment(allText);
    const channelParticipants = [...new Set(msgs.map((m: any) => m.sender_name).filter(Boolean))] as string[];

    // Count open threads (messages that have thread_id set, distinct)
    const openThreadIds = new Set(msgs.map((m: any) => m.thread_id).filter(Boolean));

    // Update participant activity map
    for (const msg of msgs) {
      if (!msg.sender_name) continue;
      const existing = participantActivity.get(msg.sender_name) || { totalMessages: 0, lastActive: '' };
      existing.totalMessages++;
      if (!existing.lastActive || msg.created_at > existing.lastActive) {
        existing.lastActive = msg.created_at;
      }
      participantActivity.set(msg.sender_name, existing);
    }

    conversations.push({
      channelId,
      channelName: String(channelName),
      participants: channelParticipants,
      messageCount: msgs.length,
      lastActivity: sorted[0]?.created_at || new Date().toISOString(),
      topicSummary,
      sentiment,
      keyMessages,
      openThreads: openThreadIds.size,
    });
  }

  // Sort by most recent activity
  conversations.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));

  // -------------------------------------------------------
  // 3. Build participant activity summaries
  // -------------------------------------------------------
  const participantActivityList: ParticipantActivity[] = participants.map((name: string) => {
    const activity = participantActivity.get(name);
    return {
      name,
      totalMessages: activity?.totalMessages || 0,
      lastActive: activity?.lastActive || '',
      engagementScore: Math.min(100, (activity?.totalMessages || 0) * 4),
      recentTopics: topics.slice(0, 3),
    };
  });

  await sendContextResponse(
    supabase,
    requestId,
    data,
    conversations.slice(0, 10),
    participantActivityList
  );
}

// -------------------------------------------------------
// POST context.response back to Entomate
// -------------------------------------------------------
async function sendContextResponse(
  supabase: any,
  requestId: string,
  originalRequest: ContextRequest,
  conversations: ConversationSummary[],
  participantActivity: ParticipantActivity[]
): Promise<void> {
  const { data: entomateConfig, error } = await supabase
    .from('ecosystem_config')
    .select('api_url, service_token, features')
    .eq('app_name', 'entomate')
    .single();

  if (error || !entomateConfig) {
    console.error('[contextHandler] Entomate config not found — cannot send context.response');
    return;
  }

  const payload = {
    id: crypto.randomUUID(),
    source: 'pulse',
    timestamp: new Date().toISOString(),
    serviceToken: entomateConfig.service_token,
    eventType: 'context.response',
    data: {
      requestId,
      meetingId: originalRequest.meetingId,
      conversations,
      participantActivity,
    },
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Ecosystem-Token': entomateConfig.service_token,
  };
  // Supabase API gateway requires both Authorization and apikey on POSTs
  // to edge functions. Without these the request 401s before reaching
  // Entomate's ecosystem-inbound handler.
  if (entomateConfig.features?.gateway_key) {
    headers['Authorization'] = `Bearer ${entomateConfig.features.gateway_key}`;
    headers['apikey'] = entomateConfig.features.gateway_key;
  }

  try {
    const resp = await fetch(entomateConfig.api_url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error(`[contextHandler] context.response POST failed (${resp.status}):`, body);
    } else {
      console.log(`[contextHandler] context.response sent — requestId: ${requestId}, channels: ${conversations.length}`);
    }
  } catch (err) {
    console.error('[contextHandler] Error sending context.response:', err);
  }
}
