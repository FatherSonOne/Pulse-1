// Vox Mode Service - Backend operations for all Vox communication styles
import { supabase } from '../supabase';

/** A subscriber of a Pulse Radio channel, joined with their pulse_users profile (#104). */
export interface ChannelSubscriber {
  subscriberId: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  subscribedAt: string | null;
}

import { transcribeMedia } from '../geminiService';
import { usageTracker } from '../usageTracker';
import { invokeAIPrompt, invokeAIJson } from '../ai/aiService';
import { captureMessage } from '../../lib/monitoring/sentry';
import { getCurrentWorkspaceId } from '../ai/getWorkspaceId';
import type {
  VoxMode,
  PulseUser,
  PulseChannel,
  Broadcast,
  VoiceThread,
  VoiceThreadMessage,
  VoxWorkspace,
  VoxTeamChannel,
  TeamVoxMessage,
  VoxNote,
  QuickVoxFavorite,
  QuickVoxMessage,
  QuickVoxStatus,
  VoxDrop,
  VoxNotification,
  VoxDeliveryStatus,
} from './voxModeTypes';

// Explicit column list for the Pulse-user directory queries. Never `select('*')`
// here — the directory is fetched by every Relay/Glimpse contact picker, and `*`
// would re-ship wide/PII columns (and, before the Storage migration, a >1 MB
// inline base64 avatar) on every call. These are exactly the fields
// mapUserProfileToPulseUser() consumes.
const PULSE_DIRECTORY_COLUMNS =
  'id, handle, display_name, full_name, avatar_url, bio, is_verified, created_at, last_seen_at';

// Short TTL so rapid re-mounts / render storms collapse into a single network
// round-trip instead of one fetch per render.
const ALL_USERS_CACHE_TTL_MS = 60_000;

class VoxModeService {
  private userId: string | null = null;
  private workspaceId: string | null = null;
  private bucketChecked: boolean = false;
  private bucketExists: boolean = false;
  private _allUsersCache: { at: number; users: PulseUser[] } | null = null;
  private _allUsersInflight: Promise<PulseUser[]> | null = null;

  setUserId(userId: string) {
    this.userId = userId;
  }

  /**
   * Resolve the caller's workspace_id by looking up workspace_members.
   * Required for inserts into workspace-scoped tables (e.g. quick_vox_messages),
   * whose RLS policies gate on `user_has_workspace_access(workspace_id)`.
   * Cached per-session — clear via clearWorkspaceCache() on workspace switch.
   */
  async ensureWorkspaceId(): Promise<string | null> {
    if (this.workspaceId) return this.workspaceId;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    if (error || !data?.workspace_id) return null;
    this.workspaceId = data.workspace_id as string;
    return this.workspaceId;
  }

  clearWorkspaceCache() {
    this.workspaceId = null;
  }

  async ensureUserId(): Promise<string> {
    if (this.userId) return this.userId;

    // Try to get from Supabase auth
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      this.userId = user.id;
      return user.id;
    }

    // Fallback to localStorage
    const stored = localStorage.getItem('pulse_user_id');
    if (stored) {
      this.userId = stored;
      return stored;
    }

    return '';
  }

  /**
   * Ensures the current user exists in the pulse_users table.
   * Creates a new pulse user record if one doesn't exist.
   * This is required before creating channels or other resources that
   * have foreign key constraints to pulse_users.
   */
  async ensurePulseUser(): Promise<PulseUser | null> {
    const userId = await this.ensureUserId();
    if (!userId) {
      console.error('No user ID available for ensurePulseUser');
      return null;
    }

    // Check if user already exists
    const existingUser = await this.getPulseUser(userId);
    if (existingUser) {
      return existingUser;
    }

    // Get user info from Supabase auth to create a better profile
    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email || '';
    const displayName = user?.user_metadata?.full_name ||
                        user?.user_metadata?.name ||
                        email.split('@')[0] ||
                        'Pulse User';

    // Generate a unique handle from email or user id
    const baseHandle = email ? email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') : userId.slice(0, 8);
    const handle = `${baseHandle}${Math.floor(Math.random() * 1000)}`;

    // Create the pulse user
    const { data, error } = await supabase
      .from('pulse_users')
      .insert([{
        id: userId,
        handle: handle,
        display_name: displayName,
        avatar_color: this.generateAvatarColor(),
        is_verified: false,
        follower_count: 0,
        following_count: 0,
        settings: {
          notificationsEnabled: true,
          emailNotifications: true,
          pushNotifications: true,
          defaultVoxMode: 'quick_vox',
          autoPlayIncoming: false,
          transcriptionEnabled: true,
          privacyLevel: 'followers',
        },
        created_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating pulse user:', error);
      // If it's a duplicate key error, the user already exists - try to fetch again
      if (error.code === '23505') {
        return await this.getPulseUser(userId);
      }
      return null;
    }

    return this.mapDbToPulseUser(data);
  }

  getUserId(): string {
    if (this.userId) return this.userId;

    // Synchronous fallback - try localStorage
    const stored = localStorage.getItem('pulse_user_id');
    if (stored) {
      this.userId = stored;
      return stored;
    }

    return '';
  }

  /**
   * Ensures the 'relay' storage bucket exists, creating it if needed.
   *
   * Dual-read model: new uploads go to the 'relay' bucket. Old content
   * remains in the 'voxer' bucket (untouched here) and continues to resolve
   * via the URLs already stored in DB records — Supabase public URLs encode
   * the bucket name, so old voxer/* URLs and new relay/* URLs both work
   * without any application-level fallback. Background migration of orphan
   * voxer objects + URL rewrites is a separate pass after the 30-day window.
   */
  async ensureStorageBucket(): Promise<boolean> {
    if (this.bucketChecked) return this.bucketExists;

    try {
      // First try to check if bucket exists by listing files (more reliable than listing buckets)
      // This avoids the 400 error when trying to create a bucket that already exists
      const { data: files, error: listFilesError } = await supabase.storage
        .from('relay')
        .list('', { limit: 1 });

      // If we can list files (even if empty), the bucket exists
      if (!listFilesError) {
        this.bucketChecked = true;
        this.bucketExists = true;
        return true;
      }

      // If we got a "not found" error, the bucket doesn't exist
      // Otherwise, assume it exists but we don't have permission to list
      if (listFilesError.message?.includes('not found') ||
          listFilesError.message?.includes('does not exist')) {
        // Try to create the bucket
        const { data, error: createError } = await supabase.storage.createBucket('relay', {
          public: true,
          fileSizeLimit: 52428800, // 50MB
          allowedMimeTypes: ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-m4a']
        });

        if (createError) {
          // If it's a "already exists" error, that's actually fine (race condition)
          if (createError.message?.includes('already exists') ||
              createError.message?.includes('duplicate')) {
            this.bucketChecked = true;
            this.bucketExists = true;
            return true;
          }
          console.error('Error creating relay bucket:', createError);
          console.error('>>> IMPORTANT: The "relay" storage bucket could not be created automatically.');
          console.error('>>> Run the migration: supabase/migrations/20260427120000_create_relay_storage_bucket.sql');
          console.error('>>> Or create it manually in the Supabase dashboard under Storage.');
          this.bucketChecked = true;
          this.bucketExists = false;
          return false;
        }

        this.bucketChecked = true;
        this.bucketExists = true;
        return true;
      }

      // Got an error listing files, but not a "not found" error
      // Assume bucket exists but we don't have list permission
      this.bucketChecked = true;
      this.bucketExists = true;
      return true;

    } catch (error) {
      console.error('Error ensuring storage bucket:', error);
      console.error('>>> IMPORTANT: The "relay" storage bucket may not exist.');
      console.error('>>> Run the migration: supabase/migrations/20260427120000_create_relay_storage_bucket.sql');
      // Don't mark as checked so we can retry
      return false;
    }
  }

  // ============================================
  // PULSE USER & HANDLES
  // ============================================

  async createPulseHandle(handle: string, displayName: string): Promise<PulseUser | null> {
    const userId = await this.ensureUserId();
    if (!userId) return null;

    // Check if handle is available
    const { data: existing } = await supabase
      .from('pulse_users')
      .select('id')
      .eq('handle', handle.toLowerCase())
      .single();

    if (existing) {
      throw new Error('Handle already taken');
    }

    const { data, error } = await supabase
      .from('pulse_users')
      .insert([{
        id: userId,
        handle: handle.toLowerCase(),
        display_name: displayName,
        avatar_color: this.generateAvatarColor(),
        is_verified: false,
        follower_count: 0,
        following_count: 0,
        settings: {
          notificationsEnabled: true,
          emailNotifications: true,
          pushNotifications: true,
          defaultVoxMode: 'quick_vox',
          autoPlayIncoming: false,
          transcriptionEnabled: true,
          privacyLevel: 'followers',
        },
        created_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating pulse handle:', error);
      return null;
    }

    return this.mapDbToPulseUser(data);
  }

  async getPulseUser(userId?: string): Promise<PulseUser | null> {
    const targetId = userId || this.getUserId();
    if (!targetId) return null;

    const { data, error } = await supabase
      .from('pulse_users')
      .select('*')
      .eq('id', targetId)
      .single();

    if (error || !data) return null;
    return this.mapDbToPulseUser(data);
  }

  async searchPulseUsers(query: string): Promise<PulseUser[]> {
    // Search in user_profiles (all registered Pulse app users).
    // Select only the columns the picker renders — never `*`, which would pull
    // wide/PII columns (and historically a >1 MB inline avatar) on every call.
    const { data, error } = await supabase
      .from('user_profiles')
      .select(PULSE_DIRECTORY_COLUMNS)
      .eq('is_public', true)
      .or(`handle.ilike.%${query}%,display_name.ilike.%${query}%,full_name.ilike.%${query}%`)
      .limit(20);

    if (error || !data) return [];
    return data.map(user => this.mapUserProfileToPulseUser(user));
  }

  async getAllPulseUsers(): Promise<PulseUser[]> {
    // Get all registered Pulse app users from user_profiles.
    //
    // This is hit by every Relay/Glimpse contact picker and was historically
    // re-fired in render storms (dozens/sec). Two guards keep that from
    // becoming an egress problem: (1) an explicit column list instead of `*`,
    // and (2) a short-TTL in-memory cache that collapses bursts into one query.
    const now = Date.now();
    if (this._allUsersCache && now - this._allUsersCache.at < ALL_USERS_CACHE_TTL_MS) {
      return this._allUsersCache.users;
    }
    if (this._allUsersInflight) return this._allUsersInflight;

    this._allUsersInflight = (async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select(PULSE_DIRECTORY_COLUMNS)
        .eq('is_public', true)
        .order('display_name', { ascending: true })
        .limit(100);

      if (error || !data) return [];
      const users = data.map(user => this.mapUserProfileToPulseUser(user));
      this._allUsersCache = { at: Date.now(), users };
      return users;
    })();

    try {
      return await this._allUsersInflight;
    } finally {
      this._allUsersInflight = null;
    }
  }

  async getPulseUsersByIds(userIds: string[]): Promise<PulseUser[]> {
    if (userIds.length === 0) return [];

    const { data, error } = await supabase
      .from('pulse_users')
      .select('*')
      .in('id', userIds);

    if (error || !data) return [];
    return data.map(user => this.mapDbToPulseUser(user));
  }

  /**
   * Filters a contacts array to only include contacts that are registered Pulse users.
   * Matches contacts by ID or by display name (case-insensitive).
   * Returns contacts in their original format with a pulseUserId property added.
   */
  async filterContactsToPulseUsers<T extends { id: string; name: string }>(contacts: T[]): Promise<(T & { pulseUserId: string })[]> {
    if (contacts.length === 0) return [];

    // Get all Pulse users
    const pulseUsers = await this.getAllPulseUsers();
    if (pulseUsers.length === 0) return [];

    // Create lookup maps for efficient matching
    const pulseUserById = new Map(pulseUsers.map(u => [u.id, u]));
    const pulseUserByName = new Map(pulseUsers.map(u => [u.displayName.toLowerCase(), u]));

    // Filter contacts that have matching Pulse users
    const filteredContacts: (T & { pulseUserId: string })[] = [];

    for (const contact of contacts) {
      // Try to match by ID first
      let pulseUser = pulseUserById.get(contact.id);

      // If no ID match, try matching by display name
      if (!pulseUser) {
        pulseUser = pulseUserByName.get(contact.name.toLowerCase());
      }

      if (pulseUser) {
        filteredContacts.push({
          ...contact,
          pulseUserId: pulseUser.id,
        });
      }
    }

    return filteredContacts;
  }

  /**
   * Gets all Pulse users formatted as contacts for use in Vox mode UIs.
   * This is useful when you want to show only Pulse users regardless of the contacts array.
   */
  async getPulseUsersAsContacts(): Promise<Array<{
    id: string;
    name: string;
    avatarColor: string;
    handle: string;
    isVerified: boolean;
  }>> {
    const pulseUsers = await this.getAllPulseUsers();

    return pulseUsers.map(user => ({
      id: user.id,
      name: user.displayName,
      avatarColor: user.avatarColor,
      handle: user.handle,
      isVerified: user.isVerified,
    }));
  }

  async followUser(targetUserId: string): Promise<boolean> {
    const userId = await this.ensureUserId();
    if (!userId) return false;

    const { error } = await supabase
      .from('pulse_follows')
      .insert([{
        follower_id: userId,
        following_id: targetUserId,
        created_at: new Date().toISOString(),
      }]);

    if (error) {
      console.error('Error following user:', error);
      return false;
    }

    // Update counts
    await supabase.rpc('increment_follower_count', { user_id: targetUserId });
    await supabase.rpc('increment_following_count', { user_id: userId });

    return true;
  }

  // ============================================
  // PULSE RADIO
  // ============================================

  async createChannel(name: string, description: string, isPublic: boolean = true): Promise<PulseChannel | null> {
    // Ensure the user exists in pulse_users first (required for foreign key constraint)
    const pulseUser = await this.ensurePulseUser();
    if (!pulseUser) {
      console.error('Failed to ensure pulse user exists before creating channel');
      return null;
    }

    const userId = pulseUser.id;

    const { data, error } = await supabase
      .from('pulse_channels')
      .insert([{
        owner_id: userId,
        name,
        description,
        is_public: isPublic,
        subscriber_count: 0,
        total_listens: 0,
        category: 'general',
        tags: [],
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating channel:', error);
      return null;
    }

    return this.mapDbToChannel(data);
  }

  async getMyChannels(limit: number = 50, offset: number = 0): Promise<PulseChannel[]> {
    const userId = await this.ensureUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('pulse_channels')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error || !data) return [];
    return data.map(channel => this.mapDbToChannel(channel));
  }

  /**
   * List the subscribers of a channel, joined with their pulse_users profile (#104).
   * RLS lets the channel owner read all subscriptions for their channel.
   */
  async getChannelSubscribers(channelId: string): Promise<ChannelSubscriber[]> {
    const { data: subs, error } = await supabase
      .from('pulse_channel_subscriptions')
      .select('subscriber_id, created_at')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true });

    if (error || !subs || subs.length === 0) return [];

    const ids = subs.map(s => s.subscriber_id).filter(Boolean);
    const { data: users } = await supabase
      .from('pulse_users')
      .select('auth_user_id, display_name, handle, avatar_url')
      .in('auth_user_id', ids);

    const byId = new Map((users ?? []).map(u => [u.auth_user_id, u]));
    return subs.map(s => {
      const u = byId.get(s.subscriber_id);
      return {
        subscriberId: s.subscriber_id,
        displayName: u?.display_name ?? 'Pulse user',
        handle: u?.handle ?? null,
        avatarUrl: u?.avatar_url ?? null,
        subscribedAt: s.created_at,
      };
    });
  }

  /**
   * Remove a subscriber from a channel (#104). RLS lets the channel owner delete
   * subscriptions for their channel. Returns false on failure.
   */
  async removeChannelSubscriber(channelId: string, subscriberId: string): Promise<boolean> {
    const { error } = await supabase
      .from('pulse_channel_subscriptions')
      .delete()
      .eq('channel_id', channelId)
      .eq('subscriber_id', subscriberId);

    if (error) {
      console.error('Failed to remove channel subscriber:', error);
      return false;
    }
    return true;
  }

  async createBroadcast(
    channelId: string,
    title: string,
    audioUrl: string,
    duration: number,
    transcript?: string,
    scheduledFor?: Date,
    parentBroadcastId?: string
  ): Promise<Broadcast | null> {
    const userId = await this.ensureUserId();
    if (!userId) return null;

    const user = await this.getPulseUser();

    const { data, error } = await supabase
      .from('broadcasts')
      .insert([{
        channel_id: channelId,
        author_id: userId,
        author_name: user?.displayName || 'Unknown',
        title,
        audio_url: audioUrl,
        duration: Math.round(duration),
        transcript,
        listen_count: 0,
        reaction_counts: {},
        is_live: false,
        published_at: scheduledFor ? null : new Date().toISOString(),
        scheduled_for: scheduledFor?.toISOString(),
        tags: [],
        parent_broadcast_id: parentBroadcastId ?? null,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating broadcast:', error);
      return null;
    }

    // Notify subscribers — but not for discussion responses (a reply shouldn't
    // ping the whole channel the way a top-level broadcast does).
    if (!parentBroadcastId) {
      await this.notifyChannelSubscribers(channelId, data.id, title);
    }

    return this.mapDbToBroadcast(data);
  }

  async uploadAndPublishBroadcast(
    channelId: string,
    title: string,
    audioBlob: Blob,
    duration: number,
    notifyUserIds?: string[],
    parentBroadcastId?: string
  ): Promise<Broadcast | null> {
    const userId = await this.ensureUserId();
    if (!userId) {
      console.error('No user ID for broadcast upload');
      return null;
    }

    try {
      // Ensure storage bucket exists
      await this.ensureStorageBucket();

      // Upload audio to storage
      const fileName = `broadcasts/${channelId}/${userId}/${Date.now()}.webm`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('relay')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          upsert: false
        });

      if (uploadError) {
        console.error('Error uploading broadcast audio:', uploadError);
        return null;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('relay')
        .getPublicUrl(fileName);

      const audioUrl = urlData.publicUrl;

      // Create the broadcast (parentBroadcastId set => discussion response)
      const broadcast = await this.createBroadcast(channelId, title, audioUrl, duration, undefined, undefined, parentBroadcastId);

      // If specific users should be notified, send them notifications
      if (broadcast && notifyUserIds && notifyUserIds.length > 0) {
        await this.notifyUsersOfBroadcast(notifyUserIds, broadcast.id, title, channelId);
      }

      return broadcast;
    } catch (error) {
      console.error('Error in uploadAndPublishBroadcast:', error);
      return null;
    }
  }

  private async notifyUsersOfBroadcast(
    userIds: string[],
    broadcastId: string,
    title: string,
    channelId: string
  ): Promise<void> {
    // Create notifications for each user
    const notifications = userIds.map(userId => ({
      user_id: userId,
      type: 'broadcast',
      title: 'New Pulse Radio Broadcast',
      message: title,
      data: { broadcastId, channelId },
      is_read: false,
      created_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('notifications')
      .insert(notifications);

    if (error) {
      console.error('Error creating broadcast notifications:', error);
    }
  }

  async getChannelBroadcasts(channelId: string, limit: number = 50, offset: number = 0): Promise<Broadcast[]> {
    const { data, error } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('channel_id', channelId)
      // Top-level broadcasts only; discussion responses surface in their parent's
      // room, not the channel feed.
      .is('parent_broadcast_id', null)
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error || !data) return [];
    return data.map(broadcast => this.mapDbToBroadcast(broadcast));
  }

  /** Discussion responses to a broadcast, oldest first. */
  async getBroadcastResponses(parentBroadcastId: string): Promise<Broadcast[]> {
    const { data, error } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('parent_broadcast_id', parentBroadcastId)
      .order('published_at', { ascending: true });

    if (error || !data) return [];
    return data.map(broadcast => this.mapDbToBroadcast(broadcast));
  }

  /**
   * Delete a broadcast you authored. Ownership-scoped on author_id (mirrors
   * deleteTeamVoxMessage); RLS is the backstop. Returns false on RLS reject so
   * the caller can roll its optimistic removal back.
   */
  async deleteBroadcast(broadcastId: string): Promise<boolean> {
    const userId = await this.ensureUserId();
    if (!userId) return false;

    const { error } = await supabase
      .from('broadcasts')
      .delete()
      .eq('id', broadcastId)
      .eq('author_id', userId);

    if (error) {
      console.error('Error deleting broadcast:', error);
      return false;
    }
    return true;
  }

  /**
   * Toggle the current user's like on a broadcast. Persists to broadcast_likes
   * so it survives reload (was component-state-only). Returns the new liked
   * state (true = now liked, false = now unliked), or null on error.
   */
  async toggleBroadcastLike(broadcastId: string): Promise<boolean | null> {
    const userId = await this.ensureUserId();
    if (!userId) return null;

    const { data: existing } = await supabase
      .from('broadcast_likes')
      .select('broadcast_id')
      .eq('broadcast_id', broadcastId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('broadcast_likes')
        .delete()
        .eq('broadcast_id', broadcastId)
        .eq('user_id', userId);
      if (error) { console.error('Error removing broadcast like:', error); return null; }
      return false;
    }

    const { error } = await supabase
      .from('broadcast_likes')
      .insert({ broadcast_id: broadcastId, user_id: userId });
    if (error) { console.error('Error adding broadcast like:', error); return null; }
    return true;
  }

  /** Which of the given broadcasts the current user has liked. */
  async getLikedBroadcastIds(broadcastIds: string[]): Promise<Set<string>> {
    if (broadcastIds.length === 0) return new Set();
    const userId = await this.ensureUserId();
    if (!userId) return new Set();

    const { data } = await supabase
      .from('broadcast_likes')
      .select('broadcast_id')
      .eq('user_id', userId)
      .in('broadcast_id', broadcastIds);

    return new Set((data ?? []).map((r: any) => r.broadcast_id as string));
  }

  // ============================================
  // VOICE THREADS
  // ============================================

  async createVoiceThread(participantIds: string[], subject?: string): Promise<VoiceThread | null> {
    const userId = await this.ensureUserId();
    if (!userId) return null;
    // RLS: user_has_workspace_access(workspace_id) AND auth.uid() = ANY(participants).
    const workspaceId = await this.ensureWorkspaceId();
    if (!workspaceId) {
      console.error('createVoiceThread: no workspace for current user');
      return null;
    }

    const allParticipants = [...new Set([userId, ...participantIds])];

    const { data, error } = await supabase
      .from('voice_threads')
      .insert([{
        workspace_id: workspaceId,
        participants: allParticipants,
        subject,
        message_count: 0,
        is_archived: false,
        created_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating voice thread:', error);
      return null;
    }

    return this.mapDbToVoiceThread(data);
  }

  async getMyVoiceThreads(limit: number = 50, offset: number = 0): Promise<VoiceThread[]> {
    const userId = await this.ensureUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('voice_threads')
      .select('*')
      .contains('participants', [userId])
      .eq('is_archived', false)
      .order('last_activity_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error || !data) return [];
    return data.map(thread => this.mapDbToVoiceThread(thread));
  }

  /**
   * Upload audio blob and send a voice thread message.
   * This is the primary method to use from components.
   */
  async uploadAndSendVoiceThreadMessage(
    threadId: string,
    audioBlob: Blob,
    duration: number,
    replyToId?: string,
    replyToTimestamp?: number,
    quotedText?: string
  ): Promise<VoiceThreadMessage | null> {
    const userId = await this.ensureUserId();
    if (!userId) {
      console.error('No user ID for voice thread message upload');
      return null;
    }

    try {
      // Ensure storage bucket exists
      await this.ensureStorageBucket();

      // Upload audio to storage
      const fileName = `voice_threads/${threadId}/${userId}/${Date.now()}.webm`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('relay')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          upsert: false
        });

      if (uploadError) {
        console.error('Error uploading voice thread audio:', uploadError);
        return null;
      }

      // Track Relay usage (duration in minutes)
      usageTracker.voxerMinutes(Math.ceil(duration / 60));
      usageTracker.storageBytes(audioBlob.size);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('relay')
        .getPublicUrl(fileName);

      const audioUrl = urlData.publicUrl;

      // Send the message with the uploaded URL
      return await this.sendVoiceThreadMessage(
        threadId,
        audioUrl,
        duration,
        undefined, // transcript - can be added later
        replyToId,
        replyToTimestamp,
        quotedText
      );
    } catch (error) {
      console.error('Error uploading and sending voice thread message:', error);
      return null;
    }
  }

  async sendVoiceThreadMessage(
    threadId: string,
    audioUrl: string,
    duration: number,
    transcript?: string,
    replyToId?: string,
    replyToTimestamp?: number,
    quotedText?: string
  ): Promise<VoiceThreadMessage | null> {
    const userId = await this.ensureUserId();
    if (!userId) return null;

    const user = await this.getPulseUser();

    const { data, error } = await supabase
      .from('voice_thread_messages')
      .insert([{
        thread_id: threadId,
        sender_id: userId,
        sender_name: user?.displayName || 'Unknown',
        audio_url: audioUrl,
        duration: Math.round(duration),
        transcript,
        reply_to_id: replyToId,
        reply_to_timestamp: replyToTimestamp,
        quoted_text: quotedText,
        read_by: [userId],
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('Error sending voice thread message:', error);
      return null;
    }

    // Update thread last activity and increment message count
    // First get current count, then update
    const { data: currentThread } = await supabase
      .from('voice_threads')
      .select('message_count')
      .eq('id', threadId)
      .single();

    await supabase
      .from('voice_threads')
      .update({
        last_activity_at: new Date().toISOString(),
        message_count: (currentThread?.message_count || 0) + 1,
      })
      .eq('id', threadId);

    // Set root message if this is first message
    const { data: thread } = await supabase
      .from('voice_threads')
      .select('root_message_id')
      .eq('id', threadId)
      .single();

    if (!thread?.root_message_id) {
      await supabase
        .from('voice_threads')
        .update({ root_message_id: data.id })
        .eq('id', threadId);
    }

    return this.mapDbToVoiceThreadMessage(data);
  }

  async deleteVoiceThreadMessage(messageId: string): Promise<boolean> {
    const userId = await this.ensureUserId();
    if (!userId) return false;

    const { error } = await supabase
      .from('voice_thread_messages')
      .delete()
      .eq('id', messageId)
      .eq('sender_id', userId);

    if (error) {
      console.error('Error deleting voice thread message:', error);
      return false;
    }
    return true;
  }

  async getThreadMessages(threadId: string, limit: number = 50, offset: number = 0): Promise<VoiceThreadMessage[]> {
    const { data, error } = await supabase
      .from('voice_thread_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error || !data) return [];
    return data.map(message => this.mapDbToVoiceThreadMessage(message));
  }

  async updateVoiceThreadSubject(threadId: string, subject: string): Promise<boolean> {
    const userId = await this.ensureUserId();
    if (!userId) return false;

    const { error } = await supabase
      .from('voice_threads')
      .update({ subject })
      .eq('id', threadId)
      .contains('participants', [userId]);

    if (error) {
      console.error('Error updating voice thread subject:', error);
      return false;
    }
    return true;
  }

  async addParticipantToThread(threadId: string, participantId: string): Promise<string[] | null> {
    const userId = await this.ensureUserId();
    if (!userId) return null;

    // Fetch current thread to get participant list
    const { data: thread, error: fetchError } = await supabase
      .from('voice_threads')
      .select('participants')
      .eq('id', threadId)
      .contains('participants', [userId])
      .single();

    if (fetchError || !thread) {
      console.error('Error fetching thread for participant add:', fetchError);
      return null;
    }

    const currentParticipants: string[] = thread.participants || [];
    if (currentParticipants.includes(participantId)) {
      return currentParticipants; // already a participant
    }

    const updatedParticipants = [...currentParticipants, participantId];
    const { error } = await supabase
      .from('voice_threads')
      .update({ participants: updatedParticipants })
      .eq('id', threadId);

    if (error) {
      console.error('Error adding participant to thread:', error);
      return null;
    }
    return updatedParticipants;
  }

  async removeParticipantFromThread(threadId: string, participantId: string): Promise<string[] | null> {
    const userId = await this.ensureUserId();
    if (!userId) return null;

    // Fetch current thread
    const { data: thread, error: fetchError } = await supabase
      .from('voice_threads')
      .select('participants')
      .eq('id', threadId)
      .contains('participants', [userId])
      .single();

    if (fetchError || !thread) {
      console.error('Error fetching thread for participant remove:', fetchError);
      return null;
    }

    const currentParticipants: string[] = thread.participants || [];
    const updatedParticipants = currentParticipants.filter(p => p !== participantId);

    if (updatedParticipants.length === currentParticipants.length) {
      return currentParticipants; // participant wasn't in the list
    }

    const { error } = await supabase
      .from('voice_threads')
      .update({ participants: updatedParticipants })
      .eq('id', threadId);

    if (error) {
      console.error('Error removing participant from thread:', error);
      return null;
    }
    return updatedParticipants;
  }

  // ============================================
  // TEAM VOX
  // ============================================

  async createWorkspace(name: string, description?: string): Promise<VoxWorkspace | null> {
    const userId = await this.ensureUserId();
    if (!userId) return null;

    const slug = `vox-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;

    // bootstrap_workspace is a SECURITY DEFINER RPC that atomically inserts
    // both the workspace and the owner workspace_members row, sidestepping the
    // chicken-and-egg between workspaces_select and workspace_members_insert.
    const { data: workspaceId, error: rpcError } = await supabase.rpc('bootstrap_workspace', {
      p_name: name,
      p_slug: slug,
      p_description: description ?? null,
      p_plan: 'free',
    });

    if (rpcError || !workspaceId) {
      console.error('Error creating workspace:', rpcError);
      return null;
    }

    // Create default general channel
    await this.createTeamChannel(workspaceId, 'General', 'General discussion', 'general');

    return this.mapDbToWorkspace({
      id: workspaceId,
      name,
      description,
      owner_id: userId,
      avatar_url: null,
      created_at: new Date().toISOString(),
      member_ids: [userId],
      vox_team_channels: [],
    });
  }

  async getMyWorkspaces(limit: number = 50, offset: number = 0): Promise<VoxWorkspace[]> {
    const userId = await this.ensureUserId();
    if (!userId) return [];

    // workspaces RLS already restricts the row set to workspaces I'm a member of,
    // so a plain select + embed is enough — no explicit membership filter needed.
    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select('id, name, description, owner_id, avatar_url, created_at, vox_team_channels(*)')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error || !workspaces) {
      if (error) console.error('Error fetching workspaces:', error);
      return [];
    }

    // member_ids[] is no longer a column — derive it per workspace from workspace_members
    const ids = workspaces.map(w => w.id);
    let membersByWorkspace = new Map<string, string[]>();
    if (ids.length > 0) {
      const { data: members } = await supabase
        .from('workspace_members')
        .select('workspace_id, user_id')
        .in('workspace_id', ids);
      for (const row of members || []) {
        const list = membersByWorkspace.get(row.workspace_id) || [];
        list.push(row.user_id);
        membersByWorkspace.set(row.workspace_id, list);
      }
    }

    return workspaces.map(workspace => this.mapDbToWorkspace({
      ...workspace,
      member_ids: membersByWorkspace.get(workspace.id) || [],
    }));
  }

  async addMemberToWorkspace(workspaceId: string, memberId: string): Promise<boolean> {
    // RLS on workspace_members enforces: only an owner/admin of this workspace
    // may insert a member row. No need to re-check ownership client-side.
    const { error } = await supabase
      .from('workspace_members')
      .insert([{
        workspace_id: workspaceId,
        user_id: memberId,
        role: 'member',
      }]);

    if (error) {
      // 23505 = unique violation — member already exists, treat as success
      if ((error as any).code === '23505') return true;
      console.error('Error adding member to workspace:', error);
      return false;
    }
    return true;
  }

  async removeMemberFromWorkspace(workspaceId: string, memberId: string): Promise<boolean> {
    // Don't let callers nuke the owner row
    const { data: target, error: fetchError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', memberId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching membership:', fetchError);
      return false;
    }
    if (!target) return true; // already gone
    if (target.role === 'owner') {
      console.error('Cannot remove workspace owner');
      return false;
    }

    // RLS enforces admin/owner-only deletes
    const { error: deleteError } = await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', memberId);

    if (deleteError) {
      console.error('Error removing member from workspace:', deleteError);
      return false;
    }
    return true;
  }

  async createTeamChannel(
    workspaceId: string,
    name: string,
    description?: string,
    type: 'general' | 'standup' | 'announcement' | 'project' = 'general'
  ): Promise<VoxTeamChannel | null> {
    const { data, error } = await supabase
      .from('vox_team_channels')
      .insert([{
        workspace_id: workspaceId,
        name,
        description,
        type,
        member_ids: [],
        unread_count: 0,
        is_pinned: false,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating team channel:', error);
      return null;
    }

    return this.mapDbToTeamChannel(data);
  }

  /**
   * Upload audio blob and send a team vox message.
   * This is the primary method to use from components.
   */
  async uploadAndSendTeamVoxMessage(
    channelId: string,
    workspaceId: string,
    audioBlob: Blob,
    duration: number,
    transcript?: string,
    messageType: 'normal' | 'standup' | 'announcement' = 'normal',
    mentions: string[] = []
  ): Promise<TeamVoxMessage | null> {
    const userId = await this.ensureUserId();
    if (!userId) {
      console.error('No user ID for team vox upload');
      return null;
    }

    try {
      // Ensure storage bucket exists
      await this.ensureStorageBucket();

      // Upload audio to storage
      const fileName = `team_vox/${workspaceId}/${channelId}/${userId}/${Date.now()}.webm`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('relay')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          upsert: false
        });

      if (uploadError) {
        console.error('Error uploading team vox audio:', uploadError);
        return null;
      }

      // Track Relay usage
      usageTracker.voxerMinutes(Math.ceil(duration / 60));
      usageTracker.storageBytes(audioBlob.size);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('relay')
        .getPublicUrl(fileName);

      const audioUrl = urlData.publicUrl;

      // Transcribe the audio if no transcript provided
      let finalTranscript = transcript || '';
      if (!finalTranscript) {
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(audioBlob);
          });

          const result = await transcribeMedia(base64, 'audio/webm');
          finalTranscript = result || '';
        } catch (transcriptError) {
          console.error('Team Vox transcription failed:', transcriptError);
        }
      }

      // Send the message with the uploaded URL and transcript
      return await this.sendTeamVoxMessage(
        channelId,
        workspaceId,
        audioUrl,
        duration,
        finalTranscript,
        messageType,
        mentions
      );
    } catch (error) {
      console.error('Error uploading and sending team vox:', error);
      return null;
    }
  }

  async sendTeamVoxMessage(
    channelId: string,
    workspaceId: string,
    audioUrl: string,
    duration: number,
    transcript?: string,
    messageType: 'normal' | 'standup' | 'announcement' = 'normal',
    mentions: string[] = []
  ): Promise<TeamVoxMessage | null> {
    const userId = await this.ensureUserId();
    if (!userId) return null;

    // Resolve the sender's display name from user_profiles, which is keyed by
    // the auth uid (== userId here). getPulseUser() looks up pulse_users by
    // id == auth uid, but pulse_users.id diverges from the auth uid for most
    // users, so it returned null → every post stamped sender_name 'Unknown'.
    const { data: senderProfile } = await supabase
      .from('user_profiles')
      .select('display_name, full_name, handle')
      .eq('id', userId)
      .maybeSingle();
    const senderName = senderProfile?.display_name || senderProfile?.full_name || senderProfile?.handle || 'Unknown';

    // Extract action items from transcript using Gemini AI (with keyword fallback)
    const actionItems = transcript ? await this.extractActionItemsAI(transcript) : [];

    const { data, error } = await supabase
      .from('team_vox_messages')
      .insert([{
        channel_id: channelId,
        workspace_id: workspaceId,
        sender_id: userId,
        sender_name: senderName,
        audio_url: audioUrl,
        duration: Math.round(duration),
        transcript,
        message_type: messageType,
        action_items: actionItems,
        mentions,
        reactions: {},
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('Error sending team vox message:', error);
      return null;
    }

    // Update channel last message time
    await supabase
      .from('vox_team_channels')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', channelId);

    // Notify mentioned users
    for (const mentionedId of mentions) {
      await this.createNotification(
        mentionedId,
        'mention',
        `${senderName} mentioned you`,
        'You were mentioned in a team vox',
        data.id,
        userId,
        senderName
      );
    }

    return this.mapDbToTeamVoxMessage(data);
  }

  async deleteTeamVoxMessage(messageId: string): Promise<boolean> {
    const userId = await this.ensureUserId();
    if (!userId) return false;

    const { error } = await supabase
      .from('team_vox_messages')
      .delete()
      .eq('id', messageId)
      .eq('sender_id', userId);

    if (error) {
      console.error('Error deleting team vox message:', error);
      return false;
    }
    return true;
  }

  /**
   * Persist the full reactions map for a team vox message. The caller computes
   * the toggled map (adds/removes the current user for an emoji); we write it
   * back to the jsonb column so reactions survive reload and reach other
   * clients. Low-concurrency surface (solo operator), so last-write-wins is fine.
   */
  async updateTeamVoxReactions(messageId: string, reactions: Record<string, string[]>): Promise<boolean> {
    const { error } = await supabase
      .from('team_vox_messages')
      .update({ reactions })
      .eq('id', messageId);

    if (error) {
      console.error('Error updating team vox reactions:', error);
      return false;
    }
    return true;
  }

  async updateTeamChannel(
    channelId: string,
    updates: { name?: string; description?: string }
  ): Promise<VoxTeamChannel | null> {
    const dbUpdates: Record<string, any> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;

    const { data, error } = await supabase
      .from('vox_team_channels')
      .update(dbUpdates)
      .eq('id', channelId)
      .select()
      .single();

    if (error) {
      console.error('Error updating team channel:', error);
      return null;
    }

    return this.mapDbToTeamChannel(data);
  }

  async getChannelMessages(channelId: string, limit: number = 50, offset: number = 0): Promise<TeamVoxMessage[]> {
    // Fetch the NEWEST `limit` messages (descending), then reverse to
    // chronological order for display. The prior ascending range(0,49) returned
    // the OLDEST 50, so any channel past 50 posts silently stopped showing new
    // voices — even the realtime refetch re-ran the same oldest-50 query, so new
    // posts never appeared. offset still pages backwards through older history.
    const { data, error } = await supabase
      .from('team_vox_messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error || !data) {
      console.error('Error fetching channel messages:', error);
      return [];
    }
    return data.reverse().map(message => this.mapDbToTeamVoxMessage(message));
  }

  // ============================================
  // VOX NOTES
  // ============================================

  async createVoxNote(
    audioBlob: Blob,
    duration: number,
    title?: string
  ): Promise<VoxNote | null> {
    const userId = await this.ensureUserId();
    if (!userId) return null;

    try {
      // Ensure storage bucket exists
      await this.ensureStorageBucket();

      // Upload audio to storage
      const fileName = `vox_notes/${userId}/${Date.now()}.webm`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('relay')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          upsert: false
        });

      if (uploadError) {
        console.error('Error uploading vox note audio:', uploadError);
        return null;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('relay')
        .getPublicUrl(fileName);

      const audioUrl = urlData.publicUrl;

      // Transcribe the audio
      let transcript = '';
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]); // Remove data URL prefix
          };
          reader.onerror = reject;
          reader.readAsDataURL(audioBlob);
        });

        const result = await transcribeMedia(base64, 'audio/webm');
        transcript = result || '';
      } catch (transcriptError) {
        console.error('Transcription failed:', transcriptError);
        // Continue without transcript - it can be transcribed later
      }

      // Save the note with transcript
      return await this.saveVoxNote(audioUrl, duration, transcript, title);
    } catch (error) {
      console.error('Error creating vox note:', error);
      return null;
    }
  }

  async saveVoxNote(
    audioUrl: string,
    duration: number,
    transcript: string,
    title?: string
  ): Promise<VoxNote | null> {
    const userId = await this.ensureUserId();
    if (!userId) return null;

    // RLS: user_has_workspace_access(workspace_id) AND user_id = auth.uid().
    const workspaceId = await this.ensureWorkspaceId();
    if (!workspaceId) {
      console.error('saveVoxNote: no workspace for current user');
      return null;
    }

    // Auto-generate title and tags from transcript
    const autoTitle = title || this.generateTitleFromTranscript(transcript);
    const autoTags = await this.extractTagsAI(transcript);
    const summary = await this.generateSummary(transcript);

    const { data, error } = await supabase
      .from('vox_notes')
      .insert([{
        workspace_id: workspaceId,
        user_id: userId,
        audio_url: audioUrl,
        duration: Math.round(duration),
        transcript,
        title: autoTitle,
        summary,
        tags: autoTags,
        linked_items: [],
        is_favorite: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('Error saving vox note:', error);
      return null;
    }

    return this.mapDbToVoxNote(data);
  }

  async updateVoxNote(noteId: string, updates: { title?: string; tags?: string[]; is_favorite?: boolean }): Promise<boolean> {
    const userId = await this.ensureUserId();
    if (!userId) return false;

    const { error } = await supabase
      .from('vox_notes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', noteId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating vox note:', error);
      return false;
    }
    return true;
  }

  async deleteVoxNote(noteId: string): Promise<boolean> {
    const userId = await this.ensureUserId();
    if (!userId) return false;

    const { error } = await supabase
      .from('vox_notes')
      .delete()
      .eq('id', noteId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting vox note:', error);
      return false;
    }
    return true;
  }

  async getMyVoxNotes(searchQuery?: string, limit: number = 50, offset: number = 0): Promise<VoxNote[]> {
    const userId = await this.ensureUserId();
    if (!userId) return [];

    let query = supabase
      .from('vox_notes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (searchQuery) {
      query = query.or(`transcript.ilike.%${searchQuery}%,title.ilike.%${searchQuery}%,tags.cs.{${searchQuery}}`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error || !data) return [];
    return data.map(note => this.mapDbToVoxNote(note));
  }

  async linkNoteToItem(noteId: string, itemType: string, itemId: string, itemTitle: string): Promise<boolean> {
    const { data: note, error: fetchError } = await supabase
      .from('vox_notes')
      .select('linked_items')
      .eq('id', noteId)
      .single();

    if (fetchError || !note) return false;

    const linkedItems = note.linked_items || [];
    linkedItems.push({
      type: itemType,
      id: itemId,
      title: itemTitle,
      linked_at: new Date().toISOString(),
    });

    const { error } = await supabase
      .from('vox_notes')
      .update({ linked_items: linkedItems, updated_at: new Date().toISOString() })
      .eq('id', noteId);

    return !error;
  }

  // ============================================
  // QUICK VOX
  // ============================================

  async setQuickVoxFavorites(favorites: Omit<QuickVoxFavorite, 'userId'>[]): Promise<boolean> {
    const userId = await this.ensureUserId();
    if (!userId) return false;

    // Delete existing favorites
    await supabase
      .from('quick_vox_favorites')
      .delete()
      .eq('user_id', userId);

    // Insert new favorites
    const { error } = await supabase
      .from('quick_vox_favorites')
      .insert(favorites.map((f, i) => ({
        user_id: userId,
        contact_id: f.contactId,
        contact_handle: f.contactHandle,
        contact_name: f.contactName,
        avatar_color: f.avatarColor,
        position: i,
      })));

    return !error;
  }

  async getQuickVoxFavorites(): Promise<QuickVoxFavorite[]> {
    const userId = await this.ensureUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('quick_vox_favorites')
      .select('*')
      .eq('user_id', userId)
      .order('position', { ascending: true });

    if (error || !data) return [];

    // Get valid Pulse user IDs to filter favorites
    const pulseUsers = await this.getPulseUsersAsContacts();
    const validPulseUserIds = new Set(pulseUsers.map(u => u.id));

    // Filter to only include favorites that are valid Pulse users
    const validFavorites = data.filter(fav => validPulseUserIds.has(fav.contact_id));

    // If some favorites were invalid, clean them up from the database
    if (validFavorites.length < data.length) {
      const invalidIds = data
        .filter(fav => !validPulseUserIds.has(fav.contact_id))
        .map(fav => fav.contact_id);

      // Delete invalid favorites from database
      await supabase
        .from('quick_vox_favorites')
        .delete()
        .eq('user_id', userId)
        .in('contact_id', invalidIds);
    }

    return validFavorites.map(favorite => this.mapDbToQuickVoxFavorite(favorite));
  }

  /**
   * Upload audio blob and send a quick vox message.
   * This is the primary method to use from components.
   */
  async uploadAndSendQuickVox(
    recipientId: string,
    audioBlob: Blob,
    duration: number,
    transcript?: string,
    analysis?: any
  ): Promise<QuickVoxMessage | null> {
    const userId = await this.ensureUserId();
    if (!userId) {
      console.error('No user ID for quick vox upload');
      return null;
    }

    try {
      // Ensure storage bucket exists
      await this.ensureStorageBucket();

      // Upload audio to storage
      const fileName = `quick_vox/${userId}/${recipientId}/${Date.now()}.webm`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('relay')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          upsert: false
        });

      if (uploadError) {
        console.error('Error uploading quick vox audio:', uploadError);
        return null;
      }

      // Track Relay usage
      usageTracker.voxerMinutes(Math.ceil(duration / 60));
      usageTracker.storageBytes(audioBlob.size);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('relay')
        .getPublicUrl(fileName);

      const audioUrl = urlData.publicUrl;

      // Transcribe if no transcript was supplied — parity with Team Vox
      // (sendTeamVoxMessage transcribes on send). Direct sends previously wrote
      // transcript:null, which left every Direct AI feature (Summarize, Meeting
      // Notes, Chapters, transcript display, reply previews) operating on empty
      // strings. This runs at the delivery point, so the durable outbox's
      // optimistic bubble still appears instantly; a failed transcription just
      // sends without one rather than blocking delivery.
      let finalTranscript = transcript || '';
      if (!finalTranscript) {
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(audioBlob);
          });
          const result = await transcribeMedia(base64, 'audio/webm');
          finalTranscript = result || '';
        } catch (transcriptError) {
          console.error('Quick Vox transcription failed:', transcriptError);
        }
      }

      // Send the message with the uploaded URL + transcript
      return await this.sendQuickVox(recipientId, audioUrl, duration, finalTranscript || undefined, analysis);
    } catch (error) {
      console.error('Error uploading and sending quick vox:', error);
      return null;
    }
  }

  /**
   * Snooze a triage item — insert a row in voice_reminders that the cron
   * worker will fire at `remindAt`. Returns the new reminder's id, or null
   * on auth/insert failure. The Triage UI uses this to surface 1h /
   * Tomorrow / Pick presets.
   */
  async snoozeTriageItem(
    kind: 'classic' | 'thread' | 'quick' | 'broadcast' | 'note',
    rowId: string,
    remindAt: Date,
    note?: string,
  ): Promise<string | null> {
    const authUserId = await this.ensureUserId();
    if (!authUserId) return null;
    const voiceKind = `voice_${kind}` as
      | 'voice_classic'
      | 'voice_thread'
      | 'voice_quick'
      | 'voice_broadcast'
      | 'voice_note';
    const { data, error } = await supabase
      .from('voice_reminders')
      .insert({
        user_id: authUserId,
        voice_kind: voiceKind,
        source_id: rowId,
        remind_at: remindAt.toISOString(),
        note,
      })
      .select('id')
      .single();
    if (error) {
      console.warn('[snoozeTriageItem] failed:', error.message);
      return null;
    }
    return data?.id ?? null;
  }

  /**
   * Cancel a previously created reminder by id. Used by the snooze toast's
   * Undo action — the row is deleted outright rather than marked dismissed
   * because the user explicitly took back the snooze.
   */
  async cancelVoiceReminder(reminderId: string): Promise<boolean> {
    const authUserId = await this.ensureUserId();
    if (!authUserId) return false;
    const { error } = await supabase
      .from('voice_reminders')
      .delete()
      .eq('id', reminderId)
      .eq('user_id', authUserId);
    if (error) {
      console.warn('[cancelVoiceReminder] failed:', error.message);
      return false;
    }
    return true;
  }

  /**
   * Mark a triage item as read. Each kind has its own read-tracking shape:
   *  - 'classic' (voxer_recordings): toggles `played = true`.
   *  - 'thread' (voice_thread_messages): appends current pulse user to
   *    `read_by[]` if absent.
   *  - 'quick' (quick_vox_messages): sets `played_at = now()`.
   *  - 'broadcast' / 'note': no-op (notes are personal; broadcasts use a
   *    separate playback-tracking surface and don't appear in needs-reply).
   * Returns true when the row was updated (or was already read), false on
   * authentication failure / missing pulse_users mapping.
   */
  async markTriageItemRead(
    kind: 'classic' | 'thread' | 'quick' | 'broadcast' | 'note',
    rowId: string,
  ): Promise<boolean> {
    const authUserId = await this.ensureUserId();
    if (!authUserId) return false;

    if (kind === 'classic') {
      const { error } = await supabase
        .from('voxer_recordings')
        .update({ played: true })
        .eq('id', rowId)
        .eq('user_id', authUserId);
      if (error) {
        console.warn('[markTriageItemRead] classic failed:', error.message);
        return false;
      }
      return true;
    }

    if (kind === 'broadcast' || kind === 'note') {
      // Broadcasts/notes don't drive needs-reply; nothing to persist.
      return true;
    }

    // thread + quick both need the canonical pulse user uuid.
    const pulseResp = await supabase
      .from('pulse_users')
      .select('id')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    const pulseUserId: string | undefined = pulseResp.data?.id;
    if (!pulseUserId) return false;

    if (kind === 'quick') {
      // RLS UPDATE on quick_vox_messages is sender-only, so the recipient (who is
      // marking-read here) can't UPDATE played_at directly — it would match 0 rows
      // and silently no-op. Route through the recipient-scoped SECURITY DEFINER
      // RPC instead (sets played_at + delivered_at + status).
      const { error } = await supabase.rpc('mark_quick_vox_played', { p_message_id: rowId });
      if (error) {
        console.warn('[markTriageItemRead] quick failed:', error.message);
        return false;
      }
      return true;
    }

    // thread: append pulseUserId to read_by[] only if not already present.
    // We re-read first so we don't blow away other readers' entries.
    const current = await supabase
      .from('voice_thread_messages')
      .select('read_by')
      .eq('id', rowId)
      .maybeSingle();
    if (current.error) {
      console.warn('[markTriageItemRead] thread read failed:', current.error.message);
      return false;
    }
    const existing: string[] = Array.isArray(current.data?.read_by)
      ? current.data.read_by
      : [];
    if (existing.includes(pulseUserId)) return true;
    const next = [...existing, pulseUserId];
    const { error } = await supabase
      .from('voice_thread_messages')
      .update({ read_by: next })
      .eq('id', rowId);
    if (error) {
      console.warn('[markTriageItemRead] thread update failed:', error.message);
      return false;
    }
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Triage dismissal — durable "hide from triage" flag (cross-device).
  //
  // Stage 2.1d.5 originally shipped this local-only (per-user Set of
  // `${kind}:${id}` strings in localStorage) so it could land without a
  // migration. Launch-readiness S2-2 added the durable backend the comment
  // promised — table `relay_triage_dismissals` (migration 20260614150000),
  // RLS own-row, keyed on auth.uid(). The public surface below is unchanged.
  //
  // Storage strategy: localStorage stays as the instant + offline cache; the
  // DB is the cross-device source of truth. Writes hit both; reads UNION both
  // so a just-made (maybe not-yet-synced) local dismissal AND dismissals made
  // on other devices both hide. If the DB call fails (offline / RLS), every
  // method degrades to the prior localStorage-only behaviour rather than
  // throwing — the hide still works locally and reconciles on the next sync.
  // ─────────────────────────────────────────────────────────────────────

  private triageDismissStorageKey(authUserId: string): string {
    return `relay_triage_dismissed:${authUserId}`;
  }

  private readDismissedSet(authUserId: string): Set<string> {
    try {
      const raw = localStorage.getItem(this.triageDismissStorageKey(authUserId));
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  }

  private writeDismissedSet(authUserId: string, set: Set<string>): void {
    try {
      localStorage.setItem(
        this.triageDismissStorageKey(authUserId),
        JSON.stringify(Array.from(set)),
      );
    } catch (err) {
      console.warn('[voxModeService] dismissed-set write failed:', err);
    }
  }

  /** Hide a triage item from the feed without touching the source row. */
  async dismissTriageItem(
    kind: 'classic' | 'thread' | 'quick' | 'broadcast' | 'note',
    rowId: string,
  ): Promise<boolean> {
    const authUserId = await this.ensureUserId();
    if (!authUserId) return false;
    // localStorage first — instant render + offline resilience.
    const set = this.readDismissedSet(authUserId);
    set.add(`${kind}:${rowId}`);
    this.writeDismissedSet(authUserId, set);
    // Durable, cross-device. Failure here keeps the local hide in place.
    try {
      const { error } = await supabase
        .from('relay_triage_dismissals')
        .upsert(
          { user_id: authUserId, kind, row_id: rowId },
          { onConflict: 'user_id,kind,row_id' },
        );
      if (error) console.warn('[voxModeService] triage dismiss DB upsert failed (kept local):', error.message);
    } catch (err) {
      console.warn('[voxModeService] triage dismiss DB upsert threw (kept local):', err);
    }
    return true;
  }

  /** Undo a dismissal — used by the toast's Undo action. */
  async undismissTriageItem(
    kind: 'classic' | 'thread' | 'quick' | 'broadcast' | 'note',
    rowId: string,
  ): Promise<boolean> {
    const authUserId = await this.ensureUserId();
    if (!authUserId) return false;
    const set = this.readDismissedSet(authUserId);
    set.delete(`${kind}:${rowId}`);
    this.writeDismissedSet(authUserId, set);
    try {
      const { error } = await supabase
        .from('relay_triage_dismissals')
        .delete()
        .eq('user_id', authUserId)
        .eq('kind', kind)
        .eq('row_id', rowId);
      if (error) console.warn('[voxModeService] triage undismiss DB delete failed (kept local):', error.message);
    } catch (err) {
      console.warn('[voxModeService] triage undismiss DB delete threw (kept local):', err);
    }
    return true;
  }

  /** Snapshot the dismissed set as `${kind}:${id}` strings (DB ∪ local). */
  async getDismissedTriageIds(): Promise<Set<string>> {
    const authUserId = await this.ensureUserId();
    if (!authUserId) return new Set();
    // localStorage = instant + offline; DB = cross-device source of truth.
    // Union both, then warm the local cache to the union. On DB error, degrade
    // to localStorage only (prior behaviour) rather than losing the feed.
    const local = this.readDismissedSet(authUserId);
    try {
      const { data, error } = await supabase
        .from('relay_triage_dismissals')
        .select('kind, row_id')
        .eq('user_id', authUserId);
      if (error) {
        console.warn('[voxModeService] triage dismissed DB read failed (using local):', error.message);
        return local;
      }
      const merged = new Set(local);
      for (const r of (data ?? []) as Array<{ kind: string; row_id: string }>) {
        merged.add(`${r.kind}:${r.row_id}`);
      }
      this.writeDismissedSet(authUserId, merged);
      return merged;
    } catch (err) {
      console.warn('[voxModeService] triage dismissed DB read threw (using local):', err);
      return local;
    }
  }

  /**
   * Hard-delete a triage item from its source table. Per-kind RLS does the
   * authorisation gate — we just call DELETE and report whether the row
   * actually went away. Threads use the existing `is_deleted` soft flag;
   * broadcasts are author-only and we let RLS reject non-owners.
   *
   * Returns true on success, false on RLS reject / network error / no-op.
   */
  async deleteTriageItem(
    kind: 'classic' | 'thread' | 'quick' | 'broadcast' | 'note',
    rowId: string,
  ): Promise<boolean> {
    const authUserId = await this.ensureUserId();
    if (!authUserId) return false;

    if (kind === 'classic') {
      const { error } = await supabase
        .from('voxer_recordings')
        .delete()
        .eq('id', rowId)
        .eq('user_id', authUserId);
      if (error) {
        console.warn('[deleteTriageItem] classic failed:', error.message);
        return false;
      }
      return true;
    }

    if (kind === 'note') {
      // Reuse the existing helper so the delete path stays consistent
      // with everywhere else that drops a vox note.
      return this.deleteVoxNote(rowId);
    }

    if (kind === 'broadcast') {
      const { error } = await supabase
        .from('broadcasts')
        .delete()
        .eq('id', rowId);
      if (error) {
        console.warn('[deleteTriageItem] broadcast failed:', error.message);
        return false;
      }
      return true;
    }

    // thread + quick both need the canonical pulse user uuid.
    const pulseResp = await supabase
      .from('pulse_users')
      .select('id')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    const pulseUserId: string | undefined = pulseResp.data?.id;
    if (!pulseUserId) return false;

    if (kind === 'quick') {
      const { error } = await supabase
        .from('quick_vox_messages')
        .delete()
        .eq('id', rowId)
        .or(`sender_id.eq.${pulseUserId},recipient_id.eq.${pulseUserId}`);
      if (error) {
        console.warn('[deleteTriageItem] quick failed:', error.message);
        return false;
      }
      return true;
    }

    // thread: soft-delete via the existing `is_deleted` column so the
    // message disappears for everyone in the thread without losing the
    // row (consistent with how the threads view treats deletion).
    const { error } = await supabase
      .from('voice_thread_messages')
      .update({ is_deleted: true })
      .eq('id', rowId)
      .eq('sender_id', pulseUserId);
    if (error) {
      console.warn('[deleteTriageItem] thread soft-delete failed:', error.message);
      return false;
    }
    return true;
  }

  /**
   * Upload an audio blob to the `relay` bucket without writing any
   * conversation row, and return the public URL. Used by the share-link
   * fallback when the recipient isn't on Pulse — the composer hands the URL
   * to the OS clipboard / share sheet instead of inserting a quick_vox row.
   */
  async uploadAudioForShare(
    audioBlob: Blob,
    duration: number,
  ): Promise<string | null> {
    const userId = await this.ensureUserId();
    if (!userId) {
      console.error('No user ID for share-audio upload');
      return null;
    }

    try {
      await this.ensureStorageBucket();

      const fileName = `share/${userId}/${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from('relay')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          upsert: false,
        });

      if (uploadError) {
        console.error('Error uploading share audio:', uploadError);
        return null;
      }

      usageTracker.voxerMinutes(Math.ceil(duration / 60));
      usageTracker.storageBytes(audioBlob.size);

      const { data: urlData } = supabase.storage
        .from('relay')
        .getPublicUrl(fileName);

      return urlData.publicUrl ?? null;
    } catch (error) {
      console.error('Error uploading share audio:', error);
      return null;
    }
  }

  async sendQuickVox(recipientId: string, audioUrl: string, duration: number, transcript?: string, analysis?: any): Promise<QuickVoxMessage | null> {
    // RLS on quick_vox_messages: user_has_workspace_access(workspace_id)
    //   AND sender_id = auth.uid(). Both pieces must be supplied — read auth
    // fresh (ensureUserId can return a stale cache / localStorage fallback
    // that fails the auth.uid() check), and resolve the workspace via
    // workspace_members (workspace_id is NOT NULL on the table).
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      console.error('sendQuickVox: no authenticated session');
      return null;
    }
    this.userId = authUser.id;

    // Stamp the message with the user's ACTIVE workspace (the one shown in the
    // switcher), not an arbitrary membership. A quick_vox is only readable by a
    // recipient who shares THIS workspace (SELECT RLS), so for multi-workspace
    // users ensureWorkspaceId()'s "first membership" pick could land the DM in a
    // workspace the recipient isn't in → silent non-delivery. Fall back to
    // ensureWorkspaceId() only when no active workspace is persisted.
    const workspaceId = getCurrentWorkspaceId() ?? await this.ensureWorkspaceId();
    if (!workspaceId) {
      console.error('sendQuickVox: no workspace for current user');
      return null;
    }

    const { data, error } = await supabase
      .from('quick_vox_messages')
      .insert([{
        workspace_id: workspaceId,
        sender_id: authUser.id,
        recipient_id: recipientId,
        audio_url: audioUrl,
        duration: Math.round(duration),
        status: 'sent',
        created_at: new Date().toISOString(),
        transcript: transcript ?? null,
        analysis: analysis ?? null,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error sending quick vox:', error);
      return null;
    }

    // Send push notification to recipient
    const sender = await this.getPulseUser();
    await this.createNotification(
      recipientId,
      'new_vox',
      `${sender?.displayName} sent you a vox`,
      'Tap to listen',
      data.id,
      authUser.id,
      sender?.displayName
    );

    return this.mapDbToQuickVoxMessage(data);
  }

  async getQuickVoxConversation(contactId: string, limit: number = 50, offset: number = 0): Promise<QuickVoxMessage[]> {
    const userId = await this.ensureUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('quick_vox_messages')
      .select('*')
      .or(`and(sender_id.eq.${userId},recipient_id.eq.${contactId}),and(sender_id.eq.${contactId},recipient_id.eq.${userId})`)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error || !data) return [];
    return data.map(message => this.mapDbToQuickVoxMessage(message));
  }

  /**
   * All quick_vox messages involving the current user (sent + received), across
   * every conversation, ascending by time. Relay's Direct surface loads the full
   * set once and derives its people list + per-contact threads from it (the same
   * load-all model the old voxer_recordings path used). RLS scopes the result to
   * rows where the caller is the sender or recipient.
   */
  /**
   * Load the user's Direct (quick_vox) history. Capped to the most recent
   * `limit` (default 500) so a long-running account doesn't load — and fetch a
   * blob for — thousands of rows on every Direct open (S3 launch-readiness:
   * the prior unbounded load was the real "histories lag", not DOM count).
   *
   * Pass `before` (an ISO timestamp) to page further back: it returns the
   * `limit` messages immediately OLDER than that cursor. Results always come
   * back ascending (oldest→newest) so the display/grouping code is unchanged;
   * we just query newest-first to take the cap off the recent end.
   */
  async getAllQuickVoxMessages(
    options?: { limit?: number; before?: string },
  ): Promise<QuickVoxMessage[]> {
    const userId = await this.ensureUserId();
    if (!userId) return [];
    const limit = options?.limit ?? 500;
    let query = supabase
      .from('quick_vox_messages')
      .select('*')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (options?.before) {
      query = query.lt('created_at', options.before);
    }
    const { data, error } = await query;
    if (error || !data) {
      if (error) console.error('Error loading quick vox messages:', error);
      return [];
    }
    return data.map(message => this.mapDbToQuickVoxMessage(message)).reverse();
  }

  /**
   * Delete a quick vox message. RLS permits deletes only for the sender, so this
   * succeeds for messages I sent and is a no-op (returns false) for others; the
   * caller removes it from local view regardless.
   */
  async deleteQuickVox(messageId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase
      .from('quick_vox_messages')
      .delete()
      .eq('id', messageId)
      .eq('sender_id', user.id);
    if (error) {
      console.error('Error deleting quick vox:', error);
      return false;
    }
    return true;
  }

  /**
   * Recipient marks a received quick vox as played (sets played_at +
   * delivered_at + status='played') via the recipient-scoped SECURITY DEFINER
   * RPC — the table's UPDATE RLS is sender-only, so a direct update from the
   * recipient matches 0 rows. Drives the sender's "listened" receipt (S1-2).
   */
  async markQuickVoxPlayed(messageId: string): Promise<void> {
    const { error } = await supabase.rpc('mark_quick_vox_played', { p_message_id: messageId });
    if (error) console.warn('[markQuickVoxPlayed] failed:', error.message);
  }

  /**
   * Recipient marks all as-yet-undelivered received quick voxes as delivered
   * (drives the sender's "delivered" receipt). Called after the recipient loads
   * and when a new vox arrives (S1-2).
   */
  async markQuickVoxDeliveredAll(): Promise<void> {
    const { error } = await supabase.rpc('mark_quick_vox_delivered_all');
    if (error) console.warn('[markQuickVoxDeliveredAll] failed:', error.message);
  }

  async updateQuickVoxStatus(isRecording: boolean): Promise<void> {
    const userId = await this.ensureUserId();
    if (!userId) return;

    await supabase
      .from('quick_vox_status')
      .upsert({
        user_id: userId,
        is_recording: isRecording,
        is_online: true,
        last_seen: new Date().toISOString(),
      });
  }

  // ============================================
  // VOX DROP
  // ============================================

  /**
   * Upload audio blob and schedule a vox drop.
   * This is the primary method to use from components.
   */
  async uploadAndScheduleVoxDrop(
    recipientIds: string[],
    audioBlob: Blob,
    duration: number,
    scheduledFor: Date,
    title?: string,
    message?: string
  ): Promise<VoxDrop | null> {
    const userId = await this.ensureUserId();
    if (!userId) {
      console.error('No user ID for vox drop upload');
      return null;
    }

    try {
      // Ensure storage bucket exists
      await this.ensureStorageBucket();

      // Upload audio to storage
      const fileName = `vox_drops/${userId}/${Date.now()}.webm`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('relay')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          upsert: false
        });

      if (uploadError) {
        console.error('Error uploading vox drop audio:', uploadError);
        return null;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('relay')
        .getPublicUrl(fileName);

      const audioUrl = urlData.publicUrl;

      // Schedule the drop with the uploaded URL
      return await this.scheduleVoxDrop(
        recipientIds,
        audioUrl,
        duration,
        scheduledFor,
        title,
        message
      );
    } catch (error) {
      console.error('Error uploading and scheduling vox drop:', error);
      return null;
    }
  }

  async scheduleVoxDrop(
    recipientIds: string[],
    audioUrl: string,
    duration: number,
    scheduledFor: Date,
    title?: string,
    message?: string,
    transcript?: string
  ): Promise<VoxDrop | null> {
    const userId = await this.ensureUserId();
    if (!userId) return null;
    // RLS: user_has_workspace_access(workspace_id) AND sender_id = auth.uid().
    const workspaceId = await this.ensureWorkspaceId();
    if (!workspaceId) {
      console.error('scheduleVoxDrop: no workspace for current user');
      return null;
    }

    const { data, error } = await supabase
      .from('vox_drops')
      .insert([{
        workspace_id: workspaceId,
        sender_id: userId,
        recipient_ids: recipientIds,
        audio_url: audioUrl,
        duration: Math.round(duration),
        transcript,
        title,
        message,
        scheduled_for: scheduledFor.toISOString(),
        status: 'scheduled',
        is_recurring: false,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('Error scheduling vox drop:', error);
      return null;
    }

    return this.mapDbToVoxDrop(data);
  }

  async getMyScheduledDrops(limit: number = 50, offset: number = 0): Promise<VoxDrop[]> {
    const userId = await this.ensureUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('vox_drops')
      .select('*')
      .eq('sender_id', userId)
      .in('status', ['scheduled'])
      .order('scheduled_for', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error || !data) return [];
    return data.map(drop => this.mapDbToVoxDrop(drop));
  }

  async getReceivedDrops(limit: number = 50, offset: number = 0): Promise<VoxDrop[]> {
    const userId = await this.ensureUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('vox_drops')
      .select('*')
      .contains('recipient_ids', [userId])
      .eq('status', 'delivered')
      .order('delivered_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error || !data) return [];
    return data.map(drop => this.mapDbToVoxDrop(drop));
  }

  async updateVoxDrop(
    dropId: string,
    updates: { title?: string; message?: string; scheduledFor?: Date }
  ): Promise<VoxDrop | null> {
    const userId = await this.ensureUserId();
    if (!userId) return null;

    const dbUpdates: Record<string, unknown> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.message !== undefined) dbUpdates.message = updates.message;
    if (updates.scheduledFor !== undefined) dbUpdates.scheduled_for = updates.scheduledFor.toISOString();

    const { data, error } = await supabase
      .from('vox_drops')
      .update(dbUpdates)
      .eq('id', dropId)
      .eq('sender_id', userId)
      .eq('status', 'scheduled')
      .select()
      .single();

    if (error) {
      console.error('Error updating vox drop:', error);
      return null;
    }

    return this.mapDbToVoxDrop(data);
  }

  async cancelVoxDrop(dropId: string): Promise<boolean> {
    const userId = await this.ensureUserId();
    if (!userId) return false;

    const { error } = await supabase
      .from('vox_drops')
      .delete()
      .eq('id', dropId)
      .eq('sender_id', userId)
      .eq('status', 'scheduled');

    return !error;
  }

  // ============================================
  // NOTIFICATIONS
  // ============================================

  async createNotification(
    userId: string,
    type: VoxNotification['type'],
    title: string,
    body: string,
    relatedVoxId?: string,
    senderId?: string,
    senderName?: string
  ): Promise<void> {
    await supabase
      .from('vox_notifications')
      .insert([{
        user_id: userId,
        type,
        title,
        body,
        related_vox_id: relatedVoxId,
        sender_id: senderId,
        sender_name: senderName,
        is_read: false,
        created_at: new Date().toISOString(),
      }]);
  }

  async getMyNotifications(): Promise<VoxNotification[]> {
    const userId = await this.ensureUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('vox_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data) return [];
    return data.map(notification => this.mapDbToNotification(notification));
  }

  // ============================================
  // REAL-TIME SUBSCRIPTIONS
  // ============================================

  async subscribeToQuickVox(callback: (message: QuickVoxMessage) => void): Promise<any> {
    // AUTH GUARD: Check session before subscribing
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      console.warn('[VoxModeService] Cannot subscribe to QuickVox: user not authenticated');
      return null;
    }

    const userId = this.getUserId();
    if (!userId) return null;

    return supabase
      .channel(`quick_vox:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'quick_vox_messages',
        filter: `recipient_id=eq.${userId}`,
      }, (payload) => {
        callback(this.mapDbToQuickVoxMessage(payload.new));
      })
      .subscribe();
  }

  /**
   * Subscribe to UPDATEs on quick_vox messages I SENT — i.e. delivery/listened
   * receipts coming back from the recipient — so the sender's thread reflects
   * delivered/played live without a refresh (S1-2). The sender can SELECT their
   * own rows, so RLS lets these UPDATE events through. Returns the channel (or
   * null if unauthenticated). Requires quick_vox_messages in the realtime
   * publication (migration 20260614130000).
   */
  async subscribeToQuickVoxSentStatus(callback: (message: QuickVoxMessage) => void): Promise<any> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      console.warn('[VoxModeService] Cannot subscribe to QuickVox sent status: user not authenticated');
      return null;
    }
    const userId = this.getUserId();
    if (!userId) return null;
    return supabase
      .channel(`quick_vox_sent:${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'quick_vox_messages',
        filter: `sender_id=eq.${userId}`,
      }, (payload) => {
        callback(this.mapDbToQuickVoxMessage(payload.new));
      })
      .subscribe();
  }

  async subscribeToRecordingStatus(contactIds: string[], callback: (status: QuickVoxStatus) => void): Promise<any> {
    // AUTH GUARD: Check session before subscribing
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      console.warn('[VoxModeService] Cannot subscribe to recording status: user not authenticated');
      return null;
    }

    return supabase
      .channel('recording_status')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'quick_vox_status',
      }, (payload) => {
        if (contactIds.includes(payload.new?.user_id)) {
          callback({
            recipientId: payload.new.user_id,
            isRecording: payload.new.is_recording,
            isOnline: payload.new.is_online,
            lastSeen: new Date(payload.new.last_seen),
          });
        }
      })
      .subscribe();
  }

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  private generateAvatarColor(): string {
    const colors = ['#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#3B82F6', '#EF4444'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  private generateTitleFromTranscript(transcript: string): string {
    // Take first sentence or first 50 chars
    const firstSentence = transcript.split(/[.!?]/)[0].trim();
    if (firstSentence.length <= 50) return firstSentence;
    return firstSentence.substring(0, 47) + '...';
  }

  private extractTagsFromTranscript(transcript: string): string[] {
    // Keyword-based extraction as synchronous fallback
    const keywords = ['meeting', 'idea', 'task', 'reminder', 'important', 'urgent', 'follow-up', 'decision'];
    const found: string[] = [];
    const lower = transcript.toLowerCase();
    for (const keyword of keywords) {
      if (lower.includes(keyword)) found.push(keyword);
    }
    return found.slice(0, 5);
  }

  private extractActionItems(transcript: string): string[] {
    // Keyword-based extraction as synchronous fallback
    const sentences = transcript.split(/[.!?]/);
    const actionItems: string[] = [];
    const triggers = ['need to', 'should', 'will', 'must', 'action item', 'todo', 'to do'];
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      if (triggers.some(t => lower.includes(t))) actionItems.push(sentence.trim());
    }
    return actionItems.slice(0, 5);
  }

  /**
   * Generate a summary via ai-router (Gemini Flash), with keyword fallback.
   */
  private async generateSummary(transcript: string): Promise<string> {
    const keywordFallback = () => {
      const sentences = transcript.split(/[.!?]/).filter(s => s.trim());
      return sentences.slice(0, 2).join('. ') + '.';
    };

    if (transcript.length < 50) return keywordFallback();

    const workspaceId = await this.ensureWorkspaceId();
    if (!workspaceId) return keywordFallback();

    try {
      const summary = await invokeAIPrompt(
        'voxer_transcript_summary',
        `Summarize the following voice message transcript in 1-2 concise sentences. Return only the summary, no preamble.\n\nTranscript: "${transcript}"`,
        { workspaceId, temperature: 0.3 },
      );
      const trimmed = summary?.trim();
      if (trimmed) return trimmed;
    } catch (error) {
      captureMessage('Relay AI fallback: summary', 'warning', { error: error instanceof Error ? error.message : String(error) });
      // Fall through to keyword fallback
    }
    return keywordFallback();
  }

  /**
   * Extract action items via ai-router, with keyword fallback.
   */
  async extractActionItemsAI(transcript: string): Promise<string[]> {
    if (transcript.length < 30) return this.extractActionItems(transcript);

    const workspaceId = await this.ensureWorkspaceId();
    if (!workspaceId) return this.extractActionItems(transcript);

    try {
      const parsed = await invokeAIJson<unknown>(
        'voxer_transcript_summary',
        `Extract action items from this voice message transcript. Return a JSON array of strings, max 5 items. If none found, return []. No markdown.\n\nTranscript: "${transcript}"`,
        { workspaceId, temperature: 0.2 },
      );
      if (Array.isArray(parsed)) return (parsed as string[]).slice(0, 5);
    } catch (error) {
      captureMessage('Relay AI fallback: action items', 'warning', { error: error instanceof Error ? error.message : String(error) });
      // Fall through to keyword fallback
    }
    return this.extractActionItems(transcript);
  }

  /**
   * Extract tags via ai-router, with keyword fallback.
   */
  async extractTagsAI(transcript: string): Promise<string[]> {
    if (transcript.length < 30) return this.extractTagsFromTranscript(transcript);

    const workspaceId = await this.ensureWorkspaceId();
    if (!workspaceId) return this.extractTagsFromTranscript(transcript);

    try {
      const parsed = await invokeAIJson<unknown>(
        'auto_tag',
        `Extract 3-5 topic tags from this voice message transcript. Return a JSON array of lowercase single-word tags. No markdown.\n\nTranscript: "${transcript}"`,
        { workspaceId, temperature: 0.2 },
      );
      if (Array.isArray(parsed)) return (parsed as string[]).slice(0, 5);
    } catch (error) {
      captureMessage('Relay AI fallback: tags', 'warning', { error: error instanceof Error ? error.message : String(error) });
      // Fall through to keyword fallback
    }
    return this.extractTagsFromTranscript(transcript);
  }

  private async notifyChannelSubscribers(channelId: string, broadcastId: string, title: string): Promise<void> {
    // Get subscribers and notify them
    const { data: subscriptions } = await supabase
      .from('pulse_channel_subscriptions')
      .select('subscriber_id')
      .eq('channel_id', channelId);

    if (!subscriptions) return;

    const sender = await this.getPulseUser();

    for (const sub of subscriptions) {
      await this.createNotification(
        sub.subscriber_id,
        'broadcast',
        `New broadcast: ${title}`,
        `${sender?.displayName} published a new broadcast`,
        broadcastId,
        this.getUserId(),
        sender?.displayName
      );
    }
  }

  // ============================================
  // DB MAPPERS
  // ============================================

  private mapDbToPulseUser(db: any): PulseUser {
    return {
      id: db.id,
      handle: db.handle,
      displayName: db.display_name,
      avatarUrl: db.avatar_url,
      avatarColor: db.avatar_color,
      bio: db.bio,
      isVerified: db.is_verified,
      followerCount: db.follower_count,
      followingCount: db.following_count,
      createdAt: new Date(db.created_at),
      lastActiveAt: new Date(db.last_active_at),
      settings: db.settings,
    };
  }

  // Maps user_profiles table (main auth-linked profiles) to PulseUser format
  private mapUserProfileToPulseUser(db: any): PulseUser {
    // Generate a consistent avatar color from user id
    const colors = ['#10b981', '#8B5CF6', '#F59E0B', '#EC4899', '#3B82F6', '#EF4444'];
    const colorIndex = db.id ? db.id.charCodeAt(0) % colors.length : 0;

    return {
      id: db.id,
      handle: db.handle || null,
      displayName: db.display_name || db.full_name || 'Unknown User',
      avatarUrl: db.avatar_url,
      avatarColor: colors[colorIndex],
      bio: db.bio || null,
      isVerified: db.is_verified || false,
      followerCount: 0,
      followingCount: 0,
      createdAt: db.created_at ? new Date(db.created_at) : new Date(),
      lastActiveAt: db.last_seen_at ? new Date(db.last_seen_at) : new Date(),
      settings: null,
    };
  }

  private mapDbToChannel(db: any): PulseChannel {
    return {
      id: db.id,
      ownerId: db.owner_id,
      name: db.name,
      description: db.description,
      avatarUrl: db.avatar_url,
      coverUrl: db.cover_url,
      isPublic: db.is_public,
      subscriberCount: db.subscriber_count,
      totalListens: db.total_listens,
      category: db.category,
      tags: db.tags || [],
      createdAt: new Date(db.created_at),
      lastBroadcastAt: db.last_broadcast_at ? new Date(db.last_broadcast_at) : undefined,
    };
  }

  private mapDbToBroadcast(db: any): Broadcast {
    return {
      id: db.id,
      channelId: db.channel_id,
      authorId: db.author_id,
      authorName: db.author_name,
      title: db.title,
      description: db.description,
      audioUrl: db.audio_url,
      duration: db.duration,
      transcript: db.transcript,
      listenCount: db.listen_count,
      reactionCounts: db.reaction_counts || {},
      isLive: db.is_live,
      publishedAt: new Date(db.published_at),
      scheduledFor: db.scheduled_for ? new Date(db.scheduled_for) : undefined,
      tags: db.tags || [],
      episodeNumber: db.episode_number,
      parentBroadcastId: db.parent_broadcast_id ?? undefined,
    };
  }

  private mapDbToVoiceThread(db: any): VoiceThread {
    return {
      id: db.id,
      participants: db.participants,
      subject: db.subject,
      rootMessageId: db.root_message_id,
      messageCount: db.message_count,
      lastActivityAt: new Date(db.last_activity_at),
      createdAt: new Date(db.created_at),
      isArchived: db.is_archived,
    };
  }

  private mapDbToVoiceThreadMessage(db: any): VoiceThreadMessage {
    return {
      id: db.id,
      threadId: db.thread_id,
      senderId: db.sender_id,
      senderName: db.sender_name,
      audioUrl: db.audio_url,
      duration: db.duration,
      transcript: db.transcript,
      replyToId: db.reply_to_id,
      replyToTimestamp: db.reply_to_timestamp,
      quotedText: db.quoted_text,
      createdAt: new Date(db.created_at),
      readBy: db.read_by || [],
    };
  }

  private mapDbToWorkspace(db: any): VoxWorkspace {
    return {
      id: db.id,
      name: db.name,
      description: db.description,
      ownerId: db.owner_id,
      memberIds: db.member_ids || [],
      channels: (db.vox_team_channels || []).map((channel: any) => this.mapDbToTeamChannel(channel)),
      avatarUrl: db.avatar_url,
      createdAt: new Date(db.created_at),
    };
  }

  private mapDbToTeamChannel(db: any): VoxTeamChannel {
    return {
      id: db.id,
      workspaceId: db.workspace_id,
      name: db.name,
      description: db.description,
      type: db.type,
      memberIds: db.member_ids || [],
      lastMessageAt: db.last_message_at ? new Date(db.last_message_at) : undefined,
      unreadCount: db.unread_count,
      isPinned: db.is_pinned,
    };
  }

  private mapDbToTeamVoxMessage(db: any): TeamVoxMessage {
    return {
      id: db.id,
      channelId: db.channel_id,
      workspaceId: db.workspace_id,
      senderId: db.sender_id,
      senderName: db.sender_name,
      audioUrl: db.audio_url,
      duration: db.duration,
      transcript: db.transcript,
      messageType: db.message_type,
      actionItems: db.action_items || [],
      mentions: db.mentions || [],
      reactions: db.reactions || {},
      createdAt: new Date(db.created_at),
    };
  }

  private mapDbToVoxNote(db: any): VoxNote {
    return {
      id: db.id,
      userId: db.user_id,
      audioUrl: db.audio_url,
      duration: db.duration,
      transcript: db.transcript,
      title: db.title,
      summary: db.summary,
      tags: db.tags || [],
      linkedItems: db.linked_items || [],
      isFavorite: db.is_favorite,
      createdAt: new Date(db.created_at),
      updatedAt: new Date(db.updated_at),
    };
  }

  private mapDbToQuickVoxFavorite(db: any): QuickVoxFavorite {
    return {
      userId: db.user_id,
      contactId: db.contact_id,
      contactHandle: db.contact_handle,
      contactName: db.contact_name,
      avatarColor: db.avatar_color,
      position: db.position,
      lastVoxAt: db.last_vox_at ? new Date(db.last_vox_at) : undefined,
    };
  }

  private mapDbToQuickVoxMessage(db: any): QuickVoxMessage {
    return {
      id: db.id,
      senderId: db.sender_id,
      recipientId: db.recipient_id,
      audioUrl: db.audio_url,
      duration: db.duration,
      status: db.status,
      createdAt: new Date(db.created_at),
      deliveredAt: db.delivered_at ? new Date(db.delivered_at) : undefined,
      playedAt: db.played_at ? new Date(db.played_at) : undefined,
      transcript: db.transcript ?? undefined,
      analysis: db.analysis ?? undefined,
    };
  }

  private mapDbToVoxDrop(db: any): VoxDrop {
    return {
      id: db.id,
      senderId: db.sender_id,
      recipientIds: db.recipient_ids,
      audioUrl: db.audio_url,
      duration: db.duration,
      transcript: db.transcript,
      title: db.title,
      message: db.message,
      scheduledFor: new Date(db.scheduled_for),
      deliveredAt: db.delivered_at ? new Date(db.delivered_at) : undefined,
      status: db.status,
      revealCondition: db.reveal_condition,
      isRecurring: db.is_recurring,
      recurringPattern: db.recurring_pattern,
      createdAt: new Date(db.created_at),
    };
  }

  private mapDbToNotification(db: any): VoxNotification {
    return {
      id: db.id,
      userId: db.user_id,
      type: db.type,
      title: db.title,
      body: db.body,
      relatedVoxId: db.related_vox_id,
      senderId: db.sender_id,
      senderName: db.sender_name,
      isRead: db.is_read,
      createdAt: new Date(db.created_at),
    };
  }
}

export const voxModeService = new VoxModeService();
