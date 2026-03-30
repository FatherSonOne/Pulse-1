// ============================================
// ECOSYSTEM BRIDGE TEST SUITE
// Tests for config registry, type guards, token
// validation logic, event routing, heartbeat,
// outbound whitelist, bot channel resolution,
// and context handler sentiment inference.
// ============================================

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import {
  ECOSYSTEM_APPS,
  ECOSYSTEM_APP_ORDER,
  getInboundUrl,
  PULSE_INBOUND_URL,
  type EcosystemAppName,
} from '../../config/ecosystem';
import { isBotMessage, type BotChannelMessage, type ChannelMessage } from '../../types/messages';

// =====================================================
// 1. ECOSYSTEM CONFIG REGISTRY
// =====================================================

describe('Ecosystem Config Registry', () => {
  it('should define all three apps', () => {
    expect(ECOSYSTEM_APPS.pulse).toBeDefined();
    expect(ECOSYSTEM_APPS.entomate).toBeDefined();
    expect(ECOSYSTEM_APPS.logos_vision).toBeDefined();
  });

  it('should mark only pulse as current app', () => {
    expect(ECOSYSTEM_APPS.pulse.isCurrentApp).toBe(true);
    expect(ECOSYSTEM_APPS.entomate.isCurrentApp).toBe(false);
    expect(ECOSYSTEM_APPS.logos_vision.isCurrentApp).toBe(false);
  });

  it('should have valid inbound URLs for all apps', () => {
    for (const key of Object.keys(ECOSYSTEM_APPS) as EcosystemAppName[]) {
      const app = ECOSYSTEM_APPS[key];
      expect(app.inboundUrl).toMatch(/^https:\/\/.*\.supabase\.co\/functions\/v1\/ecosystem-inbound$/);
    }
  });

  it('should have unique inbound URLs per app', () => {
    const urls = Object.values(ECOSYSTEM_APPS).map((a) => a.inboundUrl);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('should have brand colors as hex strings', () => {
    for (const app of Object.values(ECOSYSTEM_APPS)) {
      expect(app.brandColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('should have names and taglines for all apps', () => {
    for (const app of Object.values(ECOSYSTEM_APPS)) {
      expect(app.name).toBeTruthy();
      expect(app.tagline).toBeTruthy();
    }
  });

  it('should have pulse bot URL set', () => {
    expect(ECOSYSTEM_APPS.pulse.botUrl).toMatch(/ecosystem-bot$/);
  });

  it('getInboundUrl returns correct URL for each app', () => {
    expect(getInboundUrl('pulse')).toBe(ECOSYSTEM_APPS.pulse.inboundUrl);
    expect(getInboundUrl('entomate')).toBe(ECOSYSTEM_APPS.entomate.inboundUrl);
    expect(getInboundUrl('logos_vision')).toBe(ECOSYSTEM_APPS.logos_vision.inboundUrl);
  });

  it('PULSE_INBOUND_URL matches pulse config', () => {
    expect(PULSE_INBOUND_URL).toBe(ECOSYSTEM_APPS.pulse.inboundUrl);
  });

  it('ECOSYSTEM_APP_ORDER lists pulse first', () => {
    expect(ECOSYSTEM_APP_ORDER[0]).toBe('pulse');
    expect(ECOSYSTEM_APP_ORDER).toHaveLength(3);
    expect(ECOSYSTEM_APP_ORDER).toContain('entomate');
    expect(ECOSYSTEM_APP_ORDER).toContain('logos_vision');
  });
});

// =====================================================
// 2. BOT MESSAGE TYPE GUARD
// =====================================================

describe('isBotMessage type guard', () => {
  it('should return true for bot messages', () => {
    const botMsg = {
      id: '1',
      is_bot_message: true,
      bot_content: 'Hello from Entomate',
      bot_app: 'entomate',
      bot_message_type: 'text',
      bot_metadata: {},
      bot_actions: [],
    } as unknown as BotChannelMessage;

    expect(isBotMessage(botMsg)).toBe(true);
  });

  it('should return false for regular messages', () => {
    const msg = {
      id: '2',
      content: 'Hello',
      is_bot_message: false,
    } as unknown as ChannelMessage;

    expect(isBotMessage(msg)).toBe(false);
  });

  it('should return false when is_bot_message is undefined', () => {
    const msg = { id: '3', content: 'Hello' } as unknown as ChannelMessage;
    expect(isBotMessage(msg)).toBe(false);
  });
});

// =====================================================
// 3. INBOUND TOKEN VALIDATION LOGIC
// =====================================================

describe('Ecosystem Inbound — Token Validation', () => {
  // Simulates the inbound edge function's token lookup logic
  function validateToken(
    token: string | null,
    configs: Array<{ inbound_token: string; enabled: boolean; app_name: string }>
  ): { valid: boolean; config?: any; error?: string } {
    if (!token) return { valid: false, error: 'Missing X-Ecosystem-Token header' };
    const match = configs.find((c) => c.inbound_token === token && c.enabled);
    if (!match) return { valid: false, error: 'Unauthorized — invalid or disabled token' };
    return { valid: true, config: match };
  }

  const configs = [
    { inbound_token: 'abc123', enabled: true, app_name: 'entomate' },
    { inbound_token: 'def456', enabled: false, app_name: 'logos_vision' },
  ];

  it('should reject null token', () => {
    const result = validateToken(null, configs);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Missing');
  });

  it('should reject empty string token', () => {
    const result = validateToken('', configs);
    expect(result.valid).toBe(false);
  });

  it('should accept valid enabled token', () => {
    const result = validateToken('abc123', configs);
    expect(result.valid).toBe(true);
    expect(result.config?.app_name).toBe('entomate');
  });

  it('should reject valid token for disabled app', () => {
    const result = validateToken('def456', configs);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('invalid or disabled');
  });

  it('should reject unknown token', () => {
    const result = validateToken('unknown_token', configs);
    expect(result.valid).toBe(false);
  });
});

// =====================================================
// 4. EVENT ROUTING LOGIC
// =====================================================

describe('Ecosystem Inbound — Event Routing', () => {
  // Replicate the routeEvent switch-case logic for testing
  const SUPPORTED_EVENT_TYPES = [
    'meeting.processed',
    'meeting.action_items_extracted',
    'meeting.briefing',
    'context.request',
    'task.created',
    'task.updated',
    'task.completed',
    'message.bot_post',
    'notification.send',
    'agent.action_completed',
    'automation.triggered',
    'contact.updated',
    'contact.created',
    'heartbeat',
  ];

  function getHandlerName(eventType: string): string | null {
    const handlerMap: Record<string, string> = {
      'meeting.processed': 'handleMeetingProcessed',
      'meeting.action_items_extracted': 'handleActionItemsExtracted',
      'meeting.briefing': 'handleMeetingBriefing',
      'context.request': 'handleContextRequest',
      'task.created': 'handleTaskEvent',
      'task.updated': 'handleTaskEvent',
      'task.completed': 'handleTaskEvent',
      'message.bot_post': 'handleBotPost',
      'notification.send': 'handleNotification',
      'agent.action_completed': 'handleAgentAction',
      'automation.triggered': 'handleAutomationEvent',
      'contact.updated': 'handleContactEvent',
      'contact.created': 'handleContactEvent',
      'heartbeat': 'handleHeartbeat',
    };
    return handlerMap[eventType] || null;
  }

  it('should have handlers for all supported event types', () => {
    for (const type of SUPPORTED_EVENT_TYPES) {
      expect(getHandlerName(type)).toBeTruthy();
    }
  });

  it('should return null for unsupported event types', () => {
    expect(getHandlerName('unknown.event')).toBeNull();
    expect(getHandlerName('')).toBeNull();
    expect(getHandlerName('meeting.deleted')).toBeNull();
  });

  it('should route all task events to the same handler', () => {
    expect(getHandlerName('task.created')).toBe('handleTaskEvent');
    expect(getHandlerName('task.updated')).toBe('handleTaskEvent');
    expect(getHandlerName('task.completed')).toBe('handleTaskEvent');
  });

  it('should route all contact events to the same handler', () => {
    expect(getHandlerName('contact.updated')).toBe('handleContactEvent');
    expect(getHandlerName('contact.created')).toBe('handleContactEvent');
  });

  it('should route meeting events to distinct handlers', () => {
    const meetingHandlers = new Set([
      getHandlerName('meeting.processed'),
      getHandlerName('meeting.action_items_extracted'),
      getHandlerName('meeting.briefing'),
    ]);
    expect(meetingHandlers.size).toBe(3);
  });
});

// =====================================================
// 5. OUTBOUND EVENT WHITELIST
// =====================================================

describe('Ecosystem Outbound — Event Whitelist', () => {
  const ALLOWED_EVENTS = ['meeting.feedback'];

  function isAllowed(eventType: string): boolean {
    return ALLOWED_EVENTS.includes(eventType);
  }

  it('should allow meeting.feedback', () => {
    expect(isAllowed('meeting.feedback')).toBe(true);
  });

  it('should reject arbitrary event types', () => {
    expect(isAllowed('meeting.processed')).toBe(false);
    expect(isAllowed('task.created')).toBe(false);
    expect(isAllowed('notification.send')).toBe(false);
    expect(isAllowed('')).toBe(false);
    expect(isAllowed('heartbeat')).toBe(false);
  });

  it('should be case-sensitive', () => {
    expect(isAllowed('Meeting.Feedback')).toBe(false);
    expect(isAllowed('MEETING.FEEDBACK')).toBe(false);
  });
});

// =====================================================
// 6. OUTBOUND REQUEST VALIDATION
// =====================================================

describe('Ecosystem Outbound — Request Validation', () => {
  interface OutboundRequest {
    eventType: string;
    targetApp: 'entomate' | 'logos_vision';
    data: Record<string, any>;
  }

  function validateOutboundRequest(
    body: Partial<OutboundRequest>
  ): { valid: boolean; error?: string } {
    if (!body.eventType || !body.targetApp) {
      return { valid: false, error: 'eventType and targetApp are required' };
    }
    if (!['entomate', 'logos_vision'].includes(body.targetApp)) {
      return { valid: false, error: 'Invalid target app' };
    }
    return { valid: true };
  }

  it('should accept valid request', () => {
    expect(validateOutboundRequest({
      eventType: 'meeting.feedback',
      targetApp: 'entomate',
      data: { rating: 5 },
    }).valid).toBe(true);
  });

  it('should reject missing eventType', () => {
    const result = validateOutboundRequest({ targetApp: 'entomate', data: {} });
    expect(result.valid).toBe(false);
  });

  it('should reject missing targetApp', () => {
    const result = validateOutboundRequest({ eventType: 'meeting.feedback', data: {} });
    expect(result.valid).toBe(false);
  });

  it('should accept logos_vision as target', () => {
    expect(validateOutboundRequest({
      eventType: 'meeting.feedback',
      targetApp: 'logos_vision',
      data: {},
    }).valid).toBe(true);
  });
});

// =====================================================
// 7. HEARTBEAT LOGIC
// =====================================================

describe('Ecosystem Heartbeat', () => {
  function buildHeartbeatPayload(appName: string, serviceToken: string) {
    return {
      id: 'test-uuid',
      source: 'pulse',
      timestamp: new Date().toISOString(),
      serviceToken,
      eventType: 'heartbeat',
      data: { app: 'pulse' },
    };
  }

  it('should build valid heartbeat payload', () => {
    const payload = buildHeartbeatPayload('entomate', 'tok123');
    expect(payload.source).toBe('pulse');
    expect(payload.eventType).toBe('heartbeat');
    expect(payload.data.app).toBe('pulse');
    expect(payload.serviceToken).toBe('tok123');
    expect(payload.timestamp).toBeTruthy();
    expect(payload.id).toBeTruthy();
  });

  it('should include ISO timestamp', () => {
    const payload = buildHeartbeatPayload('entomate', 'tok123');
    expect(() => new Date(payload.timestamp)).not.toThrow();
    expect(new Date(payload.timestamp).toISOString()).toBe(payload.timestamp);
  });

  // Simulates heartbeat result aggregation
  function aggregateHeartbeatResults(
    configs: Array<{ app_name: string; enabled: boolean }>,
    responses: Map<string, boolean>
  ): { ok: string[]; failed: string[] } {
    const results = { ok: [] as string[], failed: [] as string[] };
    for (const config of configs.filter((c) => c.enabled)) {
      if (responses.get(config.app_name)) {
        results.ok.push(config.app_name);
      } else {
        results.failed.push(config.app_name);
      }
    }
    return results;
  }

  it('should aggregate all-ok results', () => {
    const configs = [
      { app_name: 'entomate', enabled: true },
      { app_name: 'logos_vision', enabled: true },
    ];
    const responses = new Map([['entomate', true], ['logos_vision', true]]);
    const result = aggregateHeartbeatResults(configs, responses);
    expect(result.ok).toEqual(['entomate', 'logos_vision']);
    expect(result.failed).toEqual([]);
  });

  it('should mark failed apps', () => {
    const configs = [
      { app_name: 'entomate', enabled: true },
      { app_name: 'logos_vision', enabled: true },
    ];
    const responses = new Map([['entomate', true], ['logos_vision', false]]);
    const result = aggregateHeartbeatResults(configs, responses);
    expect(result.ok).toEqual(['entomate']);
    expect(result.failed).toEqual(['logos_vision']);
  });

  it('should skip disabled configs', () => {
    const configs = [
      { app_name: 'entomate', enabled: true },
      { app_name: 'logos_vision', enabled: false },
    ];
    const responses = new Map([['entomate', true]]);
    const result = aggregateHeartbeatResults(configs, responses);
    expect(result.ok).toEqual(['entomate']);
    expect(result.failed).toEqual([]);
  });

  it('should handle no enabled configs', () => {
    const configs = [{ app_name: 'entomate', enabled: false }];
    const result = aggregateHeartbeatResults(configs, new Map());
    expect(result.ok).toEqual([]);
    expect(result.failed).toEqual([]);
  });
});

// =====================================================
// 8. BOT CHANNEL RESOLUTION LOGIC
// =====================================================

describe('Ecosystem Bot — Channel Resolution', () => {
  const CHANNEL_NAME_MAP: Record<string, { name: string; description: string }> = {
    meetings: { name: 'entomate-meetings', description: 'Meeting summaries from Entomate' },
    alerts: { name: 'entomate-alerts', description: 'Automation alerts from Entomate' },
    action_items: { name: 'entomate-tasks', description: 'Task assignments from Entomate' },
    automations: { name: 'entomate-automations', description: 'Automation updates from Entomate' },
  };

  function resolveChannelName(purpose: string): { name: string; description: string } {
    return CHANNEL_NAME_MAP[purpose] || {
      name: `entomate-${purpose}`,
      description: `Entomate ${purpose}`,
    };
  }

  it('should resolve known purposes to correct channel names', () => {
    expect(resolveChannelName('meetings').name).toBe('entomate-meetings');
    expect(resolveChannelName('alerts').name).toBe('entomate-alerts');
    expect(resolveChannelName('action_items').name).toBe('entomate-tasks');
    expect(resolveChannelName('automations').name).toBe('entomate-automations');
  });

  it('should generate fallback name for unknown purposes', () => {
    const result = resolveChannelName('custom_purpose');
    expect(result.name).toBe('entomate-custom_purpose');
    expect(result.description).toBe('Entomate custom_purpose');
  });

  it('should have descriptions for all known purposes', () => {
    for (const purpose of Object.keys(CHANNEL_NAME_MAP)) {
      expect(CHANNEL_NAME_MAP[purpose].description).toBeTruthy();
    }
  });
});

// =====================================================
// 9. BOT MESSAGE VALIDATION
// =====================================================

describe('Ecosystem Bot — Message Validation', () => {
  const ENTOMATE_BOT_ID = 'e0000000-0000-0000-0000-e00000000001';

  function validateBotMessageRequest(body: Record<string, any>): {
    valid: boolean;
    error?: string;
  } {
    if (!body.workspaceId) return { valid: false, error: 'workspaceId required' };
    if (!body.content) return { valid: false, error: 'content required' };
    if (!body.channelId && !body.channelPurpose) {
      return { valid: false, error: 'No channel specified or resolved' };
    }
    return { valid: true };
  }

  it('should accept valid message with channelId', () => {
    expect(validateBotMessageRequest({
      workspaceId: 'ws-1',
      content: 'Hello',
      channelId: 'ch-1',
    }).valid).toBe(true);
  });

  it('should accept valid message with channelPurpose', () => {
    expect(validateBotMessageRequest({
      workspaceId: 'ws-1',
      content: 'Hello',
      channelPurpose: 'meetings',
    }).valid).toBe(true);
  });

  it('should reject missing workspaceId', () => {
    const result = validateBotMessageRequest({ content: 'Hello', channelId: 'ch-1' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('workspaceId');
  });

  it('should reject missing content', () => {
    const result = validateBotMessageRequest({ workspaceId: 'ws-1', channelId: 'ch-1' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('content');
  });

  it('should reject missing channel info', () => {
    const result = validateBotMessageRequest({ workspaceId: 'ws-1', content: 'Hello' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('channel');
  });

  it('should use the correct Entomate bot ID', () => {
    expect(ENTOMATE_BOT_ID).toBe('e0000000-0000-0000-0000-e00000000001');
    // UUID format check
    expect(ENTOMATE_BOT_ID).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });
});

// =====================================================
// 10. BOT SETUP VALIDATION
// =====================================================

describe('Ecosystem Bot — Setup', () => {
  const DEFAULT_CHANNELS = [
    { purpose: 'meetings', name: 'entomate-meetings', description: 'Meeting summaries and action items' },
    { purpose: 'alerts', name: 'entomate-alerts', description: 'Automation alerts and notifications' },
    { purpose: 'action_items', name: 'entomate-tasks', description: 'Task assignments and updates' },
    { purpose: 'automations', name: 'entomate-automations', description: 'Automation workflow updates' },
  ];

  it('should define 4 default bot channels', () => {
    expect(DEFAULT_CHANNELS).toHaveLength(4);
  });

  it('should have unique purposes', () => {
    const purposes = DEFAULT_CHANNELS.map((c) => c.purpose);
    expect(new Set(purposes).size).toBe(4);
  });

  it('should have unique names', () => {
    const names = DEFAULT_CHANNELS.map((c) => c.name);
    expect(new Set(names).size).toBe(4);
  });

  it('should prefix all channel names with entomate-', () => {
    for (const ch of DEFAULT_CHANNELS) {
      expect(ch.name).toMatch(/^entomate-/);
    }
  });
});

// =====================================================
// 11. SENTIMENT INFERENCE (contextHandler logic)
// =====================================================

describe('Context Handler — Sentiment Inference', () => {
  // Replicated from contextHandler.ts for unit testing
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

  it('should detect positive sentiment', () => {
    expect(inferSentiment('Great work! Excellent result, I appreciate the effort.')).toBe('positive');
  });

  it('should detect negative sentiment', () => {
    expect(inferSentiment('There is a major issue and the problem is still blocked.')).toBe('negative');
  });

  it('should return neutral for balanced text', () => {
    expect(inferSentiment('The good news is the delay was resolved.')).toBe('neutral');
  });

  it('should return neutral for empty text', () => {
    expect(inferSentiment('')).toBe('neutral');
  });

  it('should return neutral for text with no sentiment words', () => {
    expect(inferSentiment('The meeting is scheduled for 3pm tomorrow.')).toBe('neutral');
  });

  it('should be case-insensitive', () => {
    expect(inferSentiment('GREAT EXCELLENT GOOD HAPPY')).toBe('positive');
    expect(inferSentiment('ISSUE PROBLEM CONCERN DELAY')).toBe('negative');
  });

  it('should require threshold of 2+ difference for non-neutral', () => {
    // 1 positive, 0 negative -> neutral (not > 0 + 1)
    expect(inferSentiment('That is good.')).toBe('neutral');
    // 2 positive, 0 negative -> positive (2 > 0 + 1)
    expect(inferSentiment('That is good and great.')).toBe('positive');
    // 1 negative, 0 positive -> neutral
    expect(inferSentiment('There is an issue.')).toBe('neutral');
    // 2 negative, 0 positive -> negative
    expect(inferSentiment('There is an issue and a problem.')).toBe('negative');
  });
});

// =====================================================
// 12. CONTEXT REQUEST VALIDATION
// =====================================================

describe('Context Handler — Request Validation', () => {
  interface ContextRequest {
    requestId: string;
    participants: string[];
    lookbackDays?: number;
    topics?: string[];
  }

  function validateContextRequest(data: Partial<ContextRequest>): {
    valid: boolean;
    hasParticipants: boolean;
    lookbackDays: number;
  } {
    return {
      valid: !!data.requestId,
      hasParticipants: (data.participants?.length ?? 0) > 0,
      lookbackDays: data.lookbackDays ?? 30,
    };
  }

  it('should accept valid request with participants', () => {
    const result = validateContextRequest({
      requestId: 'req-1',
      participants: ['Alice', 'Bob'],
    });
    expect(result.valid).toBe(true);
    expect(result.hasParticipants).toBe(true);
    expect(result.lookbackDays).toBe(30);
  });

  it('should reject missing requestId', () => {
    const result = validateContextRequest({ participants: ['Alice'] });
    expect(result.valid).toBe(false);
  });

  it('should default lookbackDays to 30', () => {
    const result = validateContextRequest({ requestId: 'r1', participants: [] });
    expect(result.lookbackDays).toBe(30);
  });

  it('should use custom lookbackDays', () => {
    const result = validateContextRequest({
      requestId: 'r1',
      participants: [],
      lookbackDays: 7,
    });
    expect(result.lookbackDays).toBe(7);
  });

  it('should report empty participants', () => {
    const result = validateContextRequest({ requestId: 'r1', participants: [] });
    expect(result.hasParticipants).toBe(false);
  });
});

// =====================================================
// 13. MEETING RECAP CONTENT BUILDING
// =====================================================

describe('Meeting Recap — Content Assembly', () => {
  // Replicates the dual-path content building from ecosystem-inbound handleMeetingProcessed
  function buildMeetingRecapContent(data: {
    meetingTitle: string;
    summary?: string;
    sentiment?: string;
    keyDecisions?: string[];
    actionItems?: Array<{ description: string; assignee?: string; dueDate?: string }>;
    intelligenceProfile?: { name: string; icon: string; slug: string };
    profileSections?: Array<{ title: string; content: string }>;
    outputQualityScore?: number;
  }): string {
    const { meetingTitle, summary, sentiment, keyDecisions, actionItems, intelligenceProfile, profileSections, outputQualityScore } = data;

    if (intelligenceProfile && profileSections?.length) {
      // MIP-enriched path
      const qualityStars = outputQualityScore != null
        ? '\u2605'.repeat(Math.round(outputQualityScore * 5)) + '\u2606'.repeat(5 - Math.round(outputQualityScore * 5))
        : '';
      return `## ${intelligenceProfile.icon} ${intelligenceProfile.name} — Meeting Summary: ${meetingTitle}`;
    }

    // Generic path
    const sentimentEmoji = sentiment === 'positive' ? '\uD83D\uDE0A' : sentiment === 'negative' ? '\uD83D\uDE14' : '\uD83D\uDE10';
    return `## \uD83D\uDCCB Meeting Summary: ${meetingTitle}\n\n**Sentiment:** ${sentimentEmoji} ${sentiment || 'neutral'}`;
  }

  it('should use MIP path when intelligenceProfile and profileSections present', () => {
    const content = buildMeetingRecapContent({
      meetingTitle: 'Sprint Review',
      intelligenceProfile: { name: 'Tech Lead', icon: '\uD83D\uDC68\u200D\uD83D\uDCBB', slug: 'tech-lead' },
      profileSections: [{ title: 'Summary', content: 'Good progress.' }],
    });
    expect(content).toContain('Tech Lead');
    expect(content).toContain('Sprint Review');
  });

  it('should use generic path when no MIP data', () => {
    const content = buildMeetingRecapContent({
      meetingTitle: 'Sprint Review',
      summary: 'We reviewed progress',
      sentiment: 'positive',
    });
    expect(content).toContain('Meeting Summary: Sprint Review');
    expect(content).toContain('positive');
  });

  it('should default sentiment to neutral', () => {
    const content = buildMeetingRecapContent({ meetingTitle: 'Meeting' });
    expect(content).toContain('neutral');
  });
});

// =====================================================
// 14. TASK EVENT STATUS RENDERING
// =====================================================

describe('Task Event — Status Rendering', () => {
  function renderTaskStatus(eventType: string): { emoji: string; verb: string } {
    const statusEmoji = eventType === 'task.completed' ? '\u2705' : eventType === 'task.created' ? '\uD83C\uDD95' : '\uD83D\uDD04';
    const verb = eventType === 'task.completed' ? 'completed' : eventType === 'task.created' ? 'created' : 'updated';
    return { emoji: statusEmoji, verb };
  }

  it('should render completed task', () => {
    const { emoji, verb } = renderTaskStatus('task.completed');
    expect(emoji).toBe('\u2705');
    expect(verb).toBe('completed');
  });

  it('should render created task', () => {
    const { emoji, verb } = renderTaskStatus('task.created');
    expect(emoji).toBe('\uD83C\uDD95');
    expect(verb).toBe('created');
  });

  it('should render updated task', () => {
    const { emoji, verb } = renderTaskStatus('task.updated');
    expect(emoji).toBe('\uD83D\uDD04');
    expect(verb).toBe('updated');
  });
});

// =====================================================
// 15. ECOSYSTEM EVENT LOGGING SHAPE
// =====================================================

describe('Ecosystem Event — Log Shape', () => {
  function buildInboundEventLog(event: {
    id: string;
    source: string;
    eventType: string;
    entityType?: string;
    entityId?: string;
    data: Record<string, any>;
  }) {
    return {
      event_id: event.id,
      source: event.source,
      event_type: event.eventType,
      entity_type: event.entityType,
      entity_id: event.entityId,
      direction: 'inbound' as const,
      status: 'received' as const,
      payload: event.data,
    };
  }

  function buildOutboundEventLog(eventId: string, eventType: string, data: Record<string, any>) {
    return {
      event_id: eventId,
      source: 'pulse',
      event_type: eventType,
      direction: 'outbound' as const,
      status: 'processed' as const,
      payload: data,
    };
  }

  it('should build valid inbound event log', () => {
    const log = buildInboundEventLog({
      id: 'evt-1',
      source: 'entomate',
      eventType: 'meeting.processed',
      entityType: 'meeting',
      entityId: 'mtg-1',
      data: { workspaceId: 'ws-1' },
    });
    expect(log.direction).toBe('inbound');
    expect(log.status).toBe('received');
    expect(log.event_id).toBe('evt-1');
    expect(log.source).toBe('entomate');
    expect(log.event_type).toBe('meeting.processed');
    expect(log.entity_type).toBe('meeting');
    expect(log.payload).toEqual({ workspaceId: 'ws-1' });
  });

  it('should build valid outbound event log', () => {
    const log = buildOutboundEventLog('evt-2', 'meeting.feedback', { rating: 5 });
    expect(log.direction).toBe('outbound');
    expect(log.status).toBe('processed');
    expect(log.source).toBe('pulse');
    expect(log.event_type).toBe('meeting.feedback');
    expect(log.payload).toEqual({ rating: 5 });
  });

  it('should handle optional entity fields', () => {
    const log = buildInboundEventLog({
      id: 'evt-3',
      source: 'logos_vision',
      eventType: 'heartbeat',
      data: { app: 'logos_vision' },
    });
    expect(log.entity_type).toBeUndefined();
    expect(log.entity_id).toBeUndefined();
  });
});

// =====================================================
// 16. ECOSYSTEM CONFIG FEATURE FLAGS
// =====================================================

describe('Ecosystem Config — Feature Flags', () => {
  const DEFAULT_FEATURES: Record<string, boolean> = {
    bot_messages: true,
    sync_tasks: true,
    notifications: true,
    meeting_recaps: true,
    contact_sync: true,
    donation_alerts: true,
  };

  function isFeatureEnabled(
    features: Record<string, boolean> | null,
    feature: string
  ): boolean {
    return features?.[feature] ?? false;
  }

  it('should return true for enabled features', () => {
    expect(isFeatureEnabled(DEFAULT_FEATURES, 'bot_messages')).toBe(true);
    expect(isFeatureEnabled(DEFAULT_FEATURES, 'meeting_recaps')).toBe(true);
  });

  it('should return false for unknown features', () => {
    expect(isFeatureEnabled(DEFAULT_FEATURES, 'video_calls')).toBe(false);
  });

  it('should return false for null features object', () => {
    expect(isFeatureEnabled(null, 'bot_messages')).toBe(false);
  });

  it('should respect explicitly disabled features', () => {
    const features = { ...DEFAULT_FEATURES, sync_tasks: false };
    expect(isFeatureEnabled(features, 'sync_tasks')).toBe(false);
  });
});

// =====================================================
// 17. ENTITY MAP — Cross-App Linking
// =====================================================

describe('Ecosystem Entity Map', () => {
  function buildEntityMapEntry(
    localType: string,
    localId: string,
    remoteApp: string,
    remoteType: string,
    remoteId: string
  ) {
    return {
      local_entity_type: localType,
      local_entity_id: localId,
      remote_app: remoteApp,
      remote_entity_type: remoteType,
      remote_entity_id: remoteId,
    };
  }

  it('should build correct entity map for contact sync', () => {
    const entry = buildEntityMapEntry('contact', 'local-uuid', 'entomate', 'contact', 'remote-uuid');
    expect(entry.local_entity_type).toBe('contact');
    expect(entry.remote_app).toBe('entomate');
    expect(entry.remote_entity_id).toBe('remote-uuid');
  });

  it('should create unique constraint key', () => {
    const entry = buildEntityMapEntry('contact', 'uuid-1', 'logos_vision', 'contact', 'lv-uuid');
    const uniqueKey = `${entry.local_entity_type}:${entry.local_entity_id}:${entry.remote_app}`;
    expect(uniqueKey).toBe('contact:uuid-1:logos_vision');
  });
});

// =====================================================
// 18. GATEWAY KEY HEADER LOGIC
// =====================================================

describe('Ecosystem — Gateway Key Header', () => {
  function buildOutboundHeaders(
    serviceToken: string,
    features?: { gateway_key?: string }
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Ecosystem-Token': serviceToken,
    };
    if (features?.gateway_key) {
      headers['Authorization'] = `Bearer ${features.gateway_key}`;
    }
    return headers;
  }

  it('should always include X-Ecosystem-Token', () => {
    const headers = buildOutboundHeaders('tok123');
    expect(headers['X-Ecosystem-Token']).toBe('tok123');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('should add Authorization when gateway_key exists', () => {
    const headers = buildOutboundHeaders('tok123', { gateway_key: 'anon-key-abc' });
    expect(headers['Authorization']).toBe('Bearer anon-key-abc');
  });

  it('should NOT add Authorization when gateway_key is absent', () => {
    const headers = buildOutboundHeaders('tok123');
    expect(headers['Authorization']).toBeUndefined();
  });

  it('should NOT add Authorization for empty gateway_key', () => {
    const headers = buildOutboundHeaders('tok123', { gateway_key: '' });
    expect(headers['Authorization']).toBeUndefined();
  });
});

// =====================================================
// 19. CORS HEADERS
// =====================================================

describe('Ecosystem — CORS Headers', () => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ecosystem-token',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  it('should allow all origins', () => {
    expect(corsHeaders['Access-Control-Allow-Origin']).toBe('*');
  });

  it('should allow x-ecosystem-token header', () => {
    expect(corsHeaders['Access-Control-Allow-Headers']).toContain('x-ecosystem-token');
  });

  it('should allow GET, POST, and OPTIONS methods', () => {
    expect(corsHeaders['Access-Control-Allow-Methods']).toContain('GET');
    expect(corsHeaders['Access-Control-Allow-Methods']).toContain('POST');
    expect(corsHeaders['Access-Control-Allow-Methods']).toContain('OPTIONS');
  });

  it('should allow authorization header for JWT auth', () => {
    expect(corsHeaders['Access-Control-Allow-Headers']).toContain('authorization');
  });
});

// =====================================================
// 20. MEETING BRIEFING — Time Calculation
// =====================================================

describe('Meeting Briefing — Time Calculation', () => {
  function computeTimeLabel(scheduledAt: string | null): string {
    if (!scheduledAt) return '';
    const meetingTime = new Date(scheduledAt);
    const now = new Date();
    const diffMs = meetingTime.getTime() - now.getTime();
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin > 0 && diffMin < 60) return `Starting in ${diffMin} minute${diffMin !== 1 ? 's' : ''}`;
    if (diffMin >= 60) return `Starting in ${Math.round(diffMin / 60)} hour${Math.round(diffMin / 60) !== 1 ? 's' : ''}`;
    return 'Starting soon';
  }

  it('should return empty for null', () => {
    expect(computeTimeLabel(null)).toBe('');
  });

  it('should say "Starting soon" for past meetings', () => {
    const past = new Date(Date.now() - 60000).toISOString();
    expect(computeTimeLabel(past)).toBe('Starting soon');
  });

  it('should show minutes for <60min away', () => {
    const future = new Date(Date.now() + 30 * 60000).toISOString();
    const label = computeTimeLabel(future);
    expect(label).toMatch(/Starting in \d+ minutes?/);
  });

  it('should show hours for >=60min away', () => {
    const future = new Date(Date.now() + 120 * 60000).toISOString();
    const label = computeTimeLabel(future);
    expect(label).toMatch(/Starting in \d+ hours?/);
  });

  it('should use singular "minute" for 1 minute', () => {
    const future = new Date(Date.now() + 1.4 * 60000).toISOString();
    const label = computeTimeLabel(future);
    expect(label).toBe('Starting in 1 minute');
  });

  it('should use singular "hour" for 1 hour', () => {
    const future = new Date(Date.now() + 60 * 60000).toISOString();
    const label = computeTimeLabel(future);
    expect(label).toBe('Starting in 1 hour');
  });
});

// =====================================================
// 21. NOTIFICATION BUILDING
// =====================================================

describe('Ecosystem — Notification Building', () => {
  function buildNotifications(
    userIds: string[],
    content: string,
    metadata: Record<string, any>
  ) {
    return userIds.map((userId) => ({
      user_id: userId,
      type: 'ecosystem',
      content: content?.slice(0, 200) || 'New notification from Entomate',
      metadata: { source: 'entomate', ...metadata },
      read: false,
    }));
  }

  it('should create one notification per user', () => {
    const notifs = buildNotifications(['u1', 'u2', 'u3'], 'Hello', {});
    expect(notifs).toHaveLength(3);
    expect(notifs.map((n) => n.user_id)).toEqual(['u1', 'u2', 'u3']);
  });

  it('should truncate content to 200 characters', () => {
    const longContent = 'A'.repeat(500);
    const notifs = buildNotifications(['u1'], longContent, {});
    expect(notifs[0].content).toHaveLength(200);
  });

  it('should set type to ecosystem', () => {
    const notifs = buildNotifications(['u1'], 'Hello', {});
    expect(notifs[0].type).toBe('ecosystem');
  });

  it('should include source in metadata', () => {
    const notifs = buildNotifications(['u1'], 'Hello', { meetingId: 'm1' });
    expect(notifs[0].metadata.source).toBe('entomate');
    expect(notifs[0].metadata.meetingId).toBe('m1');
  });

  it('should default content for empty string', () => {
    const notifs = buildNotifications(['u1'], '', {});
    expect(notifs[0].content).toBe('New notification from Entomate');
  });

  it('should set read to false', () => {
    const notifs = buildNotifications(['u1'], 'Hello', {});
    expect(notifs[0].read).toBe(false);
  });
});

// =====================================================
// 22. QUALITY SCORE RENDERING
// =====================================================

describe('Meeting Recap — Quality Score Stars', () => {
  function renderQualityStars(score: number | null | undefined): string {
    if (score == null) return '';
    const filled = Math.round(score * 5);
    return '\u2605'.repeat(filled) + '\u2606'.repeat(5 - filled);
  }

  it('should render 5 stars for score 1.0', () => {
    expect(renderQualityStars(1.0)).toBe('\u2605\u2605\u2605\u2605\u2605');
  });

  it('should render 0 stars for score 0', () => {
    expect(renderQualityStars(0)).toBe('\u2606\u2606\u2606\u2606\u2606');
  });

  it('should render 3 stars for score 0.6', () => {
    expect(renderQualityStars(0.6)).toBe('\u2605\u2605\u2605\u2606\u2606');
  });

  it('should return empty for null', () => {
    expect(renderQualityStars(null)).toBe('');
  });

  it('should return empty for undefined', () => {
    expect(renderQualityStars(undefined)).toBe('');
  });

  it('should always total 5 characters', () => {
    for (const score of [0, 0.2, 0.4, 0.6, 0.8, 1.0]) {
      expect(renderQualityStars(score)).toHaveLength(5);
    }
  });
});
