# Apply Analytics Migrations to Supabase

## Quick Method: Supabase Dashboard

1. Go to your Supabase Dashboard: https://app.supabase.com/project/ucaeuszgoihoyrvhewxk

2. Navigate to **SQL Editor** in the left sidebar

3. Click "New Query"

4. Copy and paste the entire contents of `apply-all-analytics-migrations.sql`

5. Click "Run" or press Ctrl+Enter

6. Verify success - you should see:
   ```
   Success. No rows returned
   ```

## Verification

After running, verify the tables were created:

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

Expected: 9 rows returned

## Tables Created

### Migration 038: Relationship Health
- `relationship_health` - Main health tracking table
- Function: `calculate_relationship_health_score()`

### Migration 039: Conflict Detection
- `conflict_tracking` - Conflict tracking table
- `hot_topics` - Hot topics aggregation

### Migration 040: Recognition & Kudos
- `recognition_events` - Recognition event log
- `recognition_summary` - Aggregated recognition stats
- `wins_tracker` - Personal wins tracking

### Migration 041: Predictive Analytics
- `predictions_cache` - AI prediction results
- `ml_training_data` - ML model training data
- `burnout_indicators` - Burnout risk tracking

## Security Features

All tables include:
- Row Level Security (RLS) enabled
- User-scoped policies (users can only access their own data)
- Proper indexes for query performance
- Foreign key constraints to auth.users
- Cascade deletes when users are removed

## Troubleshooting

If you get an error about existing tables:
- The migrations use `CREATE TABLE IF NOT EXISTS` - they're safe to re-run
- The migrations use `DROP POLICY IF EXISTS` before creating policies
- All operations are idempotent

If RLS policies conflict:
- The script drops existing policies before recreating them
- This ensures clean policy definitions
