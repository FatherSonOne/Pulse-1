// ============================================
// ADMIN SERVICE
// Service for admin dashboard operations
// ============================================

import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';

// ==================== TYPES ====================

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'moderator';
  status: 'active' | 'suspended' | 'pending';
  lastActive: Date;
  createdAt: Date;
  messagesCount: number;
  groupsCount: number;
  avatarUrl?: string;
}

export interface AdminSettings {
  id: string;
  userId: string;
  allowNewRegistrations: boolean;
  emailNotifications: boolean;
  maintenanceMode: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActivityLogEntry {
  id: string;
  action: string;
  actorId: string;
  actorName: string;
  targetId?: string;
  targetName?: string;
  details?: string;
  createdAt: Date;
}

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalMessages: number;
  pendingApprovals: number;
}

// ==================== ADMIN SERVICE CLASS ====================

class AdminService {
  // ==================== USER MANAGEMENT ====================

  /**
   * Get all users for admin management
   */
  async getAllUsers(): Promise<AdminUser[]> {
    // First, get all user profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error('Failed to fetch user profiles:', profilesError);
      // Fall back to auth.admin.listUsers if profiles table doesn't have what we need
    }

    // Also get auth users for complete picture
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.warn('Could not fetch auth users (may require service role):', authError);
      // If we have profiles, use those
      if (profiles && profiles.length > 0) {
        return profiles.map(profile => this.mapProfileToAdminUser(profile));
      }
      return [];
    }

    const authUsers = authData?.users || [];

    // Merge auth users with profiles
    const usersMap = new Map<string, AdminUser>();

    // Start with auth users
    for (const authUser of authUsers) {
      const profile = profiles?.find(p => p.id === authUser.id);
      usersMap.set(authUser.id, {
        id: authUser.id,
        email: authUser.email || '',
        name: profile?.display_name || profile?.full_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Unknown',
        role: profile?.role || 'user',
        status: this.getUserStatus(authUser, profile),
        lastActive: profile?.last_seen_at ? new Date(profile.last_seen_at) : new Date(authUser.last_sign_in_at || authUser.created_at),
        createdAt: new Date(authUser.created_at),
        messagesCount: profile?.messages_count || 0,
        groupsCount: profile?.groups_count || 0,
        avatarUrl: profile?.avatar_url || authUser.user_metadata?.avatar_url,
      });
    }

    // Add any profiles that might not be in auth (shouldn't happen but just in case)
    if (profiles) {
      for (const profile of profiles) {
        if (!usersMap.has(profile.id)) {
          usersMap.set(profile.id, this.mapProfileToAdminUser(profile));
        }
      }
    }

    return Array.from(usersMap.values());
  }

  /**
   * Get a single user by ID
   */
  async getUserById(userId: string): Promise<AdminUser | null> {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Failed to fetch user:', error);
      return null;
    }

    return this.mapProfileToAdminUser(profile);
  }

  /**
   * Update user role
   */
  async updateUserRole(userId: string, role: AdminUser['role']): Promise<void> {
    const { error } = await supabase
      .from('user_profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to update user role: ${error.message}`);
    }

    // Log the action
    await this.logActivity('role_changed', userId, `Role changed to ${role}`);
  }

  /**
   * Update user status
   */
  async updateUserStatus(userId: string, status: AdminUser['status']): Promise<void> {
    const { error } = await supabase
      .from('user_profiles')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to update user status: ${error.message}`);
    }

    // Log the action
    await this.logActivity(`user_${status}`, userId, `User status changed to ${status}`);
  }

  /**
   * Delete user account
   */
  async deleteUser(userId: string): Promise<void> {
    // First delete profile data
    const { error: profileError } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.warn('Failed to delete user profile:', profileError);
    }

    // Then delete auth user (requires service role)
    try {
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      if (authError) {
        throw new Error(`Failed to delete auth user: ${authError.message}`);
      }
    } catch (err) {
      console.warn('Could not delete auth user (may require service role):', err);
    }

    await this.logActivity('user_deleted', userId, 'User account deleted');
  }

  // ==================== DASHBOARD STATS ====================

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    // Get total users count
    const { count: totalUsers, error: usersError } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    if (usersError) {
      console.error('Failed to get users count:', usersError);
    }

    // Get active users (users who were active in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { count: activeUsers, error: activeError } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .gte('last_seen_at', sevenDaysAgo.toISOString());

    if (activeError) {
      console.error('Failed to get active users count:', activeError);
    }

    // Get total messages count from unified_messages
    const { count: totalMessages, error: messagesError } = await supabase
      .from('unified_messages')
      .select('*', { count: 'exact', head: true });

    if (messagesError) {
      console.error('Failed to get messages count:', messagesError);
    }

    // Get pending approvals (users with status = 'pending')
    const { count: pendingApprovals, error: pendingError } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (pendingError) {
      console.error('Failed to get pending approvals:', pendingError);
    }

    return {
      totalUsers: totalUsers || 0,
      activeUsers: activeUsers || 0,
      totalMessages: totalMessages || 0,
      pendingApprovals: pendingApprovals || 0,
    };
  }

  // ==================== ACTIVITY LOG ====================

  /**
   * Log an admin activity
   */
  async logActivity(action: string, targetId?: string, details?: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('admin_activity_logs')
      .insert({
        id: uuidv4(),
        action,
        actor_id: user?.id,
        actor_name: user?.user_metadata?.full_name || user?.email || 'System',
        target_id: targetId,
        details,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.warn('Failed to log activity:', error);
    }
  }

  /**
   * Get recent activity logs
   */
  async getActivityLogs(limit: number = 10): Promise<ActivityLogEntry[]> {
    const { data, error } = await supabase
      .from('admin_activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch activity logs:', error);
      return [];
    }

    return (data || []).map(log => ({
      id: log.id,
      action: log.action,
      actorId: log.actor_id,
      actorName: log.actor_name,
      targetId: log.target_id,
      targetName: log.target_name,
      details: log.details,
      createdAt: new Date(log.created_at),
    }));
  }

  // ==================== ADMIN SETTINGS ====================

  /**
   * Get admin settings
   */
  async getSettings(): Promise<AdminSettings | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('admin_settings')
      .select('*')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No settings exist yet, return defaults
        return {
          id: '',
          userId: user.id,
          allowNewRegistrations: true,
          emailNotifications: true,
          maintenanceMode: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      console.error('Failed to fetch settings:', error);
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      allowNewRegistrations: data.allow_new_registrations,
      emailNotifications: data.email_notifications,
      maintenanceMode: data.maintenance_mode,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * Update admin settings
   */
  async updateSettings(updates: Partial<AdminSettings>): Promise<AdminSettings> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const settingsData = {
      user_id: user.id,
      allow_new_registrations: updates.allowNewRegistrations,
      email_notifications: updates.emailNotifications,
      maintenance_mode: updates.maintenanceMode,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('admin_settings')
      .upsert({
        id: updates.id || uuidv4(),
        ...settingsData,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update settings: ${error.message}`);
    }

    await this.logActivity('settings_updated', undefined, 'Admin settings updated');

    return {
      id: data.id,
      userId: data.user_id,
      allowNewRegistrations: data.allow_new_registrations,
      emailNotifications: data.email_notifications,
      maintenanceMode: data.maintenance_mode,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  // ==================== EXPORT FUNCTIONALITY ====================

  /**
   * Export users as CSV
   */
  async exportUsersCSV(): Promise<string> {
    const users = await this.getAllUsers();

    const headers = ['ID', 'Name', 'Email', 'Role', 'Status', 'Last Active', 'Created At', 'Messages Count', 'Groups Count'];
    const rows = users.map(user => [
      user.id,
      user.name,
      user.email,
      user.role,
      user.status,
      user.lastActive.toISOString(),
      user.createdAt.toISOString(),
      user.messagesCount.toString(),
      user.groupsCount.toString(),
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    return csv;
  }

  /**
   * Export messages as JSON
   */
  async exportMessagesJSON(): Promise<string> {
    const { data: messages, error } = await supabase
      .from('unified_messages')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1000);

    if (error) {
      throw new Error(`Failed to export messages: ${error.message}`);
    }

    return JSON.stringify(messages || [], null, 2);
  }

  // ==================== PRIVATE HELPERS ====================

  private mapProfileToAdminUser(profile: any): AdminUser {
    return {
      id: profile.id,
      email: profile.email || '',
      name: profile.display_name || profile.full_name || profile.handle || 'Unknown',
      role: profile.role || 'user',
      status: profile.status || 'active',
      lastActive: profile.last_seen_at ? new Date(profile.last_seen_at) : new Date(profile.created_at),
      createdAt: new Date(profile.created_at),
      messagesCount: profile.messages_count || 0,
      groupsCount: profile.groups_count || 0,
      avatarUrl: profile.avatar_url,
    };
  }

  private getUserStatus(authUser: any, profile: any): AdminUser['status'] {
    // Check if user is banned/suspended
    if (authUser.banned_until && new Date(authUser.banned_until) > new Date()) {
      return 'suspended';
    }

    // Check profile status
    if (profile?.status) {
      return profile.status;
    }

    // Check if email is confirmed
    if (!authUser.email_confirmed_at) {
      return 'pending';
    }

    return 'active';
  }
}

// Export singleton instance
export const adminService = new AdminService();
