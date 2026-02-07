# Privacy Dashboard - Migration Deployment Sequence

## Current Status

Based on the error you encountered, here's the current state of your migrations:

### ✅ Already Applied (SKIP THESE)
- `042_activity_logs_security.sql` - **ALREADY APPLIED** by Backend Architect Agent 3
  - If you try to run this again, you'll get the error: `relation 'idx_activity_logs_user_id' already exists`
  - **Action**: SKIP this file completely OR run the reset script first (see below)

### 📋 Migrations to Apply (IN THIS ORDER)

Run these migrations in your Supabase SQL Editor in the following order:

#### 1. User Sessions Table (Optional but Recommended)
**File**: `create_user_sessions_table.sql`
**Purpose**: Multi-device session tracking with IP geolocation
**Required for**: Session Management feature in Privacy Dashboard
**Estimated time**: ~2 seconds

```sql
-- Copy and paste the contents of create_user_sessions_table.sql
-- into Supabase SQL Editor and run
```

#### 2. Data Export & Privacy
**File**: `042_data_export_privacy.sql`
**Purpose**: Data export workflow, GDPR deletion, privacy audit trails
**Required for**: Data Export and Account Deletion features
**Estimated time**: ~3 seconds

```sql
-- Copy and paste the contents of 042_data_export_privacy.sql
-- into Supabase SQL Editor and run
```

#### 3. Data Retention & OAuth Apps
**File**: `042_data_retention_oauth.sql`
**Purpose**: Automated data cleanup policies, third-party app tracking
**Required for**: Data Retention and Connected Apps features
**Estimated time**: ~2 seconds

```sql
-- Copy and paste the contents of 042_data_retention_oauth.sql
-- into Supabase SQL Editor and run
```

---

## Option 1: Fresh Start (Recommended)

If you want to start fresh and run all 4 migrations:

1. **Reset the activity logs migration** (cleans up the already-applied migration):
   ```sql
   -- Run: 042_activity_logs_security_reset.sql
   ```

2. **Run all migrations in order**:
   - `042_activity_logs_security.sql`
   - `create_user_sessions_table.sql`
   - `042_data_export_privacy.sql`
   - `042_data_retention_oauth.sql`

## Option 2: Skip Already-Applied Migration (Fastest)

Just run the 3 remaining migrations:
1. `create_user_sessions_table.sql`
2. `042_data_export_privacy.sql`
3. `042_data_retention_oauth.sql`

---

## Post-Migration Steps

After running the migrations, complete these additional setup steps:

### 1. Install Dependencies
```bash
npm install jszip @types/jszip
```

### 2. Enable MFA in Supabase
1. Go to Supabase Dashboard → Authentication → Settings
2. Scroll to "Multi-Factor Authentication (MFA)"
3. Enable "TOTP" option
4. Save changes

### 3. Deploy Edge Function (Optional - for automated cleanup)
```bash
cd supabase/functions/data-cleanup
supabase functions deploy data-cleanup
supabase secrets set CRON_SECRET=your-random-secure-string-here
```

### 4. Configure Cron Job
In Supabase Dashboard → Database → Cron Jobs:
- Function: `data-cleanup`
- Schedule: `0 2 * * *` (daily at 2 AM UTC)

### 5. Verify Installation
Check that all tables were created:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'activity_logs',
  'security_alerts',
  'security_settings',
  'user_sessions',
  'data_exports',
  'data_deletion_requests',
  'data_retention_policies',
  'oauth_connected_apps'
)
ORDER BY table_name;
```

You should see 8 tables listed.

---

## Troubleshooting

### Error: "relation already exists"
This means the migration was already applied. Either:
- Skip that migration file
- Run the corresponding reset script first

### Error: "permission denied"
Make sure you're running migrations as the `postgres` user in Supabase SQL Editor.

### RLS Policies Not Working
Make sure you're logged in with a valid user session when testing features.

---

## Next Steps After Deployment

1. **Test Session Management**: Log in from multiple devices/browsers
2. **Test MFA Enrollment**: Try enabling 2FA in Privacy Dashboard
3. **Test Data Export**: Request a data export and download it
4. **Test Activity Logging**: Check that actions are being logged in real-time
5. **Test Security Alerts**: Monitor for unusual activity notifications
6. **Configure Retention**: Set your preferred data retention periods
7. **Review OAuth Apps**: Check connected third-party applications

---

## Quick Command Reference

```bash
# Install dependencies
npm install jszip @types/jszip

# Deploy edge function
supabase functions deploy data-cleanup

# Set environment variable
supabase secrets set CRON_SECRET=your-secret-here

# Start dev server
npm run dev
```

---

## Support

If you encounter issues:
1. Check the console for errors (F12 → Console tab)
2. Verify migrations ran successfully in Supabase Dashboard
3. Ensure all environment variables are set correctly
4. Review the comprehensive documentation files in this directory
