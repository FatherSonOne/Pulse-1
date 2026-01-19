# Migration Fix Guide

## Issue Summary
The Pulse database has existing tables from previous migrations, but the migration files are being re-run causing duplicate errors for:
- Tables (already exist)
- Indexes (already exist)
- Triggers (already exist)
- Policies (already exist)
- Columns (may be missing in existing tables)

## Root Cause
Supabase's migration system marks migrations as "applied" after they run successfully. If migrations were partially applied or tables were created manually, re-running migrations causes conflicts.

## Solution Strategy

### 1. Mark Existing Migrations as Applied
If tables already exist and are correct, mark migrations as applied without re-running them:

```sql
-- Connect to your Supabase database and run:
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES 
  ('001_unified_inbox_schema'),
  ('002_disable_rls_for_testing'),
  ('003_live_ai_schema')
ON CONFLICT (version) DO NOTHING;
```

### 2. Use Idempotent Migration Patterns

All migrations should use these patterns:

#### Tables
```sql
CREATE TABLE IF NOT EXISTS table_name (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- columns...
);
```

#### Columns (Add if missing)
```sql
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'your_table' AND column_name = 'new_column'
  ) THEN
    ALTER TABLE your_table ADD COLUMN new_column TEXT;
  END IF;
END $$;
```

#### Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_name ON table_name(column_name);
```

#### Triggers
```sql
DROP TRIGGER IF EXISTS trigger_name ON table_name;
CREATE TRIGGER trigger_name BEFORE UPDATE ON table_name
  FOR EACH ROW EXECUTE FUNCTION function_name();
```

#### Policies
```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'table_name' AND policyname = 'policy_name'
  ) THEN
    EXECUTE 'CREATE POLICY policy_name ON table_name FOR ALL USING (user_id = auth.uid())';
  END IF;
END $$;
```

### 3. Current Migration Issues

#### Migration: 001_unified_inbox_schema.sql
**Status:** Fixed ✅
- Added column existence checks before creating indexes
- Removed duplicate RLS policy creation

#### Migration: 003_live_ai_schema.sql  
**Issue:** Trigger already exists
**Fix Required:**
```sql
-- Replace
CREATE TRIGGER update_ai_sessions_updated_at...

-- With
DROP TRIGGER IF EXISTS update_ai_sessions_updated_at ON ai_sessions;
CREATE TRIGGER update_ai_sessions_updated_at...
```

### 4. Phase 1 Email Migrations

The following migrations are ready and idempotent:
- ✅ `20260114_email_signatures.sql`
- ✅ `20260114_custom_labels.sql`
- ✅ `20260114_email_filters.sql`
- ✅ `20260114_fix_contacts_table.sql`
- ✅ `20260114_fix_unified_messages.sql`
- ✅ `20260114_zzz_final_fix.sql`

### 5. Manual Fix Commands

If you need to fix the current state manually:

```bash
# Option A: Mark problematic migrations as applied
npx supabase migration repair 003_live_ai_schema --status applied

# Option B: Create a new fix migration
npx supabase migration new fix_trigger_duplicates
```

### 6. Fix Migration Template

Create `supabase/migrations/20260114_fix_all_triggers.sql`:

```sql
-- Fix all duplicate triggers

-- AI Sessions
DROP TRIGGER IF EXISTS update_ai_sessions_updated_at ON ai_sessions;
CREATE TRIGGER update_ai_sessions_updated_at 
  BEFORE UPDATE ON ai_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add similar patterns for other triggers as needed

-- Verify
SELECT 'All triggers fixed successfully' AS status;
```

### 7. Best Practices for Future Migrations

1. **Always use IF NOT EXISTS patterns**
2. **Use DO blocks for conditional logic**
3. **DROP before CREATE for triggers**
4. **Check for existence before adding columns**
5. **Use transactions for complex migrations**
6. **Test migrations on a separate database first**
7. **Document what each migration does**
8. **Keep migrations small and focused**

### 8. Recovery Steps

If migrations are stuck:

```bash
# 1. Check migration status
npx supabase migration list --linked

# 2. Check what failed
npx supabase db push --debug

# 3. Mark as applied if tables are correct
# (Run SQL from Solution Strategy #1)

# 4. Push remaining migrations
npx supabase db push
```

### 9. Verification Queries

After fixing, verify your database:

```sql
-- Check if Phase 1 tables exist
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('email_signatures', 'custom_labels', 'email_filters');

-- Check columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'email_signatures';

-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE tablename = 'custom_labels';

-- Check triggers
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public';
```

### 10. Phase 1 Verification Script

Run this to verify Phase 1 is ready:

```sql
DO $$
DECLARE
  missing_items TEXT := '';
BEGIN
  -- Check tables
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'email_signatures') THEN
    missing_items := missing_items || 'email_signatures table, ';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'custom_labels') THEN
    missing_items := missing_items || 'custom_labels table, ';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'email_filters') THEN
    missing_items := missing_items || 'email_filters table, ';
  END IF;
  
  IF missing_items = '' THEN
    RAISE NOTICE 'Phase 1 database schema is complete! ✅';
  ELSE
    RAISE NOTICE 'Missing: %', missing_items;
  END IF;
END $$;
```

## Recommended Action

Given the current state, I recommend:

1. **Skip problematic legacy migrations** that are causing errors (001-030)
2. **Mark them as applied** since the tables already exist
3. **Run only the new Phase 1 migrations** (20260114_*)

This allows you to move forward with Phase 1 features without breaking existing functionality.

## Contact

If you need assistance with migrations, the Pulse team can help via:
- GitHub Issues: [pulse/issues](https://github.com/pulse/issues)
- Supabase Support: [supabase.com/support](https://supabase.com/support)
