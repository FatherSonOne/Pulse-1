# Tasks Schema Fix - workspace_id Missing Column

## Problem

The error you're seeing:
```
column tasks.workspace_id does not exist
```

## Root Cause

**Schema Mismatch**: The `tasks` table in your database doesn't have a `workspace_id` column, but your TypeScript service code expects it.

### Current Database Schema
```sql
CREATE TABLE tasks (
  id uuid,
  user_id text NOT NULL,        -- ✅ EXISTS
  -- workspace_id MISSING!       -- ❌ MISSING
  title text NOT NULL,
  completed boolean,
  ...
)
```

### What Your Code Expects
```typescript
// src/services/taskService.ts:126
.eq('workspace_id', workspaceId)  // ❌ This column doesn't exist!
```

### Comparison with Decisions Table
The `decisions` table **correctly has** `workspace_id`:
```sql
CREATE TABLE decisions (
  id uuid,
  workspace_id uuid,  -- ✅ Has workspace_id
  ...
)
```

## Solution

### Step 1: Add workspace_id Column to Tasks Table

Run this SQL migration in your Supabase SQL Editor:

```sql
-- File: docs/fix_tasks_workspace_id.sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN workspace_id UUID;

    -- For dev/testing: set workspace_id to first user's id
    UPDATE public.tasks
    SET workspace_id = (SELECT id FROM auth.users LIMIT 1)
    WHERE workspace_id IS NULL;

    RAISE NOTICE 'Added workspace_id column to tasks table';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_workspace_id ON public.tasks(workspace_id);
```

### Step 2: Run AI Enhancements Migration

After adding `workspace_id`, run the AI enhancements:

```sql
-- File: docs/database_migration_ai_enhancements_fixed.sql
-- This adds AI columns like ai_priority_score, ai_suggested_assignee, etc.
```

### Step 3: Insert Sample Data

Use the FIXED sample data file:

```sql
-- File: docs/sample_data_FIXED.sql
-- This correctly includes workspace_id in all INSERT statements
```

## Execution Order

1. **First**: Run `fix_tasks_workspace_id.sql` (adds workspace_id column)
2. **Second**: Run `database_migration_ai_enhancements_fixed.sql` (adds AI columns)
3. **Third**: Run `sample_data_FIXED.sql` (inserts test data)

## Verification

After running the migrations, verify the fix:

```sql
-- Check that workspace_id column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tasks'
  AND column_name = 'workspace_id';

-- Expected result:
-- column_name   | data_type | is_nullable
-- workspace_id  | uuid      | YES

-- Check that tasks can be queried by workspace_id
SELECT COUNT(*) FROM tasks WHERE workspace_id IS NOT NULL;
```

## Why This Happened

Your application uses a **workspace-based architecture** where:
- Decisions are scoped to workspaces ✅
- Tasks should also be scoped to workspaces ❌ (but weren't)

The `tasks` table schema was incomplete and only tracked `user_id`, not `workspace_id`.

## Quick Fix Commands

If you have Supabase CLI access:

```bash
# 1. Add workspace_id column
supabase db push docs/fix_tasks_workspace_id.sql

# 2. Add AI enhancements
supabase db push docs/database_migration_ai_enhancements_fixed.sql

# 3. Insert sample data
supabase db push docs/sample_data_FIXED.sql
```

Or manually in Supabase Dashboard:
1. Go to SQL Editor
2. Copy contents of each file
3. Run in order listed above

## After the Fix

Your DecisionTaskHub component should now load tasks without errors:

```typescript
// This will now work:
const tasks = await taskService.getWorkspaceTasks(workspaceId);
```

## Files Reference

- `fix_tasks_workspace_id.sql` - Adds workspace_id column
- `database_migration_ai_enhancements_fixed.sql` - Adds AI columns
- `sample_data_FIXED.sql` - Sample data with workspace_id
- `sample_data_WORKING.sql` - ❌ OLD (doesn't include workspace_id in tasks)
