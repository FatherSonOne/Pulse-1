// Activity Integration Example
// This file shows how to integrate activity logging and security alerts
// into various parts of the Pulse app

import { activityService } from './activityService';
import { securityAlertsService } from './securityAlertsService';
import toast from 'react-hot-toast';

/**
 * Example: Log Gmail sync activity
 */
export async function logGmailSync(messageCount: number, syncDuration: number) {
  await activityService.logActivity({
    action_type: 'gmail_sync',
    description: `Synced ${messageCount} Gmail messages`,
    details: {
      messages_synced: messageCount,
      sync_duration_ms: syncDuration,
      timestamp: new Date().toISOString(),
    },
    severity: 'info',
    success: true,
  });
}

/**
 * Example: Log calendar access
 */
export async function logCalendarAccess(eventCount: number) {
  await activityService.logActivity({
    action_type: 'calendar_access',
    description: `Accessed Google Calendar`,
    details: {
      events_loaded: eventCount,
    },
    severity: 'info',
    success: true,
  });
}

/**
 * Example: Log settings change
 */
export async function logSettingsChange(settingName: string, oldValue: any, newValue: any) {
  await activityService.logActivity({
    action_type: 'settings_change',
    description: `Changed setting: ${settingName}`,
    details: {
      setting: settingName,
      old_value: oldValue,
      new_value: newValue,
    },
    severity: 'info',
    success: true,
  });
}

/**
 * Example: Log successful login
 */
export async function logSuccessfulLogin(provider: string) {
  await activityService.logActivity({
    action_type: 'login',
    description: `Logged in via ${provider}`,
    details: {
      provider,
      login_method: 'oauth',
    },
    severity: 'info',
    success: true,
  });
}

/**
 * Example: Log failed login attempt
 */
export async function logFailedLogin(provider: string, reason: string) {
  await activityService.logActivity({
    action_type: 'login',
    description: `Login failed via ${provider}`,
    details: {
      provider,
      reason,
    },
    severity: 'warning',
    success: false,
    error_message: reason,
  });
}

/**
 * Example: Log data export
 */
export async function logDataExport(exportType: string, fileSize: string) {
  await activityService.logActivity({
    action_type: 'data_export',
    description: `Exported ${exportType} data`,
    details: {
      export_type: exportType,
      file_size: fileSize,
    },
    severity: 'warning', // Data exports are higher severity for security
    success: true,
  });
}

/**
 * Example: Log service connection
 */
export async function logServiceConnect(serviceName: string, scopes: string[]) {
  await activityService.logActivity({
    action_type: 'service_connect',
    description: `Connected ${serviceName}`,
    details: {
      service: serviceName,
      scopes,
    },
    severity: 'info',
    success: true,
  });
}

/**
 * Example: Log service disconnection
 */
export async function logServiceDisconnect(serviceName: string) {
  await activityService.logActivity({
    action_type: 'service_disconnect',
    description: `Disconnected ${serviceName}`,
    details: {
      service: serviceName,
    },
    severity: 'info',
    success: true,
  });
}

/**
 * Example: Initialize security monitoring on app load
 */
export async function initializeSecurityMonitoring() {
  try {
    // Initialize security alerts service
    await securityAlertsService.initialize();

    // Get unread alert count
    const unreadCount = await securityAlertsService.getUnreadCount();

    if (unreadCount > 0) {
      toast(`You have ${unreadCount} new security ${unreadCount === 1 ? 'alert' : 'alerts'}`, {
        icon: '🔔',
        duration: 5000,
      });
    }
  } catch (error) {
    console.error('[Security] Failed to initialize monitoring:', error);
  }
}

/**
 * Example: React hook for real-time activity monitoring
 */
export function useActivityMonitoring(onActivity?: (activity: any) => void) {
  // This would be used in a React component
  // useEffect(() => {
  //   const unsubscribe = activityService.subscribeToActivity((activity) => {
  //     if (onActivity) {
  //       onActivity(activity);
  //     }
  //
  //     // Analyze for security threats
  //     securityAlertsService.analyzeActivity(activity);
  //   });
  //
  //   return unsubscribe;
  // }, [onActivity]);
}

/**
 * Example: React hook for security alerts
 */
export function useSecurityAlerts(onAlert?: (alert: any) => void) {
  // This would be used in a React component
  // useEffect(() => {
  //   const unsubscribe = securityAlertsService.subscribeToAlerts((alert) => {
  //     if (onAlert) {
  //       onAlert(alert);
  //     }
  //
  //     // Show toast for high-severity alerts
  //     if (alert.alert_level === 'critical' || alert.alert_level === 'high') {
  //       toast.error(`Security Alert: ${alert.title}`, {
  //         duration: 10000,
  //       });
  //     } else {
  //       toast(`Security Alert: ${alert.title}`, {
  //         icon: '⚠️',
  //         duration: 5000,
  //       });
  //     }
  //   });
  //
  //   return unsubscribe;
  // }, [onAlert]);
}

/**
 * Example: Integration with Gmail Service
 *
 * In your gmailService.ts, add:
 *
 * import { logGmailSync } from './activityIntegrationExample';
 *
 * export async function syncGmail() {
 *   const startTime = Date.now();
 *   try {
 *     const messages = await fetchMessages();
 *     const duration = Date.now() - startTime;
 *
 *     // Log successful sync
 *     await logGmailSync(messages.length, duration);
 *
 *     return messages;
 *   } catch (error) {
 *     // Log failed sync
 *     await activityService.logActivity({
 *       action_type: 'gmail_sync',
 *       description: 'Gmail sync failed',
 *       success: false,
 *       error_message: error.message,
 *       severity: 'warning',
 *     });
 *     throw error;
 *   }
 * }
 */

/**
 * Example: Integration with Auth Service
 *
 * In your authService.ts, add:
 *
 * import { logSuccessfulLogin, logFailedLogin } from './activityIntegrationExample';
 *
 * export async function loginWithGoogle() {
 *   try {
 *     const result = await supabase.auth.signInWithOAuth({ provider: 'google' });
 *
 *     if (result.error) {
 *       await logFailedLogin('Google', result.error.message);
 *       throw result.error;
 *     }
 *
 *     await logSuccessfulLogin('Google');
 *     return result.data.user;
 *   } catch (error) {
 *     await logFailedLogin('Google', error.message);
 *     throw error;
 *   }
 * }
 */

/**
 * Example: Integration with Settings Service
 *
 * In your settingsService.ts, add:
 *
 * import { logSettingsChange } from './activityIntegrationExample';
 *
 * export async function updateSetting(key, value) {
 *   const oldValue = await get(key);
 *
 *   await set(key, value);
 *
 *   // Log the change
 *   await logSettingsChange(key, oldValue, value);
 * }
 */

/**
 * Example: Display activity stats in dashboard
 */
export async function getActivityDashboardStats() {
  const stats = await activityService.getActivityStats(30);

  return {
    totalActivities: stats.total,
    authEvents: stats.by_category.auth,
    dataAccess: stats.by_category.data_access,
    settingsChanges: stats.by_category.settings,
    criticalEvents: stats.by_severity.critical,
    warningEvents: stats.by_severity.warning,
    recentLocations: stats.recent_locations,
    recentDevices: stats.recent_devices,
  };
}

/**
 * Example: Check for suspicious activity patterns
 */
export async function checkForSuspiciousActivity() {
  // Get recent activities
  const activities = await activityService.getRecentActivity(100);

  // Count failed logins in last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const failedLogins = activities.filter(
    (a) =>
      a.action_type === 'login' &&
      !a.success &&
      new Date(a.created_at) > oneHourAgo
  );

  // Alert if more than 3 failed logins
  if (failedLogins.length >= 3) {
    await securityAlertsService.createAlert({
      alert_type: 'multiple_failed_logins',
      alert_level: 'high',
      title: 'Multiple Failed Login Attempts',
      description: `${failedLogins.length} failed login attempts in the past hour`,
      metadata: {
        failed_login_count: failedLogins.length,
        time_window: '1 hour',
      },
    });
  }

  return {
    failedLogins: failedLogins.length,
    isSuspicious: failedLogins.length >= 3,
  };
}
