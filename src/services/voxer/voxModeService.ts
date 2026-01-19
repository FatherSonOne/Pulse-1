// Vox Mode Service - Backend operations for all Vox communication styles
import { supabase } from '../supabase';
import { transcribeMedia } from '../geminiService';
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

class VoxModeService {
  private userId: string | null = null;
  private initialized: boolean = false;
  private bucketChecked: boolean = false;
  private bucketExists: boolean = false;

  setUserId(userId: string) {
    this.userId = userId;
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

    console.log('Creating new pulse user:', { userId, handle, displayName });

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

    console.log('Successfully created pulse user:', data);
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
   * Ensures the voxer storage bucket exists.
   * Creates it if it doesn't exist.
   */
  async ensureStorageBucket(): Promise<boolean> {
    if (this.bucketChecked) return this.bucketExists;

    try {
      // First try to check if bucket exists by listing it
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();

      if (listError) {
        console.warn('Could not list buckets:', listError);
        // Try to upload anyway - the bucket might exist but we don't have list permission
        return true;
      }

      const voxerBucket = buckets?.find(b => b.id === 'voxer');

      if (voxerBucket) {
        console.log('Voxer storage bucket exists');
        this.bucketChecked = true;
        this.bucketExists = true;
        return true;
      }

      // Bucket doesn't exist, try to create it
      console.log('Creating voxer storage bucket...');
      const { data, error: createError } = await supabase.storage.createBucket('voxer', {
        public: true,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-m4a']
      });

      if (createError) {
        // If it's a "already exists" error or RLS policy error (bucket exists but can't create), that's fine
        if (createError.message?.includes('already exists') ||
            createError.message?.includes('duplicate') ||
            createError.message?.includes('row-level security')) {
          console.log('Voxer bucket already exists');
          this.bucketChecked = true;
          this.bucketExists = true;
          return true;
        }
        console.error('Error creating voxer bucket:', createError);
        console.error('>>> IMPORTANT: You need to create the "voxer" storage bucket in Supabase.');
        console.error('>>> Run the migration: supabase/migrations/026_voxer_storage_bucket.sql');
        console.error('>>> Or create it manually in the Supabase dashboard under Storage.');
        this.bucketChecked = true;
        this.bucketExists = false;
        return false;
      }

      console.log('Successfully created voxer storage bucket:', data);
      this.bucketChecked = true;
      this.bucketExists = true;
      return true;
    } catch (error) {
      console.error('Error ensuring storage bucket:', error);
      console.error('>>> IMPORTANT: The "voxer" storage bucket may not exist.');
      console.error('>>> Run the migration: supabase/migrations/026_voxer_storage_bucket.sql');
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
    // Search in user_profiles (all registered Pulse app users)
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('is_public', true)
      .or(`handle.ilike.%${query}%,display_name.ilike.%${query}%,full_name.ilike.%${query}%`)
      .limit(20);

    if (error || !data) return [];
    return data.map(this.mapUserProfileToPulseUser);
  }

  async getAllPulseUsers(): Promise<PulseUser[]> {
    // Get all registered Pulse app users from user_profiles
    // This includes all users who have signed up for the app
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('is_public', true)
      .order('display_name', { ascending: true })
      .limit(100);

    if (error || !data) return [];
    return data.map(this.mapUserProfileToPulseUser);
  }

  /**
   * Gets test Pulse users for development/testing purposes.
   * These are pre-created users that can be used to test messaging features.
   */
  async getTestPulseUsers(): Promise<PulseUser[]> {
    const testUserIds = [
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
    ];

    const { data, error } = await supabase
      .from('pulse_users')
      .select('*')
      .in('id', testUserIds);

    if (error || !data) return [];
    return data.map(this.mapDbToPulseUser);
  }

  /**
   * Creates test users if they don't exist in the database.
   * This is useful for development when the migration hasn't been run.
   */
  async ensureTestUsersExist(): Promise<void> {
    const testUsers = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        handle: 'testpulseuser',
        display_name: 'Test Pulse User',
        avatar_color: '#8B5CF6',
        bio: 'A test user for messaging and vox testing',
        is_verified: true,
        follower_count: 100,
        following_count: 50,
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        handle: 'demopulseuser',
        display_name: 'Demo Pulse User',
        avatar_color: '#10B981',
        bio: 'Another test user for group conversations',
        is_verified: false,
        follower_count: 25,
        following_count: 30,
      },
    ];

    for (const user of testUsers) {
      const { data: existing } = await supabase
        .from('pulse_users')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!existing) {
        await supabase.from('pulse_users').insert([{
          ...user,
          settings: {
            notificationsEnabled: true,
            emailNotifications: false,
            pushNotifications: false,
            defaultVoxMode: 'quick_vox',
            autoPlayIncoming: true,
            transcriptionEnabled: true,
            privacyLevel: 'public',
          },
          created_at: new Date().toISOString(),
          last_active_at: new Date().toISOString(),
        }]);
      }
    }
  }

  async getPulseUsersByIds(userIds: string[]): Promise<PulseUser[]> {
    if (userIds.length === 0) return [];

    const { data, error } = await supabase
      .from('pulse_users')
      .select('*')
      .in('id', userIds);

    if (error || !data) return [];
    return data.map(this.mapDbToPulseUser);
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
    console.log('Creating channel for user:', userId);

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

    console.log('Successfully created channel:', data);
    return this.mapDbToChannel(data);
  }

  async getMyChannels(): Promise<PulseChannel[]> {
    const userId = await this.ensureUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('pulse_channels')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map(this.mapDbToChannel);
  }

  async createBroadcast(
    channelId: string,
    title: string,
    audioUrl: string,
    duration: number,
    transcript?: string,
    scheduledFor?: Date
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
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating broadcast:', error);
      return null;
    }

    // Notify subscribers
    await this.notifyChannelSubscribers(channelId, data.id, title);

    return this.mapDbToBroadcast(data);
  }

  async uploadAndPublishBroadcast(
    channelId: string,
    title: string,
    audioBlob: Blob,
    duration: number,
    notifyUserIds?: string[]
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
        .from('voxer')
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
        .from('voxer')
        .getPublicUrl(fileName);

      const audioUrl = urlData.publicUrl;

      // Create the broadcast
      const broadcast = await this.createBroadcast(channelId, title, audioUrl, duration);

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

  async getChannelBroadcasts(channelId: string): Promise<Broadcast[]> {
    const { data, error } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('channel_id', channelId)
      .order('published_at', { ascending: false });

    if (error || !data) return [];
    return data.map(this.mapDbToBroadcast);
  }

  // ============================================
  // VOICE THREADS
  // ============================================

  async createVoiceThread(participantIds: string[], subject?: string): Promise<VoiceThread | null> {
    const userId = await this.ensureUserId();
    if (!userId) return null;

    const allParticipants = [...new Set([userId, ...participantIds])];

    const { data, error } = await supabase
      .from('voice_threads')
      .insert([{
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

  async getMyVoiceThreads(): Promise<VoiceThread[]> {
    const userId = await this.ensureUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('voice_threads')
      .select('*')
      .contains('participants', [userId])
      .eq('is_archived', false)
      .order('last_activity_at', { ascending: false });

    if (error || !data) return [];
    return data.map(this.mapDbToVoiceThread);
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
        .from('voxer')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          upsert: false
        });

      if (uploadError) {
        console.error('Error uploading voice thread audio:', uploadError);
        return null;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('voxer')
        .getPublicUrl(fileName);

      const audioUrl = urlData.publicUrl;
      console.log('Uploaded voice thread audio:', audioUrl);

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

  async getThreadMessages(threadId: string): Promise<VoiceThreadMessage[]> {
    const { data, error } = await supabase
      .from('voice_thread_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    if (error || !data) return [];
    return data.map(this.mapDbToVoiceThreadMessage);
  }

  // ============================================
  // TEAM VOX
  // ============================================

  async createWorkspace(name: string, description?: string): Promise<VoxWorkspace | null> {
    const userId = await this.ensureUserId();
    if (!userId) return null;

    const { data, error } = await supabase
      .from('vox_workspaces')
      .insert([{
        name,
        description,
        owner_id: userId,
        member_ids: [userId],
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating workspace:', error);
      return null;
    }

    // Create default general channel
    await this.createTeamChannel(data.id, 'General', 'General discussion', 'general');

    return this.mapDbToWorkspace(data);
  }

  async getMyWorkspaces(): Promise<VoxWorkspace[]> {
    const userId = await this.ensureUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('vox_workspaces')
      .select('*, vox_team_channels(*)')
      .contains('member_ids', [userId])
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map(this.mapDbToWorkspace);
  }

  async addMemberToWorkspace(workspaceId: string, memberId: string): Promise<boolean> {
    // First get current members
    const { data: workspace, error: fetchError } = await supabase
      .from('vox_workspaces')
      .select('member_ids')
      .eq('id', workspaceId)
      .single();

    if (fetchError || !workspace) {
      console.error('Error fetching workspace:', fetchError);
      return false;
    }

    // Check if member already exists
    const currentMembers: string[] = workspace.member_ids || [];
    if (currentMembers.includes(memberId)) {
      console.log('Member already in workspace');
      return true;
    }

    // Add new member
    const updatedMembers = [...currentMembers, memberId];

    const { error: updateError } = await supabase
      .from('vox_workspaces')
      .update({ member_ids: updatedMembers })
      .eq('id', workspaceId);

    if (updateError) {
      console.error('Error adding member to workspace:', updateError);
      return false;
    }

    return true;
  }

  async removeMemberFromWorkspace(workspaceId: string, memberId: string): Promise<boolean> {
    // First get current members
    const { data: workspace, error: fetchError } = await supabase
      .from('vox_workspaces')
      .select('member_ids, owner_id')
      .eq('id', workspaceId)
      .single();

    if (fetchError || !workspace) {
      console.error('Error fetching workspace:', fetchError);
      return false;
    }

    // Can't remove the owner
    if (workspace.owner_id === memberId) {
      console.error('Cannot remove workspace owner');
      return false;
    }

    // Remove member
    const currentMembers: string[] = workspace.member_ids || [];
    const updatedMembers = currentMembers.filter(id => id !== memberId);

    const { error: updateError } = await supabase
      .from('vox_workspaces')
      .update({ member_ids: updatedMembers })
      .eq('id', workspaceId);

    if (updateError) {
      console.error('Error removing member from workspace:', updateError);
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
        .from('voxer')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          upsert: false
        });

      if (uploadError) {
        console.error('Error uploading team vox audio:', uploadError);
        return null;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('voxer')
        .getPublicUrl(fileName);

      const audioUrl = urlData.publicUrl;
      console.log('Uploaded team vox audio:', audioUrl);

      // Send the message with the uploaded URL
      return await this.sendTeamVoxMessage(
        channelId,
        workspaceId,
        audioUrl,
        duration,
        transcript,
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

    const user = await this.getPulseUser();

    // Extract action items from transcript using AI (simplified here)
    const actionItems = transcript ? this.extractActionItems(transcript) : [];

    const { data, error } = await supabase
      .from('team_vox_messages')
      .insert([{
        channel_id: channelId,
        workspace_id: workspaceId,
        sender_id: userId,
        sender_name: user?.displayName || 'Unknown',
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
        `${user?.displayName} mentioned you`,
        'You were mentioned in a team vox',
        data.id,
        userId,
        user?.displayName
      );
    }

    return this.mapDbToTeamVoxMessage(data);
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
        .from('voxer')
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
        .from('voxer')
        .getPublicUrl(fileName);

      const audioUrl = urlData.publicUrl;

      // Transcribe the audio
      let transcript = '';
      try {
        // Get API key from environment variables and localStorage
        const geminiKey = import.meta.env.VITE_API_KEY ||
                          import.meta.env.VITE_GEMINI_API_KEY ||
                          localStorage.getItem('gemini_api_key') ||
                          '';

        console.log('Transcription: geminiKey available:', !!geminiKey);

        if (!geminiKey) {
          console.warn('No Gemini API key available - skipping transcription');
        } else {
          // Convert blob to base64
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1]); // Remove data URL prefix
            };
            reader.onerror = reject;
            reader.readAsDataURL(audioBlob);
          });

          console.log('Starting transcription with Gemini...');
          const result = await transcribeMedia(geminiKey, base64, 'audio/webm');

          transcript = result || '';
          console.log('Vox note transcribed successfully:', transcript.substring(0, 100) + (transcript.length > 100 ? '...' : ''));
        }
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

    // Auto-generate title and tags from transcript
    const autoTitle = title || this.generateTitleFromTranscript(transcript);
    const autoTags = this.extractTagsFromTranscript(transcript);
    const summary = await this.generateSummary(transcript);

    const { data, error } = await supabase
      .from('vox_notes')
      .insert([{
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

  async getMyVoxNotes(searchQuery?: string): Promise<VoxNote[]> {
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

    const { data, error } = await query;

    if (error || !data) return [];
    return data.map(this.mapDbToVoxNote);
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
      console.log('Removing invalid Quick Vox favorites:', invalidIds);

      // Delete invalid favorites from database
      await supabase
        .from('quick_vox_favorites')
        .delete()
        .eq('user_id', userId)
        .in('contact_id', invalidIds);
    }

    return validFavorites.map(this.mapDbToQuickVoxFavorite);
  }

  /**
   * Upload audio blob and send a quick vox message.
   * This is the primary method to use from components.
   */
  async uploadAndSendQuickVox(
    recipientId: string,
    audioBlob: Blob,
    duration: number
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
        .from('voxer')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          upsert: false
        });

      if (uploadError) {
        console.error('Error uploading quick vox audio:', uploadError);
        return null;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('voxer')
        .getPublicUrl(fileName);

      const audioUrl = urlData.publicUrl;
      console.log('Uploaded quick vox audio:', audioUrl);

      // Send the message with the uploaded URL
      return await this.sendQuickVox(recipientId, audioUrl, duration);
    } catch (error) {
      console.error('Error uploading and sending quick vox:', error);
      return null;
    }
  }

  async sendQuickVox(recipientId: string, audioUrl: string, duration: number): Promise<QuickVoxMessage | null> {
    const userId = await this.ensureUserId();
    if (!userId) return null;

    const { data, error } = await supabase
      .from('quick_vox_messages')
      .insert([{
        sender_id: userId,
        recipient_id: recipientId,
        audio_url: audioUrl,
        duration: Math.round(duration),
        status: 'sent',
        created_at: new Date().toISOString(),
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
      userId,
      sender?.displayName
    );

    return this.mapDbToQuickVoxMessage(data);
  }

  async getQuickVoxConversation(contactId: string): Promise<QuickVoxMessage[]> {
    const userId = await this.ensureUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('quick_vox_messages')
      .select('*')
      .or(`and(sender_id.eq.${userId},recipient_id.eq.${contactId}),and(sender_id.eq.${contactId},recipient_id.eq.${userId})`)
      .order('created_at', { ascending: true });

    if (error || !data) return [];
    return data.map(this.mapDbToQuickVoxMessage);
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
        .from('voxer')
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
        .from('voxer')
        .getPublicUrl(fileName);

      const audioUrl = urlData.publicUrl;
      console.log('Uploaded vox drop audio:', audioUrl);

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

    const { data, error } = await supabase
      .from('vox_drops')
      .insert([{
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

  async getMyScheduledDrops(): Promise<VoxDrop[]> {
    const userId = await this.ensureUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('vox_drops')
      .select('*')
      .eq('sender_id', userId)
      .in('status', ['scheduled'])
      .order('scheduled_for', { ascending: true });

    if (error || !data) return [];
    return data.map(this.mapDbToVoxDrop);
  }

  async getReceivedDrops(): Promise<VoxDrop[]> {
    const userId = await this.ensureUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('vox_drops')
      .select('*')
      .contains('recipient_ids', [userId])
      .eq('status', 'delivered')
      .order('delivered_at', { ascending: false });

    if (error || !data) return [];
    return data.map(this.mapDbToVoxDrop);
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
    return data.map(this.mapDbToNotification);
  }

  // ============================================
  // REAL-TIME SUBSCRIPTIONS
  // ============================================

  subscribeToQuickVox(callback: (message: QuickVoxMessage) => void) {
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

  subscribeToRecordingStatus(contactIds: string[], callback: (status: QuickVoxStatus) => void) {
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
    // Simple keyword extraction - in production, use AI
    const keywords = ['meeting', 'idea', 'task', 'reminder', 'important', 'urgent', 'follow-up', 'decision'];
    const found: string[] = [];
    const lower = transcript.toLowerCase();

    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        found.push(keyword);
      }
    }

    return found.slice(0, 5);
  }

  private extractActionItems(transcript: string): string[] {
    // Simple extraction - look for "need to", "should", "will", "action item"
    const sentences = transcript.split(/[.!?]/);
    const actionItems: string[] = [];
    const triggers = ['need to', 'should', 'will', 'must', 'action item', 'todo', 'to do'];

    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      if (triggers.some(t => lower.includes(t))) {
        actionItems.push(sentence.trim());
      }
    }

    return actionItems.slice(0, 5);
  }

  private async generateSummary(transcript: string): Promise<string> {
    // In production, call Gemini API for summary
    // For now, return first 2 sentences
    const sentences = transcript.split(/[.!?]/).filter(s => s.trim());
    return sentences.slice(0, 2).join('. ') + '.';
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
