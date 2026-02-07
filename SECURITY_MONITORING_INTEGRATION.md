# Security Monitoring & Activity Logging Integration

## Overview

This document describes the comprehensive security monitoring infrastructure implemented for the Pulse app. The system provides real-time activity tracking, unusual activity detection, and automated security alerts.

## Components Created

### 1. Database Migrations (`supabase/migrations/042_activity_logs_security.sql`)

Creates three main tables with Row Level Security (RLS) policies:

#### **activity_logs** Table
Tracks all significant user actions for security monitoring and audit trails.

**Key Fields:**
- `action_type`: Type of action (login, gmail_sync, settings_change, etc.)
- `action_category`: Category (auth, data_access, settings, export, security, admin)
- `description`: Human-readable description
- `details`: JSONB field for additional context
- `ip_address`, `user_agent`: Security context
- `device_info`, `location_info`: Device and location data
- `severity`: info, warning, or critical

**Features:**
- Optimized indexes for fast queries
- Automatic cleanup based on retention policy (default 90 days)
- RLS policies ensure users only see their own logs

#### **security_alerts** Table
Stores detected security events and unusual activity.

**Key Fields:**
- `alert_type`: new_location, new_device, unusual_time, etc.
- `alert_level`: low, medium, high, critical
- `title`, `description`: Alert details
- `status`: new, acknowledged, resolved, false_positive
- `email_sent`, `push_sent`: Notification tracking

**Features:**
- Links to trigger activity logs
- Status tracking with timestamps
- Notification state management

#### **security_settings** Table
User-specific security preferences.

**Key Fields:**
- `alerts_enabled`: Master toggle for alerts
- `email_alerts_enabled`, `push_alerts_enabled`: Notification preferences
- `monitor_new_locations`, `monitor_new_devices`, etc.: Alert type toggles
- `trusted_device_fingerprints`, `trusted_ip_ranges`: Trust management
- `activity_retention_days`: Data retention policy (30-365 days)

### 2. Activity Service (`src/services/activityService.ts`)

Comprehensive activity logging service with real-time capabilities.

#### Key Methods

**logActivity(params)** - Log a user activity
```typescript
await activityService.logActivity({
  action_type: 'gmail_sync',
  description: 'Synced 15 new emails',
  details: { email_count: 15 },
  severity: 'info'
});
```

**getRecentActivity(limit)** - Fetch recent activity logs
```typescript
const activities = await activityService.getRecentActivity(50);
```

**getActivityByCategory(category, limit)** - Filter by category
```typescript
const authActivities = await activityService.getActivityByCategory('auth', 50);
```

**getActivityStats(days)** - Get activity statistics
```typescript
const stats = await activityService.getActivityStats(30);
// Returns: { total, by_category, by_severity, recent_locations, recent_devices }
```

**subscribeToActivity(callback)** - Real-time updates
```typescript
const unsubscribe = activityService.subscribeToActivity((activity) => {
  console.log('New activity:', activity);
});
```

#### Automatic Device & Location Detection

The service automatically captures:
- **Device Type**: desktop, mobile, tablet
- **Operating System**: Windows, macOS, Linux, Android, iOS
- **Browser**: Chrome, Safari, Firefox, Edge
- **Timezone**: User's local timezone

### 3. Security Alerts Service (`src/services/securityAlertsService.ts`)

Detects unusual activity patterns and sends alerts.

#### Key Methods

**initialize()** - Set up security monitoring
```typescript
await securityAlertsService.initialize();
```

**createAlert(params)** - Create a security alert
```typescript
await securityAlertsService.createAlert({
  alert_type: 'new_device',
  alert_level: 'medium',
  title: 'New Device Detected',
  description: 'Login from Windows PC - Chrome',
  device_info: deviceInfo,
  location_info: locationInfo
});
```

**getAlerts(status, limit)** - Fetch alerts
```typescript
const alerts = await securityAlertsService.getAlerts('new', 20);
```

**getUnreadCount()** - Get count of new alerts
```typescript
const count = await securityAlertsService.getUnreadCount();
```

**acknowledgeAlert(alertId)** - Acknowledge an alert
```typescript
await securityAlertsService.acknowledgeAlert(alertId);
```

**updateSecuritySettings(settings)** - Update user preferences
```typescript
await securityAlertsService.updateSecuritySettings({
  alerts_enabled: true,
  monitor_new_locations: true,
  activity_retention_days: 90
});
```

**analyzeActivity(activity)** - Analyze for suspicious patterns
```typescript
await securityAlertsService.analyzeActivity(activityLog);
```

**subscribeToAlerts(callback)** - Real-time alert notifications
```typescript
const unsubscribe = securityAlertsService.subscribeToAlerts((alert) => {
  console.log('New security alert:', alert);
});
```

#### Automatic Detection Rules

The service automatically detects:

1. **New Device**: Login from unrecognized device
2. **New Location**: Login from new city/country
3. **Unusual Time**: Activity during unusual hours (2 AM - 5 AM)
4. **Data Export**: User initiated data export
5. **Rapid Requests**: Suspicious activity patterns

### 4. PrivacyDashboard Integration

The PrivacyDashboard component has been enhanced with:

#### Real-time Activity Feed
- Displays recent activities with full context
- Shows device, location, and timestamp
- Color-coded severity badges
- Auto-updates via Supabase Realtime

#### Real-time Security Alerts
- Displays recent security alerts
- Filterable by status (new, acknowledged, resolved)
- Color-coded alert levels
- One-click acknowledgment
- Toast notifications for new alerts

#### Security Settings Toggle
- Enable/disable security alerts
- Persists to database
- Immediate feedback

## Usage Examples

### Logging User Activities

**Login Event:**
```typescript
await activityService.logActivity({
  action_type: 'login',
  description: 'User logged in successfully',
  severity: 'info'
});
```

**Gmail Sync:**
```typescript
await activityService.logActivity({
  action_type: 'gmail_sync',
  description: 'Synced Gmail messages',
  details: {
    messages_synced: 42,
    sync_duration_ms: 1234
  },
  severity: 'info'
});
```

**Data Export (High Severity):**
```typescript
await activityService.logActivity({
  action_type: 'data_export',
  description: 'User exported all data',
  details: {
    export_type: 'full',
    file_size: '2.4GB'
  },
  severity: 'warning'
});
```

### Setting Up Real-time Monitoring

**In a React Component:**
```typescript
useEffect(() => {
  // Initialize security monitoring
  securityAlertsService.initialize();

  // Subscribe to activity updates
  const unsubActivity = activityService.subscribeToActivity((activity) => {
    setActivities((prev) => [activity, ...prev].slice(0, 50));

    // Analyze for security threats
    securityAlertsService.analyzeActivity(activity);
  });

  // Subscribe to security alerts
  const unsubAlerts = securityAlertsService.subscribeToAlerts((alert) => {
    setAlerts((prev) => [alert, ...prev]);

    // Show notification for high-severity alerts
    if (alert.alert_level === 'critical' || alert.alert_level === 'high') {
      toast.error(`Security Alert: ${alert.title}`);
    }
  });

  return () => {
    unsubActivity();
    unsubAlerts();
  };
}, []);
```

### Implementing Email Notifications

The security alerts service has a placeholder for email notifications. To implement:

1. **Using Supabase Edge Functions:**
```typescript
// Create edge function: supabase/functions/send-security-alert-email/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  const { alert } = await req.json();

  // Send email via SendGrid, Resend, or Supabase's email service
  await sendEmail({
    to: userEmail,
    subject: `Security Alert: ${alert.title}`,
    html: generateAlertEmail(alert)
  });

  return new Response(JSON.stringify({ success: true }));
});
```

2. **Update securityAlertsService.ts:**
```typescript
private async sendEmailNotification(alert: SecurityAlert): Promise<void> {
  try {
    await supabase.functions.invoke('send-security-alert-email', {
      body: { alert }
    });

    await supabase
      .from('security_alerts')
      .update({
        email_sent: true,
        email_sent_at: new Date().toISOString(),
      })
      .eq('id', alert.id);
  } catch (error) {
    console.error('[Security] Failed to send email notification:', error);
  }
}
```

## Database Migration

Run the migration in Supabase:

1. Go to Supabase Dashboard → SQL Editor
2. Run `supabase/migrations/042_activity_logs_security.sql`
3. Verify tables created:
   - `public.activity_logs`
   - `public.security_alerts`
   - `public.security_settings`

Or use Supabase CLI:
```bash
supabase db push
```

## Security Considerations

### Data Retention
- Default: 90 days (configurable per user: 30-365 days)
- Automatic cleanup via `cleanup_old_activity_logs()` function
- Schedule cleanup with pg_cron or Edge Functions

### Row Level Security (RLS)
- All tables have RLS enabled
- Users can only access their own data
- Prevents unauthorized access

### Sensitive Data
- API keys and credentials are NOT logged in activity details
- Security settings exclude sensitive data from cloud sync
- IP addresses stored as INET type for efficient querying

### Privacy
- Users control their own retention period
- Activity logs can be fully deleted on account closure
- Transparent about what data is collected

## Performance Optimizations

### Indexes Created
- `idx_activity_logs_user_id` - Fast user lookups
- `idx_activity_logs_created_at` - Time-based queries
- `idx_activity_logs_composite` - Complex filtered queries
- Similar indexes for security_alerts

### Real-time Performance
- Token caching in Supabase client (5-minute TTL)
- Efficient RLS policies using indexed columns
- Limited query results (default 50 items)

## Future Enhancements

1. **IP Geolocation**: Integrate with IP geolocation service (ipapi.co, MaxMind)
2. **Push Notifications**: Implement browser push notifications
3. **Advanced Analytics**: ML-based anomaly detection
4. **Export Capabilities**: Export activity logs to CSV/JSON
5. **Retention Automation**: Automated cleanup cron job
6. **Two-Factor Requirement**: Require 2FA for sensitive operations

## Testing

### Test Activity Logging
```typescript
// Log a test activity
await activityService.logActivity({
  action_type: 'login',
  description: 'Test login',
  severity: 'info'
});

// Verify it appears in dashboard
const activities = await activityService.getRecentActivity(10);
console.log('Recent activities:', activities);
```

### Test Security Alerts
```typescript
// Create a test alert
await securityAlertsService.createAlert({
  alert_type: 'new_device',
  alert_level: 'medium',
  title: 'Test Alert',
  description: 'This is a test security alert'
});

// Verify it appears
const alerts = await securityAlertsService.getAlerts('new', 10);
console.log('New alerts:', alerts);
```

## Files Modified/Created

### Created Files:
1. `supabase/migrations/042_activity_logs_security.sql` - Database schema
2. `src/services/activityService.ts` - Activity logging service
3. `src/services/securityAlertsService.ts` - Security alerts service
4. `SECURITY_MONITORING_INTEGRATION.md` - This documentation

### Modified Files:
1. `src/components/Account/PrivacyDashboard.tsx` - Enhanced UI with real-time updates

## Support

For issues or questions:
1. Check Supabase logs for database errors
2. Check browser console for client-side errors
3. Verify RLS policies are working correctly
4. Ensure Supabase Realtime is enabled for the project

---

**Built with security and privacy in mind for the Pulse app.**
