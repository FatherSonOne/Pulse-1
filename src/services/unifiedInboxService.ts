import { UnifiedMessage, ConversationGraph, ConversationNode, MessageSource } from '../types';

/**
 * Unified Inbox Service
 * Aggregates messages from multiple sources into a single conversation graph
 */

export class UnifiedInboxService {
  private conversationGraphs: Map<string, ConversationGraph> = new Map();

  /**
   * Normalize messages from different platforms into unified format
   */
  async normalizeMessage(
    rawMessage: any,
    source: MessageSource
  ): Promise<UnifiedMessage> {
    const baseProps = {
      source,
      timestamp: new Date(),
      isRead: false,
      starred: false,
      tags: [],
      metadata: {},
    };

    switch (source) {
      case 'slack':
        return {
          id: `slack-${rawMessage.ts}`,
          content: rawMessage.text,
          senderName: rawMessage.user_name,
          senderId: rawMessage.user_id,
          channelId: rawMessage.channel,
          channelName: rawMessage.channel_name,
          type: 'text' as const,
          conversationGraphId: '',
          ...baseProps,
        };

      case 'email':
        return {
          id: `email-${rawMessage.messageId}`,
          content: rawMessage.body,
          senderName: rawMessage.from.name,
          senderId: rawMessage.from.email,
          senderEmail: rawMessage.from.email,
          channelId: rawMessage.threadId,
          channelName: rawMessage.subject,
          type: 'text' as const,
          conversationGraphId: '',
          ...baseProps,
        };

      case 'sms':
        return {
          id: `sms-${rawMessage.sid}`,
          content: rawMessage.body,
          senderName: rawMessage.from,
          senderId: rawMessage.from,
          channelId: rawMessage.conversationSid,
          channelName: `SMS: ${rawMessage.from}`,
          type: 'text' as const,
          conversationGraphId: '',
          ...baseProps,
        };

      case 'pulse':
        return {
          id: `pulse-${rawMessage.id || Date.now()}`,
          content: rawMessage.text || rawMessage.content,
          senderName: rawMessage.senderName || 'Unknown',
          senderId: rawMessage.senderId || 'unknown',
          channelId: rawMessage.channelId || 'default',
          channelName: rawMessage.channelName || 'Pulse',
          type: rawMessage.type || 'text',
          conversationGraphId: '',
          ...baseProps,
        };

      default:
        throw new Error(`Unsupported message source: ${source}`);
    }
  }

  /**
   * Deduplicate messages across platforms
   * Normalizes content and identifies duplicates
   */
  deduplicateMessages(messages: UnifiedMessage[]): UnifiedMessage[] {
    const normalizedMap = new Map<string, UnifiedMessage>();
    const seenHashes = new Set<string>();

    for (const msg of messages) {
      // Normalize content for comparison
      const normalized = this.normalizeContent(msg.content);
      const hash = this.hashContent(normalized);

      if (!seenHashes.has(hash)) {
        seenHashes.add(hash);
        normalizedMap.set(msg.id, msg);
      } else {
        // Mark as duplicate in metadata
        msg.metadata.isDuplicate = true;
        msg.metadata.duplicateOf = Array.from(seenHashes).find(
          (h) => h === hash
        );
      }
    }

    return Array.from(normalizedMap.values());
  }

  /**
   * Build conversation graph from normalized messages
   */
  buildConversationGraph(
    messages: UnifiedMessage[],
    graphId: string
  ): ConversationGraph {
    const nodes = new Map<string, ConversationNode>();
    const deduplicationMap = new Map<string, string[]>();

    // Group messages by conversation
    const groupedByConversation = this.groupMessagesByConversation(messages);

    // Create nodes
    for (const [conversationKey, msgs] of groupedByConversation) {
      const node: ConversationNode = {
        id: `node-${conversationKey}`,
        messages: msgs,
        participantIds: [...new Set(msgs.map((m) => m.senderId))],
        participantNames: [...new Set(msgs.map((m) => m.senderName))],
        title: msgs[0].channelName,
        lastMessage: msgs[msgs.length - 1],
        updatedAt: msgs[msgs.length - 1].timestamp,
        source: msgs[0].source,
        externalId: conversationKey,
      };

      // Add to deduplication map
      const normalized = this.normalizeContent(msgs[0].content);
      if (!deduplicationMap.has(normalized)) {
        deduplicationMap.set(normalized, []);
      }
      deduplicationMap.get(normalized)!.push(node.id);

      nodes.set(node.id, node);
    }

    const graph: ConversationGraph = {
      id: graphId,
      nodes: Array.from(nodes.values()),
      edges: this.buildGraphEdges(Array.from(nodes.values())),
      deduplicationMap,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.conversationGraphs.set(graphId, graph);
    return graph;
  }

  /**
   * Find related conversations across platforms
   */
  findRelatedConversations(message: UnifiedMessage): UnifiedMessage[] {
    const related: UnifiedMessage[] = [];
    const threshold = 0.6; // Similarity threshold

    for (const graph of this.conversationGraphs.values()) {
      const nodes = Array.isArray(graph.nodes) ? graph.nodes : Array.from(graph.nodes.values());
      for (const node of nodes) {
        if (node.messages) {
          for (const msg of node.messages) {
            const similarity = this.calculateSimilarity(
              message.content || '',
              msg.content || ''
            );
            if (similarity > threshold && msg.id !== message.id) {
              related.push(msg);
            }
          }
        }
      }
    }

    return related;
  }

  // ============= PRIVATE HELPERS =============

  private normalizeContent(content: string): string {
    return content
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();
  }

  private hashContent(normalized: string): string {
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const set1 = new Set(this.normalizeContent(str1).split(' '));
    const set2 = new Set(this.normalizeContent(str2).split(' '));

    const intersection = [...set1].filter((x) => set2.has(x)).length;
    const union = new Set([...set1, ...set2]).size;

    return intersection / union;
  }

  private groupMessagesByConversation(
    messages: UnifiedMessage[]
  ): Map<string, UnifiedMessage[]> {
    const grouped = new Map<string, UnifiedMessage[]>();

    for (const msg of messages) {
      const key = `${msg.source}-${msg.channelId}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(msg);
    }

    // Sort messages by timestamp within each group
    for (const msgs of grouped.values()) {
      msgs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }

    return grouped;
  }

  private buildGraphEdges(
    nodes: ConversationNode[]
  ): { from: string; to: string; relationshipType: string }[] {
    const edges: { from: string; to: string; relationshipType: string }[] = [];

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const node1 = nodes[i];
        const node2 = nodes[j];

        // Check if nodes share participants
        const sharedParticipants = node1.participantIds.filter((id) =>
          node2.participantIds.includes(id)
        );

        if (sharedParticipants.length > 0) {
          edges.push({
            from: node1.id,
            to: node2.id,
            relationshipType: 'shared_participants',
          });
        }

        // Check if topics are related
        const similarity = this.calculateSimilarity(node1.title, node2.title);
        if (similarity > 0.4) {
          edges.push({
            from: node1.id,
            to: node2.id,
            relationshipType: 'related_topic',
          });
        }
      }
    }

    return edges;
  }

  getGraph(graphId: string): ConversationGraph | undefined {
    return this.conversationGraphs.get(graphId);
  }

  getAllGraphs(): ConversationGraph[] {
    return Array.from(this.conversationGraphs.values());
  }
}

export const unifiedInboxService = new UnifiedInboxService();
