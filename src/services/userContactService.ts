// User Contact Annotation Service
// Manages user-specific customization and notes about other Pulse users

import { supabase } from './supabase';
import type {
  UserContactAnnotation,
  PulseUserProfile,
  EnrichedUserProfile,
  UpdateAnnotationParams,
  LastActiveStatus,
  OnlineStatus
} from '../types/userContact';

export class UserContactService {
  
  // ============= CONTACT ANNOTATIONS =============
  
  /**
   * Get user's annotation for a specific contact
   */
  async getAnnotation(targetUserId: string): Promise<UserContactAnnotation | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('user_contact_annotations')
        .select('*')
        .eq('user_id', user.id)
        .eq('target_user_id', targetUserId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }
      
      return this.mapAnnotationFromDb(data);
    } catch (error) {
      console.error('Error fetching annotation:', error);
      return null;
    }
  }
  
  /**
   * Update or create annotation for a contact
   */
  async updateAnnotation(params: UpdateAnnotationParams): Promise<UserContactAnnotation> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      // Use the database function to update
      const { data, error } = await supabase.rpc('update_contact_annotation', {
        p_user_id: user.id,
        p_target_user_id: params.targetUserId,
        p_nickname: params.nickname || null,
        p_custom_notes: params.customNotes || null,
        p_custom_tags: params.customTags || null,
        p_custom_phone: params.customPhone || null,
        p_custom_email: params.customEmail || null,
        p_custom_birthday: params.customBirthday?.toISOString().split('T')[0] || null,
        p_custom_company: params.customCompany || null,
        p_custom_role: params.customRole || null,
        p_custom_address: params.customAddress || null,
        p_is_favorite: params.isFavorite ?? null,
        p_is_blocked: params.isBlocked ?? null
      });
      
      if (error) throw error;
      
      // Fetch the updated annotation
      const annotation = await this.getAnnotation(params.targetUserId);
      if (!annotation) throw new Error('Failed to fetch updated annotation');
      
      return annotation;
    } catch (error) {
      console.error('Error updating annotation:', error);
      throw error;
    }
  }
  
  /**
   * Delete annotation for a contact
   */
  async deleteAnnotation(targetUserId: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('user_contact_annotations')
        .delete()
        .eq('user_id', user.id)
        .eq('target_user_id', targetUserId);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting annotation:', error);
      throw error;
    }
  }
  
  /**
   * Get all favorite contacts
   */
  async getFavorites(): Promise<EnrichedUserProfile[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('user_contact_annotations')
        .select(`
          *,
          target:user_profiles!target_user_id(*)
        `)
        .eq('user_id', user.id)
        .eq('is_favorite', true)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      
      return data?.map(item => this.mapEnrichedProfileFromDb(item)) || [];
    } catch (error) {
      console.error('Error fetching favorites:', error);
      return [];
    }
  }
  
  /**
   * Get enriched user profile with annotations
   * Includes fallback queries and retry logic for robustness
   */
  async getEnrichedProfile(targetUserId: string): Promise<EnrichedUserProfile | null> {
    // Validate userId before making any queries
    if (!targetUserId || typeof targetUserId !== 'string' || targetUserId.trim() === '') {
      console.error('[userContactService] Invalid targetUserId provided:', targetUserId);
      return null;
    }

    try {
      console.log('[userContactService] getEnrichedProfile called for:', targetUserId);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('[userContactService] Not authenticated');
        throw new Error('Not authenticated');
      }

      // Try RPC first (includes annotations)
      const { data, error } = await supabase.rpc('get_enriched_user_profile', {
        p_requesting_user_id: user.id,
        p_target_user_id: targetUserId
      });

      if (!error && data && data.length > 0) {
        const enrichedProfile = this.mapEnrichedProfileFromRpc(data[0]);
        return enrichedProfile;
      }

      if (error) {
        console.warn('[userContactService] RPC error, trying fallback:', error.message);
      }

      // Fallback 1: Try basic profile query from user_profiles
      return await this.getBasicProfile(targetUserId);
    } catch (error) {
      console.error('[userContactService] Error fetching enriched profile:', error);

      // Try fallback even on exception
      try {
        return await this.getBasicProfile(targetUserId);
      } catch (fallbackError) {
        console.error('[userContactService] Fallback also failed:', fallbackError);
        return null;
      }
    }
  }

  /**
   * Get basic profile without annotations (fallback method)
   */
  private async getBasicProfile(targetUserId: string): Promise<EnrichedUserProfile | null> {
    // Try user_profiles table first
    const { data: basicProfile, error: basicError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', targetUserId)
      .single();

    if (!basicError && basicProfile) {
      console.log('[userContactService] Fallback successful from user_profiles');
      return {
        id: basicProfile.id,
        handle: basicProfile.handle,
        displayName: basicProfile.display_name,
        fullName: basicProfile.full_name,
        email: basicProfile.email,
        phoneNumber: basicProfile.phone_number,
        avatarUrl: basicProfile.avatar_url,
        bio: basicProfile.bio,
        company: basicProfile.company,
        role: basicProfile.role,
        location: basicProfile.location,
        birthday: basicProfile.birthday ? new Date(basicProfile.birthday) : undefined,
        isVerified: basicProfile.is_verified || false,
        onlineStatus: basicProfile.online_status as OnlineStatus,
        lastActiveAt: basicProfile.last_active_at ? new Date(basicProfile.last_active_at) : null,
        lastSeenAt: basicProfile.last_seen_at ? new Date(basicProfile.last_seen_at) : null,
        annotation: null
      };
    }

    // Try profiles table as second fallback (some apps use this naming)
    const { data: altProfile, error: altError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .single();

    if (!altError && altProfile) {
      console.log('[userContactService] Fallback successful from profiles table');
      return {
        id: altProfile.id,
        handle: altProfile.handle || altProfile.username,
        displayName: altProfile.display_name || altProfile.full_name,
        fullName: altProfile.full_name,
        email: altProfile.email,
        phoneNumber: altProfile.phone_number || altProfile.phone,
        avatarUrl: altProfile.avatar_url,
        bio: altProfile.bio,
        company: altProfile.company,
        role: altProfile.role,
        location: altProfile.location,
        birthday: altProfile.birthday ? new Date(altProfile.birthday) : undefined,
        isVerified: altProfile.is_verified || false,
        onlineStatus: (altProfile.online_status as OnlineStatus) || 'offline',
        lastActiveAt: altProfile.last_active_at ? new Date(altProfile.last_active_at) : null,
        lastSeenAt: altProfile.last_seen_at ? new Date(altProfile.last_seen_at) : null,
        annotation: null
      };
    }

    console.warn('[userContactService] No profile found in any table for:', targetUserId);
    return null;
  }
  
  // ============= PRESENCE TRACKING =============
  
  /**
   * Update current user's presence status
   */
  async updatePresence(status: OnlineStatus = 'online'): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      await supabase.rpc('update_user_presence', {
        p_user_id: user.id,
        p_status: status
      });
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  }
  
  /**
   * Start heartbeat to keep user online
   */
  startPresenceHeartbeat(intervalMs: number = 60000): () => void {
    const heartbeat = async () => {
      await this.updatePresence('online');
    };
    
    // Initial heartbeat
    heartbeat();
    
    // Set up interval
    const intervalId = setInterval(heartbeat, intervalMs);
    
    // Return cleanup function
    return () => {
      clearInterval(intervalId);
      this.updatePresence('offline');
    };
  }
  
  /**
   * Get user's presence status
   */
  async getPresence(userId: string): Promise<{ status: OnlineStatus; lastActiveAt: Date } | null> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('online_status, last_active_at')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      
      return {
        status: data.online_status as OnlineStatus,
        lastActiveAt: new Date(data.last_active_at)
      };
    } catch (error) {
      console.error('Error fetching presence:', error);
      return null;
    }
  }
  
  /**
   * Get human-readable last active status
   */
  async getLastActiveStatus(userId: string): Promise<LastActiveStatus> {
    try {
      const { data, error } = await supabase.rpc('get_last_active_status', {
        p_user_id: userId
      });
      
      if (error) throw error;
      
      return this.parseLastActiveStatus(data);
    } catch (error) {
      console.error('Error fetching last active status:', error);
      return { status: 'unknown', text: 'Unknown' };
    }
  }
  
  /**
   * Subscribe to user's presence changes
   */
  subscribeToPresence(
    userId: string,
    callback: (presence: { status: OnlineStatus; lastActiveAt: Date }) => void
  ): () => void {
    const channel = supabase
      .channel(`presence:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${userId}`
        },
        (payload) => {
          callback({
            status: payload.new.online_status as OnlineStatus,
            lastActiveAt: new Date(payload.new.last_active_at)
          });
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }
  
  /**
   * Get count of online users
   */
  async getOnlineUsersCount(): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('get_online_users_count');
      if (error) throw error;
      return data || 0;
    } catch (error) {
      console.error('Error fetching online users count:', error);
      return 0;
    }
  }

  /**
   * Get all Pulse users (for contact selection in Voxer modes)
   * Excludes the current user
   */
  async getAllPulseUsers(options?: {
    searchQuery?: string;
    limit?: number;
    excludeBlocked?: boolean;
  }): Promise<EnrichedUserProfile[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let query = supabase
        .from('user_profiles')
        .select('*')
        .neq('id', user.id) // Exclude current user
        .order('display_name', { ascending: true });

      // Apply search filter if provided
      if (options?.searchQuery && options.searchQuery.trim()) {
        const searchTerm = `%${options.searchQuery.trim()}%`;
        query = query.or(`display_name.ilike.${searchTerm},handle.ilike.${searchTerm},full_name.ilike.${searchTerm}`);
      }

      // Apply limit
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Get blocked users if we need to filter them
      let blockedUserIds: string[] = [];
      if (options?.excludeBlocked) {
        const { data: blockedData } = await supabase
          .from('user_contact_annotations')
          .select('target_user_id')
          .eq('user_id', user.id)
          .eq('is_blocked', true);

        blockedUserIds = blockedData?.map(b => b.target_user_id) || [];
      }

      // Map profiles and filter blocked if needed
      const profiles = (data || [])
        .filter(profile => !blockedUserIds.includes(profile.id))
        .map(profile => ({
          id: profile.id,
          handle: profile.handle,
          displayName: profile.display_name,
          fullName: profile.full_name,
          email: profile.email,
          phoneNumber: profile.phone_number,
          avatarUrl: profile.avatar_url,
          bio: profile.bio,
          company: profile.company,
          role: profile.role,
          location: profile.location,
          birthday: profile.birthday ? new Date(profile.birthday) : undefined,
          isVerified: profile.is_verified || false,
          onlineStatus: (profile.online_status as OnlineStatus) || 'offline',
          lastActiveAt: profile.last_active_at ? new Date(profile.last_active_at) : null,
          lastSeenAt: profile.last_seen_at ? new Date(profile.last_seen_at) : null,
          annotation: undefined
        }));

      return profiles;
    } catch (error) {
      console.error('Error fetching Pulse users:', error);
      return [];
    }
  }

  /**
   * Search Pulse users by query string
   */
  async searchPulseUsers(query: string, limit: number = 20): Promise<EnrichedUserProfile[]> {
    return this.getAllPulseUsers({ searchQuery: query, limit, excludeBlocked: true });
  }
  
  // ============= HELPER METHODS =============
  
  private mapAnnotationFromDb(data: any): UserContactAnnotation {
    return {
      id: data.id,
      userId: data.user_id,
      targetUserId: data.target_user_id,
      nickname: data.nickname,
      customNotes: data.custom_notes,
      customTags: data.custom_tags,
      customPhone: data.custom_phone,
      customEmail: data.custom_email,
      customBirthday: data.custom_birthday ? new Date(data.custom_birthday) : undefined,
      customCompany: data.custom_company,
      customRole: data.custom_role,
      customAddress: data.custom_address,
      isFavorite: data.is_favorite,
      isBlocked: data.is_blocked,
      lastInteractionAt: data.last_interaction_at ? new Date(data.last_interaction_at) : undefined,
      interactionCount: data.interaction_count || 0,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }
  
  private mapProfileFromDb(data: any): PulseUserProfile {
    return {
      id: data.id,
      handle: data.handle,
      displayName: data.display_name,
      fullName: data.full_name,
      bio: data.bio,
      avatarUrl: data.avatar_url,
      phone: data.phone,
      email: data.email,
      isVerified: data.is_verified,
      isPublic: data.is_public,
      onlineStatus: data.online_status as OnlineStatus,
      lastActiveAt: new Date(data.last_active_at),
      lastSeenAt: new Date(data.last_seen_at),
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }
  
  private mapEnrichedProfileFromDb(data: any): EnrichedUserProfile {
    const profile = this.mapProfileFromDb(data.target);
    const annotation = data ? {
      id: data.id,
      userId: data.user_id,
      targetUserId: data.target_user_id,
      nickname: data.nickname,
      customNotes: data.custom_notes,
      customTags: data.custom_tags,
      customPhone: data.custom_phone,
      customEmail: data.custom_email,
      customBirthday: data.custom_birthday ? new Date(data.custom_birthday) : undefined,
      customCompany: data.custom_company,
      customRole: data.custom_role,
      customAddress: data.custom_address,
      isFavorite: data.is_favorite,
      isBlocked: data.is_blocked,
      lastInteractionAt: data.last_interaction_at ? new Date(data.last_interaction_at) : undefined,
      interactionCount: data.interaction_count || 0,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    } : undefined;
    
    return { ...profile, annotation };
  }
  
  private mapEnrichedProfileFromRpc(data: any): EnrichedUserProfile {
    const profile: PulseUserProfile = {
      id: data.id,
      handle: data.handle,
      displayName: data.display_name,
      fullName: data.full_name,
      bio: data.bio,
      avatarUrl: data.avatar_url,
      phoneNumber: data.phone_number,  // Changed from phone to phone_number
      email: data.email,
      company: data.company,
      role: data.role,
      location: data.location,
      birthday: data.birthday ? new Date(data.birthday) : undefined,
      isVerified: data.is_verified || false,
      isPublic: data.is_public,
      onlineStatus: data.online_status as OnlineStatus,
      lastActiveAt: data.last_active_at ? new Date(data.last_active_at) : null,
      lastSeenAt: data.last_seen_at ? new Date(data.last_seen_at) : null,
      createdAt: data.created_at ? new Date(data.created_at) : undefined,
      updatedAt: data.updated_at ? new Date(data.updated_at) : undefined
    };
    
    const annotation: UserContactAnnotation | undefined = data.nickname || data.custom_notes ? {
      id: '', // Not returned by RPC
      userId: '', // Not returned by RPC
      targetUserId: data.id,
      nickname: data.nickname,
      customNotes: data.custom_notes,
      customTags: data.custom_tags,
      customPhone: data.custom_phone,
      customEmail: data.custom_email,
      customBirthday: data.custom_birthday ? new Date(data.custom_birthday) : undefined,
      customCompany: data.custom_company,
      customRole: data.custom_role,
      customAddress: data.custom_address,
      isFavorite: data.is_favorite || false,
      isBlocked: data.is_blocked || false,
      lastInteractionAt: undefined,
      interactionCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    } : undefined;
    
    return { ...profile, annotation };
  }
  
  private parseLastActiveStatus(text: string): LastActiveStatus {
    if (text === 'Active now') {
      return { status: 'active_now', text };
    }
    if (text.includes('m ago')) {
      return { status: 'minutes_ago', text };
    }
    if (text.includes('h ago')) {
      return { status: 'hours_ago', text };
    }
    if (text.includes('d ago') || text.includes('yesterday')) {
      return { status: 'days_ago', text };
    }
    return { status: 'unknown', text: 'Unknown' };
  }
}

// Export singleton instance
export const userContactService = new UserContactService();
