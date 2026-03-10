-- Simple Fix: Use the FIRST user in auth.users for ALL data
-- This works for single-user development/testing

-- ============================================
-- STEP 1: Check current user
-- ============================================
SELECT
  'Your User ID' as info,
  id,
  email
FROM auth.users
ORDER BY created_at ASC
LIMIT 1;

-- ============================================
-- STEP 2: Fix decisions - set to first user's ID
-- ============================================
DO $$
DECLARE
  user_uuid UUID;
BEGIN
  -- Get the first user's ID
  SELECT id INTO user_uuid FROM auth.users ORDER BY created_at ASC LIMIT 1;

  -- Update all decisions
  UPDATE decisions SET workspace_id = user_uuid;
  UPDATE decisions SET created_by = user_uuid::text WHERE created_by IS NULL OR created_by = '';

  RAISE NOTICE 'Updated decisions to user: %', user_uuid;
END $$;

-- ============================================
-- STEP 3: Fix tasks - set to first user's ID
-- ============================================
DO $$
DECLARE
  user_uuid UUID;
BEGIN
  -- Get the first user's ID
  SELECT id INTO user_uuid FROM auth.users ORDER BY created_at ASC LIMIT 1;

  -- Update all tasks
  UPDATE tasks SET workspace_id = user_uuid;
  UPDATE tasks SET user_id = user_uuid::text WHERE user_id IS NULL OR user_id = '';
  UPDATE tasks SET assignee_id = user_uuid::text WHERE assignee_id IS NULL;

  RAISE NOTICE 'Updated tasks to user: %', user_uuid;
END $$;

-- ============================================
-- STEP 4: Fix decision votes
-- ============================================
DO $$
DECLARE
  user_uuid UUID;
BEGIN
  SELECT id INTO user_uuid FROM auth.users ORDER BY created_at ASC LIMIT 1;
  UPDATE decision_votes SET user_id = user_uuid::text;
  RAISE NOTICE 'Updated votes to user: %', user_uuid;
END $$;

-- ============================================
-- STEP 5: Verify
-- ============================================
SELECT
  '✅ Decisions' as table_name,
  COUNT(*) as total,
  workspace_id
FROM decisions
GROUP BY workspace_id;

SELECT
  '✅ Tasks' as table_name,
  COUNT(*) as total,
  workspace_id,
  user_id
FROM tasks
GROUP BY workspace_id, user_id;

-- ============================================
-- STEP 6: Show sample data
-- ============================================
SELECT
  'Decisions' as type,
  LEFT(proposal_text, 50) as title,
  status,
  decision_type,
  workspace_id,
  created_by
FROM decisions
ORDER BY created_at DESC
LIMIT 5;

SELECT
  'Tasks' as type,
  title,
  completed,
  priority,
  workspace_id,
  user_id
FROM tasks
ORDER BY created_at DESC
LIMIT 5;
