# RLS Quick Reference Guide

**Last Updated**: January 20, 2026
**Phase**: 7 - Row Level Security

## At a Glance

### What is RLS?
Row Level Security (RLS) is PostgreSQL's database-level access control that filters query results based on the authenticated user. Every query automatically includes `WHERE user_id = auth.uid()` logic.

### Why RLS?
- **Defense in Depth**: Security at database level, independent of application code
- **Zero Trust**: Even if application has bugs, database enforces isolation
- **Compliance**: Meet GDPR/CCPA requirements for data isolation
- **Multi-Tenancy**: Perfect for SaaS applications with multiple users

### Migration Order
```
001_enable_rls.sql          → Enable RLS (blocks all access)
002_user_policies.sql       → Restore user-owned table access
003_workspace_policies.sql  → Enable workspace features
004_performance_indexes.sql → Optimize query performance (CRITICAL)
005_rls_helper_functions.sql → Add utility functions
006_rls_test_script.sql     → Validate everything works
```

---

## Table Security Patterns

### Pattern 1: User-Owned (Strict Isolation)
**Use When**: User owns all their data, no sharing needed

**Tables**: Contacts, Calendar Events, Archives, Voxer Recordings, Emails, SMS Conversations, AI Lab Workflows/Templates, Backups, Sync Devices, Export Jobs

**Policy Template**:
```sql
-- SELECT: Users can view their own data
CREATE POLICY "Users can view own {table}"
ON {table}
FOR SELECT
USING (user_id = auth.current_user_id());

-- INSERT: Users can create their own data
CREATE POLICY "Users can insert own {table}"
ON {table}
FOR INSERT
WITH CHECK (user_id = auth.current_user_id());

-- UPDATE: Users can update their own data
CREATE POLICY "Users can update own {table}"
ON {table}
FOR UPDATE
USING (user_id = auth.current_user_id())
WITH CHECK (user_id = auth.current_user_id());

-- DELETE: Users can delete their own data
CREATE POLICY "Users can delete own {table}"
ON {table}
FOR DELETE
USING (user_id = auth.current_user_id());
```

**Example Query**:
```javascript
// Client-side: Automatically filtered to current user
const { data } = await supabase.from('contacts').select('*');
// Returns only contacts where user_id = auth.uid()
```

---

### Pattern 2: Cascading Access (Parent-Child)
**Use When**: Child records inherit access from parent table

**Tables**:
- Messages (via Threads)
- SMS Messages (via SMS Conversations)
- Key Results (via Outcomes)

**Policy Template**:
```sql
-- SELECT: Users can view child records of their parent records
CREATE POLICY "Users can view {child} in own {parent}"
ON {child}
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM {parent}
    WHERE {parent}.id = {child}.{parent}_id
    AND {parent}.user_id = auth.current_user_id()
  )
);
```

**Example**:
```sql
-- Messages inherit access from threads
CREATE POLICY "Users can view messages in own threads"
ON messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM threads
    WHERE threads.id = messages.thread_id
    AND threads.user_id = auth.current_user_id()
  )
);
```

---

### Pattern 3: Creator + Assigned (Tasks)
**Use When**: User owns record OR is assigned to it

**Tables**: Tasks

**Policy Template**:
```sql
-- Users can view tasks they created OR are assigned to
CREATE POLICY "Users can view own or assigned tasks"
ON tasks
FOR SELECT
USING (
  user_id = auth.current_user_id()
  OR assignee_id = auth.current_user_id()
);
```

---

### Pattern 4: Workspace-Shared (Collaboration)
**Use When**: Multiple users collaborate on shared resources

**Tables**:
- Voice Rooms & Participants
- Ephemeral Workspaces, Chat Messages & Participants

**Policy Template**:
```sql
-- SELECT: Creator OR participants can view
CREATE POLICY "Users can view accessible {table}"
ON {table}
FOR SELECT
USING (
  created_by = auth.current_user_id()
  OR is_participant({table}_id, auth.current_user_id())
);
```

**Example**:
```sql
-- Voice Rooms: Public OR created OR participant
CREATE POLICY "Users can view accessible voice rooms"
ON voice_rooms
FOR SELECT
USING (
  is_private = false
  OR user_id = auth.current_user_id()
  OR is_voice_room_participant(id, auth.current_user_id())
);
```

---

### Pattern 5: Admin-Controlled (Role-Based)
**Use When**: Admins create content, users consume it

**Tables**: In-App Messages

**Policy Template**:
```sql
-- Admins can do everything
CREATE POLICY "Admins can manage {table}"
ON {table}
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Users can view active content
CREATE POLICY "Users can view active {table}"
ON {table}
FOR SELECT
USING (
  active = true
  AND (start_date IS NULL OR start_date <= NOW())
  AND (end_date IS NULL OR end_date >= NOW())
);
```

---

## Helper Functions Reference

### Authentication Functions

```sql
-- Get current user ID from JWT
auth.current_user_id() → TEXT
-- Example: WHERE user_id = auth.current_user_id()

-- Check if user is admin
auth.is_admin() → BOOLEAN
-- Example: USING (is_admin())

-- Check if user is moderator or admin
auth.is_moderator() → BOOLEAN

-- Get current user email
auth.current_user_email() → TEXT
```

### Membership Functions

```sql
-- Workspace membership
is_workspace_creator(workspace_id, user_id) → BOOLEAN
is_workspace_participant(workspace_id, user_id) → BOOLEAN
has_workspace_access(workspace_id, user_id) → BOOLEAN

-- Voice room membership
is_voice_room_creator(room_id, user_id) → BOOLEAN
is_voice_room_participant(room_id, user_id) → BOOLEAN
has_voice_room_access(room_id, user_id) → BOOLEAN

-- Thread ownership
owns_thread(thread_id, user_id) → BOOLEAN
```

### Validation Functions

```sql
-- Check if workspace is active
workspace_is_active(workspace_id) → BOOLEAN

-- Check if user is within storage quota
user_within_storage_quota(user_id, new_file_size, max_quota) → BOOLEAN

-- Check if backup name is unique for user
backup_name_unique(user_id, backup_name, exclude_backup_id) → BOOLEAN
```

### Analytics Functions

```sql
-- Get user message count
get_user_message_count(user_id) → BIGINT

-- Get user storage usage
get_user_storage_usage(user_id) → TABLE (total_files, total_size, total_size_formatted)

-- Get workspace/room participant count
get_workspace_participant_count(workspace_id) → INTEGER
get_voice_room_participant_count(room_id) → INTEGER

-- Get comprehensive user activity summary
get_user_activity_summary(user_id) → TABLE (
  message_count, thread_count, contact_count,
  task_count, completed_task_count,
  voice_recording_count, file_upload_count
)
```

---

## Common Operations

### Add RLS to New Table

```sql
-- Step 1: Enable RLS
ALTER TABLE my_new_table ENABLE ROW LEVEL SECURITY;

-- Step 2: Create policies
CREATE POLICY "Users can view own records"
ON my_new_table FOR SELECT
USING (user_id = auth.current_user_id());

CREATE POLICY "Users can insert own records"
ON my_new_table FOR INSERT
WITH CHECK (user_id = auth.current_user_id());

CREATE POLICY "Users can update own records"
ON my_new_table FOR UPDATE
USING (user_id = auth.current_user_id())
WITH CHECK (user_id = auth.current_user_id());

CREATE POLICY "Users can delete own records"
ON my_new_table FOR DELETE
USING (user_id = auth.current_user_id());

-- Step 3: Add performance index
CREATE INDEX idx_my_new_table_user_id ON my_new_table(user_id);

-- Step 4: Test with authenticated user
-- (Use Supabase client with real JWT token)
```

### Temporarily Disable RLS (Development Only)

```sql
-- Disable RLS on a table (NOT recommended for production)
ALTER TABLE my_table DISABLE ROW LEVEL SECURITY;

-- Re-enable
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;
```

### Test RLS Policy

```sql
-- View all policies on a table
SELECT * FROM pg_policies WHERE tablename = 'contacts';

-- Simulate user query (use actual user_id)
SET request.jwt.claims = '{"sub": "actual-user-uuid"}';
SELECT * FROM contacts; -- Should only return user's contacts
RESET request.jwt.claims;

-- Or use EXPLAIN to see query plan
EXPLAIN (ANALYZE, VERBOSE)
SELECT * FROM contacts WHERE user_id = 'test-user-id';
```

### Debug RLS Issues

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'your_table';

-- List all policies for a table
SELECT
  policyname,
  permissive,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'your_table';

-- Check for missing indexes
SELECT
  schemaname,
  tablename,
  attname
FROM pg_stats
WHERE schemaname = 'public'
AND tablename = 'your_table'
AND attname = 'user_id';
```

---

## Performance Best Practices

### 1. Always Index user_id
```sql
-- REQUIRED on every user-scoped table
CREATE INDEX idx_{table}_user_id ON {table}(user_id);
```

### 2. Index Foreign Keys Used in Policies
```sql
-- If policy checks thread ownership
CREATE INDEX idx_messages_thread_id ON messages(thread_id);
```

### 3. Use Composite Indexes for Multi-Column Checks
```sql
-- For queries filtering by user_id AND another column
CREATE INDEX idx_tasks_user_completed ON tasks(user_id, completed);
```

### 4. Create Partial Indexes for Common Filters
```sql
-- Only index active/unread/incomplete records
CREATE INDEX idx_tasks_incomplete
ON tasks(user_id, due_date) WHERE completed = false;

CREATE INDEX idx_unified_messages_unread
ON unified_messages(user_id, timestamp) WHERE is_read = false;
```

### 5. Analyze Tables After Index Creation
```sql
ANALYZE contacts;
ANALYZE messages;
ANALYZE tasks;
-- ... all tables with new indexes
```

---

## Client-Side Usage

### Supabase JavaScript Client

```javascript
import { createClient } from '@supabase/supabase-js';

// Initialize client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Sign in user (required for RLS)
const { data: { user } } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
});

// RLS automatically filters to current user
const { data: contacts } = await supabase
  .from('contacts')
  .select('*');
// Returns only contacts where user_id = user.id

// Insert automatically sets user_id
const { data: newContact } = await supabase
  .from('contacts')
  .insert({
    name: 'John Doe',
    email: 'john@example.com',
    // user_id automatically set from JWT
  });

// Update restricted to user's own records
const { data: updatedContact } = await supabase
  .from('contacts')
  .update({ name: 'Jane Doe' })
  .eq('id', contactId); // Only succeeds if user owns this contact

// Delete restricted to user's own records
const { error } = await supabase
  .from('contacts')
  .delete()
  .eq('id', contactId); // Only succeeds if user owns this contact
```

### Service Role (Backend Only)

```javascript
// Backend server only - NEVER expose service role key to clients
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY // Bypasses RLS!
);

// Admin operations bypass RLS
const { data: allContacts } = await supabaseAdmin
  .from('contacts')
  .select('*');
// Returns ALL contacts from ALL users

// Use for admin operations only
const { data: message } = await supabaseAdmin
  .from('in_app_messages')
  .insert({
    title: 'System Announcement',
    body: 'Scheduled maintenance tonight',
    created_by: 'system'
  });
```

---

## Table-by-Table Summary

| Table | Policy Type | Key Policies | Index |
|-------|-------------|--------------|-------|
| `contacts` | User-Owned | ALL | `user_id` |
| `calendar_events` | User-Owned | ALL | `user_id` |
| `tasks` | User-Owned + Assigned | ALL | `user_id`, `assignee_id` |
| `threads` | User-Owned | ALL | `user_id` |
| `messages` | Cascading (via threads) | ALL | `thread_id` |
| `unified_messages` | User-Owned | ALL | `user_id` |
| `sms_conversations` | User-Owned | ALL | `user_id` |
| `sms_messages` | Cascading (via conversation) | ALL | `conversation_id` |
| `emails` | User-Owned | ALL | `user_id` |
| `slack_channels` | User-Owned | ALL | `user_id` |
| `voxer_recordings` | User-Owned | ALL | `user_id` |
| `voice_rooms` | Workspace-Shared | ALL | `user_id` |
| `voice_room_participants` | Workspace-Shared | ALL | `room_id`, `user_id` |
| `archives` | User-Owned | ALL | `user_id` |
| `outcomes` | User-Owned | ALL | `user_id` |
| `key_results` | Cascading (via outcomes) | ALL | `outcome_id` |
| `ai_lab_workflows` | User-Owned | ALL | `user_id` |
| `ai_lab_templates` | User-Owned | ALL | `user_id` |
| `in_app_messages` | Admin-Controlled | Admin: ALL, Users: SELECT | N/A |
| `message_interactions` | User-Owned | SELECT, INSERT (immutable) | `user_id` |
| `user_retention_cohorts` | User-Owned | SELECT, INSERT, UPDATE | `user_id` |
| `file_uploads` | User-Owned | ALL | `user_id` |
| `backups` | User-Owned | ALL (encrypted) | `user_id` |
| `sync_devices` | User-Owned | ALL | `user_id` |
| `backup_settings` | User-Owned | ALL | `user_id` |
| `sync_settings` | User-Owned | ALL | `user_id` |
| `export_jobs` | User-Owned | ALL | `user_id` |
| `ephemeral_workspaces` | Workspace-Shared | ALL | `created_by` |
| `chat_messages` | Workspace-Shared | SELECT, INSERT (immutable) | `workspace_id` |
| `workspace_participants` | Workspace-Shared | ALL | `workspace_id`, `user_id` |

---

## Emergency Commands

### Disable All RLS (Emergency Rollback)
```sql
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND rowsecurity = true
    ) LOOP
        EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', r.tablename);
        EXECUTE format('DROP POLICY IF EXISTS "Users can view own %s" ON %I', r.tablename, r.tablename);
        EXECUTE format('CREATE POLICY "Allow all access" ON %I FOR ALL USING (true)', r.tablename);
    END LOOP;
END $$;
```

### Re-Enable All RLS
```sql
-- Run migration scripts 001-005 again
\i docs/migrations/001_enable_rls.sql
\i docs/migrations/002_user_policies.sql
\i docs/migrations/003_workspace_policies.sql
\i docs/migrations/004_performance_indexes.sql
\i docs/migrations/005_rls_helper_functions.sql
```

### Check RLS Status
```sql
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  (SELECT COUNT(*) FROM pg_policies p WHERE p.tablename = t.tablename) as policy_count
FROM pg_tables t
WHERE schemaname = 'public'
ORDER BY tablename;
```

---

## Additional Resources

- **Full Documentation**: `docs/PHASE-7-ROW-LEVEL-SECURITY.md`
- **Migration Scripts**: `docs/migrations/00*_*.sql`
- **Test Suite**: `docs/migrations/006_rls_test_script.sql`
- **PostgreSQL RLS Docs**: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- **Supabase RLS Guide**: https://supabase.com/docs/guides/auth/row-level-security

---

**Remember**: RLS is your last line of defense. Even if application bugs exist, RLS ensures users can only access their own data. Always test thoroughly before deploying to production!
