// src/services/__tests__/messageAutoResponseService.test.ts
// Unit tests for Message Auto-Response Service

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { messageAutoResponseService } from '../messageAutoResponseService';
import type { ChannelMessage } from '../../types/messages';
import type { AutoResponseRule } from '../messageAutoResponseService';
import { createSupabaseMock, createInsertMock, createUpdateMock, createDeleteMock } from '../../test/utils/supabaseMock';

// Mock Supabase module
let mockSupabase: any;

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
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

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorageMock.clear();

    // Reset the mock
    const { supabase } = await import('../supabase');
    mockSupabase = supabase;
  });

  describe('checkAutoResponse', () => {
    it('should return null when no rules are enabled', async () => {
      const autoResponseMock = createSupabaseMock({
        table: 'message_auto_responses',
        data: [],
      });

      mockSupabase.from.mockImplementation((tableName: string) => {
        if (tableName === 'message_auto_responses') {
          return autoResponseMock.chainMock;
        }
        return createSupabaseMock({ table: tableName, data: [] }).chainMock;
      });

      const response = await messageAutoResponseService.checkAutoResponse(
        mockMessage,
        'channel-1',
        'user-2'
      );

      expect(response).toBeNull();
    });

    it('should return response when rule matches', async () => {
      const autoResponseMock = createSupabaseMock({
        table: 'message_auto_responses',
        data: [mockRule],
      });

      mockSupabase.from.mockImplementation((tableName: string) => {
        if (tableName === 'message_auto_responses') {
          return autoResponseMock.chainMock;
        }
        if (tableName === 'message_auto_response_log') {
          return createSupabaseMock({ table: tableName, data: [] }).chainMock;
        }
        return createSupabaseMock({ table: tableName, data: [] }).chainMock;
      });

      const response = await messageAutoResponseService.checkAutoResponse(
        mockMessage,
        'channel-1',
        'user-2'
      );

      expect(response).toContain('Thanks for reaching out');
    });

    it('should substitute variables in template', async () => {
      const ruleWithVars = {
        ...mockRule,
        response_template: 'Hi {sender_name}, I received your message on {date}.',
      };

      const autoResponseMock = createSupabaseMock({
        table: 'message_auto_responses',
        data: [ruleWithVars],
      });

      mockSupabase.from.mockImplementation((tableName: string) => {
        if (tableName === 'message_auto_responses') {
          return autoResponseMock.chainMock;
        }
        if (tableName === 'message_auto_response_log') {
          return createSupabaseMock({ table: tableName, data: [] }).chainMock;
        }
        return createSupabaseMock({ table: tableName, data: [] }).chainMock;
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
      const highPriorityRule = {
        ...mockRule,
        id: 'rule-2',
        priority: 20,
        response_template: 'High priority response',
      };

      const autoResponseMock = createSupabaseMock({
        table: 'message_auto_responses',
        data: [highPriorityRule, mockRule],
      });

      mockSupabase.from.mockImplementation((tableName: string) => {
        if (tableName === 'message_auto_responses') {
          return autoResponseMock.chainMock;
        }
        if (tableName === 'message_auto_response_log') {
          return createSupabaseMock({ table: tableName, data: [] }).chainMock;
        }
        return createSupabaseMock({ table: tableName, data: [] }).chainMock;
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
      const autoResponseMock = createSupabaseMock({
        table: 'message_auto_responses',
        data: [mockRule],
      });

      mockSupabase.from.mockImplementation((tableName: string) => {
        if (tableName === 'message_auto_responses') {
          return autoResponseMock.chainMock;
        }
        if (tableName === 'message_auto_response_log') {
          return createSupabaseMock({ table: tableName, data: [] }).chainMock;
        }
        return createSupabaseMock({ table: tableName, data: [] }).chainMock;
      });

      const response = await messageAutoResponseService.checkAutoResponse(
        mockMessage,
        'channel-1',
        'user-2'
      );

      expect(response).toBeTruthy();
    });

    it('should not match when keyword is absent', async () => {
      const ruleWithDifferentKeyword = {
        ...mockRule,
        trigger_conditions: { keywords: ['meeting', 'schedule'] },
      };

      const autoResponseMock = createSupabaseMock({
        table: 'message_auto_responses',
        data: [ruleWithDifferentKeyword],
      });

      mockSupabase.from.mockImplementation((tableName: string) => {
        if (tableName === 'message_auto_responses') {
          return autoResponseMock.chainMock;
        }
        return createSupabaseMock({ table: tableName, data: [] }).chainMock;
      });

      const response = await messageAutoResponseService.checkAutoResponse(
        mockMessage,
        'channel-1',
        'user-2'
      );

      expect(response).toBeNull();
    });

    it('should match specific channel', async () => {
      const channelSpecificRule = {
        ...mockRule,
        trigger_conditions: {
          channels: ['channel-1'],
        },
      };

      const autoResponseMock = createSupabaseMock({
        table: 'message_auto_responses',
        data: [channelSpecificRule],
      });

      mockSupabase.from.mockImplementation((tableName: string) => {
        if (tableName === 'message_auto_responses') {
          return autoResponseMock.chainMock;
        }
        if (tableName === 'message_auto_response_log') {
          return createSupabaseMock({ table: tableName, data: [] }).chainMock;
        }
        return createSupabaseMock({ table: tableName, data: [] }).chainMock;
      });

      const response = await messageAutoResponseService.checkAutoResponse(
        mockMessage,
        'channel-1',
        'user-2'
      );

      expect(response).toBeTruthy();
    });

    it('should not match wrong channel', async () => {
      const channelSpecificRule = {
        ...mockRule,
        trigger_conditions: {
          channels: ['channel-2'],
        },
      };

      const autoResponseMock = createSupabaseMock({
        table: 'message_auto_responses',
        data: [channelSpecificRule],
      });

      mockSupabase.from.mockImplementation((tableName: string) => {
        if (tableName === 'message_auto_responses') {
          return autoResponseMock.chainMock;
        }
        return createSupabaseMock({ table: tableName, data: [] }).chainMock;
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
      const { processWithModel } = await import('../geminiService');

      localStorageMock.setItem('gemini_api_key', 'test-api-key');

      const aiRule = {
        ...mockRule,
        ai_customize: true,
      };

      const autoResponseMock = createSupabaseMock({
        table: 'message_auto_responses',
        data: [aiRule],
      });

      mockSupabase.from.mockImplementation((tableName: string) => {
        if (tableName === 'message_auto_responses') {
          return autoResponseMock.chainMock;
        }
        if (tableName === 'message_auto_response_log') {
          return createSupabaseMock({ table: tableName, data: [] }).chainMock;
        }
        return createSupabaseMock({ table: tableName, data: [] }).chainMock;
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
      const { processWithModel } = await import('../geminiService');

      localStorageMock.setItem('gemini_api_key', 'test-api-key');

      const aiRule = {
        ...mockRule,
        ai_customize: true,
      };

      const autoResponseMock = createSupabaseMock({
        table: 'message_auto_responses',
        data: [aiRule],
      });

      mockSupabase.from.mockImplementation((tableName: string) => {
        if (tableName === 'message_auto_responses') {
          return autoResponseMock.chainMock;
        }
        if (tableName === 'message_auto_response_log') {
          return createSupabaseMock({ table: tableName, data: [] }).chainMock;
        }
        return createSupabaseMock({ table: tableName, data: [] }).chainMock;
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
      const newRule = {
        rule_type: 'out_of_office' as const,
        enabled: true,
        trigger_conditions: { timeRange: { start: '18:00', end: '09:00' } },
        response_template: 'Out of office',
        ai_customize: false,
        priority: 5,
      };

      const createdRule = {
        id: 'rule-new',
        user_id: 'user-1',
        times_triggered: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...newRule,
      };

      // Create insert mock
      const insertMockObj = createInsertMock(createdRule);

      mockSupabase.from.mockImplementation((tableName: string) => {
        if (tableName === 'message_auto_responses') {
          return {
            insert: insertMockObj.insert,
          };
        }
        return createSupabaseMock({ table: tableName, data: [] }).chainMock;
      });

      const result = await messageAutoResponseService.createRule('user-1', newRule);

      expect(result).toBeTruthy();
      expect(result?.rule_type).toBe('out_of_office');
    });

    it('should toggle rule enabled status', async () => {
      const updateMockObj = createUpdateMock();

      mockSupabase.from.mockImplementation((tableName: string) => {
        if (tableName === 'message_auto_responses') {
          return {
            update: updateMockObj.update,
          };
        }
        return createSupabaseMock({ table: tableName, data: [] }).chainMock;
      });

      const result = await messageAutoResponseService.toggleRule('rule-1', false);

      expect(result).toBe(true);
    });

    it('should delete a rule', async () => {
      const deleteMockObj = createDeleteMock();

      mockSupabase.from.mockImplementation((tableName: string) => {
        if (tableName === 'message_auto_responses') {
          return {
            delete: deleteMockObj.delete,
          };
        }
        return createSupabaseMock({ table: tableName, data: [] }).chainMock;
      });

      const result = await messageAutoResponseService.deleteRule('rule-1');

      expect(result).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits', async () => {
      const autoResponseMock = createSupabaseMock({
        table: 'message_auto_responses',
        data: [mockRule],
      });

      mockSupabase.from.mockImplementation((tableName: string) => {
        if (tableName === 'message_auto_responses') {
          return autoResponseMock.chainMock;
        }
        if (tableName === 'message_auto_response_log') {
          return createSupabaseMock({ table: tableName, data: [] }).chainMock;
        }
        return createSupabaseMock({ table: tableName, data: [] }).chainMock;
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
      const rulesMock = createSupabaseMock({
        table: 'message_auto_responses',
        data: [{ id: 'rule-1' }, { id: 'rule-2' }],
      });

      const logsMock = createSupabaseMock({
        table: 'message_auto_response_log',
        data: [
          { rule_id: 'rule-1', ai_customized: true },
          { rule_id: 'rule-1', ai_customized: false },
          { rule_id: 'rule-2', ai_customized: true },
        ],
      });

      mockSupabase.from.mockImplementation((tableName: string) => {
        if (tableName === 'message_auto_responses') {
          return rulesMock.chainMock;
        }
        if (tableName === 'message_auto_response_log') {
          return logsMock.chainMock;
        }
        return createSupabaseMock({ table: tableName, data: [] }).chainMock;
      });

      const analytics = await messageAutoResponseService.getAnalytics('user-1', 30);

      expect(analytics.totalResponses).toBe(3);
      expect(analytics.responsesByRule['rule-1']).toBe(2);
      expect(analytics.responsesByRule['rule-2']).toBe(1);
      expect(analytics.aiCustomizationRate).toBeCloseTo(0.666, 2);
    });
  });
});
