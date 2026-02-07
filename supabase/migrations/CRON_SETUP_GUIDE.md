# Data Cleanup Cron Job Setup Guide

Since Supabase doesn't have a visual Cron Jobs UI, here are your options:

## ✅ Option 1: Simple Database Function with pg_cron (RECOMMENDED)

**Best for:** Most users, no external dependencies, runs inside Supabase

### Steps:
1. Go to Supabase Dashboard → **Database** → **Extensions**
2. Search for `pg_cron` and enable it
3. Go to **SQL Editor**
4. Copy and paste the contents of `simple_cleanup_cron.sql`
5. Click **Run**

**Pros:**
- ✅ Runs entirely within Supabase
- ✅ No external services needed
- ✅ Simple to set up
- ✅ Free

**Cons:**
- ❌ Less flexible than Edge Functions
- ❌ Can't easily call external APIs

---

## Option 2: GitHub Actions Cron

**Best for:** Projects already using GitHub

### Steps:
1. Make sure the GitHub Actions workflow file exists at `.github/workflows/data-cleanup-cron.yml`
2. In your GitHub repository, go to **Settings** → **Secrets and variables** → **Actions**
3. Add these secrets:
   - `SUPABASE_URL`: Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
   - `SUPABASE_ANON_KEY`: Your Supabase anon/public key
   - `CRON_SECRET`: A random secure string (generate using the method below)
4. Commit and push the workflow file
5. The job will run automatically daily at 2 AM UTC

**Generate CRON_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Test manually:**
- Go to GitHub → **Actions** → **Data Cleanup Cron Job** → **Run workflow**

**Pros:**
- ✅ Easy to test manually
- ✅ Can call Edge Functions
- ✅ Free on public repos

**Cons:**
- ❌ Requires GitHub
- ❌ May not run if repo inactive for 60+ days

---

## Option 3: External Cron Service

**Best for:** Production apps needing guaranteed execution

### Services:
- **Vercel Cron** (if deployed on Vercel)
- **Railway Cron**
- **EasyCron** (dedicated service)
- **cron-job.org** (free)

### Setup (example with cron-job.org):
1. Go to https://cron-job.org
2. Create a free account
3. Create a new cron job:
   - **URL**: `https://your-project.supabase.co/functions/v1/data-cleanup`
   - **Schedule**: Daily at 2:00 AM
   - **Request Method**: POST
   - **Headers**:
     ```
     Authorization: Bearer YOUR_SUPABASE_ANON_KEY
     Content-Type: application/json
     ```
   - **Body**:
     ```json
     {"secret": "YOUR_CRON_SECRET"}
     ```

**Pros:**
- ✅ Most reliable
- ✅ Good monitoring/alerting

**Cons:**
- ❌ Requires external service
- ❌ May have costs for high frequency

---

## Verification

After setting up any option, verify it's working:

### Check Cleanup Logs
```sql
SELECT *
FROM public.data_cleanup_logs
ORDER BY created_at DESC
LIMIT 10;
```

### Check Active Cron Jobs (Option 1 only)
```sql
SELECT *
FROM cron.job;
```

### Manual Test (Option 1)
```sql
SELECT public.execute_data_cleanup();
```

---

## My Recommendation

**Use Option 1** (Simple Database Function with pg_cron):
- It's the simplest
- No external dependencies
- Runs automatically within Supabase
- Free forever
- Easy to monitor

Only use Options 2 or 3 if you need:
- To call external APIs during cleanup
- More complex orchestration
- Guaranteed execution monitoring

---

## Troubleshooting

### pg_cron extension not available
Some Supabase plans don't include pg_cron. If it's not available:
- Use Option 2 (GitHub Actions) instead
- Or upgrade your Supabase plan

### Cron job not running
```sql
-- Check if job exists
SELECT * FROM cron.job;

-- Check job run history
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
```

### Delete a cron job
```sql
SELECT cron.unschedule('job-name-here');
```
