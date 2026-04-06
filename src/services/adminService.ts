// ============================================
// ADMIN SERVICE
// Service for admin dashboard operations
// ============================================

import { supabase } from './supabase';

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
  async getAllUsers(options?: { page?: number; pageSize?: number }): Promise<{ users: AdminUser[]; total: number }> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Get total count
    const { count, error: countError } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Failed to count user profiles:', countError);
    }

    // Get paginated results
    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Failed to fetch user profiles:', error);
      return { users: [], total: 0 };
    }

    return {
      users: (profiles || []).map(profile => this.mapProfileToAdminUser(profile)),
      total: count || 0,
    };
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
    const { data, error } = await supabase.functions.invoke('admin-manage-user', {
      body: { action: 'delete_user', userId },
    });

    if (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }

    if (data?.error) {
      throw new Error(data.error);
    }
  }

  /**
   * Ban a user (prevents login + sets profile status)
   */
  async banUser(userId: string): Promise<void> {
    const { data, error } = await supabase.functions.invoke('admin-manage-user', {
      body: { action: 'ban_user', userId },
    });

    if (error) {
      throw new Error(`Failed to ban user: ${error.message}`);
    }

    if (data?.error) {
      throw new Error(data.error);
    }
  }

  /**
   * Unban a user (restores login + sets profile status to active)
   */
  async unbanUser(userId: string): Promise<void> {
    const { data, error } = await supabase.functions.invoke('admin-manage-user', {
      body: { action: 'unban_user', userId },
    });

    if (error) {
      throw new Error(`Failed to unban user: ${error.message}`);
    }

    if (data?.error) {
      throw new Error(data.error);
    }
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
        action,
        actor_id: user?.id,
        actor_name: user?.user_metadata?.full_name || user?.email || 'System',
        target_id: targetId,
        details,
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
        id: updates.id || crypto.randomUUID(),
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
    const { users } = await this.getAllUsers({ page: 1, pageSize: 10000 });

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

  // ==================== SYSTEM HEALTH ====================

  /**
   * Get real system health metrics
   */
  async getSystemHealth(): Promise<{ dbLatencyMs: number; recentErrors: number }> {
    // Measure DB round-trip latency
    const start = performance.now();
    await supabase.from('user_profiles').select('id', { count: 'exact', head: true });
    const dbLatencyMs = Math.round(performance.now() - start);

    // Count error-related activity logs in last 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('admin_activity_logs')
      .select('*', { count: 'exact', head: true })
      .or('action.ilike.%error%,action.ilike.%fail%')
      .gte('created_at', since);

    return { dbLatencyMs, recentErrors: count || 0 };
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

}

// Export singleton instance
export const adminService = new AdminService();
