# Data Retention & OAuth Apps Setup Guide

This guide explains how to set up and configure the data retention and OAuth apps management system for Pulse.

## Overview

The data retention system provides:
- **Automatic data cleanup** based on user-defined retention policies
- **OAuth app tracking** for third-party applications
- **Audit logging** for all cleanup operations
- **Scheduled cleanup jobs** via Supabase Edge Functions

## Database Setup

### 1. Run Migration

Apply the database migration to create the necessary tables:

```bash
# From the project root
npx supabase migration up 042_data_retention_oauth
```

This creates:
- `data_retention_policies` - User retention preferences
- `data_cleanup_logs` - Audit trail of cleanup operations
- `oauth_connected_apps` - Third-party app tracking

### 2. Verify Tables

```sql
-- Check if tables were created
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('data_retention_policies', 'data_cleanup_logs', 'oauth_connected_apps');

-- Check RLS policies
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('data_retention_policies', 'data_cleanup_logs', 'oauth_connected_apps');
```

## Edge Function Setup

### 1. Deploy Data Cleanup Function

```bash
# Deploy the edge function
npx supabase functions deploy data-cleanup

# Set environment variable for cron secret
npx supabase secrets set CRON_SECRET=your_secret_key_here
```

### 2. Configure Cron Job

You have two options for scheduling:

#### Option A: Supabase Cron (Recommended)

Add to your `supabase/functions/_cron/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  // Run data cleanup daily at 2 AM UTC
  const cronSecret = Deno.env.get('CRON_SECRET');

  const response = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/data-cleanup`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const result = await response.json();
  console.log('Data cleanup result:', result);

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

Then configure pg_cron:

```sql
-- Create daily cron job (runs at 2 AM UTC)
SELECT cron.schedule(
  'data-cleanup-daily',
  '0 2 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://your-project.supabase.co/functions/v1/data-cleanup',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
```

#### Option B: External Cron Service

Use a service like GitHub Actions, Vercel Cron, or Render Cron:

**.github/workflows/data-cleanup.yml**:
```yaml
name: Data Cleanup
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
  workflow_dispatch:

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger cleanup
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json" \
            https://your-project.supabase.co/functions/v1/data-cleanup
```

### 3. Test Edge Function

```bash
# Manual test
curl -X POST \
  -H "Authorization: Bearer <YOUR_CRON_SECRET>" \
  -H "Content-Type: application/json" \
  https://your-project.supabase.co/functions/v1/data-cleanup

# Test for specific user
curl -X POST \
  -H "Authorization: Bearer <YOUR_CRON_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user-uuid-here"}' \
  https://your-project.supabase.co/functions/v1/data-cleanup
```

## Frontend Integration

### 1. Data Retention Service

The `dataRetentionService` provides methods for managing retention policies:

```typescript
import { dataRetentionService } from './services/dataRetentionService';

// Get user's retention policy
const policy = await dataRetentionService.getPolicy();

// Update retention period for emails
await dataRetentionService.updateRetentionPeriod('emails', 90);

// Enable automatic cleanup
await dataRetentionService.setAutoCleanup(true);

// Get cleanup statistics
const stats = await dataRetentionService.getCleanupStats();

// Preview cleanup before running
const preview = await dataRetentionService.previewCleanup();

// Execute manual cleanup
const results = await dataRetentionService.executeFullCleanup();

// Get cleanup history
const history = await dataRetentionService.getCleanupHistory(50);
```

### 2. OAuth Apps Service

The `oauthAppsService` manages third-party OAuth applications:

```typescript
import { oauthAppsService } from './services/oauthAppsService';

// Sync Google OAuth apps
await oauthAppsService.syncGoogleApps();

// Get all connected apps
const apps = await oauthAppsService.getConnectedApps();

// Revoke app access
await oauthAppsService.revokeApp(appId);

// Mark app as trusted
await oauthAppsService.markAsTrusted(appId, true);

// Get app statistics
const stats = await oauthAppsService.getAppStats();

// Open Google permissions page
oauthAppsService.openGooglePermissionsPage();
```

### 3. Privacy Dashboard Integration

The Privacy Dashboard component is already integrated with the services. Users can:

1. **Configure retention periods** for emails, calendar, contacts, and messages
2. **Enable/disable automatic cleanup**
3. **View cleanup statistics** showing items eligible for deletion
4. **Preview cleanup** to see what will be deleted
5. **Run manual cleanup** on demand
6. **View cleanup history** with audit logs
7. **Manage OAuth apps** and revoke access
8. **View app permissions** granted to third parties

## Security Considerations

### 1. RLS Policies

All tables have Row Level Security enabled:
- Users can only access their own retention policies
- Users can only view their own cleanup logs
- Users can only manage their own OAuth apps

### 2. Edge Function Security

- Edge function requires `CRON_SECRET` for authentication
- Only scheduled jobs and authorized requests can trigger cleanup
- Service role key is required for database operations

### 3. Data Retention Best Practices

- **Default retention**: 90 days for emails, 365 days for calendar, never for contacts
- **Opt-in cleanup**: Auto-cleanup is disabled by default
- **Audit trail**: All cleanup operations are logged
- **Soft delete recommended**: Consider implementing soft delete before hard delete
- **Backup before cleanup**: Users should export data before enabling aggressive retention

## Monitoring

### 1. Check Cleanup Logs

```sql
-- Recent cleanup operations
SELECT
  cleanup_type,
  items_deleted,
  status,
  execution_time_ms,
  created_at
FROM data_cleanup_logs
ORDER BY created_at DESC
LIMIT 50;

-- Cleanup summary by type
SELECT
  cleanup_type,
  COUNT(*) as executions,
  SUM(items_deleted) as total_deleted,
  AVG(execution_time_ms) as avg_time_ms,
  MAX(created_at) as last_run
FROM data_cleanup_logs
WHERE status = 'completed'
GROUP BY cleanup_type;

-- Failed cleanups
SELECT *
FROM data_cleanup_logs
WHERE status = 'failed'
ORDER BY created_at DESC;
```

### 2. Check Active Policies

```sql
-- Policies with auto-cleanup enabled
SELECT
  user_id,
  emails_retention_days,
  calendar_retention_days,
  contacts_retention_days,
  messages_retention_days,
  next_cleanup_at,
  last_cleanup_at
FROM data_retention_policies
WHERE auto_cleanup_enabled = true
ORDER BY next_cleanup_at;
```

### 3. OAuth App Statistics

```sql
-- Connected apps summary
SELECT
  provider,
  COUNT(*) as total_apps,
  COUNT(CASE WHEN is_active THEN 1 END) as active_apps,
  COUNT(CASE WHEN is_trusted THEN 1 END) as trusted_apps
FROM oauth_connected_apps
GROUP BY provider;

-- Recently used apps
SELECT
  app_name,
  provider,
  last_used_at,
  access_count
FROM oauth_connected_apps
WHERE is_active = true
ORDER BY last_used_at DESC NULLS LAST
LIMIT 20;
```

## Troubleshooting

### Issue: Cleanup not running automatically

1. Check if Edge Function is deployed:
   ```bash
   npx supabase functions list
   ```

2. Verify cron job is configured:
   ```sql
   SELECT * FROM cron.job WHERE jobname LIKE '%cleanup%';
   ```

3. Check Edge Function logs:
   ```bash
   npx supabase functions logs data-cleanup
   ```

### Issue: Permission denied errors

1. Verify RLS policies are correctly applied
2. Ensure service role key is set in Edge Function
3. Check user authentication tokens

### Issue: No cleanup stats showing

1. Verify data tables exist (emails, events, contacts, messages)
2. Check table schemas match expected format
3. Ensure tables have `created_at` timestamp fields

## Data Migration

If you have existing user data, you may want to:

1. **Create default policies** for existing users:
```sql
INSERT INTO data_retention_policies (user_id, auto_cleanup_enabled)
SELECT id, false FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
```

2. **Backfill cleanup logs** for manual review:
```sql
-- Example: Log what would be cleaned if policy was applied
INSERT INTO data_cleanup_logs (user_id, cleanup_type, items_deleted, status)
SELECT
  user_id,
  'emails',
  COUNT(*),
  'preview'
FROM emails
WHERE created_at < NOW() - INTERVAL '90 days'
GROUP BY user_id;
```

## Future Enhancements

Consider implementing:
- **Soft delete** with recovery period before permanent deletion
- **Export before delete** automatic data archival
- **Granular retention** by email label, calendar type, etc.
- **Retention exceptions** for important items
- **Data lifecycle policies** with staged deletion
- **Compliance modes** for GDPR, HIPAA, etc.

## Support

For issues or questions:
1. Check Supabase Edge Function logs
2. Review cleanup logs in database
3. Enable debug logging in services
4. Contact your system administrator
