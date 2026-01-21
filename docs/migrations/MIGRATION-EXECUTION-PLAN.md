# Database Migration Execution Plan

## Overview

This document outlines the strategy, procedures, and rollback plans for executing database migrations during production deployment.

## Migration Strategy

### Zero-Downtime Migration Approach

We use a **phased rollout** strategy to minimize downtime:

1. **Backward Compatible Changes** - New schema supports old and new code
2. **Code Deployment** - Deploy application code that works with both schemas
3. **Data Migration** - Migrate data incrementally
4. **Cleanup** - Remove old schema after verification

### Migration Types

1. **Additive Migrations** (Zero downtime)
   - Adding new tables
   - Adding new columns with defaults
   - Adding new indexes (with CONCURRENT in PostgreSQL)
   - Adding new constraints

2. **Modifying Migrations** (Requires planning)
   - Renaming columns
   - Changing column types
   - Modifying constraints
   - Restructuring relationships

3. **Destructive Migrations** (High risk)
   - Dropping tables
   - Dropping columns
   - Removing indexes
   - Deleting data

## Pre-Migration Checklist

Before executing any migration:

- [ ] Database backup completed and verified
- [ ] Migration tested in development environment
- [ ] Migration tested in staging environment
- [ ] Rollback procedure documented and tested
- [ ] Team notified of migration window
- [ ] Monitoring dashboards prepared
- [ ] Rollback scripts prepared and tested
- [ ] Maintenance window scheduled (if needed)
- [ ] Stakeholders notified

## Current Database Schema

### Existing Tables (via Supabase)

```sql
-- Users (managed by Supabase Auth)
auth.users

-- Pulse-specific tables
public.messages
public.briefings
public.decisions
public.tasks
public.user_preferences
public.integrations
```

## Migration Execution Steps

### Phase 1: Preparation (T-24 hours)

1. **Create Full Backup**
   ```bash
   # Supabase automatic backups are enabled
   # Create manual backup via Supabase Dashboard
   # Or using pg_dump:
   pg_dump -h db.project.supabase.co -U postgres -d postgres > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Verify Backup Integrity**
   ```bash
   # Check backup file size and contents
   ls -lh backup_*.sql
   head -n 100 backup_*.sql
   ```

3. **Test Migration on Staging**
   ```bash
   # Apply migration to staging database
   psql -h staging-db.supabase.co -U postgres -f migrations/001_add_analytics_tables.sql

   # Verify staging functionality
   ./scripts/verify-migration.sh staging
   ```

### Phase 2: Migration Execution (T-0)

1. **Enable Maintenance Mode (if needed)**
   ```bash
   # For critical migrations only
   # Set environment variable to show maintenance page
   export MAINTENANCE_MODE=true
   ```

2. **Execute Migration**
   ```sql
   -- Connect to production database
   psql -h db.project.supabase.co -U postgres -d postgres

   -- Start transaction
   BEGIN;

   -- Execute migration
   \i migrations/001_add_analytics_tables.sql

   -- Verify changes
   \dt
   \d table_name

   -- Commit if everything looks good
   COMMIT;

   -- Rollback if issues detected
   -- ROLLBACK;
   ```

3. **Verify Migration**
   ```bash
   # Run verification script
   ./scripts/verify-migration.sh production

   # Check application functionality
   ./scripts/smoke-test.sh https://pulse.yourdomain.com
   ```

4. **Disable Maintenance Mode**
   ```bash
   export MAINTENANCE_MODE=false
   ```

### Phase 3: Monitoring (T+0 to T+24 hours)

1. **Monitor Error Rates**
   - Check Sentry for database errors
   - Monitor application logs
   - Watch for query timeouts

2. **Monitor Performance**
   - Database query response times
   - Connection pool utilization
   - Index usage

3. **Validate Data Integrity**
   ```sql
   -- Run integrity checks
   SELECT COUNT(*) FROM new_table;
   SELECT * FROM new_table LIMIT 10;

   -- Verify relationships
   SELECT COUNT(*) FROM new_table t1
   LEFT JOIN related_table t2 ON t1.id = t2.new_table_id
   WHERE t2.id IS NULL;
   ```

## Migration Scripts

### Example Migration: Add Analytics Tables

```sql
-- migrations/001_add_analytics_tables.sql

BEGIN;

-- Create analytics events table
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_name VARCHAR(255) NOT NULL,
    event_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_id VARCHAR(255),
    user_agent TEXT,
    ip_address INET
);

-- Create indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_events_user_id
    ON public.analytics_events(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_events_event_name
    ON public.analytics_events(event_name);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_events_created_at
    ON public.analytics_events(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can insert their own analytics events"
    ON public.analytics_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own analytics events"
    ON public.analytics_events FOR SELECT
    USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT ON public.analytics_events TO authenticated;

COMMIT;
```

### Rollback Script

```sql
-- rollback/001_rollback_analytics_tables.sql

BEGIN;

-- Drop policies
DROP POLICY IF EXISTS "Users can view their own analytics events"
    ON public.analytics_events;
DROP POLICY IF EXISTS "Users can insert their own analytics events"
    ON public.analytics_events;

-- Drop indexes
DROP INDEX IF EXISTS public.idx_analytics_events_created_at;
DROP INDEX IF EXISTS public.idx_analytics_events_event_name;
DROP INDEX IF EXISTS public.idx_analytics_events_user_id;

-- Drop table
DROP TABLE IF EXISTS public.analytics_events;

COMMIT;
```

## Rollback Procedures

### Immediate Rollback (< 1 hour after migration)

If issues are detected immediately:

```bash
# 1. Execute rollback script
psql -h db.project.supabase.co -U postgres -f rollback/001_rollback_analytics_tables.sql

# 2. Verify rollback
./scripts/verify-migration.sh production --rollback

# 3. Redeploy previous application version
git checkout <previous-tag>
vercel --prod

# 4. Notify team
echo "Migration rolled back due to: <reason>"
```

### Delayed Rollback (> 1 hour after migration)

If issues are detected after some time:

```bash
# 1. Assess data created in new tables
psql -h db.project.supabase.co -U postgres -c "SELECT COUNT(*) FROM new_table"

# 2. Export new data if needed
pg_dump -h db.project.supabase.co -U postgres -t new_table > new_data_backup.sql

# 3. Execute rollback
psql -h db.project.supabase.co -U postgres -f rollback/001_rollback_analytics_tables.sql

# 4. Restore from backup if needed
psql -h db.project.supabase.co -U postgres < backup_20260120_143000.sql
```

## Data Migration Strategies

### Strategy 1: Single Transaction (Small datasets)

```sql
BEGIN;

-- Add new column
ALTER TABLE messages ADD COLUMN priority INTEGER DEFAULT 0;

-- Migrate data
UPDATE messages SET priority =
    CASE
        WHEN urgent = true THEN 1
        ELSE 0
    END;

-- Remove old column
ALTER TABLE messages DROP COLUMN urgent;

COMMIT;
```

### Strategy 2: Batch Processing (Large datasets)

```sql
-- Add new column first
ALTER TABLE messages ADD COLUMN priority INTEGER DEFAULT 0;

-- Migrate in batches (run multiple times)
DO $$
DECLARE
    batch_size INTEGER := 1000;
    rows_affected INTEGER;
BEGIN
    LOOP
        UPDATE messages
        SET priority = CASE WHEN urgent = true THEN 1 ELSE 0 END
        WHERE priority = 0 AND urgent IS NOT NULL
        LIMIT batch_size;

        GET DIAGNOSTICS rows_affected = ROW_COUNT;
        EXIT WHEN rows_affected = 0;

        RAISE NOTICE 'Migrated % rows', rows_affected;
        PERFORM pg_sleep(0.1); -- Pause between batches
    END LOOP;
END $$;

-- After migration is complete and verified:
ALTER TABLE messages DROP COLUMN urgent;
```

### Strategy 3: Background Job (Very large datasets)

```javascript
// scripts/migrate-data.js
async function migrateData() {
  const batchSize = 1000;
  let offset = 0;
  let migrated = 0;

  while (true) {
    const { data, error } = await supabase
      .from('messages')
      .select('id, urgent')
      .range(offset, offset + batchSize - 1)
      .is('priority', null);

    if (error || !data || data.length === 0) break;

    const updates = data.map(msg => ({
      id: msg.id,
      priority: msg.urgent ? 1 : 0
    }));

    await supabase
      .from('messages')
      .upsert(updates);

    migrated += data.length;
    offset += batchSize;

    console.log(`Migrated ${migrated} records...`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`Migration complete: ${migrated} total records`);
}
```

## Monitoring During Migration

### Key Metrics to Watch

1. **Database Performance**
   ```sql
   -- Active connections
   SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

   -- Long-running queries
   SELECT pid, now() - pg_stat_activity.query_start AS duration, query
   FROM pg_stat_activity
   WHERE state = 'active' AND now() - pg_stat_activity.query_start > interval '5 minutes';

   -- Table sizes
   SELECT schemaname, tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
   FROM pg_tables WHERE schemaname = 'public';
   ```

2. **Application Errors**
   - Monitor Sentry for database-related errors
   - Check application logs for connection issues
   - Watch for timeout errors

3. **User Impact**
   - Monitor active users (should remain stable)
   - Check support ticket queue
   - Monitor user feedback channels

## Post-Migration Tasks

After successful migration:

1. [ ] Update database documentation
2. [ ] Update schema diagrams
3. [ ] Archive migration scripts
4. [ ] Document any issues encountered
5. [ ] Update team on completion
6. [ ] Schedule backup retention review
7. [ ] Remove any temporary migration code

## Emergency Contacts

**Database Issues:**
- DBA On-Call: +1-XXX-XXX-XXXX
- DevOps Team: devops@yourdomain.com
- Supabase Support: support@supabase.com

**Escalation Path:**
1. Engineering Team Lead
2. CTO
3. Supabase Enterprise Support

## References

- [Supabase Migration Guide](https://supabase.com/docs/guides/database/migrations)
- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [Zero-Downtime Migrations](https://stripe.com/blog/online-migrations)

---

**Last Updated:** 2026-01-20
**Version:** 1.0.0
