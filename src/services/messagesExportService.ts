// ============================================
// MESSAGES EXPORT & HANDOFF SERVICE
// ============================================

import { Thread, Message, HandoffSummary } from '../types';

export interface MessageExport {
  id: string;
  messages: Message[];
  format: 'pdf' | 'markdown' | 'json' | 'docx';
  createdAt: Date;
  title: string;
  threadName: string;
}

export interface ExportOptions {
  includeTimestamps?: boolean;
  includeAttachments?: boolean;
  includeMeta?: boolean;
  dateRange?: { start: Date; end: Date };
}

/**
 * Service for exporting messages and generating handoff summaries
 */
export class MessagesExportService {
  private exports: Map<string, MessageExport> = new Map();

  // ============= EXPORT FUNCTIONS =============

  /**
   * Export messages to Markdown format
   */
  exportToMarkdown(
    thread: Thread,
    messages: Message[],
    options: ExportOptions = {}
  ): string {
    const { includeTimestamps = true, includeAttachments = true } = options;

    let markdown = `# ${thread.contactName} - Conversation Export\n\n`;
    markdown += `**Generated:** ${new Date().toLocaleString()}\n`;
    markdown += `**Total Messages:** ${messages.length}\n\n`;
    markdown += `---\n\n`;

    for (const msg of messages) {
      const sender = msg.sender === 'me' ? 'You' : thread.contactName;
      const time = includeTimestamps
        ? ` _(${msg.timestamp.toLocaleString()})_`
        : '';

      markdown += `### ${sender}${time}\n\n`;
      markdown += `${msg.text}\n\n`;

      if (includeAttachments && msg.attachment) {
        markdown += `> **Attachment:** ${msg.attachment.name} (${msg.attachment.type})\n\n`;
      }

      if (msg.reactions && msg.reactions.length > 0) {
        const reactionStr = msg.reactions.map(r => `${r.emoji}×${r.count}`).join(' ');
        markdown += `> Reactions: ${reactionStr}\n\n`;
      }

      markdown += `---\n\n`;
    }

    return markdown;
  }

  /**
   * Export messages to JSON format
   */
  exportToJSON(
    thread: Thread,
    messages: Message[],
    options: ExportOptions = {}
  ): string {
    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        threadId: thread.id,
        contactName: thread.contactName,
        messageCount: messages.length,
      },
      messages: messages.map(msg => ({
        id: msg.id,
        sender: msg.sender,
        text: msg.text,
        timestamp: msg.timestamp.toISOString(),
        source: msg.source,
        attachment: msg.attachment,
        reactions: msg.reactions,
        status: msg.status,
        decisionData: msg.decisionData,
        voiceAnalysis: msg.voiceAnalysis,
      })),
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Download exported content as a file
   */
  downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Export and download messages
   */
  async exportMessages(
    thread: Thread,
    messages: Message[],
    format: 'markdown' | 'json'
  ): Promise<void> {
    const timestamp = new Date().toISOString().split('T')[0];
    const safeName = thread.contactName.replace(/[^a-z0-9]/gi, '_');

    if (format === 'markdown') {
      const content = this.exportToMarkdown(thread, messages);
      this.downloadFile(content, `${safeName}_export_${timestamp}.md`, 'text/markdown');
    } else if (format === 'json') {
      const content = this.exportToJSON(thread, messages);
      this.downloadFile(content, `${safeName}_export_${timestamp}.json`, 'application/json');
    }
  }

  // ============= HANDOFF SUMMARY =============

  /**
   * Generate a handoff summary from messages
   * This provides context for someone new joining the conversation
   */
  generateLocalHandoffSummary(
    thread: Thread,
    messages: Message[]
  ): HandoffSummary {
    // Extract key decisions from proposals
    const keyDecisions = messages
      .filter(m => m.decisionData?.status === 'approved')
      .map(m => m.text.substring(0, 100) + (m.text.length > 100 ? '...' : ''));

    // Extract pending actions (tasks)
    const pendingActions = messages
      .filter(m => m.relatedTaskId)
      .map(m => `Task: ${m.relatedTaskId}`);

    // Generate context summary
    const recentMessages = messages.slice(-10);
    const participants = new Set(recentMessages.map(m =>
      m.sender === 'me' ? 'You' : thread.contactName
    ));

    const topics = this.extractTopics(recentMessages);

    const context = `This conversation with ${thread.contactName} has ${messages.length} messages. ` +
      `Recent discussion topics include: ${topics.join(', ')}. ` +
      `${keyDecisions.length} decisions have been made. ` +
      `${pendingActions.length} action items are pending.`;

    return {
      context,
      keyDecisions: keyDecisions.slice(0, 5),
      pendingActions: pendingActions.slice(0, 5),
    };
  }

  /**
   * Simple topic extraction from messages
   */
  private extractTopics(messages: Message[]): string[] {
    const text = messages.map(m => m.text).join(' ').toLowerCase();

    // Simple keyword extraction (in production, use NLP)
    const keywords: string[] = [];

    const patterns = [
      { regex: /meeting|schedule|call/gi, topic: 'scheduling' },
      { regex: /deadline|due|urgent/gi, topic: 'deadlines' },
      { regex: /bug|issue|error|fix/gi, topic: 'issues' },
      { regex: /feature|implement|build/gi, topic: 'development' },
      { regex: /design|ui|ux/gi, topic: 'design' },
      { regex: /review|feedback|approve/gi, topic: 'reviews' },
      { regex: /deploy|release|launch/gi, topic: 'deployment' },
      { regex: /test|qa|quality/gi, topic: 'testing' },
    ];

    for (const pattern of patterns) {
      if (pattern.regex.test(text)) {
        keywords.push(pattern.topic);
      }
    }

    return keywords.length > 0 ? keywords : ['general discussion'];
  }

  // ============= FOCUS MODE HELPERS =============

  /**
   * Filter messages for focus mode (important/actionable only)
   */
  filterForFocus(messages: Message[]): Message[] {
    return messages.filter(msg => {
      // Include messages with decisions
      if (msg.decisionData) return true;

      // Include messages with tasks
      if (msg.relatedTaskId) return true;

      // Include messages with voice analysis (likely important)
      if (msg.voiceAnalysis) return true;

      // Include messages with attachments
      if (msg.attachment) return true;

      // Include messages mentioning action words
      const actionWords = ['urgent', 'asap', 'deadline', 'important', 'critical', 'action', 'todo', 'task'];
      const hasActionWord = actionWords.some(word =>
        msg.text.toLowerCase().includes(word)
      );
      if (hasActionWord) return true;

      return false;
    });
  }

  /**
   * Generate focus digest for messages missed during focus mode
   */
  generateFocusDigest(
    threads: Thread[],
    focusStartTime: Date
  ): string {
    let digest = '**While you were focused:**\n\n';

    for (const thread of threads) {
      const newMessages = thread.messages.filter(
        m => m.sender !== 'me' && m.timestamp > focusStartTime
      );

      if (newMessages.length > 0) {
        digest += `- ${thread.contactName}: ${newMessages.length} new message${newMessages.length > 1 ? 's' : ''}\n`;

        // Check for important items
        const hasDecision = newMessages.some(m => m.decisionData);
        const hasTask = newMessages.some(m => m.relatedTaskId);

        if (hasDecision) digest += `  - Contains decision request\n`;
        if (hasTask) digest += `  - Contains task assignment\n`;
      }
    }

    return digest;
  }

  // ============= SEARCH =============

  /**
   * Search messages across threads
   */
  searchMessages(
    threads: Thread[],
    query: string
  ): { thread: Thread; message: Message }[] {
    const results: { thread: Thread; message: Message }[] = [];
    const lowerQuery = query.toLowerCase();

    for (const thread of threads) {
      for (const message of thread.messages) {
        const matchText = message.text.toLowerCase().includes(lowerQuery);
        const matchSender = thread.contactName.toLowerCase().includes(lowerQuery);
        const matchAttachment = message.attachment?.name.toLowerCase().includes(lowerQuery);

        if (matchText || matchSender || matchAttachment) {
          results.push({ thread, message });
        }
      }
    }

    // Sort by timestamp, most recent first
    return results.sort((a, b) =>
      b.message.timestamp.getTime() - a.message.timestamp.getTime()
    );
  }

  // ============= STATISTICS =============

  /**
   * Get message statistics for a thread
   */
  getThreadStatistics(thread: Thread) {
    const messages = thread.messages;
    const myMessages = messages.filter(m => m.sender === 'me');
    const theirMessages = messages.filter(m => m.sender !== 'me');

    const decisions = messages.filter(m => m.decisionData);
    const approvedDecisions = decisions.filter(m => m.decisionData?.status === 'approved');
    const pendingDecisions = decisions.filter(m => m.decisionData?.status === 'open');

    const tasks = messages.filter(m => m.relatedTaskId);
    const attachments = messages.filter(m => m.attachment);

    return {
      totalMessages: messages.length,
      sentByMe: myMessages.length,
      sentByThem: theirMessages.length,
      decisions: {
        total: decisions.length,
        approved: approvedDecisions.length,
        pending: pendingDecisions.length,
      },
      tasksCreated: tasks.length,
      attachments: attachments.length,
      averageResponseTime: this.calculateAvgResponseTime(messages),
    };
  }

  /**
   * Calculate average response time in minutes
   */
  private calculateAvgResponseTime(messages: Message[]): number {
    const responseTimes: number[] = [];

    for (let i = 1; i < messages.length; i++) {
      const prev = messages[i - 1];
      const curr = messages[i];

      // Only count responses (different senders)
      if (prev.sender !== curr.sender) {
        const diff = curr.timestamp.getTime() - prev.timestamp.getTime();
        responseTimes.push(diff / (1000 * 60)); // Convert to minutes
      }
    }

    if (responseTimes.length === 0) return 0;

    const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    return Math.round(avg);
  }
}

// Export singleton instance
export const messagesExportService = new MessagesExportService();
