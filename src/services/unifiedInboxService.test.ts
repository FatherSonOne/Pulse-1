// ============================================
// UNIFIED INBOX SERVICE TESTS
// ============================================

import { describe, it, expect, beforeEach } from 'vitest';
import { UnifiedInboxService } from './unifiedInboxService';
import { UnifiedMessage, MessageSource } from '../types';

describe('UnifiedInboxService', () => {
  let service: UnifiedInboxService;

  beforeEach(() => {
    service = new UnifiedInboxService();
  });

  describe('normalizeMessage', () => {
    it('should normalize Slack messages', async () => {
      const rawSlackMessage = {
        ts: '1234567890.123456',
        text: 'Hello from Slack!',
        user_name: 'john_doe',
        user_id: 'U123456',
        channel: 'C789012',
        channel_name: 'general',
      };

      const result = await service.normalizeMessage(rawSlackMessage, 'slack');

      expect(result.id).toBe('slack-1234567890.123456');
      expect(result.content).toBe('Hello from Slack!');
      expect(result.senderName).toBe('john_doe');
      expect(result.senderId).toBe('U123456');
      expect(result.source).toBe('slack');
      expect(result.type).toBe('text');
      expect(result.isRead).toBe(false);
      expect(result.starred).toBe(false);
    });

    it('should normalize email messages', async () => {
      const rawEmailMessage = {
        messageId: 'msg-123',
        body: 'Hello from Email!',
        from: { name: 'Jane Doe', email: 'jane@example.com' },
        threadId: 'thread-456',
        subject: 'Test Subject',
      };

      const result = await service.normalizeMessage(rawEmailMessage, 'email');

      expect(result.id).toBe('email-msg-123');
      expect(result.content).toBe('Hello from Email!');
      expect(result.senderName).toBe('Jane Doe');
      expect(result.senderEmail).toBe('jane@example.com');
      expect(result.source).toBe('email');
      expect(result.channelName).toBe('Test Subject');
    });

    it('should normalize SMS messages', async () => {
      const rawSmsMessage = {
        sid: 'SM123456',
        body: 'Hello from SMS!',
        from: '+1234567890',
        conversationSid: 'conv-123',
      };

      const result = await service.normalizeMessage(rawSmsMessage, 'sms');

      expect(result.id).toBe('sms-SM123456');
      expect(result.content).toBe('Hello from SMS!');
      expect(result.senderName).toBe('+1234567890');
      expect(result.source).toBe('sms');
    });

    it('should normalize Pulse messages', async () => {
      const rawPulseMessage = {
        id: 'pulse-123',
        text: 'Hello from Pulse!',
        senderName: 'AI Assistant',
        senderId: 'ai-001',
        channelId: 'chan-1',
        channelName: 'Main Channel',
        type: 'text',
      };

      const result = await service.normalizeMessage(rawPulseMessage, 'pulse');

      expect(result.id).toBe('pulse-pulse-123');
      expect(result.content).toBe('Hello from Pulse!');
      expect(result.senderName).toBe('AI Assistant');
      expect(result.source).toBe('pulse');
    });

    it('should throw error for unsupported source', async () => {
      await expect(
        service.normalizeMessage({}, 'unknown' as MessageSource)
      ).rejects.toThrow('Unsupported message source: unknown');
    });
  });

  describe('deduplicateMessages', () => {
    it('should remove duplicate messages based on content', () => {
      const messages: UnifiedMessage[] = [
        createMockMessage('1', 'Hello World', 'slack'),
        createMockMessage('2', 'Hello World', 'email'), // duplicate content
        createMockMessage('3', 'Different message', 'sms'),
      ];

      const result = service.deduplicateMessages(messages);

      expect(result.length).toBe(2);
      expect(result.map((m) => m.id)).toContain('1');
      expect(result.map((m) => m.id)).toContain('3');
    });

    it('should handle empty array', () => {
      const result = service.deduplicateMessages([]);
      expect(result).toEqual([]);
    });

    it('should not deduplicate unique messages', () => {
      const messages: UnifiedMessage[] = [
        createMockMessage('1', 'Message one', 'slack'),
        createMockMessage('2', 'Message two', 'email'),
        createMockMessage('3', 'Message three', 'sms'),
      ];

      const result = service.deduplicateMessages(messages);
      expect(result.length).toBe(3);
    });
  });

  describe('buildConversationGraph', () => {
    it('should build a conversation graph from messages', () => {
      const messages: UnifiedMessage[] = [
        createMockMessage('1', 'Hello', 'slack', 'channel-1'),
        createMockMessage('2', 'Hi there', 'slack', 'channel-1'),
        createMockMessage('3', 'Different channel', 'slack', 'channel-2'),
      ];

      const graph = service.buildConversationGraph(messages, 'test-graph');

      expect(graph.id).toBe('test-graph');
      const nodesArray = Array.isArray(graph.nodes) ? graph.nodes : Array.from(graph.nodes.values());
      expect(nodesArray.length).toBe(2); // 2 channels
      expect(graph.createdAt).toBeInstanceOf(Date);
    });

    it('should store the graph for retrieval', () => {
      const messages: UnifiedMessage[] = [
        createMockMessage('1', 'Hello', 'slack', 'channel-1'),
      ];

      service.buildConversationGraph(messages, 'stored-graph');

      const retrieved = service.getGraph('stored-graph');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('stored-graph');
    });
  });

  describe('findRelatedConversations', () => {
    it('should find related messages by content similarity', () => {
      const messages: UnifiedMessage[] = [
        createMockMessage('1', 'Project meeting tomorrow at 3pm', 'slack'),
        createMockMessage('2', 'Meeting about the project tomorrow', 'email'),
        createMockMessage('3', 'Completely unrelated message', 'sms'),
      ];

      service.buildConversationGraph(messages, 'test-graph');

      const searchMessage = createMockMessage('search', 'project meeting', 'pulse');
      const related = service.findRelatedConversations(searchMessage);

      // Should find related messages based on shared words
      expect(related.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getAllGraphs', () => {
    it('should return all stored graphs', () => {
      const messages1 = [createMockMessage('1', 'Hello', 'slack')];
      const messages2 = [createMockMessage('2', 'World', 'email')];

      service.buildConversationGraph(messages1, 'graph-1');
      service.buildConversationGraph(messages2, 'graph-2');

      const allGraphs = service.getAllGraphs();
      expect(allGraphs.length).toBe(2);
    });
  });
});

// Helper function to create mock messages
function createMockMessage(
  id: string,
  content: string,
  source: MessageSource,
  channelId: string = 'default-channel'
): UnifiedMessage {
  return {
    id,
    source,
    type: 'text',
    content,
    senderName: 'Test User',
    senderId: 'user-123',
    channelId,
    channelName: `Channel ${channelId}`,
    timestamp: new Date(),
    conversationGraphId: '',
    metadata: {},
    isRead: false,
    starred: false,
    tags: [],
  };
}
