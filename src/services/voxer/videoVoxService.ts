// Video Vox Service - Complete backend for video messaging with AI features
// Includes: Upload, Send, Conversations, Reactions, AI Analysis, Search

import { supabase } from '../supabase';
import { GoogleGenAI, Type } from '@google/genai';
import type {
  VideoVoxMessage,
  VideoVoxConversation,
  VideoVoxConversationMember,
  VideoVoxReaction,
  VideoVoxReadReceipt,
  VideoVoxBookmark,
  VideoVoxAIAnalysis,
  VideoVoxSearchResult,
  PulseUser,
} from './voxModeTypes';

// ============================================
// VIDEO VOX SERVICE CLASS
// ============================================

class VideoVoxService {
  private userId: string | null = null;
  private geminiApiKey: string | null = null;

  // ============================================
  // INITIALIZATION
  // ============================================

  setUserId(userId: string) {
    this.userId = userId;
  }

  async ensureUserId(): Promise<string> {
    if (this.userId) return this.userId;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      this.userId = user.id;
      return user.id;
    }

    const stored = localStorage.getItem('pulse_user_id');
    if (stored) {
      this.userId = stored;
      return stored;
    }

    return '';
  }

  private getGeminiApiKey(): string {
    if (this.geminiApiKey) return this.geminiApiKey;

    const key = import.meta.env.VITE_API_KEY ||
                import.meta.env.VITE_GEMINI_API_KEY ||
                localStorage.getItem('gemini_api_key') ||
                '';

    this.geminiApiKey = key;
    return key;
  }

  // ============================================
  // CONVERSATION MANAGEMENT
  // ============================================

  /**
   * Get or create a conversation between participants
   */
  async getOrCreateConversation(participantIds: string[]): Promise<VideoVoxConversation | null> {
    const userId = await this.ensureUserId();
    if (!userId) return null;

    // Ensure current user is in participants
    const allParticipants = [...new Set([userId, ...participantIds])];

    try {
      // Use the stored function to get or create conversation
      const { data, error } = await supabase.rpc('get_or_create_video_vox_conversation', {
        p_participant_ids: allParticipants,
        p_created_by: userId
      });

      if (error) {
        console.error('Error getting/creating conversation:', error);
        return null;
      }

      // Fetch the full conversation with participants
      return await this.getConversation(data);
    } catch (error) {
      console.error('Error in getOrCreateConversation:', error);
      return null;
    }
  }

  /**
   * Get a single conversation by ID
   */
  async getConversation(conversationId: string): Promise<VideoVoxConversation | null> {
    const { data, error } = await supabase
      .from('video_vox_conversations')
      .select(`
        *,
        video_vox_messages!video_vox_conversations_last_message_id_fkey (
          caption,
          sender_name,
          duration,
          thumbnail_url
        )
      `)
      .eq('id', conversationId)
      .single();

    if (error || !data) return null;

    // Get participant details
    const participants = await this.getParticipantDetails(data.participant_ids);

    return this.mapDbToConversation(data, participants);
  }

  /**
   * Get all conversations for current user
   */
  async getMyConversations(): Promise<VideoVoxConversation[]> {
    const userId = await this.ensureUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('video_vox_conversation_members')
      .select(`
        conversation_id,
        unread_count,
        video_vox_conversations (
          *,
          video_vox_messages!video_vox_conversations_last_message_id_fkey (
            caption,
            sender_name,
            duration,
            thumbnail_url
          )
        )
      `)
      .eq('user_id', userId)
      .order('video_vox_conversations(last_message_at)', { ascending: false });

    if (error || !data) return [];

    const conversations: VideoVoxConversation[] = [];

    for (const item of data) {
      const conv = item.video_vox_conversations as any;
      if (!conv) continue;

      const participants = await this.getParticipantDetails(conv.participant_ids);
      const mapped = this.mapDbToConversation(conv, participants);
      conversations.push(mapped);
    }

    return conversations;
  }

  /**
   * Get unread count for current user
   */
  async getTotalUnreadCount(): Promise<number> {
    const userId = await this.ensureUserId();
    if (!userId) return 0;

    const { data, error } = await supabase
      .from('video_vox_conversation_members')
      .select('unread_count')
      .eq('user_id', userId);

    if (error || !data) return 0;

    return data.reduce((sum, m) => sum + (m.unread_count || 0), 0);
  }

  /**
   * Mark conversation as read
   */
  async markConversationAsRead(conversationId: string): Promise<boolean> {
    const userId = await this.ensureUserId();
    if (!userId) return false;

    const { error } = await supabase
      .from('video_vox_conversation_members')
      .update({
        unread_count: 0,
        last_read_at: new Date().toISOString()
      })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    return !error;
  }

  /**
   * Mute/unmute conversation
   */
  async toggleMuteConversation(conversationId: string, muted: boolean): Promise<boolean> {
    const userId = await this.ensureUserId();
    if (!userId) return false;

    const { error } = await supabase
      .from('video_vox_conversation_members')
      .update({ is_muted: muted })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    return !error;
  }

  // ============================================
  // MESSAGE MANAGEMENT
  // ============================================

  /**
   * Upload and send a video message
   */
  async uploadAndSendVideoVox(
    recipientIds: string[],
    videoBlob: Blob,
    thumbnailBlob: Blob,
    duration: number,
    options?: {
      caption?: string;
      replyToId?: string;
      replyToTimestamp?: number;
      quotedText?: string;
      mentions?: string[];
      expiresAt?: Date;
    }
  ): Promise<VideoVoxMessage | null> {
    const userId = await this.ensureUserId();
    if (!userId) {
      console.error('No user ID for video vox upload');
      return null;
    }

    try {
      // Get or create conversation
      const conversation = await this.getOrCreateConversation(recipientIds);
      if (!conversation) {
        console.error('Failed to get/create conversation');
        return null;
      }

      // Get sender info
      const { data: userData } = await supabase
        .from('pulse_users')
        .select('display_name, handle, avatar_url')
        .eq('id', userId)
        .single();

      const senderName = userData?.display_name || 'Unknown';
      const senderHandle = userData?.handle;

      // Generate unique file names
      const messageId = crypto.randomUUID();
      const videoFileName = `video_vox/${conversation.id}/${userId}/${messageId}.webm`;
      const thumbFileName = `video_vox/${conversation.id}/${userId}/${messageId}_thumb.jpg`;

      // Upload video
      const { error: videoUploadError } = await supabase.storage
        .from('voxer')
        .upload(videoFileName, videoBlob, {
          contentType: 'video/webm',
          upsert: false
        });

      if (videoUploadError) {
        console.error('Error uploading video:', videoUploadError);
        return null;
      }

      // Upload thumbnail
      const { error: thumbUploadError } = await supabase.storage
        .from('voxer')
        .upload(thumbFileName, thumbnailBlob, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (thumbUploadError) {
        console.error('Error uploading thumbnail:', thumbUploadError);
      }

      // Get public URLs
      const { data: videoUrlData } = supabase.storage.from('voxer').getPublicUrl(videoFileName);
      const { data: thumbUrlData } = supabase.storage.from('voxer').getPublicUrl(thumbFileName);

      // Insert message
      const { data: messageData, error: insertError } = await supabase
        .from('video_vox_messages')
        .insert([{
          id: messageId,
          conversation_id: conversation.id,
          sender_id: userId,
          sender_name: senderName,
          sender_handle: senderHandle,
          video_url: videoUrlData.publicUrl,
          thumbnail_url: thumbUrlData.publicUrl,
          duration: Math.round(duration),
          width: 1080,
          height: 1920,
          file_size: videoBlob.size,
          caption: options?.caption,
          reply_to_id: options?.replyToId,
          reply_to_timestamp: options?.replyToTimestamp,
          quoted_text: options?.quotedText,
          mentions: options?.mentions || [],
          status: 'sent',
          processing_status: 'pending',
          expires_at: options?.expiresAt?.toISOString(),
          created_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting message:', insertError);
        return null;
      }

      // Queue AI processing in background
      this.queueAIProcessing(messageId, videoBlob);

      // Create notification for recipients
      await this.notifyRecipients(conversation.id, messageId, senderName, recipientIds);

      return this.mapDbToMessage(messageData);
    } catch (error) {
      console.error('Error in uploadAndSendVideoVox:', error);
      return null;
    }
  }

  /**
   * Get messages for a conversation
   */
  async getConversationMessages(
    conversationId: string,
    options?: { limit?: number; offset?: number; beforeId?: string }
  ): Promise<VideoVoxMessage[]> {
    let query = supabase
      .from('video_vox_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error || !data) return [];

    // Get reactions for these messages
    const messageIds = data.map(m => m.id);
    const reactions = await this.getReactionsForMessages(messageIds);

    return data.map(m => {
      const mapped = this.mapDbToMessage(m);
      mapped.reactions = reactions[m.id] || {};
      return mapped;
    }).reverse(); // Return in chronological order
  }

  /**
   * Get a single message
   */
  async getMessage(messageId: string): Promise<VideoVoxMessage | null> {
    const { data, error } = await supabase
      .from('video_vox_messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (error || !data) return null;

    const reactions = await this.getReactionsForMessages([messageId]);
    const mapped = this.mapDbToMessage(data);
    mapped.reactions = reactions[messageId] || {};

    return mapped;
  }

  /**
   * Get thread replies for a message
   */
  async getThreadReplies(messageId: string): Promise<VideoVoxMessage[]> {
    const { data, error } = await supabase
      .from('video_vox_messages')
      .select('*')
      .eq('reply_to_id', messageId)
      .order('created_at', { ascending: true });

    if (error || !data) return [];

    return data.map(this.mapDbToMessage);
  }

  /**
   * Mark message as viewed
   */
  async markMessageAsViewed(
    messageId: string,
    watchDuration?: number,
    completed?: boolean
  ): Promise<boolean> {
    const userId = await this.ensureUserId();
    if (!userId) return false;

    // Upsert read receipt
    const { error: receiptError } = await supabase
      .from('video_vox_read_receipts')
      .upsert({
        message_id: messageId,
        user_id: userId,
        viewed_at: new Date().toISOString(),
        watch_duration: watchDuration,
        completed: completed || false
      }, {
        onConflict: 'message_id,user_id'
      });

    if (receiptError) {
      console.error('Error creating read receipt:', receiptError);
    }

    // Update message status if sender is different
    const { data: message } = await supabase
      .from('video_vox_messages')
      .select('sender_id, status')
      .eq('id', messageId)
      .single();

    if (message && message.sender_id !== userId && message.status !== 'viewed') {
      await supabase
        .from('video_vox_messages')
        .update({ status: 'viewed' })
        .eq('id', messageId);
    }

    return true;
  }

  /**
   * Delete a message (soft delete or hard delete)
   */
  async deleteMessage(messageId: string): Promise<boolean> {
    const userId = await this.ensureUserId();
    if (!userId) return false;

    // Only allow sender to delete
    const { data: message } = await supabase
      .from('video_vox_messages')
      .select('sender_id')
      .eq('id', messageId)
      .single();

    if (!message || message.sender_id !== userId) {
      return false;
    }

    const { error } = await supabase
      .from('video_vox_messages')
      .delete()
      .eq('id', messageId);

    return !error;
  }

  // ============================================
  // REACTIONS
  // ============================================

  /**
   * Add or remove a reaction
   */
  async toggleReaction(
    messageId: string,
    emoji: string,
    timestamp?: number
  ): Promise<boolean> {
    const userId = await this.ensureUserId();
    if (!userId) return false;

    // Check if reaction exists
    const { data: existing } = await supabase
      .from('video_vox_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('emoji', emoji)
      .single();

    if (existing) {
      // Remove reaction
      const { error } = await supabase
        .from('video_vox_reactions')
        .delete()
        .eq('id', existing.id);
      return !error;
    } else {
      // Add reaction
      const { error } = await supabase
        .from('video_vox_reactions')
        .insert([{
          message_id: messageId,
          user_id: userId,
          emoji: emoji,
          timestamp: timestamp,
          created_at: new Date().toISOString()
        }]);
      return !error;
    }
  }

  /**
   * Get reactions for messages
   */
  async getReactionsForMessages(messageIds: string[]): Promise<Record<string, Record<string, string[]>>> {
    if (messageIds.length === 0) return {};

    const { data, error } = await supabase
      .from('video_vox_reactions')
      .select('message_id, user_id, emoji')
      .in('message_id', messageIds);

    if (error || !data) return {};

    const result: Record<string, Record<string, string[]>> = {};

    for (const reaction of data) {
      if (!result[reaction.message_id]) {
        result[reaction.message_id] = {};
      }
      if (!result[reaction.message_id][reaction.emoji]) {
        result[reaction.message_id][reaction.emoji] = [];
      }
      result[reaction.message_id][reaction.emoji].push(reaction.user_id);
    }

    return result;
  }

  // ============================================
  // BOOKMARKS
  // ============================================

  /**
   * Toggle bookmark on a message
   */
  async toggleBookmark(messageId: string, note?: string, timestamp?: number): Promise<boolean> {
    const userId = await this.ensureUserId();
    if (!userId) return false;

    const { data: existing } = await supabase
      .from('video_vox_bookmarks')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('video_vox_bookmarks')
        .delete()
        .eq('id', existing.id);
      return !error;
    } else {
      const { error } = await supabase
        .from('video_vox_bookmarks')
        .insert([{
          message_id: messageId,
          user_id: userId,
          note: note,
          timestamp: timestamp,
          created_at: new Date().toISOString()
        }]);
      return !error;
    }
  }

  /**
   * Get user's bookmarks
   */
  async getMyBookmarks(): Promise<VideoVoxBookmark[]> {
    const userId = await this.ensureUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('video_vox_bookmarks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map(b => ({
      id: b.id,
      userId: b.user_id,
      messageId: b.message_id,
      note: b.note,
      timestamp: b.timestamp,
      createdAt: new Date(b.created_at)
    }));
  }

  // ============================================
  // AI ANALYSIS WITH GEMINI
  // ============================================

  /**
   * Queue AI processing for a video message
   */
  private async queueAIProcessing(messageId: string, videoBlob: Blob): Promise<void> {
    try {
      // Add to queue
      await supabase
        .from('video_vox_ai_queue')
        .insert([{
          message_id: messageId,
          status: 'pending',
          tasks: ['transcribe', 'summarize', 'extract_topics'],
          created_at: new Date().toISOString()
        }]);

      // Process immediately in background
      this.processVideoWithAI(messageId, videoBlob).catch(console.error);
    } catch (error) {
      console.error('Error queuing AI processing:', error);
    }
  }

  /**
   * Process video with Gemini AI
   */
  async processVideoWithAI(messageId: string, videoBlob: Blob): Promise<VideoVoxAIAnalysis | null> {
    const apiKey = this.getGeminiApiKey();
    if (!apiKey) {
      console.warn('No Gemini API key available - skipping AI processing');
      return null;
    }

    try {
      // Update status to processing
      await supabase
        .from('video_vox_ai_queue')
        .update({ status: 'processing', started_at: new Date().toISOString() })
        .eq('message_id', messageId);

      await supabase
        .from('video_vox_messages')
        .update({ processing_status: 'transcribing' })
        .eq('id', messageId);

      // Convert blob to base64
      const base64 = await this.blobToBase64(videoBlob);

      // Initialize Gemini
      const ai = new GoogleGenAI({ apiKey });

      // Analyze video with Gemini 2.5
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { inlineData: { mimeType: 'video/webm', data: base64 } },
            { text: `Analyze this video message and provide:
1. Full transcript of everything spoken
2. A concise 1-2 sentence summary
3. Key topics/themes (as a list of keywords)
4. Overall sentiment (positive, neutral, negative, or mixed)
5. Any action items or tasks mentioned

Return as JSON.` }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              transcript: { type: Type.STRING, description: "Full speech transcript" },
              summary: { type: Type.STRING, description: "1-2 sentence summary" },
              topics: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Key topics/keywords" },
              sentiment: { type: Type.STRING, enum: ['positive', 'neutral', 'negative', 'mixed'] },
              actionItems: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Action items mentioned" }
            },
            required: ["transcript", "summary", "topics", "sentiment", "actionItems"]
          }
        }
      });

      const resultText = response.text || '{}';
      const analysis: VideoVoxAIAnalysis = JSON.parse(resultText);

      // Update message with AI results
      await supabase
        .from('video_vox_messages')
        .update({
          transcript: analysis.transcript,
          summary: analysis.summary,
          topics: analysis.topics,
          sentiment: analysis.sentiment,
          action_items: analysis.actionItems,
          processing_status: 'complete'
        })
        .eq('id', messageId);

      // Update queue status
      await supabase
        .from('video_vox_ai_queue')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('message_id', messageId);

      return analysis;
    } catch (error: any) {
      console.error('AI processing failed:', error);

      // Update failure status
      await supabase
        .from('video_vox_messages')
        .update({ processing_status: 'failed' })
        .eq('id', messageId);

      await supabase
        .from('video_vox_ai_queue')
        .update({
          status: 'failed',
          error_message: error.message,
          attempts: supabase.sql`attempts + 1`
        })
        .eq('message_id', messageId);

      return null;
    }
  }

  /**
   * Manually trigger AI analysis for an existing message
   */
  async reprocessWithAI(messageId: string): Promise<VideoVoxAIAnalysis | null> {
    const message = await this.getMessage(messageId);
    if (!message) return null;

    // Fetch video blob from URL
    try {
      const response = await fetch(message.videoUrl);
      const videoBlob = await response.blob();
      return await this.processVideoWithAI(messageId, videoBlob);
    } catch (error) {
      console.error('Failed to fetch video for reprocessing:', error);
      return null;
    }
  }

  // ============================================
  // SEARCH
  // ============================================

  /**
   * Search videos by content
   */
  async searchVideos(query: string): Promise<VideoVoxSearchResult[]> {
    const userId = await this.ensureUserId();
    if (!userId || !query.trim()) return [];

    // Search in transcripts, captions, and topics
    const { data, error } = await supabase
      .from('video_vox_messages')
      .select(`
        *,
        video_vox_conversations!inner (participant_ids)
      `)
      .contains('video_vox_conversations.participant_ids', [userId])
      .or(`transcript.ilike.%${query}%,caption.ilike.%${query}%,summary.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data) return [];

    const results: VideoVoxSearchResult[] = data.map(m => {
      const message = this.mapDbToMessage(m);
      let matchType: 'transcript' | 'caption' | 'topic' | 'summary' = 'transcript';
      let matchText = '';

      const lowerQuery = query.toLowerCase();

      if (m.caption?.toLowerCase().includes(lowerQuery)) {
        matchType = 'caption';
        matchText = m.caption;
      } else if (m.summary?.toLowerCase().includes(lowerQuery)) {
        matchType = 'summary';
        matchText = m.summary;
      } else if (m.transcript?.toLowerCase().includes(lowerQuery)) {
        matchType = 'transcript';
        // Extract snippet around match
        const index = m.transcript.toLowerCase().indexOf(lowerQuery);
        const start = Math.max(0, index - 50);
        const end = Math.min(m.transcript.length, index + query.length + 50);
        matchText = '...' + m.transcript.substring(start, end) + '...';
      }

      return {
        message,
        matchType,
        matchText,
        relevanceScore: 1.0 // Could implement better scoring
      };
    });

    return results;
  }

  // ============================================
  // REAL-TIME SUBSCRIPTIONS
  // ============================================

  /**
   * Subscribe to new messages in a conversation
   */
  subscribeToConversation(
    conversationId: string,
    callback: (message: VideoVoxMessage) => void
  ) {
    return supabase
      .channel(`video_vox:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'video_vox_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, async (payload) => {
        const message = this.mapDbToMessage(payload.new);
        const reactions = await this.getReactionsForMessages([message.id]);
        message.reactions = reactions[message.id] || {};
        callback(message);
      })
      .subscribe();
  }

  /**
   * Subscribe to reaction changes
   */
  subscribeToReactions(
    messageIds: string[],
    callback: (messageId: string, reactions: Record<string, string[]>) => void
  ) {
    return supabase
      .channel('video_vox_reactions')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'video_vox_reactions',
      }, async (payload) => {
        const messageId = (payload.new as any)?.message_id || (payload.old as any)?.message_id;
        if (messageIds.includes(messageId)) {
          const reactions = await this.getReactionsForMessages([messageId]);
          callback(messageId, reactions[messageId] || {});
        }
      })
      .subscribe();
  }

  /**
   * Subscribe to new conversations
   */
  subscribeToNewConversations(callback: (conversation: VideoVoxConversation) => void) {
    const userId = this.userId;
    if (!userId) return null;

    return supabase
      .channel('video_vox_new_conversations')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'video_vox_conversation_members',
        filter: `user_id=eq.${userId}`,
      }, async (payload) => {
        const conversation = await this.getConversation((payload.new as any).conversation_id);
        if (conversation) {
          callback(conversation);
        }
      })
      .subscribe();
  }

  // ============================================
  // DOWNLOAD/EXPORT
  // ============================================

  /**
   * Download video message
   */
  async downloadVideo(messageId: string): Promise<Blob | null> {
    const message = await this.getMessage(messageId);
    if (!message) return null;

    try {
      const response = await fetch(message.videoUrl);
      return await response.blob();
    } catch (error) {
      console.error('Failed to download video:', error);
      return null;
    }
  }

  /**
   * Export conversation transcript
   */
  async exportConversationTranscript(conversationId: string): Promise<string> {
    const messages = await this.getConversationMessages(conversationId, { limit: 1000 });

    let transcript = `Video Vox Conversation Export\n`;
    transcript += `Exported: ${new Date().toISOString()}\n`;
    transcript += `${'='.repeat(50)}\n\n`;

    for (const message of messages) {
      transcript += `[${message.createdAt.toLocaleString()}] ${message.senderName}:\n`;
      if (message.caption) {
        transcript += `Caption: ${message.caption}\n`;
      }
      if (message.transcript) {
        transcript += `Transcript: ${message.transcript}\n`;
      }
      if (message.summary) {
        transcript += `Summary: ${message.summary}\n`;
      }
      transcript += `Duration: ${message.duration}s\n`;
      transcript += `\n`;
    }

    return transcript;
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private async getParticipantDetails(userIds: string[]): Promise<Array<{
    id: string;
    name: string;
    handle?: string;
    avatarUrl?: string;
    avatarColor: string;
  }>> {
    if (userIds.length === 0) return [];

    const { data } = await supabase
      .from('pulse_users')
      .select('id, display_name, handle, avatar_url, avatar_color')
      .in('id', userIds);

    if (!data) return [];

    return data.map(u => ({
      id: u.id,
      name: u.display_name,
      handle: u.handle,
      avatarUrl: u.avatar_url,
      avatarColor: u.avatar_color || '#8B5CF6'
    }));
  }

  private async notifyRecipients(
    conversationId: string,
    messageId: string,
    senderName: string,
    recipientIds: string[]
  ): Promise<void> {
    const userId = await this.ensureUserId();

    for (const recipientId of recipientIds) {
      if (recipientId === userId) continue;

      await supabase
        .from('vox_notifications')
        .insert([{
          user_id: recipientId,
          type: 'new_vox',
          title: `${senderName} sent you a video`,
          body: 'Tap to watch',
          related_vox_id: messageId,
          sender_id: userId,
          sender_name: senderName,
          is_read: false,
          created_at: new Date().toISOString()
        }]);
    }
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // ============================================
  // DB MAPPERS
  // ============================================

  private mapDbToMessage(db: any): VideoVoxMessage {
    return {
      id: db.id,
      conversationId: db.conversation_id,
      senderId: db.sender_id,
      senderName: db.sender_name,
      senderHandle: db.sender_handle,
      senderAvatarUrl: db.sender_avatar_url,
      videoUrl: db.video_url,
      thumbnailUrl: db.thumbnail_url,
      duration: db.duration,
      width: db.width || 1080,
      height: db.height || 1920,
      fileSize: db.file_size,
      caption: db.caption,
      transcript: db.transcript,
      summary: db.summary,
      topics: db.topics || [],
      sentiment: db.sentiment,
      actionItems: db.action_items || [],
      replyToId: db.reply_to_id,
      replyToTimestamp: db.reply_to_timestamp,
      quotedText: db.quoted_text,
      threadCount: db.thread_count || 0,
      mentions: db.mentions || [],
      status: db.status,
      processingStatus: db.processing_status,
      createdAt: new Date(db.created_at),
      deliveredAt: db.delivered_at ? new Date(db.delivered_at) : undefined,
      expiresAt: db.expires_at ? new Date(db.expires_at) : undefined,
      reactions: db.reactions || {},
      metadata: db.metadata,
    };
  }

  private mapDbToConversation(db: any, participants: Array<{
    id: string;
    name: string;
    handle?: string;
    avatarUrl?: string;
    avatarColor: string;
  }>): VideoVoxConversation {
    const lastMessage = db.video_vox_messages;

    return {
      id: db.id,
      participantIds: db.participant_ids || [],
      participants: participants,
      title: db.title,
      lastMessageId: db.last_message_id,
      lastMessageAt: db.last_message_at ? new Date(db.last_message_at) : undefined,
      lastMessageCaption: lastMessage?.caption,
      lastMessageSender: lastMessage?.sender_name,
      lastMessageDuration: lastMessage?.duration,
      lastMessageThumbnail: lastMessage?.thumbnail_url,
      createdBy: db.created_by,
      createdAt: new Date(db.created_at),
      updatedAt: new Date(db.updated_at || db.created_at),
    };
  }
}

// Export singleton instance
export const videoVoxService = new VideoVoxService();
