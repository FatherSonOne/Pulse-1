# Privacy Dashboard - Quick Start Guide

## 🚀 Quick Setup (5 Minutes)

### Step 1: Install Dependencies
```bash
npm install jszip
npm install --save-dev @types/jszip
```

### Step 2: Run Database Migration

**Using Supabase Dashboard:**
1. Open https://app.supabase.com/project/_/sql
2. Copy contents of `supabase/migrations/042_data_export_privacy.sql`
3. Click "Run"
4. Verify success in output

**Using Supabase CLI:**
```bash
cd supabase
supabase migration up
```

### Step 3: Verify Setup

Check tables created:
```sql
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('data_exports', 'data_deletion_requests', 'activity_logs');
```

Check storage bucket:
```sql
SELECT * FROM storage.buckets WHERE id = 'data-exports';
```

---

## 📦 What You Got

### Services Ready to Use

```typescript
// Data Export Service
import { dataExportService } from './services/dataExportService';

// Data Privacy Service
import { dataPrivacyService } from './services/dataPrivacyService';
```

### Database Tables

- `data_exports` - Export tracking and download history
- `data_deletion_requests` - Deletion workflow with confirmation
- `activity_logs` - Privacy audit trail

### Storage Bucket

- `data-exports` - Stores ZIP files with user data

---

## 🎯 Common Usage

### Export User Data

```typescript
// Request export
const { data: { user } } = await supabase.auth.getUser();

const exportRequest = await dataExportService.requestExport(user.id, {
  exportType: 'full_export',
  includeAttachments: false
});

// Check history
const history = await dataExportService.getExportHistory(user.id);

// Download when ready
if (exportRequest.status === 'completed') {
  window.open(exportRequest.file_url, '_blank');
}
```

### Delete User Data

```typescript
// Request deletion
const { data: { user } } = await supabase.auth.getUser();

const deletionRequest = await dataPrivacyService.requestDeletion(
  user.id,
  user.email,
  {
    deletionType: 'full_account',
    confirmationEmail: true
  }
);

// User receives email with confirmation link
// After clicking link:
const confirmed = await dataPrivacyService.confirmDeletion(token);
```

### View Activity Logs

```typescript
const { data: { user } } = await supabase.auth.getUser();
const logs = await dataPrivacyService.getActivityLogs(user.id, 50);

// Display logs
logs.forEach(log => {
  console.log(`${log.action_type}: ${log.action_detail}`);
});
```

---

## 🔧 Integration with PrivacyDashboard

### Add Imports (Line ~10)

```typescript
import { dataExportService, type ExportType } from '../../services/dataExportService';
import { dataPrivacyService, type DeletionType } from '../../services/dataPrivacyService';
```

### Add State (Line ~50)

```typescript
const [exportInProgress, setExportInProgress] = useState(false);
const [deletionInProgress, setDeletionInProgress] = useState(false);
```

### Add Functions (After loadSecurityData)

```typescript
const loadExportHistory = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const exports = await dataExportService.getExportHistory(user.id);
  setDownloadHistory(exports.map(exp => ({
    id: exp.id,
    type: exp.export_type,
    size: dataExportService.formatFileSize(exp.file_size_bytes || 0),
    timestamp: new Date(exp.created_at),
    status: exp.status,
    url: exp.file_url
  })));
};

const loadActivityLogs = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const logs = await dataPrivacyService.getActivityLogs(user.id, 50);
  setActivityLog(logs);
};
```

### Update useEffect (Line ~65)

```typescript
useEffect(() => {
  if (!isOpen) return;
  loadServicesAndActivity();
  loadSecurityData();
  loadExportHistory();     // ADD
  loadActivityLogs();      // ADD
}, [isOpen]);
```

### Update Export Button (Find in Privacy Tab)

```typescript
<button onClick={() => handleExportData('full_export')}>
  Export Your Data
</button>
```

### Update Delete Button (Find in Privacy Tab)

```typescript
<button onClick={() => handleDeleteData('full_account')}>
  Delete Your Data
</button>
```

---

## 📊 Export File Structure

When users download an export, they receive:

```
export_abc123.zip
├── README.txt          # Instructions for user
├── metadata.json       # Export info & statistics
├── settings.json       # User preferences
├── contacts.json       # Contact list (JSON)
├── contacts.csv        # Contact list (Excel-compatible)
├── calendar.json       # Calendar events (JSON)
├── calendar.csv        # Calendar events (Excel-compatible)
├── messages.json       # Chat messages
└── emails.json         # Email data
```

---

## 🔒 Security Features

✅ **Row Level Security** - Users only see their own data
✅ **Private Storage** - Download links expire after 7 days
✅ **Confirmation Workflow** - Email confirmation for deletions
✅ **Activity Logging** - All actions tracked for audit
✅ **IP Tracking** - Security audit trail
✅ **Auto Cleanup** - Exports expire after 30 days

---

## 🧪 Testing

### Test Export
1. Click "Export Your Data" in Privacy Dashboard
2. Wait 2-3 seconds for processing
3. Refresh download history
4. Click Download button
5. Verify ZIP file contents

### Test Deletion
1. Click "Delete Your Data" in Privacy Dashboard
2. Confirm in popup dialog
3. Check console for confirmation token (email integration pending)
4. Use token to confirm deletion
5. Verify data deleted from database

---

## ⚠️ Important Notes

**Email Confirmation (Placeholder)**
Currently confirmation emails are logged to console. To implement:
- Integrate with SendGrid, Postmark, or similar
- Create email templates
- Update `sendConfirmationEmail()` function

**API Integrations (Future)**
Gmail/Calendar/Contacts export/deletion requires:
- Google API client setup
- OAuth token management
- API quota management

**Scheduled Jobs Needed**
Set up cron jobs for:
- Daily: Clean up expired exports
- Weekly: Clean up old activity logs (90+ days)

---

## 📚 Documentation

**Full Documentation:** `PRIVACY_DASHBOARD_README.md`
**API Reference:** See inline comments in service files
**Troubleshooting:** Check README troubleshooting section

---

## 🆘 Quick Troubleshooting

**Export not working?**
- Check browser console
- Verify storage bucket exists
- Check RLS policies in Supabase

**Download failing?**
- Check if export status is 'completed'
- Verify signed URL hasn't expired
- Check storage permissions

**Deletion not processing?**
- Verify confirmation token
- Check deletion request status
- Review foreign key constraints

---

## ✅ Completion Checklist

Setup:
- [ ] Installed JSZip dependency
- [ ] Ran database migration
- [ ] Verified tables created
- [ ] Verified storage bucket exists

Integration:
- [ ] Added service imports
- [ ] Added state variables
- [ ] Added load functions
- [ ] Updated useEffect
- [ ] Updated button handlers

Testing:
- [ ] Tested full export
- [ ] Tested partial export
- [ ] Tested deletion request
- [ ] Verified activity logs
- [ ] Checked download history

Production:
- [ ] Set up email service
- [ ] Configure cron jobs
- [ ] Set up monitoring
- [ ] Review security policies

---

**Need Help?** Check `PRIVACY_DASHBOARD_README.md` for detailed documentation.

**Version:** 1.0.0
**Date:** 2026-02-06
