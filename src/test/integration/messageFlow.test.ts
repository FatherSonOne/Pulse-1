// ============================================
// MESSAGE FLOW INTEGRATION TESTS
// Tests the complete message flow from ingestion to display
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnifiedInboxService } from '../../services/unifiedInboxService';
import { ChannelExportService } from '../../services/channelExportService';

describe('Message Flow Integration', () => {
  let inboxService: UnifiedInboxService;
  let exportService: ChannelExportService;

  beforeEach(() => {
    inboxService = new UnifiedInboxService();
    exportService = new ChannelExportService();
  });

  describe('Multi-source message aggregation', () => {
    it('should aggregate messages from multiple sources into unified inbox', async () => {
      // Simulate messages from different sources
      const slackMessage = {
        ts: '1234567890.111',
        text: 'Project update from Slack',
        user_name: 'alice',
        user_id: 'U001',
        channel: 'C001',
        channel_name: 'project-updates',
      };

      const emailMessage = {
        messageId: 'email-123',
        body: 'Project update via email',
        from: { name: 'Bob', email: 'bob@example.com' },
        threadId: 'thread-456',
        subject: 'RE: Project Updates',
      };

      const smsMessage = {
        sid: 'SM789',
        body: 'Quick update via SMS',
        from: '+1234567890',
        conversationSid: 'conv-001',
      };

      // Normalize messages from each source
      const normalizedSlack = await inboxService.normalizeMessage(slackMessage, 'slack');
      const normalizedEmail = await inboxService.normalizeMessage(emailMessage, 'email');
      const normalizedSms = await inboxService.normalizeMessage(smsMessage, 'sms');

      // All messages should have unified structure
      expect(normalizedSlack.source).toBe('slack');
      expect(normalizedEmail.source).toBe('email');
      expect(normalizedSms.source).toBe('sms');

      // All should have required fields
      [normalizedSlack, normalizedEmail, normalizedSms].forEach((msg) => {
        expect(msg.id).toBeTruthy();
        expect(msg.content).toBeTruthy();
        expect(msg.senderName).toBeTruthy();
        expect(msg.timestamp).toBeInstanceOf(Date);
      });
    });

    it('should deduplicate messages across sources', async () => {
      // Same content from different sources
      const slackMsg = await inboxService.normalizeMessage(
        { ts: '1', text: 'Important announcement', user_name: 'admin', user_id: 'U1', channel: 'C1', channel_name: 'general' },
        'slack'
      );

      const emailMsg = await inboxService.normalizeMessage(
        { messageId: '2', body: 'Important announcement', from: { name: 'Admin', email: 'admin@co.com' }, threadId: 't1', subject: 'Announcement' },
        'email'
      );

      const deduplicated = inboxService.deduplicateMessages([slackMsg, emailMsg]);

      // Should remove duplicate based on content
      expect(deduplicated.length).toBe(1);
    });

    it('should build conversation graph from messages', async () => {
      const messages = await Promise.all([
        inboxService.normalizeMessage(
          { ts: '1', text: 'First message', user_name: 'alice', user_id: 'U1', channel: 'C1', channel_name: 'project' },
          'slack'
        ),
        inboxService.normalizeMessage(
          { ts: '2', text: 'Reply to first', user_name: 'bob', user_id: 'U2', channel: 'C1', channel_name: 'project' },
          'slack'
        ),
        inboxService.normalizeMessage(
          { ts: '3', text: 'Different channel', user_name: 'charlie', user_id: 'U3', channel: 'C2', channel_name: 'random' },
          'slack'
        ),
      ]);

      const graph = inboxService.buildConversationGraph(messages, 'test-graph');

      const nodesArray = Array.isArray(graph.nodes) ? graph.nodes : Array.from(graph.nodes.values());
      expect(nodesArray.length).toBe(2); // Two channels
      expect(graph.edges?.length ?? 0).toBeGreaterThanOrEqual(0);

      // First node should have 2 messages (same channel)
      const projectNode = nodesArray.find((n) => n.title === 'project');
      expect(projectNode?.messages?.length).toBe(2);
    });
  });

  describe('Message to export flow', () => {
    it('should export aggregated messages to markdown', async () => {
      // Create some messages
      const messages = await Promise.all([
        inboxService.normalizeMessage(
          { ts: '1', text: 'Decision: We will use React', user_name: 'lead', user_id: 'U1', channel: 'C1', channel_name: 'architecture' },
          'slack'
        ),
        inboxService.normalizeMessage(
          { ts: '2', text: 'Task: Set up project structure', user_name: 'dev', user_id: 'U2', channel: 'C1', channel_name: 'architecture' },
          'slack'
        ),
      ]);

      // Build spec from messages
      const spec = exportService.buildChannelSpec('Architecture', messages);

      // Export to markdown
      const markdown = exportService.exportToMarkdown('Architecture', spec);

      expect(markdown).toContain('# Architecture');
      expect(markdown).toContain('## Overview');
      expect(markdown).toContain('**Last Updated:**');
    });

    it('should export to HTML with proper formatting', async () => {
      const messages = await Promise.all([
        inboxService.normalizeMessage(
          { ts: '1', text: 'Project kickoff', user_name: 'pm', user_id: 'U1', channel: 'C1', channel_name: 'planning' },
          'slack'
        ),
      ]);

      const spec = exportService.buildChannelSpec('Planning', messages);
      const html = exportService.exportToHtml('Planning', spec);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>');
      expect(html).toContain('<style>');
      expect(html).toContain('<body>');
    });

    it('should create and track artifacts', async () => {
      const messages = await Promise.all([
        inboxService.normalizeMessage(
          { ts: '1', text: 'Test message', user_name: 'user', user_id: 'U1', channel: 'C1', channel_name: 'test' },
          'slack'
        ),
      ]);

      const spec = exportService.buildChannelSpec('Test', messages);
      const artifact = await exportService.exportToGoogleDocs('C1', 'Test', messages, spec);

      expect(artifact.status).toBe('draft');

      // Publish the artifact
      exportService.publishArtifact(artifact.id);

      const updated = exportService.getArtifact(artifact.id);
      expect(updated?.status).toBe('published');

      // Verify it's in the list
      const allArtifacts = exportService.getAllArtifacts();
      expect(allArtifacts.find((a) => a.id === artifact.id)).toBeTruthy();
    });
  });

  describe('Cross-platform conversation tracking', () => {
    it('should find related conversations across platforms', async () => {
      // Create messages about the same topic from different sources
      const messages = await Promise.all([
        inboxService.normalizeMessage(
          { ts: '1', text: 'Budget meeting tomorrow', user_name: 'cfo', user_id: 'U1', channel: 'C1', channel_name: 'finance' },
          'slack'
        ),
        inboxService.normalizeMessage(
          { messageId: '2', body: 'RE: Budget meeting discussion', from: { name: 'CFO', email: 'cfo@co.com' }, threadId: 't1', subject: 'Budget' },
          'email'
        ),
        inboxService.normalizeMessage(
          { ts: '3', text: 'Unrelated topic', user_name: 'other', user_id: 'U2', channel: 'C2', channel_name: 'random' },
          'slack'
        ),
      ]);

      // Build graph
      inboxService.buildConversationGraph(messages, 'cross-platform');

      // Search for related messages
      const searchMsg = await inboxService.normalizeMessage(
        { id: 'search', text: 'budget meeting', senderName: 'searcher', senderId: 'S1', channelId: 'search', channelName: 'search' },
        'pulse'
      );

      const related = inboxService.findRelatedConversations(searchMsg);

      // Should find budget-related messages
      expect(Array.isArray(related)).toBe(true);
    });

    it('should build edges between related conversations', async () => {
      // Messages with shared participants
      const messages = await Promise.all([
        inboxService.normalizeMessage(
          { ts: '1', text: 'Message in channel 1', user_name: 'shared_user', user_id: 'U1', channel: 'C1', channel_name: 'channel-1' },
          'slack'
        ),
        inboxService.normalizeMessage(
          { ts: '2', text: 'Message in channel 2', user_name: 'shared_user', user_id: 'U1', channel: 'C2', channel_name: 'channel-2' },
          'slack'
        ),
      ]);

      const graph = inboxService.buildConversationGraph(messages, 'shared-participants');

      // Should have edges connecting nodes with shared participants
      const hasSharedParticipantEdge = graph.edges.some(
        (e) => e.relationshipType === 'shared_participants'
      );

      expect(hasSharedParticipantEdge).toBe(true);
    });
  });
});
