// Video Vox Service - Complete backend for video messaging with AI features
// Includes: Upload, Send, Conversations, Reactions, AI Analysis, Search

import { supabase } from '../supabase';
import { getCurrentWorkspaceId } from '../ai/getWorkspaceId';
import type {
  GlimpseMessage,
  GlimpseConversation,
  GlimpseConversationMember,
  GlimpseReaction,
  GlimpseReadReceipt,
  GlimpseBookmark,
  GlimpseAIAnalysis,
  GlimpseSearchResult,
  PulseUser,
} from './glimpseTypes';

// ============================================
// VIDEO VOX SERVICE CLASS
// ============================================

class GlimpseService {
  private userId: string | null = null;

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

  // ============================================
  // CONVERSATION MANAGEMENT
  // ============================================

  /**
   * Get or create a conversation between participants
   */
  async getOrCreateConversation(participantIds: string[]): Promise<GlimpseConversation | null> {
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
  async getConversation(conversationId: string): Promise<GlimpseConversation | null> {
    const { data, error } = await supabase
      .from('video_vox_conversations')
      .select(`
        *,
        video_vox_messages!video_vox_conversations_last_message_fkey (
          caption,
          sender_name,
          duration,
          thumbnail_url
        )
      `)
      .eq('id', conversationId)
      .maybeSingle();

    if (error || !data) return null;

    // Get participant details
    const participants = await this.getParticipantDetails(data.participant_ids);

    return this.mapDbToConversation(data, participants);
  }

  /**
   * Get all conversations for current user.
   *
   * Implementation note: split into two queries instead of one nested embed +
   * cross-table order. PostgREST's nested ORDER syntax (`order=embedded(col)`)
   * is a 400 footgun in the JS SDK, and the alternative referencedTable option
   * is fragile across versions. Two simple queries are predictable and the cost
   * difference is negligible — both hit indexed columns.
   */
  async getMyConversations(): Promise<GlimpseConversation[]> {
    const userId = await this.ensureUserId();
    if (!userId) return [];

    // Step 1: which conversations is the user a member of?
    const { data: members, error: memberError } = await supabase
      .from('video_vox_conversation_members')
      .select('conversation_id, unread_count')
      .eq('user_id', userId);

    if (memberError) {
      console.error('Error fetching conversation memberships:', memberError);
      return [];
    }
    if (!members || members.length === 0) return [];

    const conversationIds = members.map((m) => m.conversation_id);
    const unreadByConv = new Map<string, number>(
      members.map((m) => [m.conversation_id, m.unread_count || 0])
    );

    // Step 2: full conversations + last-message embed, ordered server-side.
    // Embed includes AI peek fields (summary / action_items / processing_status)
    // so the Triage Cockpit conversations list can render its 2-line summary
    // peek + action-count pill + transcribing skeleton without a per-row fetch.
    const { data: convs, error: convError } = await supabase
      .from('video_vox_conversations')
      .select(`
        *,
        video_vox_messages!video_vox_conversations_last_message_fkey (
          caption,
          sender_name,
          duration,
          thumbnail_url,
          summary,
          action_items,
          processing_status
        )
      `)
      .in('id', conversationIds)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (convError) {
      console.error('Error fetching conversations:', convError);
      return [];
    }
    if (!convs) return [];

    // Step 3: batch participant lookup (eliminates N+1)
    const allParticipantIds = new Set<string>();
    for (const conv of convs) {
      for (const pid of conv.participant_ids || []) {
        allParticipantIds.add(pid);
      }
    }
    const allParticipants = await this.getParticipantDetails([...allParticipantIds]);
    const participantMap = new Map(allParticipants.map((p) => [p.id, p]));

    // Step 4: map to GlimpseConversation, attaching unread + participants
    return convs.map((conv) => {
      const participants = (conv.participant_ids || [])
        .map((pid: string) => participantMap.get(pid))
        .filter(Boolean) as Array<{
        id: string;
        name: string;
        handle?: string;
        avatarUrl?: string;
        avatarColor: string;
      }>;
      const mapped = this.mapDbToConversation(conv, participants);
      mapped.unreadCount = unreadByConv.get(conv.id) ?? 0;
      return mapped;
    });
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
   * One XHR attempt against the Supabase Storage REST API. Used internally by
   * `uploadWithProgress` which wraps this in a retry loop.
   */
  private uploadAttempt(
    bucket: string,
    path: string,
    blob: Blob,
    contentType: string,
    onProgress?: (percent: number) => void
  ): Promise<{ status: number; error: Error | null }> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        resolve({ status: 0, error: new Error('Supabase config not available for XHR upload') });
        return;
      }

      const url = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ status: xhr.status, error: null });
        } else {
          resolve({
            status: xhr.status,
            error: new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`),
          });
        }
      };

      xhr.onerror = () => {
        resolve({ status: 0, error: new Error('Network error during upload') });
      };

      xhr.onabort = () => {
        resolve({ status: 0, error: new Error('Upload aborted') });
      };

      xhr.open('POST', url, true);
      xhr.setRequestHeader('Authorization', `Bearer ${supabaseKey}`);
      xhr.setRequestHeader('apikey', supabaseKey);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.send(blob);
    });
  }

  /**
   * Upload a file to Supabase Storage via XMLHttpRequest for real progress
   * tracking, with retry-with-backoff on transient failures.
   *
   * Retried statuses: 0 (network), 408 (request timeout), 425 (too early),
   * 429 (rate limit), 5xx (incl. Supabase's 544 DatabaseTimeout which the
   * Storage backend emits when the Postgres metadata insert times out).
   *
   * 4xx other than the above are NOT retried — they indicate a permanent
   * client/auth error and would just waste time + bandwidth.
   */
  private async uploadWithProgress(
    bucket: string,
    path: string,
    blob: Blob,
    contentType: string,
    onProgress?: (percent: number) => void
  ): Promise<{ error: Error | null }> {
    const MAX_ATTEMPTS = 3;
    const BASE_DELAY_MS = 1500;

    const isRetryable = (status: number) =>
      status === 0 ||
      status === 408 ||
      status === 425 ||
      status === 429 ||
      status >= 500;

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const { status, error } = await this.uploadAttempt(
        bucket,
        path,
        blob,
        contentType,
        onProgress,
      );

      if (!error) return { error: null };
      lastError = error;

      if (!isRetryable(status) || attempt === MAX_ATTEMPTS) {
        return { error };
      }

      // Reset progress to 0 for the next attempt so the user sees the upload
      // restart rather than continuing from a stale percentage.
      onProgress?.(0);

      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(
        `[glimpse] upload attempt ${attempt}/${MAX_ATTEMPTS} failed (status ${status}); retrying in ${delay}ms…`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }

    return { error: lastError ?? new Error('Upload failed after retries') };
  }

  /**
   * Upload and send a video message.
   * Accepts an optional onProgress callback for real upload progress tracking.
   */
  async uploadAndSendGlimpse(
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
    },
    onProgress?: (percent: number) => void
  ): Promise<GlimpseMessage | null> {
    const userId = await this.ensureUserId();
    if (!userId) {
      console.error('No user ID for video vox upload');
      return null;
    }

    try {
      // Phase 1: Setup (0-5%)
      onProgress?.(2);

      // Get or create conversation
      const conversation = await this.getOrCreateConversation(recipientIds);
      if (!conversation) {
        console.error('Failed to get/create conversation');
        return null;
      }

      // Get sender info — maybeSingle so a missing pulse_users row falls
      // through to the default name without 406ing.
      const { data: userData } = await supabase
        .from('pulse_users')
        .select('display_name, handle, avatar_url')
        .eq('id', userId)
        .maybeSingle();

      const senderName = userData?.display_name || 'Unknown';
      const senderHandle = userData?.handle;

      onProgress?.(5);

      // Generate unique file names
      const messageId = crypto.randomUUID();
      const videoFileName = `video_vox/${conversation.id}/${userId}/${messageId}.webm`;
      const thumbFileName = `video_vox/${conversation.id}/${userId}/${messageId}_thumb.jpg`;

      // Phase 2: Upload video with real progress (5-85%)
      // Video upload is the heaviest part, so it gets the largest progress range.
      const { error: videoUploadError } = await this.uploadWithProgress(
        'relay',
        videoFileName,
        videoBlob,
        'video/webm',
        (percent) => {
          // Map video upload 0-100% to overall 5-85%
          const overallPercent = 5 + Math.round(percent * 0.8);
          onProgress?.(overallPercent);
        }
      );

      if (videoUploadError) {
        console.error('Error uploading video:', videoUploadError);
        return null;
      }

      // Phase 3: Upload thumbnail (85-90%)
      onProgress?.(85);
      const { error: thumbUploadError } = await this.uploadWithProgress(
        'relay',
        thumbFileName,
        thumbnailBlob,
        'image/jpeg'
        // No progress callback for thumbnail -- it's small and fast
      );

      if (thumbUploadError) {
        console.error('Error uploading thumbnail:', thumbUploadError);
      }

      onProgress?.(90);

      // Phase 4: Insert DB record and finalize (90-100%)
      // Get public URLs
      const { data: videoUrlData } = supabase.storage.from('relay').getPublicUrl(videoFileName);
      const { data: thumbUrlData } = supabase.storage.from('relay').getPublicUrl(thumbFileName);

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

      onProgress?.(95);

      // Queue AI processing in background
      this.queueAIProcessing(messageId, videoBlob);

      // Create notification for recipients
      await this.notifyRecipients(conversation.id, messageId, senderName, recipientIds);

      onProgress?.(100);
      return this.mapDbToMessage(messageData);
    } catch (error) {
      console.error('Error in uploadAndSendGlimpse:', error);
      return null;
    }
  }

  /**
   * Get messages for a conversation
   */
  async getConversationMessages(
    conversationId: string,
    options?: { limit?: number; offset?: number; beforeId?: string }
  ): Promise<GlimpseMessage[]> {
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
  async getMessage(messageId: string): Promise<GlimpseMessage | null> {
    const { data, error } = await supabase
      .from('video_vox_messages')
      .select('*')
      .eq('id', messageId)
      .maybeSingle();

    if (error || !data) return null;

    const reactions = await this.getReactionsForMessages([messageId]);
    const mapped = this.mapDbToMessage(data);
    mapped.reactions = reactions[messageId] || {};

    return mapped;
  }

  /**
   * Get thread replies for a message
   */
  async getThreadReplies(messageId: string): Promise<GlimpseMessage[]> {
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
      .maybeSingle();

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
      .maybeSingle();

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
    // toggle pattern — first click always finds zero rows; use maybeSingle()
    // to avoid 406 Not Acceptable on the empty result.
    const { data: existing } = await supabase
      .from('video_vox_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('emoji', emoji)
      .maybeSingle();

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
   * Create a Pulse task from an extracted action item on a Glimpse message.
   * Idempotent — if a task already exists with the same title + origin message,
   * returns 'already-exists' instead of inserting a duplicate. Stores
   * provenance in metadata so future UIs can show "from glimpse by X on Y".
   */
  async createTaskFromActionItem(
    actionItem: string,
    message: GlimpseMessage
  ): Promise<{ status: 'created' | 'already-exists' | 'failed'; taskId?: string }> {
    const userId = await this.ensureUserId();
    if (!userId) return { status: 'failed' };

    const trimmed = actionItem.trim();
    if (!trimmed) return { status: 'failed' };

    // De-dupe: check whether a task with the same title already exists for
    // this origin message. Lookup is exact match — Gemini output is stable
    // enough that exact-text comparison works for the same source extraction.
    const { data: existing } = await supabase
      .from('tasks')
      .select('id')
      .eq('user_id', userId)
      .eq('origin_message_id', message.id)
      .eq('title', trimmed)
      .maybeSingle();

    if (existing) {
      return { status: 'already-exists', taskId: existing.id };
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert([
        {
          user_id: userId,
          title: trimmed,
          description: `Extracted from Glimpse · ${message.senderName} · ${message.createdAt.toLocaleString()}`,
          origin_message_id: message.id,
          status: 'todo',
          list_id: 'work',
          metadata: {
            source: 'glimpse',
            glimpse_message_id: message.id,
            glimpse_conversation_id: message.conversationId,
            glimpse_sender_id: message.senderId,
            glimpse_sender_name: message.senderName,
            glimpse_recorded_at: message.createdAt.toISOString(),
            glimpse_video_url: message.videoUrl,
          },
        },
      ])
      .select('id')
      .single();

    if (error || !data) {
      console.error('Error creating task from action item:', error);
      return { status: 'failed' };
    }

    return { status: 'created', taskId: data.id };
  }

  /**
   * Get the set of action-item texts already converted to tasks for a list of
   * glimpse messages. Used by the chat hook to render ✓ marks on rows the
   * user has already pulled into their task list across sessions.
   */
  async getConvertedActionItems(
    messageIds: string[]
  ): Promise<Map<string, Set<string>>> {
    const userId = await this.ensureUserId();
    if (!userId || messageIds.length === 0) return new Map();

    const { data, error } = await supabase
      .from('tasks')
      .select('origin_message_id, title')
      .eq('user_id', userId)
      .in('origin_message_id', messageIds);

    if (error || !data) return new Map();

    const byMessage = new Map<string, Set<string>>();
    for (const row of data) {
      if (!row.origin_message_id) continue;
      if (!byMessage.has(row.origin_message_id)) {
        byMessage.set(row.origin_message_id, new Set());
      }
      byMessage.get(row.origin_message_id)!.add(row.title);
    }
    return byMessage;
  }

  /**
   * Toggle bookmark on a message. Returns the new state so the UI can give
   * immediate "added" / "removed" feedback without an extra round-trip.
   */
  async toggleBookmark(
    messageId: string,
    note?: string,
    timestamp?: number
  ): Promise<'added' | 'removed' | null> {
    const userId = await this.ensureUserId();
    if (!userId) return null;

    const { data: existing } = await supabase
      .from('video_vox_bookmarks')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('video_vox_bookmarks')
        .delete()
        .eq('id', existing.id);
      return error ? null : 'removed';
    }
    const { error } = await supabase
      .from('video_vox_bookmarks')
      .insert([{
        message_id: messageId,
        user_id: userId,
        note: note,
        timestamp: timestamp,
        created_at: new Date().toISOString(),
      }]);
    return error ? null : 'added';
  }

  /**
   * Get user's bookmarks
   */
  async getMyBookmarks(): Promise<GlimpseBookmark[]> {
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
   * Queue AI processing for a video message.
   * The queue insert is best-effort bookkeeping — if RLS or the table itself
   * is misconfigured we still want the AI work to run, since the queue is for
   * later reprocessing, not the live path.
   */
  private async queueAIProcessing(messageId: string, videoBlob: Blob): Promise<void> {
    const { error: queueErr } = await supabase
      .from('video_vox_ai_queue')
      .insert([{
        message_id: messageId,
        status: 'pending',
        tasks: ['transcribe', 'summarize', 'extract_topics'],
        created_at: new Date().toISOString(),
      }]);

    if (queueErr) {
      console.warn('AI queue enqueue failed (continuing with inline processing):', queueErr.message);
    }

    // Always run the AI work, even if queue insert failed.
    this.processVideoWithAI(messageId, videoBlob).catch(console.error);
  }

  /**
   * Process video with Gemini AI
   */
  async processVideoWithAI(messageId: string, videoBlob: Blob): Promise<GlimpseAIAnalysis | null> {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) {
      console.warn('No active workspace — skipping Glimpse AI processing');
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

      // Route through gemini-video edge function. Schema mirrors the previous
      // inline SDK schema so the parsed payload matches GlimpseAIAnalysis.
      const { data: invokeData, error: invokeError } = await supabase.functions.invoke('gemini-video', {
        body: {
          action: 'analyze',
          video_base64: base64,
          mime_type: 'video/webm',
          prompt: `Analyze this video message and provide:
1. Full transcript of everything spoken
2. A concise 1-2 sentence summary
3. Key topics/themes (as a list of keywords)
4. Overall sentiment (positive, neutral, negative, or mixed)
5. Any action items or tasks mentioned

Return as JSON.`,
          model: 'gemini-2.5-flash',
          workspace_id: workspaceId,
          schema: {
            type: 'OBJECT',
            properties: {
              transcript: { type: 'STRING', description: 'Full speech transcript' },
              summary: { type: 'STRING', description: '1-2 sentence summary' },
              topics: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Key topics/keywords' },
              sentiment: { type: 'STRING', enum: ['positive', 'neutral', 'negative', 'mixed'] },
              actionItems: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Action items mentioned' },
            },
            required: ['transcript', 'summary', 'topics', 'sentiment', 'actionItems'],
          },
        },
      });

      if (invokeError) throw invokeError;
      const analysis = (invokeData as { data?: GlimpseAIAnalysis } | null)?.data;
      if (!analysis) throw new Error('gemini-video returned no analysis');

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

      // Increment attempts with a separate fetch-then-update since Supabase JS SDK
      // does not support raw SQL expressions in .update(). Use maybeSingle()
      // because the queue row may not exist (queue insert can fail on RLS or
      // if the table is misconfigured) — .single() would 406 on no rows.
      const { data: queueEntry } = await supabase
        .from('video_vox_ai_queue')
        .select('attempts')
        .eq('message_id', messageId)
        .maybeSingle();

      if (queueEntry) {
        await supabase
          .from('video_vox_ai_queue')
          .update({
            status: 'failed',
            error_message: error.message,
            attempts: (queueEntry.attempts ?? 0) + 1,
          })
          .eq('message_id', messageId);
      }

      return null;
    }
  }

  /**
   * Manually trigger AI analysis for an existing message
   */
  async reprocessWithAI(messageId: string): Promise<GlimpseAIAnalysis | null> {
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
   * Escape special characters for Postgres ilike patterns.
   * Prevents user input containing %, _, or \ from being interpreted
   * as wildcards or escape sequences.
   */
  private sanitizeIlikeInput(input: string): string {
    return input
      .replace(/\\/g, '\\\\')  // escape backslashes first
      .replace(/%/g, '\\%')    // escape percent
      .replace(/_/g, '\\_');   // escape underscore
  }

  /**
   * Compute a relevance score for a search result based on:
   *  - Field weight (caption > summary > transcript)
   *  - Match position (earlier = more relevant)
   *  - Density (how much of the field the query covers)
   * Returns a score in the range (0, 1].
   */
  private computeRelevanceScore(
    fieldValue: string,
    query: string,
    fieldWeight: number
  ): number {
    const lowerField = fieldValue.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const matchIndex = lowerField.indexOf(lowerQuery);

    if (matchIndex === -1) return 0;

    // Position score: earlier matches score higher (1.0 at start, decays toward 0.3)
    const positionScore = 1.0 - (matchIndex / lowerField.length) * 0.7;

    // Density score: longer matches relative to field length score higher
    const densityScore = Math.min(1.0, lowerQuery.length / lowerField.length * 5);

    // Weighted combination: field weight (0-1) * 0.5 + position * 0.3 + density * 0.2
    const score = fieldWeight * 0.5 + positionScore * 0.3 + densityScore * 0.2;

    // Clamp to (0, 1]
    return Math.min(1.0, Math.max(0.01, parseFloat(score.toFixed(3))));
  }

  /**
   * Search videos by content
   */
  async searchVideos(query: string): Promise<GlimpseSearchResult[]> {
    const userId = await this.ensureUserId();
    if (!userId || !query.trim()) return [];

    // Sanitize user input to prevent ilike injection (Y18)
    const sanitized = this.sanitizeIlikeInput(query.trim());

    // Search in transcripts, captions, and topics
    const { data, error } = await supabase
      .from('video_vox_messages')
      .select(`
        *,
        video_vox_conversations!inner (participant_ids)
      `)
      .contains('video_vox_conversations.participant_ids', [userId])
      .or(`transcript.ilike.%${sanitized}%,caption.ilike.%${sanitized}%,summary.ilike.%${sanitized}%`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data) return [];

    // Field weights: caption (highest) > summary > transcript (lowest)
    const FIELD_WEIGHTS = {
      caption: 1.0,
      summary: 0.7,
      transcript: 0.4,
    } as const;

    const results: GlimpseSearchResult[] = data.map(m => {
      const message = this.mapDbToMessage(m);
      let matchType: 'transcript' | 'caption' | 'topic' | 'summary' = 'transcript';
      let matchText = '';
      let relevanceScore = 0.01;

      const lowerQuery = query.trim().toLowerCase();

      if (m.caption?.toLowerCase().includes(lowerQuery)) {
        matchType = 'caption';
        matchText = m.caption;
        relevanceScore = this.computeRelevanceScore(m.caption, query.trim(), FIELD_WEIGHTS.caption);
      } else if (m.summary?.toLowerCase().includes(lowerQuery)) {
        matchType = 'summary';
        matchText = m.summary;
        relevanceScore = this.computeRelevanceScore(m.summary, query.trim(), FIELD_WEIGHTS.summary);
      } else if (m.transcript?.toLowerCase().includes(lowerQuery)) {
        matchType = 'transcript';
        // Extract snippet around match
        const index = m.transcript.toLowerCase().indexOf(lowerQuery);
        const start = Math.max(0, index - 50);
        const end = Math.min(m.transcript.length, index + query.length + 50);
        matchText = '...' + m.transcript.substring(start, end) + '...';
        relevanceScore = this.computeRelevanceScore(m.transcript, query.trim(), FIELD_WEIGHTS.transcript);
      }

      return {
        message,
        matchType,
        matchText,
        relevanceScore,
      };
    });

    // Sort by relevance descending so best matches appear first
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return results;
  }

  // ============================================
  // REAL-TIME SUBSCRIPTIONS
  // ============================================

  /**
   * Subscribe to new messages in a conversation
   */
  async subscribeToConversation(
    conversationId: string,
    callback: (message: GlimpseMessage) => void
  ): Promise<any> {
    // AUTH GUARD: Check session before subscribing
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      console.warn('[GlimpseService] Cannot subscribe to conversation: user not authenticated');
      return null;
    }

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
  async subscribeToReactions(
    messageIds: string[],
    callback: (messageId: string, reactions: Record<string, string[]>) => void
  ): Promise<any> {
    // AUTH GUARD: Check session before subscribing
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      console.warn('[GlimpseService] Cannot subscribe to reactions: user not authenticated');
      return null;
    }

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
  async subscribeToNewConversations(callback: (conversation: GlimpseConversation) => void): Promise<any> {
    // AUTH GUARD: Check session before subscribing
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      console.warn('[GlimpseService] Cannot subscribe to new conversations: user not authenticated');
      return null;
    }

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
        // Data URL form: `data:<mimetype>;base64,<payload>`. The mimetype can
        // contain commas (e.g. `video/webm;codecs=vp9,opus`) so naive split(',')
        // lands inside the codec list. Split on the literal `;base64,` marker
        // which is unambiguous.
        const result = reader.result as string;
        const marker = ';base64,';
        const idx = result.indexOf(marker);
        if (idx < 0) {
          reject(new Error('Unexpected FileReader output: missing ;base64, marker'));
          return;
        }
        resolve(result.slice(idx + marker.length));
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // ============================================
  // DB MAPPERS
  // ============================================

  private mapDbToMessage(db: any): GlimpseMessage {
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
  }>): GlimpseConversation {
    const lastMessage = db.video_vox_messages;
    const actionItems: string[] | undefined = lastMessage?.action_items;

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
      lastMessageSummary: lastMessage?.summary,
      lastMessageActionCount: Array.isArray(actionItems) ? actionItems.length : undefined,
      lastMessageProcessingStatus: lastMessage?.processing_status,
      createdBy: db.created_by,
      createdAt: new Date(db.created_at),
      updatedAt: new Date(db.updated_at || db.created_at),
    };
  }
}

// Export singleton instance
export const glimpseService = new GlimpseService();
