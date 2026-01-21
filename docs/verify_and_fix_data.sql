-- Verify and Fix Sample Data
-- This script checks what data exists and fixes workspace_id mismatches

-- ============================================
-- STEP 1: Check current user
-- ============================================
SELECT
  'Current User' as info,
  id as user_id,
  email
FROM auth.users
LIMIT 1;

-- ============================================
-- STEP 2: Check existing decisions
-- ============================================
SELECT
  'Existing Decisions' as info,
  COUNT(*) as total,
  workspace_id,
  created_by
FROM decisions
GROUP BY workspace_id, created_by;

-- ============================================
-- STEP 3: Check existing tasks
-- ============================================
SELECT
  'Existing Tasks' as info,
  COUNT(*) as total,
  workspace_id,
  user_id
FROM tasks
GROUP BY workspace_id, user_id;

-- ============================================
-- STEP 4: Fix workspace_id for decisions
-- ============================================
-- Update all decisions to use the current user's ID as workspace_id
UPDATE decisions
SET workspace_id = (SELECT id FROM auth.users LIMIT 1)
WHERE workspace_id != (SELECT id FROM auth.users LIMIT 1)
  OR workspace_id IS NULL;

-- ============================================
-- STEP 5: Fix workspace_id for tasks
-- ============================================
-- Update all tasks to use the current user's ID as workspace_id
UPDATE tasks
SET workspace_id = (SELECT id FROM auth.users LIMIT 1)
WHERE workspace_id != (SELECT id FROM auth.users LIMIT 1)
  OR workspace_id IS NULL;

-- ============================================
-- STEP 6: Verify the fix
-- ============================================
SELECT
  '✅ After Fix - Decisions' as info,
  COUNT(*) as total,
  workspace_id
FROM decisions
GROUP BY workspace_id;

SELECT
  '✅ After Fix - Tasks' as info,
  COUNT(*) as total,
  workspace_id
FROM tasks
GROUP BY workspace_id;

-- ============================================
-- STEP 7: Show sample data
-- ============================================
SELECT
  'Sample Decisions' as info,
  LEFT(proposal_text, 50) as decision,
  status,
  workspace_id
FROM decisions
ORDER BY created_at DESC
LIMIT 5;

SELECT
  'Sample Tasks' as info,
  title,
  priority,
  workspace_id
FROM tasks
ORDER BY created_at DESC
LIMIT 5;
