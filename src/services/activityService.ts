// Activity Logging Service - Comprehensive activity tracking
// Logs all significant user actions for security monitoring and audit trails
// Integrates with Supabase for persistent storage and real-time updates

import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

// ============================================
// Type Definitions
// ============================================

export type ActionType =
  | 'login'
  | 'logout'
  | 'gmail_sync'
  | 'calendar_access'
  | 'contacts_sync'
  | 'drive_access'
  | 'settings_change'
  | 'password_change'
  | 'data_export'
  | 'data_delete'
  | 'service_connect'
  | 'service_disconnect'
  | 'email_send'
  | 'file_upload'
  | 'profile_update'
  | 'security_alert_acknowledged'
  | 'session_created'
  | 'session_revoked'
  | 'api_key_created'
  | 'api_key_revoked'
  | 'war_room_session_created'
  | 'war_room_session_deleted'
  | 'war_room_message_sent'
  | 'war_room_doc_uploaded'
  | 'war_room_doc_deleted'
  | 'war_room_voice_session_started'
  | 'war_room_voice_session_ended'
  | 'war_room_mission_launched'
  | 'war_room_decision_recorded'
  | 'war_room_export'
  | 'war_room_share';

export type ActionCategory = 'auth' | 'data_access' | 'settings' | 'export' | 'security' | 'admin';

export type Severity = 'info' | 'warning' | 'critical';

export interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  os: string;
  browser: string;
  model?: string;
}

export interface LocationInfo {
  city?: string;
  country?: string;
  region?: string;
  timezone?: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action_type: ActionType;
  action_category: ActionCategory;
  description: string;
  details: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  device_info: DeviceInfo;
  location_info: LocationInfo;
  success: boolean;
  error_message?: string;
  severity: Severity;
  created_at: string;
}

export interface CreateActivityLogParams {
  action_type: ActionType;
  description: string;
  details?: Record<string, any>;
  success?: boolean;
  error_message?: string;
  severity?: Severity;
}

// ============================================
// Activity Service Class
// ============================================

class ActivityService {
  private realtimeChannel: RealtimeChannel | null = null;

  /**
   * Log a user activity
   */
  async logActivity(params: CreateActivityLogParams): Promise<ActivityLog | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('[Activity] Cannot log activity - user not authenticated');
        return null;
      }

      // Determine action category from action type
      const action_category = this.getActionCategory(params.action_type);

      // Get device and location info
      const device_info = this.getDeviceInfo();
      const location_info = await this.getLocationInfo();
      const ip_address = await this.getClientIP();

      const activityLog = {
        user_id: user.id,
        action_type: params.action_type,
        action_category,
        description: params.description,
        details: params.details || {},
        ip_address,
        user_agent: navigator.userAgent,
        device_info,
        location_info,
        success: params.success !== undefined ? params.success : true,
        error_message: params.error_message,
        severity: params.severity || 'info',
      };

      const { data, error } = await supabase
        .from('activity_logs')
        .insert([activityLog])
        .select()
        .single();

      if (error) {
        console.error('[Activity] Failed to log activity:', error);
        return null;
      }

      return data as ActivityLog;
    } catch (error) {
      console.error('[Activity] Error logging activity:', error);
      return null;
    }
  }

  /**
   * Get user's recent activity logs with cursor-based pagination.
   * @param limit  Page size (default 50)
   * @param offset Row offset for pagination (default 0)
   */
  async getRecentActivity(limit: number = 50, offset: number = 0): Promise<ActivityLog[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('[Activity] Cannot fetch activity - user not authenticated');
        return [];
      }

      const { data, error } = await supabase
        .from('activity_logs')
        .select('id, user_id, action_type, action_category, description, severity, success, error_message, device_info, location_info, ip_address, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('[Activity] Failed to fetch activity logs:', error);
        return [];
      }

      return (data || []) as ActivityLog[];
    } catch (error) {
      console.error('[Activity] Error fetching activity logs:', error);
      return [];
    }
  }

  /**
   * Get activity logs by category with cursor-based pagination.
   * @param limit  Page size (default 50)
   * @param offset Row offset for pagination (default 0)
   */
  async getActivityByCategory(
    category: ActionCategory,
    limit: number = 50,
    offset: number = 0
  ): Promise<ActivityLog[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('activity_logs')
        .select('id, user_id, action_type, action_category, description, severity, success, error_message, device_info, location_info, ip_address, created_at')
        .eq('user_id', user.id)
        .eq('action_category', category)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('[Activity] Failed to fetch category activity:', error);
        return [];
      }

      return (data || []) as ActivityLog[];
    } catch (error) {
      console.error('[Activity] Error fetching category activity:', error);
      return [];
    }
  }

  /**
   * Get activity logs within date range.
   * @param limit  Page size (default 200; date-range queries are already bounded)
   * @param offset Row offset for pagination (default 0)
   */
  async getActivityByDateRange(
    startDate: Date,
    endDate: Date,
    limit: number = 200,
    offset: number = 0
  ): Promise<ActivityLog[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('activity_logs')
        .select('id, user_id, action_type, action_category, description, severity, success, error_message, device_info, location_info, ip_address, created_at')
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('[Activity] Failed to fetch date range activity:', error);
        return [];
      }

      return (data || []) as ActivityLog[];
    } catch (error) {
      console.error('[Activity] Error fetching date range activity:', error);
      return [];
    }
  }

  /**
   * Get activity statistics
   */
  async getActivityStats(days: number = 30): Promise<{
    total: number;
    by_category: Record<ActionCategory, number>;
    by_severity: Record<Severity, number>;
    recent_locations: string[];
    recent_devices: string[];
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return {
          total: 0,
          by_category: { auth: 0, data_access: 0, settings: 0, export: 0, security: 0, admin: 0 },
          by_severity: { info: 0, warning: 0, critical: 0 },
          recent_locations: [],
          recent_devices: [],
        };
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('activity_logs')
        .select('action_category, severity, location_info, device_info')
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString());

      if (error || !data) {
        console.error('[Activity] Failed to fetch activity stats:', error);
        return {
          total: 0,
          by_category: { auth: 0, data_access: 0, settings: 0, export: 0, security: 0, admin: 0 },
          by_severity: { info: 0, warning: 0, critical: 0 },
          recent_locations: [],
          recent_devices: [],
        };
      }

      const logs = data as ActivityLog[];

      // Calculate statistics
      const by_category = logs.reduce((acc, log) => {
        acc[log.action_category] = (acc[log.action_category] || 0) + 1;
        return acc;
      }, {} as Record<ActionCategory, number>);

      const by_severity = logs.reduce((acc, log) => {
        acc[log.severity] = (acc[log.severity] || 0) + 1;
        return acc;
      }, {} as Record<Severity, number>);

      // Get unique recent locations
      const recent_locations = Array.from(
        new Set(
          logs
            .filter((log) => log.location_info?.city)
            .map((log) => `${log.location_info.city}, ${log.location_info.country}`)
        )
      ).slice(0, 5);

      // Get unique recent devices
      const recent_devices = Array.from(
        new Set(
          logs
            .filter((log) => log.device_info?.os)
            .map((log) => `${log.device_info.os} - ${log.device_info.browser}`)
        )
      ).slice(0, 5);

      return {
        total: logs.length,
        by_category: {
          auth: by_category.auth || 0,
          data_access: by_category.data_access || 0,
          settings: by_category.settings || 0,
          export: by_category.export || 0,
          security: by_category.security || 0,
          admin: by_category.admin || 0,
        },
        by_severity: {
          info: by_severity.info || 0,
          warning: by_severity.warning || 0,
          critical: by_severity.critical || 0,
        },
        recent_locations,
        recent_devices,
      };
    } catch (error) {
      console.error('[Activity] Error calculating stats:', error);
      return {
        total: 0,
        by_category: { auth: 0, data_access: 0, settings: 0, export: 0, security: 0, admin: 0 },
        by_severity: { info: 0, warning: 0, critical: 0 },
        recent_locations: [],
        recent_devices: [],
      };
    }
  }

  /**
   * Subscribe to real-time activity updates
   */
  async subscribeToActivity(callback: (activity: ActivityLog) => void): Promise<() => void> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.warn('[Activity] Cannot subscribe - user not authenticated');
      return () => {};
    }

    this.realtimeChannel = supabase
      .channel('activity_logs_channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_logs',
          filter: `user_id=eq.${user.user?.id}`,
        },
        (payload) => {
          callback(payload.new as ActivityLog);
        }
      )
      .subscribe();

    // Return unsubscribe function
    return () => {
      if (this.realtimeChannel) {
        this.realtimeChannel.unsubscribe();
        this.realtimeChannel = null;
      }
    };
  }

  /**
   * Unsubscribe from real-time updates
   */
  unsubscribe(): void {
    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe();
      this.realtimeChannel = null;
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Determine action category from action type
   */
  private getActionCategory(actionType: ActionType): ActionCategory {
    const categoryMap: Record<ActionType, ActionCategory> = {
      login: 'auth',
      logout: 'auth',
      session_created: 'auth',
      session_revoked: 'auth',
      password_change: 'security',
      gmail_sync: 'data_access',
      calendar_access: 'data_access',
      contacts_sync: 'data_access',
      drive_access: 'data_access',
      email_send: 'data_access',
      file_upload: 'data_access',
      settings_change: 'settings',
      profile_update: 'settings',
      api_key_created: 'settings',
      api_key_revoked: 'settings',
      data_export: 'export',
      data_delete: 'export',
      service_connect: 'settings',
      service_disconnect: 'settings',
      security_alert_acknowledged: 'security',
      war_room_session_created: 'data_access',
      war_room_session_deleted: 'data_access',
      war_room_message_sent: 'data_access',
      war_room_doc_uploaded: 'data_access',
      war_room_doc_deleted: 'data_access',
      war_room_voice_session_started: 'security',
      war_room_voice_session_ended: 'security',
      war_room_mission_launched: 'data_access',
      war_room_decision_recorded: 'data_access',
      war_room_export: 'export',
      war_room_share: 'export',
    };

    return categoryMap[actionType] || 'security';
  }

  /**
   * Get device information from user agent
   */
  private getDeviceInfo(): DeviceInfo {
    const ua = navigator.userAgent;
    const device: DeviceInfo = {
      type: 'unknown',
      os: 'Unknown',
      browser: 'Unknown',
    };

    // Detect device type
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      device.type = 'tablet';
    } else if (
      /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(
        ua
      )
    ) {
      device.type = 'mobile';
    } else {
      device.type = 'desktop';
    }

    // Detect OS
    if (/windows/i.test(ua)) device.os = 'Windows';
    else if (/macintosh|mac os x/i.test(ua)) device.os = 'macOS';
    else if (/linux/i.test(ua)) device.os = 'Linux';
    else if (/android/i.test(ua)) device.os = 'Android';
    else if (/iphone|ipad|ipod/i.test(ua)) device.os = 'iOS';

    // Detect browser
    if (/chrome/i.test(ua) && !/edg/i.test(ua)) device.browser = 'Chrome';
    else if (/safari/i.test(ua) && !/chrome/i.test(ua)) device.browser = 'Safari';
    else if (/firefox/i.test(ua)) device.browser = 'Firefox';
    else if (/edg/i.test(ua)) device.browser = 'Edge';
    else if (/msie|trident/i.test(ua)) device.browser = 'Internet Explorer';

    return device;
  }

  /**
   * Get location information (using browser API or IP geolocation)
   */
  private async getLocationInfo(): Promise<LocationInfo> {
    try {
      // Try to get timezone from browser
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // For production, you would integrate with an IP geolocation service
      // For now, we'll just return timezone
      return {
        timezone,
      };
    } catch (error) {
      return {};
    }
  }

  /**
   * Get client IP address (requires backend support)
   * For now, returns undefined - implement with backend proxy
   */
  private async getClientIP(): Promise<string | undefined> {
    // In production, implement this with a backend endpoint
    // that returns the client's IP address from request headers
    return undefined;
  }
}

// Export singleton instance
export const activityService = new ActivityService();
export default activityService;
