# RLS Deployment Checklist

**Phase 7: Row Level Security Deployment**
**Last Updated**: January 20, 2026

## Pre-Deployment Checklist

### 1. Environment Preparation

- [ ] **Staging Environment Ready**
  - [ ] Staging database matches production schema
  - [ ] Test users created with different roles
  - [ ] Sample data populated (messages, contacts, tasks)

- [ ] **Database Backup Created**
  - [ ] Full database backup completed
  - [ ] Backup verified and downloadable
  - [ ] Backup restoration tested
  - [ ] Backup stored securely off-site

- [ ] **Access Credentials Verified**
  - [ ] Supabase dashboard access confirmed
  - [ ] Service role key available (never exposed to clients)
  - [ ] Anon key documented for client applications
  - [ ] Database connection strings ready

### 2. Code Review

- [ ] **Migration Scripts Reviewed**
  - [ ] All 6 migration files present in `docs/migrations/`
  - [ ] Scripts reviewed by senior developer
  - [ ] Scripts tested in development environment
  - [ ] Rollback procedure documented and tested

- [ ] **Application Code Updated**
  - [ ] All services properly pass `userId` parameter
  - [ ] Supabase client uses authenticated sessions
  - [ ] Service role operations identified and secured
  - [ ] Error handling for RLS permission denials

### 3. Performance Baseline

- [ ] **Benchmark Queries Prepared**
  - [ ] Top 10 most frequent queries identified
  - [ ] Query execution times measured (baseline)
  - [ ] Expected post-RLS times calculated (+15-20%)
  - [ ] Alert thresholds defined

- [ ] **Monitoring Setup**
  - [ ] Slow query log enabled
  - [ ] Query performance dashboard configured
  - [ ] Alert rules created for >500ms queries
  - [ ] Database metrics monitoring active

### 4. Testing Preparation

- [ ] **Test Accounts Created**
  - [ ] User Alice: `alice@example.com` (regular user)
  - [ ] User Bob: `bob@example.com` (regular user)
  - [ ] User Admin: `admin@example.com` (admin role)
  - [ ] All passwords documented securely

- [ ] **Test Data Prepared**
  - [ ] Alice has 10+ contacts, 5+ messages
  - [ ] Bob has 10+ contacts, 5+ messages
  - [ ] Shared workspace created with both users
  - [ ] Voice room created with participants

### 5. Rollback Preparation

- [ ] **Rollback Script Ready**
  ```sql
  -- Quick rollback: Disable RLS and restore permissive policies
  -- Located in PHASE-7-ROW-LEVEL-SECURITY.md
  ```
  - [ ] Rollback script tested in development
  - [ ] Rollback procedure documented
  - [ ] Team trained on rollback process

---

## Deployment Steps (Execute in Order)

### Maintenance Window Planning

**Recommended Window**: 2:00 AM - 4:00 AM (local time)
**Expected Downtime**: 5-10 minutes during policy creation
**Notification**: Send 48 hours advance notice to users

---

### Step 1: Create Database Backup (T-30 minutes)

**Estimated Time**: 5 minutes

- [ ] Navigate to Supabase Dashboard → Database → Backups
- [ ] Click "Create Backup" → Name: `pre-rls-YYYYMMDD`
- [ ] Wait for backup completion (green checkmark)
- [ ] Download backup file to local machine
- [ ] Verify backup file size matches database size

**Verification**:
```sql
-- Check database size
SELECT pg_size_pretty(pg_database_size(current_database()));
```

---

### Step 2: Enable Row Level Security (T-0)

**Estimated Time**: 5 seconds
**CRITICAL**: This immediately restricts ALL access!

- [ ] Open Supabase SQL Editor
- [ ] Copy contents of `docs/migrations/001_enable_rls.sql`
- [ ] Paste into SQL Editor
- [ ] Click "Run"
- [ ] Verify success message: "RLS enabled on all tables"

**Expected Output**:
```
31 rows showing RLS enabled = true
✅ RLS enabled on all tables. CRITICAL: Run 002_user_policies.sql IMMEDIATELY to restore access.
```

**Impact**: All client queries will fail until Step 3 completes.

**Troubleshooting**:
```sql
-- If errors occur, check RLS status
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```

---

### Step 3: Create User-Owned Policies (T+1 minute)

**Estimated Time**: 10 seconds
**URGENT**: Run IMMEDIATELY after Step 2!

- [ ] Open new tab in SQL Editor
- [ ] Copy contents of `docs/migrations/002_user_policies.sql`
- [ ] Paste into SQL Editor
- [ ] Click "Run"
- [ ] Verify success message with policy counts

**Expected Output**:
```
18 tables with 4 policies each = 72 policies created
✅ User-owned policies created. Continue with 003_workspace_policies.sql
```

**Verification**:
```sql
-- Count policies
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
```

**Impact**: User-owned table access restored. Workspace features still blocked.

---

### Step 4: Create Workspace Policies (T+2 minutes)

**Estimated Time**: 15 seconds

- [ ] Copy contents of `docs/migrations/003_workspace_policies.sql`
- [ ] Paste into SQL Editor
- [ ] Click "Run"
- [ ] Verify success message and helper functions created

**Expected Output**:
```
12 tables with policies created
7 helper functions created
✅ Workspace and shared resource policies created. Continue with 004_performance_indexes.sql
```

**Verification**:
```sql
-- Check helper functions
SELECT proname FROM pg_proc WHERE proname LIKE '%workspace%' OR proname LIKE '%voice_room%';
```

**Impact**: All features now accessible with proper security. Performance may be slow without indexes.

---

### Step 5: Add Performance Indexes (T+3 minutes)

**Estimated Time**: 30 seconds
**CRITICAL**: Required for acceptable performance!

- [ ] Copy contents of `docs/migrations/004_performance_indexes.sql`
- [ ] Paste into SQL Editor
- [ ] Click "Run"
- [ ] Wait for completion (may take 20-30 seconds)
- [ ] Verify all indexes created

**Expected Output**:
```
76 indexes created successfully
ANALYZE completed on all tables
✅ Performance indexes created. Continue with 005_rls_helper_functions.sql
```

**Verification**:
```sql
-- Count indexes
SELECT schemaname, tablename, COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY index_count DESC;
```

**Impact**: Query performance restored to acceptable levels (~20% overhead).

---

### Step 6: Create Helper Functions (T+4 minutes)

**Estimated Time**: 5 seconds
**Optional but Recommended**

- [ ] Copy contents of `docs/migrations/005_rls_helper_functions.sql`
- [ ] Paste into SQL Editor
- [ ] Click "Run"
- [ ] Verify all functions created

**Expected Output**:
```
20+ helper functions created
Permissions granted to authenticated users
✅ RLS helper functions created. All migration scripts complete!
```

**Verification**:
```sql
-- List helper functions
SELECT proname, pg_get_function_arguments(oid) as args
FROM pg_proc
WHERE proname IN ('current_user_id', 'is_admin', 'has_workspace_access')
ORDER BY proname;
```

---

### Step 7: Run Test Suite (T+5 minutes)

**Estimated Time**: 10 seconds
**Required for Validation**

- [ ] Copy contents of `docs/migrations/006_rls_test_script.sql`
- [ ] Paste into SQL Editor
- [ ] Click "Run"
- [ ] Review test results

**Expected Output**:
```
========================================
RLS TEST SUITE COMPLETE
========================================
✓ PASS: 10/10 tests passed
⚠ WARNING: 0 performance warnings
✗ FAIL: 0 tests failed
```

**Action Items**:
- [ ] All tests show "✓ PASS" markers
- [ ] No "✗ FAIL" markers present
- [ ] Review any "⚠ WARNING" markers
- [ ] Document any unexpected results

**If Tests Fail**:
1. Do NOT proceed to Step 8
2. Review failure messages
3. Check policy configuration
4. Consider rollback if critical

---

### Step 8: Test with Real Users (T+10 minutes)

**Estimated Time**: 5 minutes per user

#### Test User: Alice

- [ ] Sign in as Alice (`alice@example.com`)
- [ ] Navigate to Contacts
- [ ] Verify Alice sees only her contacts (not Bob's)
- [ ] Create new contact → Success
- [ ] Update Alice's contact → Success
- [ ] Delete Alice's contact → Success
- [ ] Navigate to Messages
- [ ] Verify Alice sees only her threads
- [ ] Send message in Alice's thread → Success
- [ ] Navigate to Tasks
- [ ] Verify Alice sees her tasks + assigned tasks

#### Test User: Bob

- [ ] Sign in as Bob (`bob@example.com`)
- [ ] Navigate to Contacts
- [ ] Verify Bob sees only his contacts (not Alice's)
- [ ] Navigate to Messages
- [ ] Verify Bob sees only his threads
- [ ] Create new thread → Success

#### Test Workspace Features

- [ ] Sign in as Alice
- [ ] Create ephemeral workspace
- [ ] Add Bob as participant
- [ ] Send encrypted message → Success
- [ ] Sign in as Bob
- [ ] Verify Bob can see workspace and messages
- [ ] Bob sends message → Success
- [ ] Sign in as Charlie (not participant)
- [ ] Verify Charlie CANNOT see workspace → Expected Denial

#### Test Voice Rooms

- [ ] Create public voice room as Alice
- [ ] Bob joins public room → Success
- [ ] Create private voice room as Alice
- [ ] Bob attempts to join private room → Denied (Expected)
- [ ] Alice invites Bob to private room → Success
- [ ] Bob now can access private room → Success

#### Test Admin Functions

- [ ] Sign in as Admin
- [ ] Create in-app message
- [ ] Set active = true → Success
- [ ] Sign out
- [ ] Sign in as Alice
- [ ] Verify Alice can see in-app message → Success
- [ ] Alice attempts to edit message → Denied (Expected)

**Results Documentation**:
- [ ] All user tests passed
- [ ] All workspace tests passed
- [ ] All admin tests passed
- [ ] No unexpected errors logged

---

### Step 9: Performance Validation (T+20 minutes)

**Estimated Time**: 10 minutes

- [ ] Run benchmark queries
- [ ] Compare execution times to baseline
- [ ] Verify <20% performance overhead

**Benchmark Queries**:

```sql
-- 1. Simple user data query
EXPLAIN ANALYZE
SELECT * FROM contacts WHERE user_id = 'alice-uuid';

-- 2. Join query with thread messages
EXPLAIN ANALYZE
SELECT m.* FROM messages m
JOIN threads t ON t.id = m.thread_id
WHERE t.user_id = 'alice-uuid'
ORDER BY m.timestamp DESC
LIMIT 50;

-- 3. Complex workspace query
EXPLAIN ANALYZE
SELECT w.*, COUNT(p.id) as participant_count
FROM ephemeral_workspaces w
LEFT JOIN workspace_participants p ON p.workspace_id = w.id
WHERE w.created_by = 'alice-uuid'
GROUP BY w.id;
```

**Acceptance Criteria**:
- [ ] Query 1: <50ms (baseline ~40ms)
- [ ] Query 2: <200ms (baseline ~180ms)
- [ ] Query 3: <300ms (baseline ~250ms)

**If Performance Issues**:
1. Check index usage with `EXPLAIN ANALYZE`
2. Look for "Seq Scan" indicators (missing index)
3. Review `004_performance_indexes.sql` for missing indexes
4. Add specific indexes as needed

---

### Step 10: Monitoring Setup (T+30 minutes)

**Estimated Time**: 5 minutes

- [ ] **Slow Query Log Enabled**
  - [ ] Navigate to Supabase Dashboard → Settings → Database
  - [ ] Enable "Log slow queries"
  - [ ] Set threshold to 500ms
  - [ ] Verify logs appearing in Dashboard → Database → Logs

- [ ] **Performance Alerts Configured**
  - [ ] Set up alert for queries >1000ms
  - [ ] Set up alert for failed RLS policy checks
  - [ ] Set up alert for database CPU >80%

- [ ] **Dashboard Widgets**
  - [ ] Add "Active Connections" widget
  - [ ] Add "Query Performance" widget
  - [ ] Add "Database Size" widget

---

## Post-Deployment Checklist

### Immediate (First Hour)

- [ ] **Verify Application Functionality**
  - [ ] Login/logout working
  - [ ] Contact management working
  - [ ] Message sending working
  - [ ] Task creation working
  - [ ] File uploads working
  - [ ] Voice room creation working

- [ ] **Monitor Error Logs**
  - [ ] Check Supabase logs for RLS errors
  - [ ] Check application logs for permission denials
  - [ ] Review any 403 Forbidden errors
  - [ ] Document any unexpected issues

- [ ] **Performance Monitoring**
  - [ ] Check slow query log
  - [ ] Review query execution times
  - [ ] Monitor database CPU usage
  - [ ] Monitor connection count

### First 24 Hours

- [ ] **User Feedback**
  - [ ] Monitor support tickets
  - [ ] Check user reports of access issues
  - [ ] Review social media/community feedback
  - [ ] Document any user-reported problems

- [ ] **Performance Review**
  - [ ] Review slow query log summary
  - [ ] Identify any problematic queries
  - [ ] Check for missing indexes
  - [ ] Optimize as needed

- [ ] **Security Audit**
  - [ ] Verify no cross-user data leakage
  - [ ] Test with multiple users
  - [ ] Check admin-only operations
  - [ ] Review database audit logs

### First Week

- [ ] **Comprehensive Testing**
  - [ ] Test all application features
  - [ ] Multi-user scenarios
  - [ ] Edge cases (deleted users, expired workspaces)
  - [ ] Load testing with realistic traffic

- [ ] **Team Training**
  - [ ] Train developers on RLS patterns
  - [ ] Review helper functions
  - [ ] Document common issues
  - [ ] Create troubleshooting guide

- [ ] **Documentation Update**
  - [ ] Update API documentation
  - [ ] Update database schema docs
  - [ ] Create RLS best practices guide
  - [ ] Share knowledge with team

---

## Rollback Procedure

**If Critical Issues Occur**

### Emergency Rollback (5 minutes)

1. **Disable RLS and Restore Permissive Access**

```sql
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Disable RLS on all tables
    FOR r IN (
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND rowsecurity = true
    ) LOOP
        EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', r.tablename);

        -- Drop all RLS policies
        EXECUTE format('DROP POLICY IF EXISTS "Users can view own %s" ON %I', r.tablename, r.tablename);
        EXECUTE format('DROP POLICY IF EXISTS "Users can insert own %s" ON %I', r.tablename, r.tablename);
        EXECUTE format('DROP POLICY IF EXISTS "Users can update own %s" ON %I', r.tablename, r.tablename);
        EXECUTE format('DROP POLICY IF EXISTS "Users can delete own %s" ON %I', r.tablename, r.tablename);

        -- Restore permissive policy
        EXECUTE format('CREATE POLICY "Allow all access" ON %I FOR ALL USING (true)', r.tablename);

        RAISE NOTICE 'Rolled back RLS on table: %', r.tablename;
    END LOOP;

    RAISE NOTICE 'RLS rollback complete. All tables now allow unrestricted access.';
END $$;
```

2. **Verify Rollback**

```sql
-- Check that RLS is disabled
SELECT tablename, rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
-- All should show rls_enabled = false

-- Check permissive policies exist
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
AND policyname = 'Allow all access'
ORDER BY tablename;
-- Should show "Allow all access" for all tables
```

3. **Test Application**

- [ ] Test login/logout
- [ ] Test data access
- [ ] Verify no permission errors
- [ ] Monitor for 1 hour

4. **Post-Rollback Analysis**

- [ ] Document the issue that caused rollback
- [ ] Identify root cause
- [ ] Create fix plan
- [ ] Schedule re-deployment

---

## Success Criteria

### Deployment Successful If:

- ✅ All migration scripts executed without errors
- ✅ All test scenarios passed (10/10)
- ✅ User testing completed successfully
- ✅ Performance within acceptable range (<20% overhead)
- ✅ No critical errors in first 24 hours
- ✅ No user-reported access issues
- ✅ Zero cross-user data leakage detected

### Deployment Failed If:

- ❌ Migration scripts failed to execute
- ❌ Test scenarios failed (>2 failures)
- ❌ Users cannot access their own data
- ❌ Performance degradation >50%
- ❌ Cross-user data leakage detected
- ❌ Critical errors preventing application use

**Action on Failure**: Execute rollback procedure immediately.

---

## Contact Information

**Deployment Team**:
- Database Admin: [Name] - [Email] - [Phone]
- Backend Lead: [Name] - [Email] - [Phone]
- DevOps Lead: [Name] - [Email] - [Phone]
- On-Call Engineer: [Name] - [Email] - [Phone]

**Escalation Path**:
1. Level 1: On-Call Engineer
2. Level 2: Backend Lead + Database Admin
3. Level 3: CTO + VP Engineering

---

## Appendix

### Common Issues and Solutions

#### Issue: "No rows returned" after RLS enabled

**Solution**:
```javascript
// Ensure user is authenticated
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  // User not signed in - redirect to login
}
```

#### Issue: "Permission denied" on specific table

**Solution**:
```sql
-- Check policies on table
SELECT * FROM pg_policies WHERE tablename = 'your_table';

-- Verify user_id matches
SELECT user_id FROM your_table WHERE id = 'record-id';
-- Compare to auth.current_user_id()
```

#### Issue: Slow query performance

**Solution**:
```sql
-- Check if index exists
SELECT * FROM pg_indexes WHERE tablename = 'your_table' AND indexname LIKE '%user_id%';

-- If missing, create index
CREATE INDEX idx_your_table_user_id ON your_table(user_id);
```

---

**Deployment Prepared By**: Backend Architect Agent
**Date**: January 20, 2026
**Version**: 1.0
