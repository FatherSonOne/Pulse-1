// src/services/messageSummarizationService.ts
// Message Summarization Service
// Provides thread summaries, daily digests, and catch-up summaries

import { supabase } from './supabase';
import { processWithModel } from './geminiService';
import { messageChannelService } from './messageChannelService';
import { ChannelMessage } from '../types/messages';

// ==================== Types ====================

export interface ThreadSummary {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  decisions: string[];
  participants: string[];
  messageCount: number;
}

export interface DailyDigest {
  summary: string;
  channelSummaries: ChannelDigest[];
  actionItems: string[];
  totalMessages: number;
  date: string;
}

export interface ChannelDigest {
  channelId: string;
  channelName: string;
  messageCount: number;
  highlights: string[];
  topParticipants: string[];
}

export interface CatchUpSummary {
  summary: string;
  keyChanges: string[];
  decisonsMade: string[];
  actionItems: string[];
  messageCount: number;
  timeframe: string;
}

// ==================== Cache Management ====================

const summaryCache = new Map<
  string,
  { data: any; timestamp: number; messageCount: number }
>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function getCacheKey(type: string, id: string): string {
  return `${type}:${id}`;
}

function getCached<T>(type: string, id: string): T | null {
  const key = getCacheKey(type, id);
  const cached = summaryCache.get(key);

  if (!cached) return null;

  if (Date.now() - cached.timestamp > CACHE_TTL) {
    summaryCache.delete(key);
    return null;
  }

  return cached.data as T;
}

function setCached<T>(type: string, id: string, data: T, messageCount: number): void {
  const key = getCacheKey(type, id);
  summaryCache.set(key, { data, timestamp: Date.now(), messageCount });
}

// ==================== Service Class ====================

class MessageSummarizationService {
  /**
   * Summarize a message thread
   */
  async summarizeThread(
    channelId: string,
    threadId: string,
    userId: string,
    apiKey: string
  ): Promise<ThreadSummary> {
    try {
      // Check cache first
      const cached = getCached<ThreadSummary>('thread', threadId);
      if (cached) {
        return cached;
      }

      // Get thread messages
      const messages = await messageChannelService.getThreadMessages(threadId);

      if (messages.length === 0) {
        throw new Error('No messages in thread');
      }

      // Build context for AI
      const context = messages
        .map((m) => `[${m.sender_name || 'Unknown'}]: ${m.content}`)
        .join('\n');

      // Generate summary using Gemini Flash
      const prompt = `Analyze this conversation thread and provide a structured summary.

Thread Messages:
${context}

Please provide:
1. A concise overall summary (2-3 sentences capturing the main discussion)
2. Key points discussed (3-5 bullet points of main topics or arguments)
3. Action items identified (tasks or next steps mentioned)
4. Decisions made (any conclusions or agreements reached)
5. Participants involved (list of participant names)

Return as JSON with this exact structure:
{
  "summary": "overall summary text",
  "keyPoints": ["point 1", "point 2", ...],
  "actionItems": ["item 1", "item 2", ...],
  "decisions": ["decision 1", "decision 2", ...],
  "participants": ["name 1", "name 2", ...]
}`;

      const response = await processWithModel(apiKey, prompt, 'gemini-2.5-flash');

      if (!response) {
        throw new Error('Failed to generate summary');
      }

      // Parse JSON response
      const parsed = this.parseJSONResponse(response);

      const summary: ThreadSummary = {
        summary: parsed.summary || 'No summary available',
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
        decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
        participants: Array.isArray(parsed.participants) ? parsed.participants : [],
        messageCount: messages.length,
      };

      // Cache the summary
      setCached('thread', threadId, summary, messages.length);

      // Save to database
      await this.saveSummary(
        userId,
        'thread',
        threadId,
        summary.summary,
        summary.keyPoints,
        summary.actionItems,
        summary.decisions,
        summary.participants,
        summary.messageCount
      );

      return summary;
    } catch (error) {
      console.error('[Summarization] Error summarizing thread:', error);
      throw error;
    }
  }

  /**
   * Generate daily digest for a user
   */
  async generateDailyDigest(
    userId: string,
    workspaceId: string,
    date: Date,
    apiKey: string
  ): Promise<DailyDigest> {
    try {
      const dateStr = date.toISOString().split('T')[0];

      // Check cache
      const cached = getCached<DailyDigest>('daily', dateStr);
      if (cached) {
        return cached;
      }

      // Get all channels for workspace
      const channels = await messageChannelService.getChannels(workspaceId);

      const channelSummaries: ChannelDigest[] = [];
      const allActionItems: string[] = [];

      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Summarize each channel
      for (const channel of channels) {
        // Get messages for the day
        const { data: messages } = await supabase
          .from('messages')
          .select('*')
          .eq('channel_id', channel.id)
          .gte('created_at', startOfDay.toISOString())
          .lte('created_at', endOfDay.toISOString())
          .order('created_at', { ascending: true });

        if (!messages || messages.length === 0) {
          continue;
        }

        // Build context for channel
        const channelContext = messages.map((m: any) => `${m.sender_name || 'Unknown'}: ${m.content}`).join('\n');

        // Get channel summary
        const channelPrompt = `Summarize today's activity in the #${channel.name} channel:

Messages:
${channelContext}

Provide:
1. Top 3 highlights (brief, one-line summaries of key events or discussions)
2. Action items mentioned (tasks, todos, or requests)

Return as JSON:
{
  "highlights": ["highlight 1", "highlight 2", "highlight 3"],
  "actionItems": ["item 1", "item 2", ...]
}`;

        try {
          const channelResponse = await processWithModel(apiKey, channelPrompt, 'gemini-2.5-flash-lite');
          const channelData = this.parseJSONResponse(channelResponse || '{}');

          // Get top participants
          const participantCounts = new Map<string, number>();
          for (const msg of messages) {
            const name = (msg as any).sender_name || 'Unknown';
            participantCounts.set(name, (participantCounts.get(name) || 0) + 1);
          }
          const topParticipants = Array.from(participantCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name]) => name);

          channelSummaries.push({
            channelId: channel.id,
            channelName: channel.name,
            messageCount: messages.length,
            highlights: Array.isArray(channelData.highlights) ? channelData.highlights : [],
            topParticipants,
          });

          if (Array.isArray(channelData.actionItems)) {
            allActionItems.push(...channelData.actionItems);
          }
        } catch (error) {
          console.error(`[Summarization] Error summarizing channel ${channel.name}:`, error);
        }
      }

      // Generate overall summary
      const overallPrompt = `Create a brief executive summary of today's workspace activity:

${channelSummaries.map((c) => `#${c.channelName} (${c.messageCount} messages): ${c.highlights.join('; ')}`).join('\n')}

Provide a 2-3 sentence overview of the most important activities and outcomes from today.`;

      const overallSummary = await processWithModel(apiKey, overallPrompt, 'gemini-2.5-flash-lite');

      const digest: DailyDigest = {
        summary: overallSummary || 'No significant activity today',
        channelSummaries,
        actionItems: [...new Set(allActionItems)], // Remove duplicates
        totalMessages: channelSummaries.reduce((sum, c) => sum + c.messageCount, 0),
        date: dateStr,
      };

      // Cache the digest
      setCached('daily', dateStr, digest, digest.totalMessages);

      // Save to database
      await this.saveSummary(
        userId,
        'daily_digest',
        dateStr,
        digest.summary,
        digest.channelSummaries.map((c) => c.channelName),
        digest.actionItems,
        [],
        [],
        digest.totalMessages
      );

      return digest;
    } catch (error) {
      console.error('[Summarization] Error generating daily digest:', error);
      throw error;
    }
  }

  /**
   * Generate catch-up summary for messages since last visit
   */
  async generateCatchUpSummary(
    channelId: string,
    userId: string,
    sinceDate: Date,
    apiKey: string
  ): Promise<CatchUpSummary> {
    try {
      const cacheKey = `${channelId}-${sinceDate.toISOString()}`;
      const cached = getCached<CatchUpSummary>('catchup', cacheKey);
      if (cached) {
        return cached;
      }

      // Get messages since last visit
      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .eq('channel_id', channelId)
        .gte('created_at', sinceDate.toISOString())
        .order('created_at', { ascending: true });

      if (!messages || messages.length === 0) {
        return {
          summary: 'No new messages since your last visit',
          keyChanges: [],
          decisonsMade: [],
          actionItems: [],
          messageCount: 0,
          timeframe: this.formatTimeframe(sinceDate),
        };
      }

      // Build context
      const context = messages.map((m: any) => `[${m.sender_name || 'Unknown'}]: ${m.content}`).join('\n');

      // Generate catch-up summary
      const prompt = `Analyze these messages and create a "while you were away" summary:

Messages:
${context}

Focus on:
1. Overall summary of what happened (2-3 sentences)
2. Key changes or developments
3. Important decisions made
4. Action items or requests directed at anyone

Return as JSON:
{
  "summary": "what happened while away",
  "keyChanges": ["change 1", "change 2", ...],
  "decisionsMade": ["decision 1", "decision 2", ...],
  "actionItems": ["item 1", "item 2", ...]
}`;

      const response = await processWithModel(apiKey, prompt, 'gemini-2.5-flash');
      const parsed = this.parseJSONResponse(response || '{}');

      const catchUpSummary: CatchUpSummary = {
        summary: parsed.summary || 'New messages were exchanged',
        keyChanges: Array.isArray(parsed.keyChanges) ? parsed.keyChanges : [],
        decisonsMade: Array.isArray(parsed.decisionsMade) ? parsed.decisionsMade : [],
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
        messageCount: messages.length,
        timeframe: this.formatTimeframe(sinceDate),
      };

      // Cache
      setCached('catchup', cacheKey, catchUpSummary, messages.length);

      // Save to database
      await this.saveSummary(
        userId,
        'catch_up',
        cacheKey,
        catchUpSummary.summary,
        catchUpSummary.keyChanges,
        catchUpSummary.actionItems,
        catchUpSummary.decisonsMade,
        [],
        catchUpSummary.messageCount
      );

      return catchUpSummary;
    } catch (error) {
      console.error('[Summarization] Error generating catch-up summary:', error);
      throw error;
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Parse JSON response from AI (handles markdown code blocks)
   */
  private parseJSONResponse(response: string): any {
    try {
      // Remove markdown code blocks if present
      let cleaned = response.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.substring(7);
      }
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.substring(3);
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.substring(0, cleaned.length - 3);
      }

      return JSON.parse(cleaned.trim());
    } catch (error) {
      console.error('[Summarization] Error parsing JSON:', error);
      return {};
    }
  }

  /**
   * Format timeframe for display
   */
  private formatTimeframe(since: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - since.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 1) {
      return `${diffDays} days`;
    } else if (diffHours > 1) {
      return `${diffHours} hours`;
    } else {
      return 'less than an hour';
    }
  }

  /**
   * Save summary to database
   */
  private async saveSummary(
    userId: string,
    summaryType: string,
    referenceId: string,
    summaryText: string,
    keyPoints: string[],
    actionItems: string[],
    decisions: string[],
    participants: string[],
    messageCount: number
  ): Promise<void> {
    try {
      await supabase.from('conversation_summaries').insert({
        user_id: userId,
        summary_type: summaryType,
        reference_id: referenceId,
        summary_text: summaryText,
        key_points: keyPoints,
        action_items: actionItems,
        decisions: decisions,
        participants: participants,
        message_count: messageCount,
      });
    } catch (error) {
      console.error('[Summarization] Error saving summary:', error);
      // Non-critical, don't throw
    }
  }

  /**
   * Get saved summaries for a user
   */
  async getSummaries(
    userId: string,
    summaryType?: string,
    limit: number = 10
  ): Promise<any[]> {
    try {
      let query = supabase
        .from('conversation_summaries')
        .select('*')
        .eq('user_id', userId)
        .order('generated_at', { ascending: false })
        .limit(limit);

      if (summaryType) {
        query = query.eq('summary_type', summaryType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[Summarization] Error fetching summaries:', error);
      return [];
    }
  }

  /**
   * Delete old summaries
   */
  async cleanupOldSummaries(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const { data, error } = await supabase
        .from('conversation_summaries')
        .delete()
        .lt('generated_at', cutoffDate.toISOString())
        .select('id');

      if (error) throw error;
      return data?.length || 0;
    } catch (error) {
      console.error('[Summarization] Error cleaning up summaries:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const messageSummarizationService = new MessageSummarizationService();
export default messageSummarizationService;
