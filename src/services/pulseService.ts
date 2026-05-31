// Pulse Service - User profiles and in-app messaging
import { supabase } from './supabase';
import { trackMessageSent } from '../lib/monitoring/analytics';
import { getCurrentWorkspaceId } from './ai/getWorkspaceId';

export interface UserProfile {
  id: string;
  handle: string | null;
  display_name: string | null;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  phone: string | null;
  is_public: boolean;
  is_verified: boolean;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
  language: string;
  timezone: string;
}

export interface PulseMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  thread_id: string | null;
  content: string;
  content_type: 'text' | 'image' | 'voice' | 'file';
  media_url: string | null;
  is_read: boolean;
  read_at: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  // Joined fields
  sender?: UserProfile;
  recipient?: UserProfile;
}

export interface PulseConversation {
  id: string;
  user1_id: string;
  user2_id: string;
  last_message_id: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  user1_unread_count: number;
  user2_unread_count: number;
  is_archived_by_user1: boolean;
  is_archived_by_user2: boolean;
  is_muted_by_user1: boolean;
  is_muted_by_user2: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  other_user?: UserProfile;
  unread_count?: number;
}

export interface SearchUserResult {
  id: string;
  handle: string | null;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
}

class PulseService {
  // ========================================
  // USER PROFILE METHODS
  // ========================================

  /**
   * Get the current user's profile
   */
  async getCurrentProfile(): Promise<UserProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      // Profile might not exist yet
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching profile:', error);
      throw error;
    }

    return data;
  }

  /**
   * Get a user's profile by ID
   */
  async getProfileById(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error fetching profile:', error);
      throw error;
    }

    return data;
  }

  /**
   * Get a user's profile by handle
   */
  async getProfileByHandle(handle: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('handle', handle.toLowerCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error fetching profile by handle:', error);
      throw error;
    }

    return data;
  }

  /**
   * Update the current user's profile
   */
  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Normalize handle to lowercase
    if (updates.handle) {
      updates.handle = updates.handle.toLowerCase();
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({
        id: user.id,
        ...updates,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      throw error;
    }

    return data;
  }

  /**
   * Check if a handle is available
   */
  async isHandleAvailable(handle: string): Promise<boolean> {
    const { data, error } = await supabase
      .rpc('is_handle_available', { check_handle: handle.toLowerCase() });

    if (error) {
      console.error('Error checking handle:', error);
      throw error;
    }

    return data === true;
  }

  /**
   * Validate handle format
   */
  validateHandle(handle: string): { valid: boolean; error?: string } {
    if (!handle) {
      return { valid: false, error: 'Handle is required' };
    }

    const lowered = handle.toLowerCase();

    // Length check
    if (lowered.length < 3) {
      return { valid: false, error: 'Handle must be at least 3 characters' };
    }
    if (lowered.length > 30) {
      return { valid: false, error: 'Handle must be 30 characters or less' };
    }

    // Format check
    if (!/^[a-z0-9_]+$/.test(lowered)) {
      return { valid: false, error: 'Handle can only contain letters, numbers, and underscores' };
    }

    // No leading/trailing underscore
    if (lowered.startsWith('_') || lowered.endsWith('_')) {
      return { valid: false, error: 'Handle cannot start or end with underscore' };
    }

    // No double underscores
    if (lowered.includes('__')) {
      return { valid: false, error: 'Handle cannot contain consecutive underscores' };
    }

    return { valid: true };
  }

  /**
   * Search for users by handle, display name, or full name
   */
  async searchUsers(query: string, limit: number = 20): Promise<SearchUserResult[]> {
    const { data, error } = await supabase
      .rpc('search_users', {
        search_query: query,
        limit_count: limit
      });

    if (error) {
      console.error('Error searching users:', error);
      throw error;
    }

    return data || [];
  }

  // ========================================
  // MESSAGING METHODS
  // ========================================

  /**
   * Get all conversations for the current user
   */
  async getConversations(): Promise<PulseConversation[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // First, get conversations (excluding ones soft-deleted by this user)
    const { data: conversations, error } = await supabase
      .from('pulse_conversations')
      .select('*')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    // Filter out conversations deleted by this user
    // (is_deleted_by_user1/2 may not exist in older DB schemas — handle gracefully)

    if (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }

    if (!conversations || conversations.length === 0) {
      return [];
    }

    // Collect all other user IDs we need to fetch
    const otherUserIds = conversations.map(conv =>
      conv.user1_id === user.id ? conv.user2_id : conv.user1_id
    );

    // Fetch all user profiles in one query
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .in('id', otherUserIds);

    if (profileError) {
      console.error('Error fetching profiles:', profileError);
      // Continue without profiles rather than failing
    }

    // Create a map for quick lookup
    const profileMap = new Map(
      (profiles || []).map(p => [p.id, p])
    );

    // Transform to include other_user and unread_count, filter soft-deleted
    return conversations
      .filter(conv => {
        const isUser1 = conv.user1_id === user.id;
        return isUser1
          ? !conv.is_deleted_by_user1
          : !conv.is_deleted_by_user2;
      })
      .map(conv => {
        const isUser1 = conv.user1_id === user.id;
        const otherUserId = isUser1 ? conv.user2_id : conv.user1_id;
        return {
          ...conv,
          other_user: profileMap.get(otherUserId) || null,
          unread_count: isUser1 ? conv.user1_unread_count : conv.user2_unread_count
        };
      });
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId: string, limit: number = 50): Promise<PulseMessage[]> {
    // First get the messages
    const { data: messages, error } = await supabase
      .from('pulse_messages')
      .select('*')
      .eq('thread_id', conversationId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }

    if (!messages || messages.length === 0) {
      return [];
    }

    // Collect all unique user IDs
    const userIds = [...new Set([
      ...messages.map(m => m.sender_id),
      ...messages.map(m => m.recipient_id)
    ])];

    // Fetch all user profiles
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('*')
      .in('id', userIds);

    // Create profile map
    const profileMap = new Map(
      (profiles || []).map(p => [p.id, p])
    );

    // Attach profiles to messages
    return messages.map(msg => ({
      ...msg,
      sender: profileMap.get(msg.sender_id) || null,
      recipient: profileMap.get(msg.recipient_id) || null
    }));
  }

  /**
   * Send a message to another user
   */
  async sendMessage(
    recipientId: string,
    content: string,
    contentType: 'text' | 'image' | 'voice' | 'file' = 'text',
    mediaUrl?: string
  ): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .rpc('send_pulse_message', {
        p_sender_id: user.id,
        p_recipient_id: recipientId,
        p_content: content,
        p_content_type: contentType,
        p_media_url: mediaUrl || null
      });

    if (error) {
      console.error('Error sending message:', error);
      throw error;
    }

    // DAU/WAU/MAU + stickiness trunk event. Single chokepoint — all six Relay
    // modes / Pulse-DM surfaces funnel through this RPC, so we never spray
    // the call site. Fired only on success (after the RPC throws-or-returns).
    // Maps `voice|file|image|text` to the analytics enum verbatim.
    try {
      const messageType =
        contentType === 'voice' ? 'voice'
        : contentType === 'file' || contentType === 'image' ? 'file'
        : 'text';
      // Pulse DMs aren't workspace-scoped at the RPC level, so attach the
      // sender's *active* workspace as a best-effort dimension for the NSM
      // "Weekly Active Collaborative Workspaces" GROUP BY. Cheap synchronous
      // localStorage read (same key WorkspaceContext persists) — no DB
      // round-trip in the hot send path. Omitted entirely when unset; never
      // faked. No separate org id exists (org == workspace today).
      const workspaceId = getCurrentWorkspaceId();
      trackMessageSent(messageType, {
        content_type: contentType,
        ...(workspaceId ? { workspace_id: workspaceId } : {}),
      });
    } catch {
      // Analytics failures must never break the send path.
    }

    return data; // Returns message ID
  }

  /**
   * Mark messages in a conversation as read
   */
  async markAsRead(conversationId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .rpc('mark_messages_read', {
        p_user_id: user.id,
        p_conversation_id: conversationId
      });

    if (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(messageId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('pulse_messages')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString()
      })
      .eq('id', messageId)
      .eq('sender_id', user.id); // Only sender can delete

    if (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }

  /**
   * Get or create a conversation with another user
   */
  async getOrCreateConversation(otherUserId: string): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .rpc('get_or_create_conversation', {
        user_a: user.id,
        user_b: otherUserId
      });

    if (error) {
      console.error('Error getting/creating conversation:', error);
      throw error;
    }

    // If the user previously deleted this conversation, restore it now that
    // they're actively starting a new exchange.
    const conversationId = data as string;
    const { data: conv } = await supabase
      .from('pulse_conversations')
      .select('user1_id, is_deleted_by_user1, is_deleted_by_user2')
      .eq('id', conversationId)
      .single();

    if (conv) {
      const isUser1 = conv.user1_id === user.id;
      const deleteField = isUser1 ? 'is_deleted_by_user1' : 'is_deleted_by_user2';
      const wasDeleted = isUser1 ? conv.is_deleted_by_user1 : conv.is_deleted_by_user2;
      if (wasDeleted) {
        await supabase
          .from('pulse_conversations')
          .update({ [deleteField]: false })
          .eq('id', conversationId);
      }
    }

    return conversationId;
  }

  /**
   * Archive/unarchive a conversation
   */
  async setConversationArchived(conversationId: string, archived: boolean): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get the conversation to determine which user column to update
    const { data: conv, error: fetchError } = await supabase
      .from('pulse_conversations')
      .select('user1_id, user2_id')
      .eq('id', conversationId)
      .single();

    if (fetchError) throw fetchError;

    const updateField = conv.user1_id === user.id
      ? 'is_archived_by_user1'
      : 'is_archived_by_user2';

    const { error } = await supabase
      .from('pulse_conversations')
      .update({ [updateField]: archived })
      .eq('id', conversationId);

    if (error) {
      console.error('Error archiving conversation:', error);
      throw error;
    }
  }

  /**
   * Delete a conversation (removes it for the current user only via soft delete)
   */
  async deleteConversation(conversationId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: conv, error: fetchError } = await supabase
      .from('pulse_conversations')
      .select('user1_id, user2_id')
      .eq('id', conversationId)
      .single();

    if (fetchError) throw fetchError;

    const deleteField = conv.user1_id === user.id
      ? 'is_deleted_by_user1'
      : 'is_deleted_by_user2';

    const { error } = await supabase
      .from('pulse_conversations')
      .update({ [deleteField]: true })
      .eq('id', conversationId);

    if (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  }

  /**
   * Mute/unmute a conversation
   */
  async setConversationMuted(conversationId: string, muted: boolean): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: conv, error: fetchError } = await supabase
      .from('pulse_conversations')
      .select('user1_id, user2_id')
      .eq('id', conversationId)
      .single();

    if (fetchError) throw fetchError;

    const updateField = conv.user1_id === user.id
      ? 'is_muted_by_user1'
      : 'is_muted_by_user2';

    const { error } = await supabase
      .from('pulse_conversations')
      .update({ [updateField]: muted })
      .eq('id', conversationId);

    if (error) {
      console.error('Error muting conversation:', error);
      throw error;
    }
  }

  /**
   * Get total unread message count
   */
  async getUnreadCount(): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { data, error } = await supabase
      .from('pulse_messages')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('is_read', false)
      .eq('is_deleted', false);

    if (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }

    return data?.length || 0;
  }

  /**
   * Get all public Pulse users (for discovery)
   * Returns up to limit users, optionally excluding current user
   */
  async getAllUsers(limit: number = 50): Promise<SearchUserResult[]> {
    const { data: { user } } = await supabase.auth.getUser();

    let query = supabase
      .from('user_profiles')
      .select('id, handle, display_name, full_name, avatar_url, is_verified')
      .eq('is_public', true)
      .order('last_seen_at', { ascending: false })
      .limit(limit);

    // Exclude current user if logged in
    if (user) {
      query = query.neq('id', user.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching all users:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get recent Pulse contacts (users you've messaged)
   */
  async getRecentContacts(limit: number = 10): Promise<SearchUserResult[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Get recent conversations and extract the other user IDs
    const { data: conversations, error: convError } = await supabase
      .from('pulse_conversations')
      .select('user1_id, user2_id, last_message_at')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (convError || !conversations || conversations.length === 0) {
      return [];
    }

    // Get the other user IDs
    const otherUserIds = conversations.map(conv =>
      conv.user1_id === user.id ? conv.user2_id : conv.user1_id
    );

    // Fetch their profiles
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, handle, display_name, full_name, avatar_url, is_verified')
      .in('id', otherUserIds);

    if (profileError) {
      console.error('Error fetching recent contacts:', profileError);
      return [];
    }

    // Sort profiles to match conversation order
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    return otherUserIds
      .map(id => profileMap.get(id))
      .filter((p): p is SearchUserResult => p !== undefined);
  }

  /**
   * Subscribe to new messages in real-time
   * Subscribes to messages where user is either sender or recipient
   */
  subscribeToMessages(
    onMessage: (message: PulseMessage) => void
  ): () => void {
    // Create unique channel name to avoid conflicts
    const channelName = `pulse-messages-${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      // Subscribe to messages where user is recipient (incoming messages)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pulse_messages'
        },
        async (payload) => {
          const newMsg = payload.new as any;

          // Get current user ID
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          // Only process messages relevant to this user
          if (newMsg.sender_id !== user.id && newMsg.recipient_id !== user.id) {
            return;
          }

          // Fetch sender and recipient profiles
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('*')
            .in('id', [newMsg.sender_id, newMsg.recipient_id]);

          const profileMap = new Map(
            (profiles || []).map(p => [p.id, p])
          );

          const message: PulseMessage = {
            ...newMsg,
            sender: profileMap.get(newMsg.sender_id) || null,
            recipient: profileMap.get(newMsg.recipient_id) || null
          };

          onMessage(message);
        }
      )
      .subscribe((status) => {
        console.log('Pulse messages realtime subscription status:', status);
      });

    // Return unsubscribe function
    return () => {
      supabase.removeChannel(channel);
    };
  }
  // ========================================
  // REACTION METHODS
  // ========================================

  /**
   * Get all reactions for a list of message IDs
   */
  async getReactionsForMessages(messageIds: string[]): Promise<Record<string, Array<{ emoji: string; count: number; me: boolean }>>> {
    if (messageIds.length === 0) return {};

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return {};

    const { data, error } = await supabase
      .from('pulse_message_reactions')
      .select('message_id, user_id, emoji')
      .in('message_id', messageIds);

    if (error) {
      console.error('Error fetching reactions:', error);
      return {};
    }

    // Aggregate into { messageId: [{ emoji, count, me }] }
    const result: Record<string, Array<{ emoji: string; count: number; me: boolean }>> = {};
    for (const row of data || []) {
      if (!result[row.message_id]) result[row.message_id] = [];
      const existing = result[row.message_id].find(r => r.emoji === row.emoji);
      if (existing) {
        existing.count++;
        if (row.user_id === user.id) existing.me = true;
      } else {
        result[row.message_id].push({
          emoji: row.emoji,
          count: 1,
          me: row.user_id === user.id
        });
      }
    }
    return result;
  }

  /**
   * Add a reaction to a message (toggle: removes if already exists)
   * Returns true if added, false if removed
   */
  async toggleReaction(messageId: string, emoji: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Check if reaction already exists
    const { data: existing } = await supabase
      .from('pulse_message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .eq('emoji', emoji)
      .maybeSingle();

    if (existing) {
      // Remove it
      const { error } = await supabase
        .from('pulse_message_reactions')
        .delete()
        .eq('id', existing.id);

      if (error) {
        console.error('Error removing reaction:', error);
        throw error;
      }
      return false;
    } else {
      // Add it
      const { error } = await supabase
        .from('pulse_message_reactions')
        .insert({
          message_id: messageId,
          user_id: user.id,
          emoji
        });

      if (error) {
        console.error('Error adding reaction:', error);
        throw error;
      }
      return true;
    }
  }

  /**
   * Subscribe to reaction changes in real-time
   */
  subscribeToReactions(
    onReactionChange: () => void
  ): () => void {
    const channelName = `pulse-reactions-${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pulse_message_reactions'
        },
        () => {
          onReactionChange();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  // ========================================
  // STARRED MESSAGES METHODS
  // ========================================

  /**
   * Get all starred message IDs for the current user
   */
  async getStarredMessageIds(): Promise<Set<string>> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Set();

    const { data, error } = await supabase
      .from('pulse_starred_messages')
      .select('message_id')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching starred messages:', error);
      return new Set();
    }

    return new Set((data || []).map(d => d.message_id));
  }

  /**
   * Toggle star on a message. Returns true if starred, false if unstarred.
   */
  async toggleStar(messageId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Check if already starred
    const { data: existing } = await supabase
      .from('pulse_starred_messages')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('pulse_starred_messages')
        .delete()
        .eq('id', existing.id);

      if (error) {
        console.error('Error unstarring message:', error);
        throw error;
      }
      return false;
    } else {
      const { error } = await supabase
        .from('pulse_starred_messages')
        .insert({
          message_id: messageId,
          user_id: user.id
        });

      if (error) {
        console.error('Error starring message:', error);
        throw error;
      }
      return true;
    }
  }

  // ========================================
  // FILE UPLOAD METHODS
  // ========================================

  /**
   * Upload a file to Supabase storage and return the public URL
   */
  async uploadAttachment(file: File): Promise<{ url: string; contentType: 'image' | 'voice' | 'file' }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Determine content type
    let contentType: 'image' | 'voice' | 'file' = 'file';
    if (file.type.startsWith('image/')) contentType = 'image';
    else if (file.type.startsWith('audio/')) contentType = 'voice';

    // Create unique path: user_id/timestamp_filename
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${user.id}/${Date.now()}_${Math.random().toString(36).substr(2, 6)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('pulse-attachments')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Error uploading attachment:', uploadError);
      throw uploadError;
    }

    const { data: urlData } = supabase.storage
      .from('pulse-attachments')
      .getPublicUrl(path);

    return {
      url: urlData.publicUrl,
      contentType
    };
  }

  /**
   * Send a message with an attachment (upload file then send)
   */
  async sendMessageWithAttachment(
    recipientId: string,
    file: File,
    caption?: string
  ): Promise<string> {
    const { url, contentType } = await this.uploadAttachment(file);
    return this.sendMessage(recipientId, caption || file.name, contentType, url);
  }

  // ========================================
  // MESSAGE EDITING
  // ========================================

  /**
   * Edit a message (only sender can edit, only text content)
   */
  async editMessage(messageId: string, newContent: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('pulse_messages')
      .update({
        content: newContent,
        metadata: { edited: true, edited_at: new Date().toISOString() },
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId)
      .eq('sender_id', user.id); // Only sender can edit

    if (error) {
      console.error('Error editing message:', error);
      throw error;
    }
  }

  // ========================================
  // PAGINATION
  // ========================================

  /**
   * Get messages with cursor-based pagination
   * Returns messages older than the cursor (for "load more" scrolling up)
   */
  async getMessagesPaginated(
    conversationId: string,
    limit: number = 50,
    beforeDate?: string
  ): Promise<{ messages: PulseMessage[]; hasMore: boolean }> {
    let query = supabase
      .from('pulse_messages')
      .select('*')
      .eq('thread_id', conversationId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit + 1); // Fetch one extra to check if there are more

    if (beforeDate) {
      query = query.lt('created_at', beforeDate);
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error('Error fetching paginated messages:', error);
      throw error;
    }

    if (!messages || messages.length === 0) {
      return { messages: [], hasMore: false };
    }

    const hasMore = messages.length > limit;
    const trimmed = hasMore ? messages.slice(0, limit) : messages;

    // Reverse to ascending order for display
    trimmed.reverse();

    // Collect all unique user IDs
    const userIds = [...new Set([
      ...trimmed.map(m => m.sender_id),
      ...trimmed.map(m => m.recipient_id)
    ])];

    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('*')
      .in('id', userIds);

    const profileMap = new Map(
      (profiles || []).map(p => [p.id, p])
    );

    const enriched = trimmed.map(msg => ({
      ...msg,
      sender: profileMap.get(msg.sender_id) || null,
      recipient: profileMap.get(msg.recipient_id) || null
    }));

    return { messages: enriched, hasMore };
  }

  // ========================================
  // TYPING INDICATORS
  // ========================================

  /**
   * Broadcast typing status via Supabase Realtime Presence
   */
  broadcastTyping(conversationId: string, isTyping: boolean): void {
    const channelName = `typing:${conversationId}`;
    const channel = supabase.channel(channelName);

    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { isTyping, timestamp: Date.now() }
    });
  }

  /**
   * Subscribe to typing indicators for a conversation
   */
  subscribeToTyping(
    conversationId: string,
    onTypingChange: (isTyping: boolean) => void
  ): () => void {
    const channelName = `typing:${conversationId}`;
    let typingTimeout: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { isTyping } = payload.payload;
        onTypingChange(isTyping);

        // Auto-clear typing after 5s of no updates
        if (typingTimeout) clearTimeout(typingTimeout);
        if (isTyping) {
          typingTimeout = setTimeout(() => onTypingChange(false), 5000);
        }
      })
      .subscribe();

    return () => {
      if (typingTimeout) clearTimeout(typingTimeout);
      supabase.removeChannel(channel);
    };
  }

  // ========================================
  // MESSAGE FORWARDING
  // ========================================

  /**
   * Forward a message to another conversation
   */
  async forwardMessage(messageId: string, targetRecipientId: string): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Fetch the original message
    const { data: original, error: fetchError } = await supabase
      .from('pulse_messages')
      .select('content, content_type, media_url')
      .eq('id', messageId)
      .single();

    if (fetchError || !original) {
      throw new Error('Message not found');
    }

    // Send as a new message with forwarded metadata
    const { data, error } = await supabase
      .rpc('send_pulse_message', {
        p_sender_id: user.id,
        p_recipient_id: targetRecipientId,
        p_content: original.content,
        p_content_type: original.content_type,
        p_media_url: original.media_url || null
      });

    if (error) {
      console.error('Error forwarding message:', error);
      throw error;
    }

    return data;
  }

  // ========================================
  // SCHEDULED MESSAGES
  // ========================================

  /**
   * Schedule a message for future delivery
   */
  async scheduleMessage(
    recipientId: string,
    content: string,
    scheduledFor: Date
  ): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('pulse_scheduled_messages')
      .insert({
        sender_id: user.id,
        recipient_id: recipientId,
        content,
        scheduled_for: scheduledFor.toISOString(),
        status: 'pending'
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error scheduling message:', error);
      throw error;
    }

    return data.id;
  }

  /**
   * Get pending scheduled messages for the current user
   */
  async getScheduledMessages(): Promise<Array<{
    id: string;
    recipient_id: string;
    content: string;
    scheduled_for: string;
    status: string;
    created_at: string;
  }>> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('pulse_scheduled_messages')
      .select('*')
      .eq('sender_id', user.id)
      .eq('status', 'pending')
      .order('scheduled_for', { ascending: true });

    if (error) {
      console.error('Error fetching scheduled messages:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Cancel a scheduled message
   */
  async cancelScheduledMessage(messageId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('pulse_scheduled_messages')
      .update({ status: 'cancelled' })
      .eq('id', messageId)
      .eq('sender_id', user.id);

    if (error) {
      console.error('Error cancelling scheduled message:', error);
      throw error;
    }
  }
}

export const pulseService = new PulseService();
