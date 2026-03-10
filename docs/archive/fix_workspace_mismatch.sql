-- Fix Workspace ID Mismatch
-- Update all decisions and tasks to use the ACTUAL logged-in user's workspace ID

-- ============================================
-- STEP 1: Show current mismatch
-- ============================================
SELECT
  'Current logged-in user (what UI uses)' as info,
  id as workspace_id,
  email
FROM auth.users
WHERE email = 'jehovahsmessyb3@gmail.com' -- Your logged-in email
LIMIT 1;

-- ============================================
-- STEP 2: Fix ALL decisions
-- ============================================
UPDATE decisions
SET workspace_id = (
  SELECT id FROM auth.users
  WHERE email = 'jehovahsmessyb3@gmail.com'
  LIMIT 1
);

-- ============================================
-- STEP 3: Fix ALL tasks
-- ============================================
-- First, update user_id for tasks that have NULL user_id
UPDATE tasks
SET user_id = (
  SELECT id FROM auth.users
  WHERE email = 'jehovahsmessyb3@gmail.com'
  LIMIT 1
)
WHERE user_id IS NULL;

-- Then update workspace_id for ALL tasks
UPDATE tasks
SET workspace_id = (
  SELECT id FROM auth.users
  WHERE email = 'jehovahsmessyb3@gmail.com'
  LIMIT 1
);

-- ============================================
-- STEP 4: Verify the fix
-- ============================================
SELECT
  '✅ Decisions Fixed' as status,
  COUNT(*) as total,
  workspace_id
FROM decisions
GROUP BY workspace_id;

SELECT
  '✅ Tasks Fixed' as status,
  COUNT(*) as total,
  workspace_id
FROM tasks
GROUP BY workspace_id;

-- ============================================
-- STEP 5: Show sample data
-- ============================================
SELECT
  'Sample Decisions' as type,
  LEFT(proposal_text, 60) as title,
  status,
  workspace_id
FROM decisions
ORDER BY created_at DESC
LIMIT 5;

SELECT
  'Sample Tasks' as type,
  title,
  priority,
  workspace_id
FROM tasks
ORDER BY created_at DESC
LIMIT 5;
