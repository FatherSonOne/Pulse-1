// src/services/__tests__/messageAutoResponseService.test.ts
// Unit tests for Message Auto-Response Service

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { messageAutoResponseService } from '../messageAutoResponseService';
import type { ChannelMessage } from '../../types/messages';
import type { AutoResponseRule } from '../messageAutoResponseService';

// Mock Supabase
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
    })),
  },
}));

// Mock Gemini Service
vi.mock('../geminiService', () => ({
  processWithModel: vi.fn(),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('MessageAutoResponseService', () => {
  const mockMessage: ChannelMessage = {
    id: 'msg-1',
    channel_id: 'channel-1',
    sender_id: 'user-1',
    sender_name: 'John Doe',
    content: 'Can you help me with this urgent issue?',
    message_type: 'text',
    created_at: new Date().toISOString(),
    is_pinned: false,
    reactions: {},
  };

  const mockRule: AutoResponseRule = {
    id: 'rule-1',
    user_id: 'user-2',
    rule_type: 'rule_based',
    enabled: true,
    trigger_conditions: {
      keywords: ['help', 'urgent'],
    },
    response_template: 'Thanks for reaching out! I will get back to you shortly.',
    ai_customize: false,
    priority: 10,
    times_triggered: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  describe('checkAutoResponse', () => {
    it('should return null when no rules are enabled', async () => {
      const { supabase } = await import('../supabase');
      vi.mocked(supabase.from('message_auto_responses').select().eq().order as any).mockResolvedValue({
        data: [],
        error: null,
      });

      const response = await messageAutoResponseService.checkAutoResponse(
        mockMessage,
        'channel-1',
        'user-2'
      );

      expect(response).toBeNull();
    });

    it('should return response when rule matches', async () => {
      const { supabase } = await import('../supabase');
      vi.mocked(supabase.from('message_auto_responses').select().eq().order as any).mockResolvedValue({
        data: [mockRule],
        error: null,
      });

      const response = await messageAutoResponseService.checkAutoResponse(
        mockMessage,
        'channel-1',
        'user-2'
      );

      expect(response).toContain('Thanks for reaching out');
    });

    it('should substitute variables in template', async () => {
      const { supabase } = await import('../supabase');
      const ruleWithVars = {
        ...mockRule,
        response_template: 'Hi {sender_name}, I received your message on {date}.',
      };

      vi.mocked(supabase.from('message_auto_responses').select().eq().order as any).mockResolvedValue({
        data: [ruleWithVars],
        error: null,
      });

      const response = await messageAutoResponseService.checkAutoResponse(
        mockMessage,
        'channel-1',
        'user-2'
      );

      expect(response).toContain('John Doe');
      expect(response).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/); // Date pattern
    });

    it('should respect priority ordering', async () => {
      const { supabase } = await import('../supabase');
      const highPriorityRule = {
        ...mockRule,
        id: 'rule-2',
        priority: 20,
        response_template: 'High priority response',
      };

      vi.mocked(supabase.from('message_auto_responses').select().eq().order as any).mockResolvedValue({
        data: [highPriorityRule, mockRule],
        error: null,
      });

      const response = await messageAutoResponseService.checkAutoResponse(
        mockMessage,
        'channel-1',
        'user-2'
      );

      expect(response).toBe('High priority response');
    });
  });

  describe('Rule Matching', () => {
    it('should match keyword in message content', async () => {
      const { supabase } = await import('../supabase');
      vi.mocked(supabase.from('message_auto_responses').select().eq().order as any).mockResolvedValue({
        data: [mockRule],
        error: null,
      });

      const response = await messageAutoResponseService.checkAutoResponse(
        mockMessage,
        'channel-1',
        'user-2'
      );

      expect(response).toBeTruthy();
    });

    it('should not match when keyword is absent', async () => {
      const { supabase } = await import('../supabase');
      const ruleWithDifferentKeyword = {
        ...mockRule,
        trigger_conditions: { keywords: ['meeting', 'schedule'] },
      };

      vi.mocked(supabase.from('message_auto_responses').select().eq().order as any).mockResolvedValue({
        data: [ruleWithDifferentKeyword],
        error: null,
      });

      const response = await messageAutoResponseService.checkAutoResponse(
        mockMessage,
        'channel-1',
        'user-2'
      );

      expect(response).toBeNull();
    });

    it('should match specific channel', async () => {
      const { supabase } = await import('../supabase');
      const channelSpecificRule = {
        ...mockRule,
        trigger_conditions: {
          channels: ['channel-1'],
        },
      };

      vi.mocked(supabase.from('message_auto_responses').select().eq().order as any).mockResolvedValue({
        data: [channelSpecificRule],
        error: null,
      });

      const response = await messageAutoResponseService.checkAutoResponse(
        mockMessage,
        'channel-1',
        'user-2'
      );

      expect(response).toBeTruthy();
    });

    it('should not match wrong channel', async () => {
      const { supabase } = await import('../supabase');
      const channelSpecificRule = {
        ...mockRule,
        trigger_conditions: {
          channels: ['channel-2'],
        },
      };

      vi.mocked(supabase.from('message_auto_responses').select().eq().order as any).mockResolvedValue({
        data: [channelSpecificRule],
        error: null,
      });

      const response = await messageAutoResponseService.checkAutoResponse(
        mockMessage,
        'channel-1',
        'user-2'
      );

      expect(response).toBeNull();
    });
  });

  describe('AI Customization', () => {
    it('should use AI to customize response when enabled', async () => {
      const { supabase } = await import('../supabase');
      const { processWithModel } = await import('../geminiService');

      localStorageMock.setItem('gemini_api_key', 'test-api-key');

      const aiRule = {
        ...mockRule,
        ai_customize: true,
      };

      vi.mocked(supabase.from('message_auto_responses').select().eq().order as any).mockResolvedValue({
        data: [aiRule],
        error: null,
      });

      vi.mocked(processWithModel).mockResolvedValue('AI customized response');

      const response = await messageAutoResponseService.checkAutoResponse(
        mockMessage,
        'channel-1',
        'user-2'
      );

      expect(processWithModel).toHaveBeenCalled();
      expect(response).toBe('AI customized response');
    });

    it('should fallback to template if AI fails', async () => {
      const { supabase } = await import('../supabase');
      const { processWithModel } = await import('../geminiService');

      localStorageMock.setItem('gemini_api_key', 'test-api-key');

      const aiRule = {
        ...mockRule,
        ai_customize: true,
      };

      vi.mocked(supabase.from('message_auto_responses').select().eq().order as any).mockResolvedValue({
        data: [aiRule],
        error: null,
      });

      vi.mocked(processWithModel).mockRejectedValue(new Error('AI error'));

      const response = await messageAutoResponseService.checkAutoResponse(
        mockMessage,
        'channel-1',
        'user-2'
      );

      expect(response).toBe(mockRule.response_template);
    });
  });

  describe('Rule Management', () => {
    it('should create a new rule', async () => {
      const { supabase } = await import('../supabase');
      const newRule = {
        rule_type: 'out_of_office' as const,
        enabled: true,
        trigger_conditions: { timeRange: { start: '18:00', end: '09:00' } },
        response_template: 'Out of office',
        ai_customize: false,
        priority: 5,
      };

      vi.mocked(supabase.from('message_auto_responses').insert().select().single as any).mockResolvedValue({
        data: { id: 'rule-new', ...newRule, user_id: 'user-1' },
        error: null,
      });

      const result = await messageAutoResponseService.createRule('user-1', newRule);

      expect(result).toBeTruthy();
      expect(result?.rule_type).toBe('out_of_office');
    });

    it('should toggle rule enabled status', async () => {
      const { supabase } = await import('../supabase');

      vi.mocked(supabase.from('message_auto_responses').update().eq as any).mockResolvedValue({
        error: null,
      });

      const result = await messageAutoResponseService.toggleRule('rule-1', false);

      expect(result).toBe(true);
    });

    it('should delete a rule', async () => {
      const { supabase } = await import('../supabase');

      vi.mocked(supabase.from('message_auto_responses').delete().eq as any).mockResolvedValue({
        error: null,
      });

      const result = await messageAutoResponseService.deleteRule('rule-1');

      expect(result).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits', async () => {
      const { supabase } = await import('../supabase');
      vi.mocked(supabase.from('message_auto_responses').select().eq().order as any).mockResolvedValue({
        data: [mockRule],
        error: null,
      });

      // Send 11 responses quickly (limit is 10 per minute)
      const responses = [];
      for (let i = 0; i < 11; i++) {
        const response = await messageAutoResponseService.checkAutoResponse(
          { ...mockMessage, id: `msg-${i}` },
          'channel-1',
          'user-2'
        );
        responses.push(response);
      }

      // Last response should be rate limited (null)
      expect(responses[10]).toBeNull();
    });
  });

  describe('Analytics', () => {
    it('should return analytics for user rules', async () => {
      const { supabase } = await import('../supabase');

      vi.mocked(supabase.from('message_auto_responses').select().eq as any).mockResolvedValue({
        data: [{ id: 'rule-1' }, { id: 'rule-2' }],
        error: null,
      });

      vi.mocked(supabase.from('message_auto_response_log').select().in().gte as any).mockResolvedValue({
        data: [
          { rule_id: 'rule-1', ai_customized: true },
          { rule_id: 'rule-1', ai_customized: false },
          { rule_id: 'rule-2', ai_customized: true },
        ],
        error: null,
      });

      const analytics = await messageAutoResponseService.getAnalytics('user-1', 30);

      expect(analytics.totalResponses).toBe(3);
      expect(analytics.responsesByRule['rule-1']).toBe(2);
      expect(analytics.responsesByRule['rule-2']).toBe(1);
      expect(analytics.aiCustomizationRate).toBeCloseTo(0.666, 2);
    });
  });
});
