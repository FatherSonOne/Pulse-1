# Privacy Dashboard - Data Export & Management System

## Overview

Comprehensive backend integration for Pulse's Privacy Dashboard, implementing GDPR-compliant data export and deletion workflows with confirmation, tracking, and audit trails.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                  Privacy Dashboard UI                    │
│  (PrivacyDashboard.tsx - React Component)               │
└─────────────────┬────────────────────┬──────────────────┘
                  │                    │
                  ▼                    ▼
    ┌─────────────────────┐  ┌─────────────────────┐
    │ Data Export Service │  │ Data Privacy Service │
    │ (dataExportService) │  │ (dataPrivacyService) │
    └─────────┬───────────┘  └─────────┬───────────┘
              │                        │
              ▼                        ▼
    ┌─────────────────────────────────────────────┐
    │           Supabase Backend                   │
    │  ┌──────────────┬──────────────┬──────────┐ │
    │  │ PostgreSQL   │   Storage    │   Auth   │ │
    │  │ - data_exports│ - ZIP files │ - Users  │ │
    │  │ - deletion_req│              │          │ │
    │  │ - activity_log│              │          │ │
    │  └──────────────┴──────────────┴──────────┘ │
    └─────────────────────────────────────────────┘
```

## Database Schema

### Tables Created

#### 1. `data_exports`
Tracks user data export requests and download history.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to auth.users |
| export_type | TEXT | Type: full_export, emails_only, etc. |
| status | TEXT | Status: pending, processing, completed, failed, expired |
| file_size_bytes | BIGINT | Size of exported ZIP file |
| file_url | TEXT | Signed download URL (7-day expiry) |
| storage_path | TEXT | Path in Supabase Storage |
| expires_at | TIMESTAMPTZ | Auto-delete date (30 days) |
| downloaded_at | TIMESTAMPTZ | Last download timestamp |
| download_count | INTEGER | Number of downloads |
| error_message | TEXT | Error details if failed |
| metadata | JSONB | Additional export information |

**Indexes:**
- `idx_data_exports_user_id` - Fast user lookups
- `idx_data_exports_status` - Status filtering
- `idx_data_exports_created_at` - Chronological sorting
- `idx_data_exports_expires_at` - Cleanup queries

#### 2. `data_deletion_requests`
Tracks data deletion requests with confirmation workflow.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to auth.users |
| user_email | TEXT | User email for confirmation |
| deletion_type | TEXT | Type: full_account, activity_logs, etc. |
| status | TEXT | Status: pending_confirmation, confirmed, processing, completed, cancelled, failed |
| confirmation_token | UUID | Token for email confirmation |
| confirmation_sent_at | TIMESTAMPTZ | When confirmation email sent |
| confirmed_at | TIMESTAMPTZ | When user confirmed |
| processed_at | TIMESTAMPTZ | When deletion completed |
| items_deleted_count | INTEGER | Number of records deleted |
| error_message | TEXT | Error details if failed |
| ip_address | INET | Request origin IP (security audit) |
| user_agent | TEXT | Browser/device info (security audit) |
| metadata | JSONB | Additional deletion information |

**Indexes:**
- `idx_data_deletion_requests_user_id` - Fast user lookups
- `idx_data_deletion_requests_status` - Status filtering
- `idx_data_deletion_requests_confirmation_token` - Token verification

#### 3. `activity_logs`
Privacy audit trail tracking all user activities.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to auth.users |
| action_type | TEXT | Type: login, data_export, data_deletion, etc. |
| action_detail | TEXT | Human-readable description |
| ip_address | INET | Request origin IP |
| user_agent | TEXT | Browser/device info |
| metadata | JSONB | Additional action data |
| created_at | TIMESTAMPTZ | When action occurred |

**Indexes:**
- `idx_activity_logs_user_id` - Fast user lookups
- `idx_activity_logs_action_type` - Action filtering
- `idx_activity_logs_created_at` - Chronological sorting

### Storage Bucket

**Bucket:** `data-exports`
- Stores ZIP files containing exported user data
- Private bucket (not publicly accessible)
- RLS policies ensure users only access their own files
- Organized by user ID: `{user_id}/{export_id}.zip`

## Services Architecture

### Data Export Service (`dataExportService.ts`)

#### Key Features
- Asynchronous export processing (non-blocking)
- ZIP file generation with JSON + CSV formats
- Automatic cleanup after 30 days
- Download tracking and analytics
- Progress monitoring

#### Export Types
1. **full_export** - All user data
2. **emails_only** - Gmail data
3. **contacts_only** - Google Contacts
4. **calendar_only** - Calendar events
5. **settings_only** - User preferences
6. **messages_only** - Chat messages

#### Export Workflow
```
User Request → Create DB Record → Background Processing
                                          ↓
                          Gather Data → Generate ZIP
                                          ↓
                          Upload to Storage → Generate Signed URL
                                          ↓
                          Update DB Record → Notify User
```

#### API Methods

```typescript
// Request new export
dataExportService.requestExport(userId: string, options: {
  exportType: ExportType,
  includeAttachments?: boolean,
  dateRange?: { startDate: string, endDate: string }
}): Promise<DataExport>

// Get export history
dataExportService.getExportHistory(userId: string): Promise<DataExport[]>

// Track download
dataExportService.trackDownload(exportId: string): Promise<void>

// Delete export
dataExportService.deleteExport(exportId: string, userId: string): Promise<boolean>

// Format file size for display
dataExportService.formatFileSize(bytes: number): string
```

#### Export File Structure
```
export_123.zip/
├── metadata.json         # Export metadata and statistics
├── README.txt           # Human-readable documentation
├── settings.json        # User application settings
├── contacts.json        # Contact list (JSON format)
├── contacts.csv         # Contact list (CSV format)
├── calendar.json        # Calendar events (JSON format)
├── calendar.csv         # Calendar events (CSV format)
├── messages.json        # Chat messages
└── emails.json          # Email data (if available)
```

### Data Privacy Service (`dataPrivacyService.ts`)

#### Key Features
- Confirmation workflow for safety
- GDPR-compliant deletion
- Partial and full account deletion
- Audit trail for compliance
- Automatic activity log cleanup

#### Deletion Types
1. **full_account** - All user data across all tables
2. **activity_logs** - Privacy audit trail only
3. **messages** - Chat messages only
4. **emails** - Gmail data (via API)
5. **contacts** - Google Contacts (via API)
6. **calendar** - Calendar events (via API)

#### Deletion Workflow
```
User Request → Create Deletion Request → Send Confirmation Email
                                                ↓
                          User Clicks Link → Confirm Deletion
                                                ↓
                          Process Deletion → Delete from Tables
                                                ↓
                          Update Request → Log Activity → Complete
```

#### API Methods

```typescript
// Request deletion
dataPrivacyService.requestDeletion(userId: string, userEmail: string, options: {
  deletionType: DeletionType,
  confirmationEmail?: boolean,
  ipAddress?: string,
  userAgent?: string
}): Promise<DataDeletionRequest>

// Confirm deletion via token
dataPrivacyService.confirmDeletion(confirmationToken: string): Promise<boolean>

// Cancel pending deletion
dataPrivacyService.cancelDeletion(requestId: string, userId: string): Promise<boolean>

// Get deletion history
dataPrivacyService.getDeletionHistory(userId: string): Promise<DataDeletionRequest[]>

// Get pending deletions
dataPrivacyService.getPendingDeletions(userId: string): Promise<DataDeletionRequest[]>

// Get activity logs
dataPrivacyService.getActivityLogs(userId: string, limit: number): Promise<ActivityLog[]>

// Cleanup old activity logs (GDPR compliance)
dataPrivacyService.cleanupOldActivityLogs(retentionDays: number): Promise<number>
```

## Security Implementation

### Row Level Security (RLS)

All tables have RLS enabled with strict policies:

```sql
-- Users can only view their own data
CREATE POLICY "Users can view their own exports"
  ON data_exports FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only create data for themselves
CREATE POLICY "Users can create their own exports"
  ON data_exports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own data
CREATE POLICY "Users can update their own exports"
  ON data_exports FOR UPDATE
  USING (auth.uid() = user_id);
```

### Storage Security

Storage bucket policies ensure users can only access their own files:

```sql
-- Users can only upload to their own folder
CREATE POLICY "Users can upload their own exports"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'data-exports'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can only download from their own folder
CREATE POLICY "Users can download their own exports"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'data-exports'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### Signed URLs

Download URLs are time-limited (7 days) to prevent unauthorized access:

```typescript
const { data, error } = await supabase.storage
  .from('data-exports')
  .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days
```

## Privacy & Compliance

### GDPR Compliance

1. **Right to Access** - Users can export all their data
2. **Right to Erasure** - Users can delete all their data
3. **Data Portability** - Exports include machine-readable formats (JSON, CSV)
4. **Audit Trail** - All actions logged in activity_logs
5. **Data Retention** - Automatic cleanup after specified periods
6. **Confirmation Workflow** - Prevents accidental deletions

### Activity Logging

All privacy-related actions are logged:

```typescript
await logActivity(userId, 'data_export', 'Export completed', {
  exportId,
  exportType,
  fileSize
});

await logActivity(userId, 'data_deletion', 'Deletion requested', {
  deletionType,
  requestId
});
```

### Data Retention

- **Exports:** Auto-delete after 30 days
- **Activity Logs:** Configurable retention (default 90 days)
- **Deletion Requests:** Kept for audit trail

## Installation & Setup

### 1. Install Dependencies

```bash
npm install jszip
npm install --save-dev @types/jszip
```

### 2. Run Database Migration

**Option A: Supabase CLI**
```bash
cd supabase
supabase migration up
```

**Option B: Supabase Dashboard**
1. Go to SQL Editor
2. Copy `supabase/migrations/042_data_export_privacy.sql`
3. Execute

### 3. Verify Setup

Run verification queries from the migration file to ensure:
- Tables created with RLS enabled
- Indexes created for performance
- Storage bucket exists with correct policies

### 4. Configure Environment

Ensure Supabase environment variables are set:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Usage Examples

### Requesting Data Export

```typescript
import { dataExportService } from './services/dataExportService';

// Full export
const exportRequest = await dataExportService.requestExport(userId, {
  exportType: 'full_export',
  includeAttachments: false
});

// Partial export with date range
const emailsExport = await dataExportService.requestExport(userId, {
  exportType: 'emails_only',
  dateRange: {
    startDate: '2024-01-01',
    endDate: '2024-12-31'
  }
});

// Check export history
const history = await dataExportService.getExportHistory(userId);
```

### Requesting Data Deletion

```typescript
import { dataPrivacyService } from './services/dataPrivacyService';

// Full account deletion
const deletionRequest = await dataPrivacyService.requestDeletion(
  userId,
  userEmail,
  {
    deletionType: 'full_account',
    confirmationEmail: true
  }
);

// Partial deletion (activity logs only)
const logsRequest = await dataPrivacyService.requestDeletion(
  userId,
  userEmail,
  {
    deletionType: 'activity_logs',
    confirmationEmail: true
  }
);

// Confirm deletion (via email link)
const confirmed = await dataPrivacyService.confirmDeletion(confirmationToken);

// Cancel pending deletion
await dataPrivacyService.cancelDeletion(requestId, userId);
```

### Viewing Activity Logs

```typescript
import { dataPrivacyService } from './services/dataPrivacyService';

// Get recent activity
const logs = await dataPrivacyService.getActivityLogs(userId, 50);

// Display in UI
logs.forEach(log => {
  console.log(`${log.action_type}: ${log.action_detail} at ${log.created_at}`);
});
```

## Maintenance & Operations

### Scheduled Cleanup Jobs

Implement cron jobs for automatic cleanup:

```typescript
// Clean up expired exports (run daily)
const cleanupExports = async () => {
  const count = await dataExportService.cleanupExpiredExports();
  console.log(`Cleaned up ${count} expired exports`);
};

// Clean up old activity logs (run weekly)
const cleanupLogs = async () => {
  const count = await dataPrivacyService.cleanupOldActivityLogs(90);
  console.log(`Cleaned up ${count} old activity logs`);
};
```

### Monitoring

Key metrics to monitor:
- Export request rate
- Export success/failure rate
- Average export file size
- Storage usage
- Deletion request rate
- Activity log growth rate

### Error Handling

Services implement comprehensive error handling:

```typescript
try {
  const exportRequest = await dataExportService.requestExport(userId, options);
} catch (error) {
  if (error.code === 'STORAGE_QUOTA_EXCEEDED') {
    // Handle storage quota errors
  } else if (error.code === 'PERMISSION_DENIED') {
    // Handle permission errors
  } else {
    // Generic error handling
  }
}
```

## Performance Optimization

### Async Processing

Exports are processed asynchronously to prevent UI blocking:

```typescript
// Request is created immediately
const exportRequest = await dataExportService.requestExport(userId, options);

// Processing happens in background
processExport(exportId, userId, options).catch(console.error);

// UI can poll for status updates
const checkStatus = setInterval(async () => {
  const status = await dataExportService.getExport(exportId);
  if (status.status === 'completed') {
    clearInterval(checkStatus);
    notifyUser('Export ready!');
  }
}, 5000);
```

### Database Indexes

Indexes optimize common queries:
- User lookups: `idx_*_user_id`
- Status filtering: `idx_*_status`
- Chronological sorting: `idx_*_created_at`
- Expiration cleanup: `idx_data_exports_expires_at`

### Caching Strategy

Consider implementing caching for:
- Export history (cache for 5 minutes)
- Activity logs (cache for 1 minute)
- Deletion status (real-time, no cache)

## Troubleshooting

### Export Not Processing

**Symptoms:** Export stuck in "pending" status

**Solutions:**
1. Check browser console for errors
2. Verify Supabase Storage bucket exists
3. Check RLS policies are correct
4. Verify user has sufficient storage quota

### Deletion Not Working

**Symptoms:** Deletion request fails or stuck

**Solutions:**
1. Verify confirmation token is valid
2. Check user has correct permissions
3. Ensure deletion request status is correct
4. Check for foreign key constraints

### Activity Logs Empty

**Symptoms:** No activity logs displayed

**Solutions:**
1. Check if `activity_logs` table exists
2. Verify RLS policies allow user access
3. Ensure logging functions are being called
4. Check if logs have been auto-deleted

### Storage Errors

**Symptoms:** Upload failures or download errors

**Solutions:**
1. Verify storage bucket exists
2. Check storage policies are correct
3. Ensure signed URL hasn't expired
4. Check file size limits

## Future Enhancements

### Phase 1: Email Integration
- Send actual confirmation emails (integrate with SendGrid/Postmark)
- Email templates for export ready notifications
- Reminder emails for pending deletions

### Phase 2: API Integrations
- Gmail API for email export/deletion
- Google Calendar API for calendar data
- Google Contacts API for contact management

### Phase 3: Advanced Features
- Scheduled/recurring exports
- Export encryption with user-provided key
- Multi-format exports (PDF, Excel)
- Compression options for large exports

### Phase 4: Analytics
- Export usage dashboard
- Data retention analytics
- Privacy compliance reports
- User behavior insights

## Support & Documentation

### Additional Resources
- Supabase Documentation: https://supabase.com/docs
- JSZip Documentation: https://stuk.github.io/jszip/
- GDPR Guidelines: https://gdpr.eu/

### API Reference
See inline TypeScript documentation in service files for detailed API reference.

### Contributing
Follow the existing code patterns and ensure:
- RLS policies for all new tables
- Comprehensive error handling
- Activity logging for privacy actions
- Tests for critical paths

---

**Implementation Date:** 2026-02-06
**Backend Architect:** Claude Sonnet 4.5
**Version:** 1.0.0
