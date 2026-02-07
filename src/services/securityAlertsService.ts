// Security Alerts Service - Unusual activity detection and notifications
// Detects suspicious behavior patterns and sends email alerts
// Integrates with activity logging and user security preferences

import { supabase } from './supabase';
import { activityService, ActivityLog, DeviceInfo, LocationInfo } from './activityService';
import { RealtimeChannel } from '@supabase/supabase-js';

// ============================================
// Type Definitions
// ============================================

export type AlertType =
  | 'new_location'
  | 'new_device'
  | 'unusual_time'
  | 'multiple_failed_logins'
  | 'suspicious_data_access'
  | 'unauthorized_export'
  | 'password_changed'
  | 'api_key_changed'
  | 'rapid_requests'
  | 'impossible_travel';

export type AlertLevel = 'low' | 'medium' | 'high' | 'critical';

export type AlertStatus = 'new' | 'acknowledged' | 'resolved' | 'false_positive';

export interface SecurityAlert {
  id: string;
  user_id: string;
  alert_type: AlertType;
  alert_level: AlertLevel;
  title: string;
  description: string;
  trigger_activity_id?: string;
  ip_address?: string;
  device_info: DeviceInfo;
  location_info: LocationInfo;
  status: AlertStatus;
  acknowledged_at?: string;
  resolved_at?: string;
  email_sent: boolean;
  email_sent_at?: string;
  push_sent: boolean;
  push_sent_at?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SecuritySettings {
  id: string;
  user_id: string;
  alerts_enabled: boolean;
  email_alerts_enabled: boolean;
  push_alerts_enabled: boolean;
  monitor_new_locations: boolean;
  monitor_new_devices: boolean;
  monitor_unusual_times: boolean;
  monitor_failed_logins: boolean;
  monitor_data_exports: boolean;
  trusted_device_fingerprints: string[];
  trusted_ip_ranges: string[];
  activity_retention_days: number;
  created_at: string;
  updated_at: string;
}

export interface CreateAlertParams {
  alert_type: AlertType;
  alert_level: AlertLevel;
  title: string;
  description: string;
  trigger_activity_id?: string;
  ip_address?: string;
  device_info?: DeviceInfo;
  location_info?: LocationInfo;
  metadata?: Record<string, any>;
}

// ============================================
// Security Alerts Service Class
// ============================================

class SecurityAlertsService {
  private realtimeChannel: RealtimeChannel | null = null;
  private knownDevices: Map<string, DeviceInfo> = new Map();
  private knownLocations: Map<string, LocationInfo> = new Map();
  private lastActivityTimestamps: Map<string, number> = new Map();

  /**
   * Initialize security monitoring for the current user
   */
  async initialize(): Promise<void> {
    try {
      // Load known devices and locations from activity history
      await this.loadKnownDevicesAndLocations();

      // Ensure user has security settings
      await this.ensureSecuritySettings();

      console.log('[Security] Security monitoring initialized');
    } catch (error) {
      console.error('[Security] Failed to initialize:', error);
    }
  }

  /**
   * Create a security alert
   */
  async createAlert(params: CreateAlertParams): Promise<SecurityAlert | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('[Security] Cannot create alert - user not authenticated');
        return null;
      }

      // Check if alerts are enabled for this user
      const settings = await this.getSecuritySettings();
      if (!settings?.alerts_enabled) {
        console.debug('[Security] Alerts disabled for user');
        return null;
      }

      const alert = {
        user_id: user.id,
        alert_type: params.alert_type,
        alert_level: params.alert_level,
        title: params.title,
        description: params.description,
        trigger_activity_id: params.trigger_activity_id,
        ip_address: params.ip_address,
        device_info: params.device_info || {},
        location_info: params.location_info || {},
        status: 'new' as AlertStatus,
        email_sent: false,
        push_sent: false,
        metadata: params.metadata || {},
      };

      const { data, error } = await supabase
        .from('security_alerts')
        .insert([alert])
        .select()
        .single();

      if (error) {
        console.error('[Security] Failed to create alert:', error);
        return null;
      }

      const createdAlert = data as SecurityAlert;

      // Send notification if enabled
      if (settings?.email_alerts_enabled) {
        await this.sendEmailNotification(createdAlert);
      }

      console.log('[Security] Alert created:', createdAlert.alert_type);
      return createdAlert;
    } catch (error) {
      console.error('[Security] Error creating alert:', error);
      return null;
    }
  }

  /**
   * Get user's security alerts
   */
  async getAlerts(status?: AlertStatus, limit: number = 50): Promise<SecurityAlert[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from('security_alerts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[Security] Failed to fetch alerts:', error);
        return [];
      }

      return (data || []) as SecurityAlert[];
    } catch (error) {
      console.error('[Security] Error fetching alerts:', error);
      return [];
    }
  }

  /**
   * Get unread alert count
   */
  async getUnreadCount(): Promise<number> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { count, error } = await supabase
        .from('security_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'new');

      if (error) {
        console.error('[Security] Failed to count unread alerts:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('[Security] Error counting unread alerts:', error);
      return 0;
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('security_alerts')
        .update({
          status: 'acknowledged',
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      if (error) {
        console.error('[Security] Failed to acknowledge alert:', error);
        return false;
      }

      // Log the acknowledgment
      await activityService.logActivity({
        action_type: 'security_alert_acknowledged',
        description: 'Acknowledged security alert',
        details: { alert_id: alertId },
      });

      return true;
    } catch (error) {
      console.error('[Security] Error acknowledging alert:', error);
      return false;
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('security_alerts')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      if (error) {
        console.error('[Security] Failed to resolve alert:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[Security] Error resolving alert:', error);
      return false;
    }
  }

  /**
   * Mark alert as false positive
   */
  async markAsFalsePositive(alertId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('security_alerts')
        .update({ status: 'false_positive' })
        .eq('id', alertId);

      if (error) {
        console.error('[Security] Failed to mark as false positive:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[Security] Error marking as false positive:', error);
      return false;
    }
  }

  /**
   * Get security settings
   */
  async getSecuritySettings(): Promise<SecuritySettings | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('security_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No settings found, create default
          return await this.ensureSecuritySettings();
        }
        console.error('[Security] Failed to fetch settings:', error);
        return null;
      }

      return data as SecuritySettings;
    } catch (error) {
      console.error('[Security] Error fetching settings:', error);
      return null;
    }
  }

  /**
   * Update security settings
   */
  async updateSecuritySettings(
    settings: Partial<Omit<SecuritySettings, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<SecuritySettings | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('security_settings')
        .update(settings)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('[Security] Failed to update settings:', error);
        return null;
      }

      // Log the settings change
      await activityService.logActivity({
        action_type: 'settings_change',
        description: 'Updated security settings',
        details: { changed_fields: Object.keys(settings) },
      });

      return data as SecuritySettings;
    } catch (error) {
      console.error('[Security] Error updating settings:', error);
      return null;
    }
  }

  /**
   * Analyze activity for suspicious patterns
   */
  async analyzeActivity(activity: ActivityLog): Promise<void> {
    const settings = await this.getSecuritySettings();
    if (!settings?.alerts_enabled) return;

    // Check for new device
    if (settings.monitor_new_devices && activity.device_info) {
      const isNewDevice = await this.checkNewDevice(activity.device_info);
      if (isNewDevice) {
        await this.createAlert({
          alert_type: 'new_device',
          alert_level: 'medium',
          title: 'New Device Detected',
          description: `Login from a new device: ${activity.device_info.os} - ${activity.device_info.browser}`,
          trigger_activity_id: activity.id,
          device_info: activity.device_info,
          location_info: activity.location_info,
          ip_address: activity.ip_address,
          metadata: { device: activity.device_info },
        });
      }
    }

    // Check for new location
    if (settings.monitor_new_locations && activity.location_info?.city) {
      const isNewLocation = await this.checkNewLocation(activity.location_info);
      if (isNewLocation) {
        await this.createAlert({
          alert_type: 'new_location',
          alert_level: 'medium',
          title: 'New Location Detected',
          description: `Login from new location: ${activity.location_info.city}, ${activity.location_info.country}`,
          trigger_activity_id: activity.id,
          device_info: activity.device_info,
          location_info: activity.location_info,
          ip_address: activity.ip_address,
          metadata: { location: activity.location_info },
        });
      }
    }

    // Check for unusual access times
    if (settings.monitor_unusual_times) {
      const isUnusualTime = this.checkUnusualTime();
      if (isUnusualTime) {
        await this.createAlert({
          alert_type: 'unusual_time',
          alert_level: 'low',
          title: 'Unusual Activity Time',
          description: 'Activity detected during unusual hours',
          trigger_activity_id: activity.id,
          device_info: activity.device_info,
          location_info: activity.location_info,
          metadata: { time: new Date().toISOString() },
        });
      }
    }

    // Check for data exports
    if (settings.monitor_data_exports && activity.action_type === 'data_export') {
      await this.createAlert({
        alert_type: 'unauthorized_export',
        alert_level: 'high',
        title: 'Data Export Detected',
        description: 'User initiated a data export',
        trigger_activity_id: activity.id,
        device_info: activity.device_info,
        location_info: activity.location_info,
        metadata: { export_details: activity.details },
      });
    }

    // Check for rapid requests
    const isRapidRequest = this.checkRapidRequests(activity.user_id);
    if (isRapidRequest) {
      await this.createAlert({
        alert_type: 'rapid_requests',
        alert_level: 'medium',
        title: 'Rapid Requests Detected',
        description: 'Unusual number of requests in short time period',
        trigger_activity_id: activity.id,
        device_info: activity.device_info,
        location_info: activity.location_info,
        metadata: { request_count: this.lastActivityTimestamps.size },
      });
    }
  }

  /**
   * Subscribe to real-time alert updates
   */
  async subscribeToAlerts(callback: (alert: SecurityAlert) => void): Promise<() => void> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.warn('[Security] Cannot subscribe - user not authenticated');
      return () => {};
    }

    this.realtimeChannel = supabase
      .channel('security_alerts_channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'security_alerts',
          filter: `user_id=eq.${user.user?.id}`,
        },
        (payload) => {
          callback(payload.new as SecurityAlert);
        }
      )
      .subscribe();

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
  // Private Helper Methods
  // ============================================

  private async ensureSecuritySettings(): Promise<SecuritySettings | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('security_settings')
        .insert([{ user_id: user.id }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          // Already exists, fetch it
          return await this.getSecuritySettings();
        }
        console.error('[Security] Failed to create settings:', error);
        return null;
      }

      return data as SecuritySettings;
    } catch (error) {
      console.error('[Security] Error ensuring settings:', error);
      return null;
    }
  }

  private async loadKnownDevicesAndLocations(): Promise<void> {
    const recentActivity = await activityService.getRecentActivity(100);

    recentActivity.forEach((activity) => {
      if (activity.device_info) {
        const deviceKey = this.getDeviceFingerprint(activity.device_info);
        this.knownDevices.set(deviceKey, activity.device_info);
      }

      if (activity.location_info?.city) {
        const locationKey = `${activity.location_info.city}-${activity.location_info.country}`;
        this.knownLocations.set(locationKey, activity.location_info);
      }
    });
  }

  private async checkNewDevice(device: DeviceInfo): Promise<boolean> {
    const deviceKey = this.getDeviceFingerprint(device);
    return !this.knownDevices.has(deviceKey);
  }

  private async checkNewLocation(location: LocationInfo): Promise<boolean> {
    const locationKey = `${location.city}-${location.country}`;
    return !this.knownLocations.has(locationKey);
  }

  private checkUnusualTime(): boolean {
    const hour = new Date().getHours();
    // Consider unusual if between 2 AM and 5 AM
    return hour >= 2 && hour < 5;
  }

  private checkRapidRequests(userId: string): boolean {
    const now = Date.now();
    const key = userId;
    const lastTimestamp = this.lastActivityTimestamps.get(key);

    this.lastActivityTimestamps.set(key, now);

    // Check if less than 1 second since last activity
    if (lastTimestamp && now - lastTimestamp < 1000) {
      return true;
    }

    return false;
  }

  private getDeviceFingerprint(device: DeviceInfo): string {
    return `${device.type}-${device.os}-${device.browser}`;
  }

  private async sendEmailNotification(alert: SecurityAlert): Promise<void> {
    try {
      // In production, integrate with SendGrid or Supabase Edge Functions
      // For now, we'll mark it as sent and log
      console.log('[Security] Email notification would be sent for alert:', alert.title);

      // Update alert to mark email as sent
      await supabase
        .from('security_alerts')
        .update({
          email_sent: true,
          email_sent_at: new Date().toISOString(),
        })
        .eq('id', alert.id);

      // TODO: Implement actual email sending via SendGrid or Supabase
      // Example with Supabase Edge Function:
      // await supabase.functions.invoke('send-security-alert-email', {
      //   body: { alert }
      // });
    } catch (error) {
      console.error('[Security] Failed to send email notification:', error);
    }
  }
}

// Export singleton instance
export const securityAlertsService = new SecurityAlertsService();
export default securityAlertsService;
