// src/services/__tests__/conversationIntelligenceService.test.ts
// Unit tests for Conversation Intelligence Service

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { conversationIntelligenceService } from '../conversationIntelligenceService';
import type { ChannelMessage } from '../../types/messages';

// Mock dependencies
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  },
}));

vi.mock('../geminiService', () => ({
  processWithModel: vi.fn(),
}));

describe('ConversationIntelligenceService', () => {
  const mockMessages: ChannelMessage[] = [
    {
      id: 'msg-1',
      channel_id: 'channel-1',
      sender_id: 'user-1',
      sender_name: 'Alice',
      content: 'This is great! I love this project.',
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
      content: 'I agree, the team is doing amazing work on the API redesign.',
      message_type: 'text',
      created_at: new Date('2024-01-15T10:05:00Z').toISOString(),
      is_pinned: false,
      reactions: {},
    },
    {
      id: 'msg-3',
      channel_id: 'channel-1',
      sender_id: 'user-3',
      sender_name: 'Charlie',
      content: 'Yes, the new authentication flow is much better.',
      message_type: 'text',
      created_at: new Date('2024-01-15T10:10:00Z').toISOString(),
      is_pinned: false,
      reactions: {},
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeConversation', () => {
    it('should analyze all aspects of conversation', async () => {
      const { processWithModel } = await import('../geminiService');

      // Mock sentiment response
      vi.mocked(processWithModel).mockResolvedValueOnce(
        JSON.stringify({
          current: 'positive',
          score: 0.8,
          reason: 'Team is expressing enthusiasm about the project',
          trend: 'improving',
        })
      );

      // Mock topics response
      vi.mocked(processWithModel).mockResolvedValueOnce(
        JSON.stringify([
          { topic: 'API redesign', confidence: 0.9 },
          { topic: 'Authentication', confidence: 0.85 },
        ])
      );

      // Mock follow-ups response
      vi.mocked(processWithModel).mockResolvedValueOnce(
        JSON.stringify([
          'When will the API redesign be completed?',
          'What are the next steps for authentication?',
        ])
      );

      const intelligence = await conversationIntelligenceService.analyzeConversation(
        'channel-1',
        mockMessages,
        'user-1',
        'test-api-key'
      );

      expect(intelligence.sentiment.current).toBe('positive');
      expect(intelligence.sentiment.score).toBe(0.8);
      expect(intelligence.topics).toHaveLength(2);
      expect(intelligence.topics[0].topic).toBe('API redesign');
      expect(intelligence.followUpSuggestions).toHaveLength(2);
    });

    it('should calculate engagement metrics', async () => {
      const { processWithModel } = await import('../geminiService');

      vi.mocked(processWithModel).mockResolvedValue(JSON.stringify({}));

      const intelligence = await conversationIntelligenceService.analyzeConversation(
        'channel-1',
        mockMessages,
        'user-1',
        'test-api-key'
      );

      expect(intelligence.engagement).toBeDefined();
      expect(intelligence.engagement.participants).toHaveLength(3);
      expect(intelligence.engagement.score).toBeGreaterThan(0);
      expect(intelligence.engagement.messageVelocity).toBeGreaterThan(0);
    });

    it('should handle empty conversation', async () => {
      const intelligence = await conversationIntelligenceService.analyzeConversation(
        'channel-1',
        [],
        'user-1',
        'test-api-key'
      );

      expect(intelligence.sentiment.current).toBe('neutral');
      expect(intelligence.topics).toHaveLength(0);
      expect(intelligence.engagement.score).toBe(0);
    });

    it('should cache analysis results', async () => {
      const { processWithModel } = await import('../geminiService');

      vi.mocked(processWithModel).mockResolvedValue(
        JSON.stringify({ current: 'positive', score: 0.7, reason: 'Good vibes', trend: 'stable' })
      );

      // First call
      await conversationIntelligenceService.analyzeConversation(
        'channel-1',
        mockMessages,
        'user-1',
        'test-api-key'
      );

      // Second call should use cache
      await conversationIntelligenceService.analyzeConversation(
        'channel-1',
        mockMessages,
        'user-1',
        'test-api-key'
      );

      // Should only call AI once (3 times: sentiment, topics, followups)
      expect(processWithModel).toHaveBeenCalledTimes(3);
    });
  });

  describe('Sentiment Analysis', () => {
    it('should detect positive sentiment', async () => {
      const { processWithModel } = await import('../geminiService');

      vi.mocked(processWithModel).mockResolvedValueOnce(
        JSON.stringify({
          current: 'positive',
          score: 0.75,
          reason: 'Team is excited about progress',
          trend: 'improving',
        })
      );

      vi.mocked(processWithModel).mockResolvedValue(JSON.stringify([]));

      const intelligence = await conversationIntelligenceService.analyzeConversation(
        'channel-1',
        mockMessages,
        'user-1',
        'test-api-key'
      );

      expect(intelligence.sentiment.current).toBe('positive');
      expect(intelligence.sentiment.score).toBeGreaterThan(0);
      expect(intelligence.sentiment.trend).toBe('improving');
    });

    it('should detect negative sentiment', async () => {
      const { processWithModel } = await import('../geminiService');

      const negativeMessages: ChannelMessage[] = [
        {
          ...mockMessages[0],
          content: 'This is frustrating. Nothing is working.',
        },
      ];

      vi.mocked(processWithModel).mockResolvedValueOnce(
        JSON.stringify({
          current: 'negative',
          score: -0.6,
          reason: 'Frustration expressed about issues',
          trend: 'declining',
        })
      );

      vi.mocked(processWithModel).mockResolvedValue(JSON.stringify([]));

      const intelligence = await conversationIntelligenceService.analyzeConversation(
        'channel-1',
        negativeMessages,
        'user-1',
        'test-api-key'
      );

      expect(intelligence.sentiment.current).toBe('negative');
      expect(intelligence.sentiment.score).toBeLessThan(0);
    });

    it('should handle mixed sentiment', async () => {
      const { processWithModel } = await import('../geminiService');

      vi.mocked(processWithModel).mockResolvedValueOnce(
        JSON.stringify({
          current: 'mixed',
          score: 0.1,
          reason: 'Both positive and negative aspects discussed',
          trend: 'stable',
        })
      );

      vi.mocked(processWithModel).mockResolvedValue(JSON.stringify([]));

      const intelligence = await conversationIntelligenceService.analyzeConversation(
        'channel-1',
        mockMessages,
        'user-1',
        'test-api-key'
      );

      expect(intelligence.sentiment.current).toBe('mixed');
    });
  });

  describe('Topic Detection', () => {
    it('should identify main topics', async () => {
      const { processWithModel } = await import('../geminiService');

      vi.mocked(processWithModel).mockResolvedValueOnce(JSON.stringify({}));

      vi.mocked(processWithModel).mockResolvedValueOnce(
        JSON.stringify([
          { topic: 'Project management', confidence: 0.9 },
          { topic: 'Technical implementation', confidence: 0.85 },
          { topic: 'Team collaboration', confidence: 0.75 },
        ])
      );

      vi.mocked(processWithModel).mockResolvedValue(JSON.stringify([]));

      const intelligence = await conversationIntelligenceService.analyzeConversation(
        'channel-1',
        mockMessages,
        'user-1',
        'test-api-key'
      );

      expect(intelligence.topics).toHaveLength(3);
      expect(intelligence.topics[0].confidence).toBe(0.9);
      expect(intelligence.topics.every((t) => t.topic && t.confidence >= 0 && t.confidence <= 1)).toBe(true);
    });

    it('should handle no clear topics', async () => {
      const { processWithModel } = await import('../geminiService');

      vi.mocked(processWithModel).mockResolvedValueOnce(JSON.stringify({}));
      vi.mocked(processWithModel).mockResolvedValueOnce(JSON.stringify([]));
      vi.mocked(processWithModel).mockResolvedValue(JSON.stringify([]));

      const intelligence = await conversationIntelligenceService.analyzeConversation(
        'channel-1',
        mockMessages,
        'user-1',
        'test-api-key'
      );

      expect(intelligence.topics).toHaveLength(0);
    });
  });

  describe('Engagement Metrics', () => {
    it('should calculate participant engagement scores', async () => {
      const { processWithModel } = await import('../geminiService');
      vi.mocked(processWithModel).mockResolvedValue(JSON.stringify({}));

      const intelligence = await conversationIntelligenceService.analyzeConversation(
        'channel-1',
        mockMessages,
        'user-1',
        'test-api-key'
      );

      const participants = intelligence.engagement.participants;

      expect(participants).toHaveLength(3);
      expect(participants[0].messageCount).toBeGreaterThan(0);
      expect(participants[0].engagementScore).toBeGreaterThan(0);
      expect(participants[0].engagementScore).toBeLessThanOrEqual(100);
    });

    it('should sort participants by engagement', async () => {
      const { processWithModel } = await import('../geminiService');
      vi.mocked(processWithModel).mockResolvedValue(JSON.stringify({}));

      const messagesWithVariedEngagement: ChannelMessage[] = [
        ...mockMessages,
        { ...mockMessages[0], id: 'msg-4', sender_id: 'user-1' },
        { ...mockMessages[0], id: 'msg-5', sender_id: 'user-1' },
      ];

      const intelligence = await conversationIntelligenceService.analyzeConversation(
        'channel-1',
        messagesWithVariedEngagement,
        'user-1',
        'test-api-key'
      );

      const participants = intelligence.engagement.participants;

      // user-1 should be most engaged (3 messages)
      expect(participants[0].userId).toBe('user-1');
      expect(participants[0].messageCount).toBe(3);
    });

    it('should calculate message velocity', async () => {
      const { processWithModel } = await import('../geminiService');
      vi.mocked(processWithModel).mockResolvedValue(JSON.stringify({}));

      const intelligence = await conversationIntelligenceService.analyzeConversation(
        'channel-1',
        mockMessages,
        'user-1',
        'test-api-key'
      );

      expect(intelligence.engagement.messageVelocity).toBeGreaterThan(0);
    });

    it('should determine engagement trend', async () => {
      const { processWithModel } = await import('../geminiService');
      vi.mocked(processWithModel).mockResolvedValue(JSON.stringify({}));

      // Create messages with increasing velocity
      const now = new Date();
      const trendingMessages: ChannelMessage[] = [
        { ...mockMessages[0], created_at: new Date(now.getTime() - 60000).toISOString() },
        { ...mockMessages[1], created_at: new Date(now.getTime() - 50000).toISOString() },
        { ...mockMessages[2], created_at: new Date(now.getTime() - 1000).toISOString() },
        { ...mockMessages[2], id: 'msg-4', created_at: new Date(now.getTime() - 500).toISOString() },
        { ...mockMessages[2], id: 'msg-5', created_at: now.toISOString() },
      ];

      const intelligence = await conversationIntelligenceService.analyzeConversation(
        'channel-1',
        trendingMessages,
        'user-1',
        'test-api-key'
      );

      expect(['increasing', 'stable', 'declining']).toContain(intelligence.engagement.trend);
    });
  });

  describe('Follow-up Suggestions', () => {
    it('should generate relevant follow-up suggestions', async () => {
      const { processWithModel } = await import('../geminiService');

      vi.mocked(processWithModel).mockResolvedValueOnce(JSON.stringify({}));
      vi.mocked(processWithModel).mockResolvedValueOnce(JSON.stringify([]));

      vi.mocked(processWithModel).mockResolvedValueOnce(
        JSON.stringify([
          'Ask about timeline for completion',
          'Clarify testing requirements',
          'Schedule follow-up meeting',
        ])
      );

      const intelligence = await conversationIntelligenceService.analyzeConversation(
        'channel-1',
        mockMessages,
        'user-1',
        'test-api-key'
      );

      expect(intelligence.followUpSuggestions).toHaveLength(3);
      expect(intelligence.followUpSuggestions[0]).toContain('timeline');
    });

    it('should limit suggestions to 3', async () => {
      const { processWithModel } = await import('../geminiService');

      vi.mocked(processWithModel).mockResolvedValueOnce(JSON.stringify({}));
      vi.mocked(processWithModel).mockResolvedValueOnce(JSON.stringify([]));

      vi.mocked(processWithModel).mockResolvedValueOnce(
        JSON.stringify(['Suggestion 1', 'Suggestion 2', 'Suggestion 3', 'Suggestion 4', 'Suggestion 5'])
      );

      const intelligence = await conversationIntelligenceService.analyzeConversation(
        'channel-1',
        mockMessages,
        'user-1',
        'test-api-key'
      );

      expect(intelligence.followUpSuggestions.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Database Integration', () => {
    it('should save intelligence to database', async () => {
      const { supabase } = await import('../supabase');
      const { processWithModel } = await import('../geminiService');

      vi.mocked(processWithModel).mockResolvedValue(JSON.stringify({}));

      vi.mocked(supabase.from('conversation_intelligence').upsert as any).mockResolvedValue({
        error: null,
      });

      await conversationIntelligenceService.analyzeConversation(
        'channel-1',
        mockMessages,
        'user-1',
        'test-api-key'
      );

      expect(supabase.from).toHaveBeenCalledWith('conversation_intelligence');
    });

    it('should retrieve saved intelligence', async () => {
      const { supabase } = await import('../supabase');

      const mockSavedIntelligence = {
        channel_id: 'channel-1',
        user_id: 'user-1',
        current_sentiment: 'positive',
        sentiment_score: 0.8,
        detected_topics: ['API', 'Testing'],
        topic_confidence: { API: 0.9, Testing: 0.7 },
        engagement_trend: 'stable',
        suggested_followups: ['Review API docs'],
        last_analyzed_at: new Date().toISOString(),
      };

      vi.mocked(supabase.from('conversation_intelligence').select().eq().single as any).mockResolvedValue({
        data: mockSavedIntelligence,
        error: null,
      });

      const intelligence = await conversationIntelligenceService.getIntelligence('channel-1', 'user-1');

      expect(intelligence).toBeTruthy();
      expect(intelligence?.sentiment.current).toBe('positive');
      expect(intelligence?.topics).toHaveLength(2);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache for specific channel', async () => {
      const { processWithModel } = await import('../geminiService');

      vi.mocked(processWithModel).mockResolvedValue(JSON.stringify({}));

      // First analysis
      await conversationIntelligenceService.analyzeConversation(
        'channel-1',
        mockMessages,
        'user-1',
        'test-api-key'
      );

      const callCount = vi.mocked(processWithModel).mock.calls.length;

      // Clear cache
      conversationIntelligenceService.clearCache('channel-1');

      // Second analysis should call AI again
      await conversationIntelligenceService.analyzeConversation(
        'channel-1',
        mockMessages,
        'user-1',
        'test-api-key'
      );

      expect(vi.mocked(processWithModel).mock.calls.length).toBeGreaterThan(callCount);
    });

    it('should clear all cache', () => {
      expect(() => {
        conversationIntelligenceService.clearCache();
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle AI service errors gracefully', async () => {
      const { processWithModel } = await import('../geminiService');

      vi.mocked(processWithModel).mockRejectedValue(new Error('AI service error'));

      const intelligence = await conversationIntelligenceService.analyzeConversation(
        'channel-1',
        mockMessages,
        'user-1',
        'test-api-key'
      );

      // Should return empty intelligence rather than throwing
      expect(intelligence).toBeDefined();
      expect(intelligence.sentiment.current).toBe('neutral');
    });

    it('should handle malformed JSON responses', async () => {
      const { processWithModel } = await import('../geminiService');

      vi.mocked(processWithModel).mockResolvedValue('invalid json {');

      const intelligence = await conversationIntelligenceService.analyzeConversation(
        'channel-1',
        mockMessages,
        'user-1',
        'test-api-key'
      );

      expect(intelligence).toBeDefined();
    });
  });
});
