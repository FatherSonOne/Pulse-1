// src/services/__tests__/messageSummarizationService.test.ts
// Unit tests for Message Summarization Service

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { messageSummarizationService } from '../messageSummarizationService';
import type { ChannelMessage } from '../../types/messages';

// Mock dependencies
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  },
}));

vi.mock('../geminiService', () => ({
  processWithModel: vi.fn(),
}));

vi.mock('../messageChannelService', () => ({
  messageChannelService: {
    getThreadMessages: vi.fn(),
    getChannels: vi.fn(),
  },
}));

describe('MessageSummarizationService', () => {
  const mockMessages: ChannelMessage[] = [
    {
      id: 'msg-1',
      channel_id: 'channel-1',
      sender_id: 'user-1',
      sender_name: 'Alice',
      content: 'We need to discuss the Q1 budget',
      message_type: 'text',
      created_at: new Date('2024-01-15T10:00:00Z').toISOString(),
      is_pinned: false,
      reactions: {},
    },
    {
      id: 'msg-2',
      channel_id: 'channel-1',
      sender_id: 'user-2',
      sender_name: 'Bob',
      content: 'I agree. Let me prepare the report by Friday.',
      message_type: 'text',
      created_at: new Date('2024-01-15T10:05:00Z').toISOString(),
      is_pinned: false,
      reactions: {},
    },
    {
      id: 'msg-3',
      channel_id: 'channel-1',
      sender_id: 'user-1',
      sender_name: 'Alice',
      content: 'Perfect. We decided to increase marketing budget by 20%.',
      message_type: 'text',
      created_at: new Date('2024-01-15T10:10:00Z').toISOString(),
      is_pinned: false,
      reactions: {},
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('summarizeThread', () => {
    it('should generate thread summary with all components', async () => {
      const { messageChannelService } = await import('../messageChannelService');
      const { processWithModel } = await import('../geminiService');

      vi.mocked(messageChannelService.getThreadMessages).mockResolvedValue(mockMessages);

      const mockAIResponse = JSON.stringify({
        summary: 'Discussion about Q1 budget with decision to increase marketing spend',
        keyPoints: ['Q1 budget review', 'Marketing budget increase', 'Report deadline Friday'],
        actionItems: ['Prepare budget report by Friday'],
        decisions: ['Increase marketing budget by 20%'],
        participants: ['Alice', 'Bob'],
      });

      vi.mocked(processWithModel).mockResolvedValue(mockAIResponse);

      const summary = await messageSummarizationService.summarizeThread(
        'channel-1',
        'thread-1',
        'user-1',
        'test-api-key'
      );

      expect(summary.summary).toContain('Q1 budget');
      expect(summary.keyPoints).toHaveLength(3);
      expect(summary.actionItems).toHaveLength(1);
      expect(summary.decisions).toHaveLength(1);
      expect(summary.participants).toContain('Alice');
      expect(summary.participants).toContain('Bob');
      expect(summary.messageCount).toBe(3);
    });

    it('should handle empty thread', async () => {
      const { messageChannelService } = await import('../messageChannelService');

      vi.mocked(messageChannelService.getThreadMessages).mockResolvedValue([]);

      await expect(
        messageSummarizationService.summarizeThread(
          'channel-1',
          'thread-1',
          'user-1',
          'test-api-key'
        )
      ).rejects.toThrow('No messages in thread');
    });

    it('should cache summary results', async () => {
      const { messageChannelService } = await import('../messageChannelService');
      const { processWithModel } = await import('../geminiService');

      vi.mocked(messageChannelService.getThreadMessages).mockResolvedValue(mockMessages);

      const mockAIResponse = JSON.stringify({
        summary: 'Cached summary',
        keyPoints: ['Key point'],
        actionItems: [],
        decisions: [],
        participants: ['Alice'],
      });

      vi.mocked(processWithModel).mockResolvedValue(mockAIResponse);

      // First call
      await messageSummarizationService.summarizeThread(
        'channel-1',
        'thread-1',
        'user-1',
        'test-api-key'
      );

      // Second call should use cache
      const summary2 = await messageSummarizationService.summarizeThread(
        'channel-1',
        'thread-1',
        'user-1',
        'test-api-key'
      );

      // AI should only be called once
      expect(processWithModel).toHaveBeenCalledTimes(1);
      expect(summary2.summary).toBe('Cached summary');
    });

    it('should handle malformed JSON response', async () => {
      const { messageChannelService } = await import('../messageChannelService');
      const { processWithModel } = await import('../geminiService');

      vi.mocked(messageChannelService.getThreadMessages).mockResolvedValue(mockMessages);
      vi.mocked(processWithModel).mockResolvedValue('Invalid JSON {');

      const summary = await messageSummarizationService.summarizeThread(
        'channel-1',
        'thread-1',
        'user-1',
        'test-api-key'
      );

      // Should return default values
      expect(summary.summary).toBe('No summary available');
      expect(summary.keyPoints).toEqual([]);
    });
  });

  describe('generateDailyDigest', () => {
    it('should generate digest for multiple channels', async () => {
      const { messageChannelService } = await import('../messageChannelService');
      const { supabase } = await import('../supabase');
      const { processWithModel } = await import('../geminiService');

      vi.mocked(messageChannelService.getChannels).mockResolvedValue([
        {
          id: 'channel-1',
          workspace_id: 'workspace-1',
          name: 'general',
          is_public: true,
          is_group: false,
          created_by: 'user-1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      vi.mocked(supabase.from('messages').select().eq().gte().lte().order as any).mockResolvedValue({
        data: mockMessages,
        error: null,
      });

      const channelSummaryResponse = JSON.stringify({
        highlights: ['Budget discussion', 'Marketing increase approved'],
        actionItems: ['Prepare report'],
      });

      vi.mocked(processWithModel).mockResolvedValueOnce(channelSummaryResponse);
      vi.mocked(processWithModel).mockResolvedValueOnce('Overall good progress on budget planning');

      const digest = await messageSummarizationService.generateDailyDigest(
        'user-1',
        'workspace-1',
        new Date('2024-01-15'),
        'test-api-key'
      );

      expect(digest.channelSummaries).toHaveLength(1);
      expect(digest.channelSummaries[0].channelName).toBe('general');
      expect(digest.totalMessages).toBe(3);
      expect(digest.actionItems).toContain('Prepare report');
    });

    it('should handle day with no messages', async () => {
      const { messageChannelService } = await import('../messageChannelService');
      const { supabase } = await import('../supabase');
      const { processWithModel } = await import('../geminiService');

      vi.mocked(messageChannelService.getChannels).mockResolvedValue([]);
      vi.mocked(processWithModel).mockResolvedValue('No activity');

      const digest = await messageSummarizationService.generateDailyDigest(
        'user-1',
        'workspace-1',
        new Date(),
        'test-api-key'
      );

      expect(digest.channelSummaries).toHaveLength(0);
      expect(digest.totalMessages).toBe(0);
    });
  });

  describe('generateCatchUpSummary', () => {
    it('should summarize messages since last visit', async () => {
      const { supabase } = await import('../supabase');
      const { processWithModel } = await import('../geminiService');

      const sinceDate = new Date('2024-01-15T09:00:00Z');

      vi.mocked(supabase.from('messages').select().eq().gte().order as any).mockResolvedValue({
        data: mockMessages,
        error: null,
      });

      const mockAIResponse = JSON.stringify({
        summary: 'Budget discussions with increased marketing spend decision',
        keyChanges: ['Marketing budget increased'],
        decisionsMade: ['20% marketing budget increase'],
        actionItems: ['Prepare report by Friday'],
      });

      vi.mocked(processWithModel).mockResolvedValue(mockAIResponse);

      const catchUp = await messageSummarizationService.generateCatchUpSummary(
        'channel-1',
        'user-1',
        sinceDate,
        'test-api-key'
      );

      expect(catchUp.summary).toContain('Budget');
      expect(catchUp.keyChanges).toHaveLength(1);
      expect(catchUp.decisonsMade).toHaveLength(1);
      expect(catchUp.actionItems).toHaveLength(1);
      expect(catchUp.messageCount).toBe(3);
    });

    it('should handle no new messages', async () => {
      const { supabase } = await import('../supabase');

      vi.mocked(supabase.from('messages').select().eq().gte().order as any).mockResolvedValue({
        data: [],
        error: null,
      });

      const catchUp = await messageSummarizationService.generateCatchUpSummary(
        'channel-1',
        'user-1',
        new Date(),
        'test-api-key'
      );

      expect(catchUp.summary).toContain('No new messages');
      expect(catchUp.messageCount).toBe(0);
    });

    it('should format timeframe correctly', async () => {
      const { supabase } = await import('../supabase');

      vi.mocked(supabase.from('messages').select().eq().gte().order as any).mockResolvedValue({
        data: [],
        error: null,
      });

      // Test different time ranges
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const catchUp = await messageSummarizationService.generateCatchUpSummary(
        'channel-1',
        'user-1',
        twoDaysAgo,
        'test-api-key'
      );

      expect(catchUp.timeframe).toContain('days');
    });
  });

  describe('getSummaries', () => {
    it('should retrieve saved summaries', async () => {
      const { supabase } = await import('../supabase');

      const mockSummaries = [
        {
          id: 'summary-1',
          user_id: 'user-1',
          summary_type: 'thread',
          reference_id: 'thread-1',
          summary_text: 'Thread summary',
          key_points: ['Point 1'],
          action_items: [],
          decisions: [],
          participants: ['Alice'],
          message_count: 5,
          generated_at: new Date().toISOString(),
        },
      ];

      vi.mocked(supabase.from('conversation_summaries').select().eq().order().limit as any).mockResolvedValue({
        data: mockSummaries,
        error: null,
      });

      const summaries = await messageSummarizationService.getSummaries('user-1', 'thread', 10);

      expect(summaries).toHaveLength(1);
      expect(summaries[0].summary_type).toBe('thread');
    });
  });

  describe('cleanupOldSummaries', () => {
    it('should delete old summaries', async () => {
      const { supabase } = await import('../supabase');

      vi.mocked(supabase.from('conversation_summaries').delete().lt().select as any).mockResolvedValue({
        data: [{ id: 'old-1' }, { id: 'old-2' }],
        error: null,
      });

      const deleted = await messageSummarizationService.cleanupOldSummaries(30);

      expect(deleted).toBe(2);
    });

    it('should handle cleanup errors', async () => {
      const { supabase } = await import('../supabase');

      vi.mocked(supabase.from('conversation_summaries').delete().lt().select as any).mockResolvedValue({
        data: null,
        error: new Error('Cleanup failed'),
      });

      const deleted = await messageSummarizationService.cleanupOldSummaries(30);

      expect(deleted).toBe(0);
    });
  });

  describe('JSON Parsing', () => {
    it('should handle markdown code blocks', async () => {
      const { messageChannelService } = await import('../messageChannelService');
      const { processWithModel } = await import('../geminiService');

      vi.mocked(messageChannelService.getThreadMessages).mockResolvedValue(mockMessages);

      const mockAIResponse = '```json\n{"summary":"Test","keyPoints":[],"actionItems":[],"decisions":[],"participants":[]}\n```';

      vi.mocked(processWithModel).mockResolvedValue(mockAIResponse);

      const summary = await messageSummarizationService.summarizeThread(
        'channel-1',
        'thread-1',
        'user-1',
        'test-api-key'
      );

      expect(summary.summary).toBe('Test');
    });
  });
});
