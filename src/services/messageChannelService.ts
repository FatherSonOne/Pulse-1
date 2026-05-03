// src/services/messageChannelService.ts
//
// Workspace-channel messages service. Reads/writes `channel_messages`
// (the canonical workspace channel table created in Phase 5a migration
// `20260426000008_channel_messages_canonical.sql`).
//
// Reactions and read-receipts use the dedicated tables created by the
// same migration:
//   - message_reactions  (atomic, row-per-reaction)
//   - message_reads      (composite-key (message_id, user_id))
//
// The legacy `channel_messages.reactions jsonb` column is DEPRECATED —
// kept only for back-compat with rows written before atomic reactions
// existed. New code MUST NOT write to it; readers should use the
// `message_reactions` table (hydrated by `getMessages` / `getReactionsForMessages`).
//
// History:
//   - Pre-Session 5a: queried `from('messages')` against a phantom
//     schema that didn't exist in production (issue #0 in deep dive).
//   - Session 5a (2026-04-26): canonical `channel_messages` table
//     landed; this service flipped to it.

import { supabase } from './supabase';
import {
  ChannelMessage,
  MessageChannel,
  MessageDraft,
  ChannelMember,
} from '../types/messages';
import { generateSmartReply, analyzeDraftIntent } from './geminiService';

// Types for enhanced features
export interface TypingIndicator {
  userId: string;
  userName: string;
  channelId: string;
  timestamp: Date;
}

export interface MessageSearchFilters {
  channelId?: string;
  senderId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  hasAttachments?: boolean;
  isPinned?: boolean;
  messageType?: 'text' | 'image' | 'file' | 'voice';
}

export interface SearchResult {
  message: ChannelMessage;
  channelName: string;
  highlightedContent: string;
  relevanceScore: number;
}

export interface SmartReplyOption {
  text: string;
  tone: 'professional' | 'friendly' | 'brief' | 'detailed';
  confidence: number;
}

export interface DraftAnalysisResult {
  intent: string;
  confidence: number;
  suggestions: string[];
  warnings: string[];
  estimatedReadTime: number;
}

// Module-level timeout storage for typing indicators
const typingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

export const messageChannelService = {
  // ==================== Channel Operations ====================

  async getChannels(workspaceId: string): Promise<MessageChannel[]> {
    const { data, error } = await supabase
      .from('message_channels')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data as MessageChannel[];
  },

  async getChannel(channelId: string): Promise<MessageChannel | null> {
    const { data, error } = await supabase
      .from('message_channels')
      .select('*')
      .eq('id', channelId)
      .single();

    if (error) return null;
    return data as MessageChannel;
  },

  async createChannel(
    workspaceId: string,
    name: string,
    description?: string,
    isGroup: boolean = false,
    createdBy?: string
  ): Promise<MessageChannel> {
    const { data, error } = await supabase
      .from('message_channels')
      .insert([
        {
          workspace_id: workspaceId,
          name,
          description,
          is_group: isGroup,
          is_public: !isGroup,
          created_by: createdBy,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data as MessageChannel;
  },

  async updateChannel(
    channelId: string,
    updates: Partial<MessageChannel>
  ): Promise<MessageChannel> {
    const { data, error } = await supabase
      .from('message_channels')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', channelId)
      .select()
      .single();

    if (error) throw error;
    return data as MessageChannel;
  },

  async deleteChannel(channelId: string): Promise<void> {
    const { error } = await supabase
      .from('message_channels')
      .delete()
      .eq('id', channelId);

    if (error) throw error;
  },

  // ==================== Channel Members ====================

  async getChannelMembers(channelId: string): Promise<ChannelMember[]> {
    const { data, error } = await supabase
      .from('channel_members')
      .select(`
        *,
        users:user_id (
          id,
          name,
          avatar_url
        )
      `)
      .eq('channel_id', channelId);

    if (error) throw error;
    return data as ChannelMember[];
  },

  async addChannelMember(
    channelId: string,
    userId: string,
    role: 'admin' | 'member' = 'member'
  ): Promise<ChannelMember> {
    const { data, error } = await supabase
      .from('channel_members')
      .insert([{ channel_id: channelId, user_id: userId, role }])
      .select()
      .single();

    if (error) throw error;
    return data as ChannelMember;
  },

  async removeChannelMember(channelId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('channel_members')
      .delete()
      .eq('channel_id', channelId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  async updateMemberRole(
    channelId: string,
    userId: string,
    role: 'admin' | 'member'
  ): Promise<void> {
    const { error } = await supabase
      .from('channel_members')
      .update({ role })
      .eq('channel_id', channelId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  // ==================== Messages ====================

  async getMessages(
    channelId: string,
    limit: number = 50,
    before?: string
  ): Promise<ChannelMessage[]> {
    let query = supabase
      .from('channel_messages')
      .select('*')
      .eq('channel_id', channelId)
      .is('thread_id', null) // Only get top-level messages
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;
    if (error) throw error;
    const messages = (data as ChannelMessage[]).reverse();

    // Hydrate reactions from the atomic message_reactions table.
    // The legacy JSON-blob `messages.reactions` field is preserved for
    // backwards compatibility but not authoritative — UI consumers
    // should treat the hydrated value here as truth.
    if (messages.length > 0) {
      try {
        const reactionsByMessage = await this.getReactionsForMessages(
          messages.map((m) => m.id)
        );
        for (const m of messages) {
          if (reactionsByMessage[m.id]) {
            m.reactions = reactionsByMessage[m.id];
          }
        }
      } catch {
        // Don't fail message loading if reaction hydration fails.
      }
    }

    return messages;
  },

  async sendMessage(
    channelId: string,
    senderId: string,
    content: string,
    messageType: 'text' | 'image' | 'file' | 'voice' = 'text',
    attachments?: any[],
    threadId?: string
  ): Promise<ChannelMessage> {
    const { data, error } = await supabase
      .from('channel_messages')
      .insert([
        {
          channel_id: channelId,
          sender_id: senderId,
          content,
          message_type: messageType,
          attachments: attachments || [],
          thread_id: threadId,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data as ChannelMessage;
  },

  async editMessage(
    messageId: string,
    content: string
  ): Promise<ChannelMessage> {
    const { data, error } = await supabase
      .from('channel_messages')
      .update({ content, edited_at: new Date().toISOString() })
      .eq('id', messageId)
      .select()
      .single();

    if (error) throw error;
    return data as ChannelMessage;
  },

  async deleteMessage(messageId: string): Promise<void> {
    const { error } = await supabase
      .from('channel_messages')
      .delete()
      .eq('id', messageId);

    if (error) throw error;
  },

  async pinMessage(messageId: string, isPinned: boolean): Promise<void> {
    const { error } = await supabase
      .from('channel_messages')
      .update({ is_pinned: isPinned })
      .eq('id', messageId);

    if (error) throw error;
  },

  /**
   * Add a reaction to a message. Atomic via the message_reactions table —
   * concurrent inserts are de-duplicated by the (message_id, user_id, emoji)
   * unique constraint. Replaces the previous JSON-blob read-modify-write
   * pattern that could lose concurrent reactions.
   */
  async addReaction(
    messageId: string,
    emoji: string,
    userId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('message_reactions')
      .upsert(
        { message_id: messageId, user_id: userId, emoji },
        { onConflict: 'message_id,user_id,emoji', ignoreDuplicates: true }
      );

    if (error) throw error;
  },

  async removeReaction(
    messageId: string,
    emoji: string,
    userId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('emoji', emoji);

    if (error) throw error;
  },

  /**
   * Load all reactions for a list of messages, grouped by message id and
   * shaped as `{ emoji: userId[] }` for back-compat with the legacy
   * `ChannelMessage.reactions` field consumers.
   */
  async getReactionsForMessages(
    messageIds: string[]
  ): Promise<Record<string, Record<string, string[]>>> {
    if (messageIds.length === 0) return {};
    const { data, error } = await supabase
      .from('message_reactions')
      .select('message_id, user_id, emoji')
      .in('message_id', messageIds);

    if (error) throw error;

    const grouped: Record<string, Record<string, string[]>> = {};
    for (const row of data || []) {
      const r = row as { message_id: string; user_id: string; emoji: string };
      grouped[r.message_id] ??= {};
      grouped[r.message_id][r.emoji] ??= [];
      if (!grouped[r.message_id][r.emoji].includes(r.user_id)) {
        grouped[r.message_id][r.emoji].push(r.user_id);
      }
    }
    return grouped;
  },

  // ==================== Read Receipts ====================

  /**
   * Mark one or more messages as read by the current user. Idempotent —
   * re-marking is a no-op via the message_reads composite primary key.
   */
  async markMessagesRead(
    messageIds: string[],
    userId: string
  ): Promise<void> {
    if (messageIds.length === 0 || !userId) return;
    const rows = messageIds.map((id) => ({
      message_id: id,
      user_id: userId,
    }));
    const { error } = await supabase
      .from('message_reads')
      .upsert(rows, { onConflict: 'message_id,user_id', ignoreDuplicates: true });
    if (error) throw error;
  },

  /**
   * Load the readers for a batch of messages. Returns a map of
   * messageId → list of `{ userId, readAt }`, sorted oldest-first.
   */
  async getReadsForMessages(
    messageIds: string[]
  ): Promise<Record<string, Array<{ userId: string; readAt: string }>>> {
    if (messageIds.length === 0) return {};
    const { data, error } = await supabase
      .from('message_reads')
      .select('message_id, user_id, read_at')
      .in('message_id', messageIds)
      .order('read_at', { ascending: true });

    if (error) throw error;

    const grouped: Record<string, Array<{ userId: string; readAt: string }>> = {};
    for (const row of data || []) {
      const r = row as { message_id: string; user_id: string; read_at: string };
      grouped[r.message_id] ??= [];
      grouped[r.message_id].push({ userId: r.user_id, readAt: r.read_at });
    }
    return grouped;
  },

  /**
   * Subscribe to read-receipt changes on a channel's messages. Calls
   * `onRead` with the new row when any reader marks a message read.
   */
  subscribeToChannelReads(
    channelId: string,
    onRead: (row: { messageId: string; userId: string; readAt: string }) => void
  ) {
    const channel = supabase
      .channel(`channel-reads:${channelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_reads' },
        (payload) => {
          const r = payload.new as {
            message_id: string;
            user_id: string;
            read_at: string;
          };
          onRead({ messageId: r.message_id, userId: r.user_id, readAt: r.read_at });
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  },

  // ==================== Thread Messages ====================

  async getThreadMessages(threadId: string): Promise<ChannelMessage[]> {
    const { data, error } = await supabase
      .from('channel_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data as ChannelMessage[];
  },

  async getThreadCount(messageId: string): Promise<number> {
    const { count, error } = await supabase
      .from('channel_messages')
      .select('*', { count: 'exact', head: true })
      .eq('thread_id', messageId);

    if (error) return 0;
    return count || 0;
  },

  // ==================== Drafts ====================

  async getDraft(userId: string, channelId: string): Promise<MessageDraft | null> {
    const { data, error } = await supabase
      .from('message_drafts')
      .select('*')
      .eq('user_id', userId)
      .eq('channel_id', channelId)
      .single();

    if (error) return null;
    return data as MessageDraft;
  },

  async saveDraft(
    userId: string,
    channelId: string,
    content: string
  ): Promise<MessageDraft> {
    const { data, error } = await supabase
      .from('message_drafts')
      .upsert(
        {
          user_id: userId,
          channel_id: channelId,
          content,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,channel_id' }
      )
      .select()
      .single();

    if (error) throw error;
    return data as MessageDraft;
  },

  async deleteDraft(userId: string, channelId: string): Promise<void> {
    const { error } = await supabase
      .from('message_drafts')
      .delete()
      .eq('user_id', userId)
      .eq('channel_id', channelId);

    if (error) throw error;
  },

  // ==================== Search ====================

  async searchMessages(
    channelId: string,
    query: string
  ): Promise<ChannelMessage[]> {
    const { data, error } = await supabase
      .from('channel_messages')
      .select('*')
      .eq('channel_id', channelId)
      .ilike('content', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return data as ChannelMessage[];
  },

  // ==================== Pinned Messages ====================

  async getPinnedMessages(channelId: string): Promise<ChannelMessage[]> {
    const { data, error } = await supabase
      .from('channel_messages')
      .select('*')
      .eq('channel_id', channelId)
      .eq('is_pinned', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as ChannelMessage[];
  },

  // ==================== Real-time Subscriptions ====================

  async subscribeToChannel(
    channelId: string,
    onMessage: (message: ChannelMessage) => void
  ): Promise<any> {
    // AUTH GUARD: Check session before subscribing
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      console.warn('[MessageChannelService] Cannot subscribe to channel: user not authenticated');
      return null;
    }

    return supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'channel_messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          onMessage(payload.new as ChannelMessage);
        }
      )
      .subscribe();
  },

  unsubscribeFromChannel(channelId: string) {
    supabase.removeChannel(supabase.channel(`messages:${channelId}`));
  },

  // ==================== AI-Powered Features (Option A) ====================

  /**
   * Generate smart reply suggestions based on conversation context
   */
  async getSmartReplies(
    apiKey: string,
    channelId: string,
    currentUserId: string,
    limit: number = 10
  ): Promise<SmartReplyOption[]> {
    try {
      // Get recent messages for context
      const messages = await this.getMessages(channelId, limit);
      if (messages.length === 0) return [];

      const history = messages.map(m => ({
        role: m.sender_id === currentUserId ? 'me' : 'other',
        text: m.content
      }));

      const reply = await generateSmartReply(apiKey, history);
      if (!reply) return [];

      // Generate multiple reply options with different tones
      return [
        { text: reply, tone: 'professional', confidence: 0.9 },
        { text: this.makeBrief(reply), tone: 'brief', confidence: 0.85 },
        { text: this.makeFriendly(reply), tone: 'friendly', confidence: 0.8 },
      ];
    } catch (error) {
      console.error('Error generating smart replies:', error);
      return [];
    }
  },

  /**
   * Analyze draft message before sending
   */
  async analyzeDraft(
    apiKey: string,
    draftContent: string,
    channelId: string
  ): Promise<DraftAnalysisResult | null> {
    try {
      const analysis = await analyzeDraftIntent(apiKey, draftContent);
      if (!analysis) return null;

      const wordCount = draftContent.split(/\s+/).length;
      const estimatedReadTime = Math.ceil(wordCount / 200); // ~200 words per minute

      return {
        intent: analysis.intent,
        confidence: analysis.confidence,
        suggestions: analysis.suggestion ? [analysis.suggestion] : [],
        warnings: this.detectDraftWarnings(draftContent),
        estimatedReadTime: Math.max(1, estimatedReadTime)
      };
    } catch (error) {
      console.error('Error analyzing draft:', error);
      return null;
    }
  },

  /**
   * Detect potential issues in draft message
   */
  detectDraftWarnings(content: string): string[] {
    const warnings: string[] = [];

    // Check for all caps
    if (content === content.toUpperCase() && content.length > 20) {
      warnings.push('Message is in all caps - this may seem aggressive');
    }

    // Check for excessive punctuation
    if (/[!?]{3,}/.test(content)) {
      warnings.push('Consider reducing exclamation/question marks');
    }

    // Check for potentially sensitive words
    const sensitivePatterns = [
      { pattern: /\burgent\b/i, warning: 'Using "urgent" - make sure it truly is' },
      { pattern: /\bASAP\b/i, warning: 'ASAP can create pressure - specify actual deadline if possible' },
      { pattern: /\bfailure\b/i, warning: 'Consider rephrasing to be more constructive' },
    ];

    for (const { pattern, warning } of sensitivePatterns) {
      if (pattern.test(content)) {
        warnings.push(warning);
      }
    }

    return warnings;
  },

  // Helper methods for tone variations
  makeBrief(text: string): string {
    // Simple truncation for brief version
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());
    if (sentences.length <= 1) return text;
    return sentences[0].trim() + '.';
  },

  makeFriendly(text: string): string {
    // Add friendly elements
    const friendlyPrefixes = ['Thanks! ', 'Great question! ', 'Happy to help! '];
    const prefix = friendlyPrefixes[Math.floor(Math.random() * friendlyPrefixes.length)];
    return prefix + text;
  },

  // ==================== Real-Time Typing Indicators ====================

  // Note: typingTimeouts is managed as a module-level variable for persistence
  /**
   * Broadcast typing indicator to channel
   */
  async sendTypingIndicator(
    channelId: string,
    userId: string,
    userName: string
  ): Promise<void> {
    const channel = supabase.channel(`typing:${channelId}`);

    await channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        userId,
        userName,
        channelId,
        timestamp: new Date().toISOString()
      }
    });
  },

  /**
   * Subscribe to typing indicators for a channel
   */
  async subscribeToTypingIndicators(
    channelId: string,
    onTyping: (indicator: TypingIndicator) => void,
    onStopTyping: (userId: string) => void
  ): Promise<any> {
    // AUTH GUARD: Check session before subscribing
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      console.warn('[MessageChannelService] Cannot subscribe to typing indicators: user not authenticated');
      return null;
    }

    const channel = supabase
      .channel(`typing:${channelId}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        const indicator: TypingIndicator = {
          userId: payload.payload.userId,
          userName: payload.payload.userName,
          channelId: payload.payload.channelId,
          timestamp: new Date(payload.payload.timestamp)
        };

        onTyping(indicator);

        // Clear existing timeout for this user
        const timeoutKey = `${channelId}:${indicator.userId}`;
        const existingTimeout = this.typingTimeouts.get(timeoutKey);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        // Set new timeout to clear typing indicator after 3 seconds
        const timeout = setTimeout(() => {
          onStopTyping(indicator.userId);
          this.typingTimeouts.delete(timeoutKey);
        }, 3000);

        this.typingTimeouts.set(timeoutKey, timeout);
      })
      .subscribe();

    return channel;
  },

  /**
   * Unsubscribe from typing indicators
   */
  unsubscribeFromTypingIndicators(channelId: string) {
    supabase.removeChannel(supabase.channel(`typing:${channelId}`));

    // Clear any pending timeouts for this channel
    for (const [key, timeout] of this.typingTimeouts.entries()) {
      if (key.startsWith(`${channelId}:`)) {
        clearTimeout(timeout);
        this.typingTimeouts.delete(key);
      }
    }
  },

  // ==================== Enhanced Search with Filters ====================

  /**
   * Advanced message search with multiple filters
   */
  async searchMessagesAdvanced(
    workspaceId: string,
    query: string,
    filters: MessageSearchFilters = {}
  ): Promise<SearchResult[]> {
    // Defense-in-depth (#33 PR-12): !inner forces an inner-join filter on
    // the parent table by the embedded resource's workspace_id, so
    // cross-workspace channel_messages cannot leak even if RLS regresses.
    let dbQuery = supabase
      .from('channel_messages')
      .select(`
        *,
        channels:channel_id!inner (
          name,
          workspace_id
        )
      `)
      .eq('channels.workspace_id', workspaceId)
      .ilike('content', `%${query}%`);

    // Apply filters
    if (filters.channelId) {
      dbQuery = dbQuery.eq('channel_id', filters.channelId);
    }

    if (filters.senderId) {
      dbQuery = dbQuery.eq('sender_id', filters.senderId);
    }

    if (filters.dateFrom) {
      dbQuery = dbQuery.gte('created_at', filters.dateFrom.toISOString());
    }

    if (filters.dateTo) {
      dbQuery = dbQuery.lte('created_at', filters.dateTo.toISOString());
    }

    if (filters.hasAttachments) {
      dbQuery = dbQuery.not('attachments', 'is', null);
    }

    if (filters.isPinned !== undefined) {
      dbQuery = dbQuery.eq('is_pinned', filters.isPinned);
    }

    if (filters.messageType) {
      dbQuery = dbQuery.eq('message_type', filters.messageType);
    }

    const { data, error } = await dbQuery
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    // Transform to SearchResult with highlighting
    return (data || []).map((msg: any) => ({
      message: msg as ChannelMessage,
      channelName: msg.channels?.name || 'Unknown Channel',
      highlightedContent: this.highlightSearchTerm(msg.content, query),
      relevanceScore: this.calculateRelevance(msg.content, query)
    }));
  },

  /**
   * Highlight search term in content
   */
  highlightSearchTerm(content: string, searchTerm: string): string {
    if (!searchTerm) return content;
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return content.replace(regex, '**$1**');
  },

  /**
   * Calculate relevance score for search result
   */
  calculateRelevance(content: string, searchTerm: string): number {
    const lowerContent = content.toLowerCase();
    const lowerSearch = searchTerm.toLowerCase();

    // Exact match at start gets highest score
    if (lowerContent.startsWith(lowerSearch)) return 1.0;

    // Count occurrences
    const matches = (lowerContent.match(new RegExp(lowerSearch, 'g')) || []).length;

    // Calculate score based on match density
    const density = matches / (content.length / 100);
    return Math.min(0.9, density * 0.3 + 0.3);
  },

  // ==================== Message Statistics ====================

  /**
   * Get channel message statistics
   */
  async getChannelStats(channelId: string): Promise<{
    totalMessages: number;
    messagesThisWeek: number;
    messagesThisMonth: number;
    topContributors: { userId: string; count: number }[];
    pinnedCount: number;
    attachmentCount: number;
  }> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get total count
    const { count: totalMessages } = await supabase
      .from('channel_messages')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', channelId);

    // Get this week count
    const { count: messagesThisWeek } = await supabase
      .from('channel_messages')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', channelId)
      .gte('created_at', weekAgo.toISOString());

    // Get this month count
    const { count: messagesThisMonth } = await supabase
      .from('channel_messages')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', channelId)
      .gte('created_at', monthAgo.toISOString());

    // Get pinned count
    const { count: pinnedCount } = await supabase
      .from('channel_messages')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', channelId)
      .eq('is_pinned', true);

    // Get attachment count
    const { count: attachmentCount } = await supabase
      .from('channel_messages')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', channelId)
      .not('attachments', 'is', null);

    // Get top contributors (simplified - in production use aggregation)
    const { data: recentMessages } = await supabase
      .from('channel_messages')
      .select('sender_id')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(200);

    const contributorCounts = new Map<string, number>();
    for (const msg of recentMessages || []) {
      const count = contributorCounts.get(msg.sender_id) || 0;
      contributorCounts.set(msg.sender_id, count + 1);
    }

    const topContributors = Array.from(contributorCounts.entries())
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalMessages: totalMessages || 0,
      messagesThisWeek: messagesThisWeek || 0,
      messagesThisMonth: messagesThisMonth || 0,
      topContributors,
      pinnedCount: pinnedCount || 0,
      attachmentCount: attachmentCount || 0
    };
  },

  // ==================== Optimistic Updates Support ====================

  /**
   * Create an optimistic message for immediate UI update
   */
  createOptimisticMessage(
    channelId: string,
    senderId: string,
    senderName: string,
    content: string,
    messageType: 'text' | 'image' | 'file' | 'voice' = 'text'
  ): ChannelMessage {
    return {
      id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      channel_id: channelId,
      sender_id: senderId,
      sender_name: senderName,
      content,
      message_type: messageType,
      created_at: new Date().toISOString(),
      is_pinned: false,
      reactions: {}
    };
  },

  /**
   * Send message with optimistic update support
   */
  async sendMessageOptimistic(
    channelId: string,
    senderId: string,
    senderName: string,
    content: string,
    messageType: 'text' | 'image' | 'file' | 'voice' = 'text',
    attachments?: any[],
    threadId?: string,
    onOptimistic?: (message: ChannelMessage) => void,
    onConfirmed?: (message: ChannelMessage) => void,
    onError?: (tempId: string, error: Error) => void
  ): Promise<ChannelMessage | null> {
    // Create optimistic message
    const optimisticMsg = this.createOptimisticMessage(
      channelId, senderId, senderName, content, messageType
    );

    // Immediately show optimistic update
    if (onOptimistic) {
      onOptimistic(optimisticMsg);
    }

    try {
      // Send actual message
      const confirmedMsg = await this.sendMessage(
        channelId, senderId, content, messageType, attachments, threadId
      );

      // Replace optimistic with confirmed
      if (onConfirmed) {
        onConfirmed({ ...confirmedMsg, _tempId: optimisticMsg.id } as any);
      }

      return confirmedMsg;
    } catch (error) {
      // Handle failure - remove optimistic message
      if (onError) {
        onError(optimisticMsg.id, error as Error);
      }
      return null;
    }
  },

  // ==================== Message Read Status ====================

  /**
   * Mark messages as read up to a specific message
   */
  async markAsRead(
    channelId: string,
    userId: string,
    lastReadMessageId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('channel_read_status')
      .upsert({
        channel_id: channelId,
        user_id: userId,
        last_read_message_id: lastReadMessageId,
        last_read_at: new Date().toISOString()
      }, {
        onConflict: 'channel_id,user_id'
      });

    if (error) {
      console.error('Error marking as read:', error);
    }
  },

  /**
   * Get unread count for a channel
   */
  async getUnreadCount(
    channelId: string,
    userId: string
  ): Promise<number> {
    // Get last read message ID
    const { data: readStatus } = await supabase
      .from('channel_read_status')
      .select('last_read_message_id, last_read_at')
      .eq('channel_id', channelId)
      .eq('user_id', userId)
      .single();

    if (!readStatus?.last_read_at) {
      // Never read - count all messages
      const { count } = await supabase
        .from('channel_messages')
        .select('*', { count: 'exact', head: true })
        .eq('channel_id', channelId);
      return count || 0;
    }

    // Count messages after last read
    const { count } = await supabase
      .from('channel_messages')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', channelId)
      .gt('created_at', readStatus.last_read_at);

    return count || 0;
  },

  // ==================== Full Channel Subscription ====================

  // Track active "full" subscriptions so subscribe is idempotent and
  // unsubscribe pulls the same instance instead of creating a fresh one.
  _fullChannels: new Map<string, ReturnType<typeof supabase.channel>>(),

  /**
   * Subscribe to all channel events (messages, edits, deletes, reactions).
   * Idempotent: re-subscribing the same channelId removes the previous
   * subscription first to avoid duplicate listeners.
   */
  async subscribeToChannelFull(
    channelId: string,
    callbacks: {
      onInsert?: (message: ChannelMessage) => void;
      onUpdate?: (message: ChannelMessage) => void;
      onDelete?: (messageId: string) => void;
    }
  ): Promise<any> {
    // AUTH GUARD: Check session before subscribing
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      console.warn('[MessageChannelService] Cannot subscribe to channel full: user not authenticated');
      return null;
    }

    // Replace any existing subscription for this channelId.
    const existing = this._fullChannels.get(channelId);
    if (existing) {
      supabase.removeChannel(existing);
      this._fullChannels.delete(channelId);
    }

    const channel = supabase.channel(`channel-full:${channelId}`);

    if (callbacks.onInsert) {
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'channel_messages', filter: `channel_id=eq.${channelId}` },
        (payload) => callbacks.onInsert!(payload.new as ChannelMessage)
      );
    }

    if (callbacks.onUpdate) {
      channel.on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'channel_messages', filter: `channel_id=eq.${channelId}` },
        (payload) => callbacks.onUpdate!(payload.new as ChannelMessage)
      );
    }

    if (callbacks.onDelete) {
      channel.on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'channel_messages', filter: `channel_id=eq.${channelId}` },
        (payload) => callbacks.onDelete!((payload.old as any).id)
      );
    }

    this._fullChannels.set(channelId, channel);
    return channel.subscribe();
  },

  /**
   * Unsubscribe from full channel events. Safe to call when no
   * subscription exists.
   */
  unsubscribeFromChannelFull(channelId: string) {
    const channel = this._fullChannels.get(channelId);
    if (channel) {
      supabase.removeChannel(channel);
      this._fullChannels.delete(channelId);
    }
  },
};

export default messageChannelService;
