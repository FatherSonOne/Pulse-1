# Database Migrations for Pulse API

This directory contains SQL migrations for the Pulse Supabase database to support Logos Vision CRM integration.

## Quick Start - Manual Migration (Recommended)

Since Supabase doesn't support programmatic SQL execution via the JS client, you'll need to run these migrations manually through the Supabase SQL Editor.

### Step 1: Get Your Pulse Supabase Project URL

Your Pulse Supabase URL: `https://ucaeuszgoihoyrvhewxk.supabase.co`

### Step 2: Open Supabase SQL Editor

1. Go to: https://app.supabase.com
2. Select your project: `ucaeuszgoihoyrvhewxk`
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New query**

### Step 3: Run Migration 001 - Google Contacts Sync Jobs Table

1. Open the file: `001_google_contacts_sync_jobs.sql`
2. Copy the entire contents
3. Paste into the Supabase SQL Editor
4. Click **Run** or press `Ctrl+Enter`

**Expected Result:**
```
Success. No rows returned
```

This migration creates:
- ✅ `google_contacts_sync_jobs` table
- ✅ Indexes for performance
- ✅ RLS policies for security
- ✅ Trigger for auto-updating timestamps
- ✅ Service role permissions

### Step 4: Run Migration 002 - Relationship Profiles API Access

1. Open the file: `002_relationship_profiles_api_access.sql`
2. Copy the entire contents
3. Paste into the Supabase SQL Editor
4. Click **Run** or press `Ctrl+Enter`

**Expected Result:**
```
Success. No rows returned
```

This migration creates:
- ✅ Service role policies on `relationship_profiles` table
- ✅ API access permissions for profile creation/updates
- ✅ Bypasses RLS for API operations

### Step 5: Verify Migrations

Run this query in the SQL Editor to verify tables exist:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('google_contacts_sync_jobs', 'relationship_profiles')
ORDER BY table_name;
```

**Expected Result:**
```
table_name
---------------------------
google_contacts_sync_jobs
relationship_profiles
```

### Step 6: Update Pulse Server to Use Service Role Key (Optional)

For the enrichment endpoint to work without user authentication, update your server to use the service role key for Logos Vision API operations.

**Add to F:\pulse1\.env.local:**
```env
# Supabase Service Role Key (for API operations that bypass RLS)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**Get your service role key:**
1. Go to Supabase Dashboard → Settings → API
2. Copy the **service_role** key (not the anon key)
3. Add it to .env.local

**Update F:\pulse1\server.js** to use service role for Logos Vision endpoints:
```javascript
// For Logos Vision API endpoints, use service role
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// In verifyLogosVisionAuth middleware, create client with service role:
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
```

---

## Migration Files

### 001_google_contacts_sync_jobs.sql
Creates the sync jobs table for tracking Google Contacts sync operations.

**Tables Created:**
- `google_contacts_sync_jobs` - Tracks sync job status, progress, and results

**Features:**
- Auto-generated UUID primary keys
- Status tracking (pending, in_progress, completed, failed)
- Progress counters (total, synced, failed, skipped)
- Filter configuration (label, domain)
- Error tracking and results storage
- RLS policies for user data isolation
- Service role bypass for API operations

### 002_relationship_profiles_api_access.sql
Configures RLS policies for API access to relationship profiles.

**Policies Created:**
- Service role full access (bypasses RLS)
- API profile creation policy
- API profile update policy

**Purpose:**
Allows the Pulse API server to create and update relationship profiles without user authentication, enabling the enrichment endpoint to work.

---

## Programmatic Migration (Advanced)

If you want to run migrations programmatically, you can use the migration runner script, but you'll need the service role key.

### Prerequisites

Add to `.env.local`:
```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### Run Migrations

```bash
cd F:\pulse1
node migrations/run-migrations.js
```

**Note:** This requires the service role key and may not work with all Supabase configurations. Manual migration via SQL Editor is more reliable.

---

## Rollback

If you need to rollback these migrations:

```sql
-- Rollback 002
DROP POLICY IF EXISTS "Service role can manage all profiles" ON public.relationship_profiles;
DROP POLICY IF EXISTS "API can create profiles" ON public.relationship_profiles;
DROP POLICY IF EXISTS "API can update profiles" ON public.relationship_profiles;

-- Rollback 001
DROP TRIGGER IF EXISTS update_google_contacts_sync_jobs_updated_at ON public.google_contacts_sync_jobs;
DROP FUNCTION IF EXISTS public.update_google_contacts_sync_jobs_updated_at();
DROP TABLE IF EXISTS public.google_contacts_sync_jobs;
```

---

## Troubleshooting

### Error: "permission denied for table"
**Solution:** Make sure you're logged in as the project owner or have sufficient permissions.

### Error: "relation already exists"
**Solution:** The table already exists. Skip that migration or drop it first.

### Error: "policy already exists"
**Solution:** The policy already exists. Skip or use `DROP POLICY IF EXISTS` first.

---

## Next Steps After Migration

1. ✅ Restart Pulse API server: `node server.js`
2. ✅ Test sync endpoint: `curl -X POST -H "X-API-Key: logos_vision_pulse_shared_secret_2026" -H "Content-Type: application/json" -d '{"workspace_id":"test","filter":{}}' http://localhost:3003/api/logos-vision/sync`
3. ✅ Test sync status: `curl -H "X-API-Key: logos_vision_pulse_shared_secret_2026" http://localhost:3003/api/logos-vision/sync/SYNC_ID/status`
4. ✅ Test enrichment: `curl -X POST -H "X-API-Key: logos_vision_pulse_shared_secret_2026" -H "Content-Type: application/json" -d '{"name":"Test","company":"Acme"}' http://localhost:3003/api/logos-vision/contacts/test@example.com/enrich`

---

**Created:** 2026-01-26
**For:** Logos Vision CRM - Pulse API Integration (Phase 3)
