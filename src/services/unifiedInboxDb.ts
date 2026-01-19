import { supabase } from './supabase';
import { UnifiedMessage, MessageSource } from '../types/index';

// ============================================
// DATABASE TYPES
// ============================================

export interface DbUser {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface DbIntegration {
  id: string;
  user_id: string;
  platform: MessageSource;
  workspace_id?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  is_active: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DbContact {
  id: string;
  user_id: string;
  platform: MessageSource;
  external_id: string;
  name: string;
  display_name?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  company?: string;
  role?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DbChannel {
  id: string;
  user_id: string;
  platform: MessageSource;
  external_id: string;
  name: string;
  type?: string;
  is_member: boolean;
  is_archived: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DbMessage {
  id: string;
  user_id: string;
  platform: MessageSource;
  external_id: string;
  channel_id: string;
  sender_id?: string;
  content: string;
  content_type: string;
  media_url?: string;
  thread_id?: string;
  reply_to_id?: string;
  timestamp: string;
  is_read: boolean;
  is_starred: boolean;
  tags: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DbSyncState {
  id: string;
  user_id: string;
  platform: MessageSource;
  channel_external_id?: string;
  last_sync_at?: string;
  last_message_timestamp?: string;
  sync_cursor?: string;
  sync_status: 'pending' | 'syncing' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// UNIFIED INBOX DATABASE SERVICE
// ============================================

export class UnifiedInboxDbService {
  /**
   * Upsert a contact from any platform
   */
  async upsertContact(userId: string, platform: MessageSource, contact: {
    externalId: string;
    name: string;
    email?: string;
    phone?: string;
    avatarUrl?: string;
    company?: string;
    role?: string;
    metadata?: Record<string, any>;
  }): Promise<DbContact> {
    const { data, error } = await supabase
      .from('contacts')
      .upsert({
        user_id: userId,
        platform,
        external_id: contact.externalId,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        avatar_url: contact.avatarUrl,
        company: contact.company,
        role: contact.role,
        metadata: contact.metadata || {},
      }, {
        onConflict: 'user_id,platform,external_id'
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to upsert contact: ${error.message}`);
    return data;
  }

  /**
   * Upsert a channel from any platform
   */
  async upsertChannel(userId: string, platform: MessageSource, channel: {
    externalId: string;
    name: string;
    type?: string;
    isMember?: boolean;
    isArchived?: boolean;
    metadata?: Record<string, any>;
  }): Promise<DbChannel> {
    const { data, error } = await supabase
      .from('channels')
      .upsert({
        user_id: userId,
        platform,
        external_id: channel.externalId,
        name: channel.name,
        type: channel.type,
        is_member: channel.isMember ?? false,
        is_archived: channel.isArchived ?? false,
        metadata: channel.metadata || {},
      }, {
        onConflict: 'user_id,platform,external_id'
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to upsert channel: ${error.message}`);
    return data;
  }

  /**
   * Store a unified message (handles deduplication)
   */
  async storeMessage(userId: string, message: UnifiedMessage): Promise<DbMessage | null> {
    try {
      // First, ensure the channel exists
      const channel = await this.upsertChannel(userId, message.source, {
        externalId: message.channelId,
        name: message.channelName,
        isMember: true,
      });

      // Ensure the sender exists as a contact
      let senderId: string | undefined;
      if (message.senderId && message.senderName) {
        const sender = await this.upsertContact(userId, message.source, {
          externalId: message.senderId,
          name: message.senderName,
          email: message.senderEmail,
          metadata: {},
        });
        senderId = sender.id;
      }

      // Store the message
      const { data, error } = await supabase
        .from('unified_messages')
        .upsert({
          user_id: userId,
          platform: message.source,
          external_id: message.id,
          channel_id: channel.id,
          sender_id: senderId,
          content: message.content,
          content_type: message.type,
          media_url: message.mediaUrl,
          thread_id: message.threadId,
          timestamp: message.timestamp.toISOString(),
          is_read: message.isRead,
          is_starred: message.starred,
          tags: message.tags,
          metadata: message.metadata,
        }, {
          onConflict: 'user_id,platform,external_id'
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to store message:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error storing message:', error);
      return null;
    }
  }

  /**
   * Bulk store messages (more efficient for syncing)
   */
  async storeMessages(userId: string, messages: UnifiedMessage[]): Promise<number> {
    let storedCount = 0;

    for (const message of messages) {
      const result = await this.storeMessage(userId, message);
      if (result) storedCount++;
    }

    return storedCount;
  }

  /**
   * Get all messages for a user
   */
  async getMessages(userId: string, options?: {
    platform?: MessageSource;
    channelId?: string;
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    starredOnly?: boolean;
  }): Promise<DbMessage[]> {
    let query = supabase
      .from('unified_messages')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false });

    if (options?.platform) {
      query = query.eq('platform', options.platform);
    }

    if (options?.channelId) {
      query = query.eq('channel_id', options.channelId);
    }

    if (options?.unreadOnly) {
      query = query.eq('is_read', false);
    }

    if (options?.starredOnly) {
      query = query.eq('is_starred', true);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to fetch messages: ${error.message}`);
    return data || [];
  }

  /**
   * Get channels for a user
   */
  async getChannels(userId: string, platform?: MessageSource): Promise<DbChannel[]> {
    let query = supabase
      .from('channels')
      .select('*')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('name');

    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to fetch channels: ${error.message}`);
    return data || [];
  }

  /**
   * Get contacts for a user
   */
  async getContacts(userId: string, platform?: MessageSource): Promise<DbContact[]> {
    let query = supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .order('name');

    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to fetch contacts: ${error.message}`);
    return data || [];
  }

  /**
   * Mark message as read
   */
  async markAsRead(userId: string, messageId: string): Promise<void> {
    const { error } = await supabase
      .from('unified_messages')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('id', messageId);

    if (error) throw new Error(`Failed to mark message as read: ${error.message}`);
  }

  /**
   * Toggle star on message
   */
  async toggleStar(userId: string, messageId: string, starred: boolean): Promise<void> {
    const { error } = await supabase
      .from('unified_messages')
      .update({ is_starred: starred })
      .eq('user_id', userId)
      .eq('id', messageId);

    if (error) throw new Error(`Failed to toggle star: ${error.message}`);
  }

  /**
   * Update sync state
   */
  async updateSyncState(userId: string, platform: MessageSource, state: {
    channelExternalId?: string;
    lastMessageTimestamp?: Date;
    syncCursor?: string;
    syncStatus: 'pending' | 'syncing' | 'completed' | 'failed';
    errorMessage?: string;
  }): Promise<void> {
    const { error} = await supabase
      .from('message_sync_state')
      .upsert({
        user_id: userId,
        platform,
        channel_external_id: state.channelExternalId,
        last_sync_at: new Date().toISOString(),
        last_message_timestamp: state.lastMessageTimestamp?.toISOString(),
        sync_cursor: state.syncCursor,
        sync_status: state.syncStatus,
        error_message: state.errorMessage,
      }, {
        onConflict: 'user_id,platform,channel_external_id'
      });

    if (error) throw new Error(`Failed to update sync state: ${error.message}`);
  }

  /**
   * Get sync state for a platform
   */
  async getSyncState(userId: string, platform: MessageSource, channelExternalId?: string): Promise<DbSyncState | null> {
    let query = supabase
      .from('message_sync_state')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', platform);

    if (channelExternalId) {
      query = query.eq('channel_external_id', channelExternalId);
    }

    const { data, error } = await query.single();

    if (error) return null;
    return data;
  }

  /**
   * Get message count by platform
   */
  async getMessageStats(userId: string): Promise<Record<MessageSource, number>> {
    const { data, error } = await supabase
      .from('unified_messages')
      .select('platform')
      .eq('user_id', userId);

    if (error) return {} as Record<MessageSource, number>;

    const stats: Record<string, number> = {};
    data.forEach(row => {
      stats[row.platform] = (stats[row.platform] || 0) + 1;
    });

    return stats as Record<MessageSource, number>;
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string, platform?: MessageSource): Promise<number> {
    let query = supabase
      .from('unified_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (platform) {
      query = query.eq('platform', platform);
    }

    const { count, error } = await query;

    if (error) return 0;
    return count || 0;
  }
}

export const unifiedInboxDb = new UnifiedInboxDbService();
