# Analytics Enhancement - Deployment Guide

## Current Status

✅ **Phase 1 Complete:** All 4 database migration files created
⏳ **Deployment Pending:** Awaiting manual deployment to Supabase

## Quick Deploy (2 minutes)

### Step 1: Open SQL Editor
Click this link: https://app.supabase.com/project/ucaeuszgoihoyrvhewxk/sql/new

### Step 2: Copy SQL
Open file: `f:\pulse1\apply-all-analytics-migrations.sql` in your text editor

Select All (Ctrl+A), Copy (Ctrl+C)

### Step 3: Execute
1. Paste into Supabase SQL Editor (Ctrl+V)
2. Click "RUN" button (or Ctrl+Enter)
3. Wait for "Success. No rows returned" message

### Step 4: Verify
Run this query in the same SQL Editor:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'relationship_health',
  'conflict_tracking',
  'hot_topics',
  'recognition_events',
  'recognition_summary',
  'wins_tracker',
  'predictions_cache',
  'ml_training_data',
  'burnout_indicators'
)
ORDER BY table_name;
```

You should see 9 tables listed.

## What Gets Deployed

### 9 New Analytics Tables

1. **relationship_health** - Track relationship metrics and health scores
2. **conflict_tracking** - Log and track conflicts
3. **hot_topics** - Aggregate recurring conflict topics
4. **recognition_events** - Log recognition and kudos
5. **recognition_summary** - Aggregated appreciation metrics
6. **wins_tracker** - Personal achievements
7. **predictions_cache** - AI prediction results
8. **ml_training_data** - ML model training data
9. **burnout_indicators** - Burnout risk assessment

### 1 Database Function

- **calculate_relationship_health_score()** - Calculates weighted relationship health

### Security Features

- All tables have Row Level Security (RLS) enabled
- Users can only access their own data
- Proper foreign key constraints
- Optimized indexes for performance

## Troubleshooting

**Error: "relation already exists"**
- Safe to ignore - migrations use `CREATE TABLE IF NOT EXISTS`

**Error: "policy already exists"**
- Safe to ignore - migrations drop policies before recreating

**Error: "permission denied"**
- Ensure you're logged in as project owner/admin

## After Deployment

Once deployed successfully:

1. Verify tables exist (run verification query above)
2. Commit migration files to git:
   ```bash
   git add supabase/migrations/*.sql
   git add apply-all-analytics-migrations.sql
   git commit -m "feat(db): add analytics enhancement database schema"
   ```
3. Proceed to Phase 2: Backend Services

## Files Reference

| File | Purpose |
|------|---------|
| `apply-all-analytics-migrations.sql` | **Deploy this file** - Contains all 4 migrations |
| `supabase/migrations/038_relationship_health.sql` | Individual migration file |
| `supabase/migrations/039_conflict_detection.sql` | Individual migration file |
| `supabase/migrations/040_recognition_kudos.sql` | Individual migration file |
| `supabase/migrations/041_predictive_analytics.sql` | Individual migration file |
| `APPLY_MIGRATIONS.md` | Detailed deployment instructions |
| `MIGRATION_STATUS.md` | Migration status and details |
| `PHASE_1_COMPLETE.md` | Phase 1 completion summary |

## Need Help?

If deployment fails:
1. Check Supabase Dashboard logs
2. Verify you have admin access
3. Try deploying individual migration files one at a time
4. Contact Supabase support if database permissions are locked

---

**Ready to deploy?** Follow Steps 1-4 above!
