-- Sample Data for AI-Enhanced Decisions & Tasks (FINAL VERSION)
-- This creates realistic test data to showcase all AI features
-- Uses defensive checks for column existence

-- ============================================
-- SAMPLE DECISIONS (using correct column names)
-- ============================================

-- Decision 1: Active voting (should trigger "pending vote" nudge)
INSERT INTO decisions (
  id,
  workspace_id,
  proposal_text,
  status,
  decision_type,
  created_by,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  'Choose CI/CD Platform: We need to decide between GitHub Actions, GitLab CI, or Jenkins for our deployment pipeline. Consider cost, ease of use, and integration with existing tools.',
  'voting',
  'technical',
  (SELECT id FROM auth.users LIMIT 1),
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days'
) ON CONFLICT DO NOTHING;

-- Decision 2: Recent voting (active, high risk)
INSERT INTO decisions (
  id,
  workspace_id,
  proposal_text,
  status,
  decision_type,
  created_by,
  created_at,
  updated_at,
  ai_risk_level
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  'Migrate to Microservices Architecture: Should we break down our monolith into microservices? This would improve scalability but increase complexity.',
  'voting',
  'technical',
  (SELECT id FROM auth.users LIMIT 1),
  NOW() - INTERVAL '6 hours',
  NOW() - INTERVAL '6 hours',
  'high'
) ON CONFLICT DO NOTHING;

-- Decision 3: Decided (for metrics)
INSERT INTO decisions (
  id,
  workspace_id,
  proposal_text,
  status,
  decision_type,
  created_by,
  created_at,
  updated_at,
  resolved_at,
  ai_risk_level
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  'Switch to TypeScript: Convert our codebase from JavaScript to TypeScript for better type safety and developer experience.',
  'decided',
  'technical',
  (SELECT id FROM auth.users LIMIT 1),
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day',
  'medium'
) ON CONFLICT DO NOTHING;

-- Decision 4: Product decision (voting)
INSERT INTO decisions (
  id,
  workspace_id,
  proposal_text,
  status,
  decision_type,
  created_by,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  'Add Dark Mode to Mobile App: Users have requested dark mode. Should we prioritize this for Q2?',
  'voting',
  'product',
  (SELECT id FROM auth.users LIMIT 1),
  NOW() - INTERVAL '12 hours',
  NOW() - INTERVAL '12 hours'
) ON CONFLICT DO NOTHING;

-- ============================================
-- SAMPLE TASKS
-- ============================================

-- Task 1: Overdue and urgent
DO $$
DECLARE
  has_workspace_id BOOLEAN;
BEGIN
  -- Check if workspace_id column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'workspace_id'
  ) INTO has_workspace_id;

  IF has_workspace_id THEN
    -- Insert with workspace_id
    INSERT INTO tasks (
      id,
      workspace_id,
      title,
      description,
      status,
      priority,
      assigned_to,
      created_by,
      due_date,
      created_at,
      updated_at,
      metadata,
      ai_priority_score
    ) VALUES (
      gen_random_uuid(),
      (SELECT id FROM auth.users LIMIT 1),
      'Fix Critical Security Vulnerability',
      'SQL injection vulnerability discovered in user authentication. URGENT FIX NEEDED.',
      'in_progress',
      'urgent',
      (SELECT id FROM auth.users LIMIT 1),
      (SELECT id FROM auth.users LIMIT 1),
      NOW() - INTERVAL '2 days',
      NOW() - INTERVAL '5 days',
      NOW() - INTERVAL '1 hour',
      '{}'::jsonb,
      95.0
    ) ON CONFLICT DO NOTHING;
  ELSE
    -- Insert without workspace_id
    INSERT INTO tasks (
      id,
      title,
      description,
      status,
      priority,
      assigned_to,
      created_by,
      due_date,
      created_at,
      updated_at,
      metadata,
      ai_priority_score
    ) VALUES (
      gen_random_uuid(),
      'Fix Critical Security Vulnerability',
      'SQL injection vulnerability discovered in user authentication. URGENT FIX NEEDED.',
      'in_progress',
      'urgent',
      (SELECT id FROM auth.users LIMIT 1),
      (SELECT id FROM auth.users LIMIT 1),
      NOW() - INTERVAL '2 days',
      NOW() - INTERVAL '5 days',
      NOW() - INTERVAL '1 hour',
      '{}'::jsonb,
      95.0
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Task 2: Due today
DO $$
DECLARE
  has_workspace_id BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'workspace_id'
  ) INTO has_workspace_id;

  IF has_workspace_id THEN
    INSERT INTO tasks (
      id,
      workspace_id,
      title,
      description,
      status,
      priority,
      assigned_to,
      created_by,
      due_date,
      created_at,
      updated_at,
      metadata,
      ai_priority_score,
      ai_predicted_duration
    ) VALUES (
      gen_random_uuid(),
      (SELECT id FROM auth.users LIMIT 1),
      'Complete API Documentation',
      'Write comprehensive API docs for the new endpoints. Include examples and error codes.',
      'in_progress',
      'high',
      (SELECT id FROM auth.users LIMIT 1),
      (SELECT id FROM auth.users LIMIT 1),
      NOW() + INTERVAL '8 hours',
      NOW() - INTERVAL '3 days',
      NOW() - INTERVAL '2 hours',
      '{}'::jsonb,
      82.0,
      '4-6 hours'
    ) ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO tasks (
      id,
      title,
      description,
      status,
      priority,
      assigned_to,
      created_by,
      due_date,
      created_at,
      updated_at,
      metadata,
      ai_priority_score,
      ai_predicted_duration
    ) VALUES (
      gen_random_uuid(),
      'Complete API Documentation',
      'Write comprehensive API docs for the new endpoints. Include examples and error codes.',
      'in_progress',
      'high',
      (SELECT id FROM auth.users LIMIT 1),
      (SELECT id FROM auth.users LIMIT 1),
      NOW() + INTERVAL '8 hours',
      NOW() - INTERVAL '3 days',
      NOW() - INTERVAL '2 hours',
      '{}'::jsonb,
      82.0,
      '4-6 hours'
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Task 3: High priority, blocks others
DO $$
DECLARE
  has_workspace_id BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'workspace_id'
  ) INTO has_workspace_id;

  IF has_workspace_id THEN
    INSERT INTO tasks (
      id,
      workspace_id,
      title,
      description,
      status,
      priority,
      assigned_to,
      created_by,
      due_date,
      created_at,
      updated_at,
      metadata,
      ai_priority_score,
      ai_predicted_duration
    ) VALUES (
      gen_random_uuid(),
      (SELECT id FROM auth.users LIMIT 1),
      'Set Up Staging Environment',
      'Configure staging server before we can deploy new features. This is blocking 3 other tasks.',
      'todo',
      'high',
      (SELECT id FROM auth.users LIMIT 1),
      (SELECT id FROM auth.users LIMIT 1),
      NOW() + INTERVAL '2 days',
      NOW() - INTERVAL '1 day',
      NOW() - INTERVAL '1 day',
      '{}'::jsonb,
      88.0,
      '1-2 days'
    ) ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO tasks (
      id,
      title,
      description,
      status,
      priority,
      assigned_to,
      created_by,
      due_date,
      created_at,
      updated_at,
      metadata,
      ai_priority_score,
      ai_predicted_duration
    ) VALUES (
      gen_random_uuid(),
      'Set Up Staging Environment',
      'Configure staging server before we can deploy new features. This is blocking 3 other tasks.',
      'todo',
      'high',
      (SELECT id FROM auth.users LIMIT 1),
      (SELECT id FROM auth.users LIMIT 1),
      NOW() + INTERVAL '2 days',
      NOW() - INTERVAL '1 day',
      NOW() - INTERVAL '1 day',
      '{}'::jsonb,
      88.0,
      '1-2 days'
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Task 4: Medium priority
DO $$
DECLARE
  has_workspace_id BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'workspace_id'
  ) INTO has_workspace_id;

  IF has_workspace_id THEN
    INSERT INTO tasks (
      id,
      workspace_id,
      title,
      description,
      status,
      priority,
      assigned_to,
      created_by,
      due_date,
      created_at,
      updated_at,
      metadata,
      ai_priority_score
    ) VALUES (
      gen_random_uuid(),
      (SELECT id FROM auth.users LIMIT 1),
      'Refactor User Service',
      'Clean up the user service code - extract duplicate logic into reusable functions.',
      'todo',
      'medium',
      (SELECT id FROM auth.users LIMIT 1),
      (SELECT id FROM auth.users LIMIT 1),
      NOW() + INTERVAL '1 week',
      NOW() - INTERVAL '2 days',
      NOW() - INTERVAL '2 days',
      '{}'::jsonb,
      65.0
    ) ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO tasks (
      id,
      title,
      description,
      status,
      priority,
      assigned_to,
      created_by,
      due_date,
      created_at,
      updated_at,
      metadata,
      ai_priority_score
    ) VALUES (
      gen_random_uuid(),
      'Refactor User Service',
      'Clean up the user service code - extract duplicate logic into reusable functions.',
      'todo',
      'medium',
      (SELECT id FROM auth.users LIMIT 1),
      (SELECT id FROM auth.users LIMIT 1),
      NOW() + INTERVAL '1 week',
      NOW() - INTERVAL '2 days',
      NOW() - INTERVAL '2 days',
      '{}'::jsonb,
      65.0
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Task 5: Completed
DO $$
DECLARE
  has_workspace_id BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'workspace_id'
  ) INTO has_workspace_id;

  IF has_workspace_id THEN
    INSERT INTO tasks (
      id,
      workspace_id,
      title,
      description,
      status,
      priority,
      assigned_to,
      created_by,
      due_date,
      completed_at,
      created_at,
      updated_at,
      metadata,
      ai_priority_score
    ) VALUES (
      gen_random_uuid(),
      (SELECT id FROM auth.users LIMIT 1),
      'Update Dependencies',
      'Update all npm packages to latest versions and test thoroughly.',
      'done',
      'medium',
      (SELECT id FROM auth.users LIMIT 1),
      (SELECT id FROM auth.users LIMIT 1),
      NOW() - INTERVAL '1 day',
      NOW() - INTERVAL '6 hours',
      NOW() - INTERVAL '4 days',
      NOW() - INTERVAL '6 hours',
      '{}'::jsonb,
      70.0
    ) ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO tasks (
      id,
      title,
      description,
      status,
      priority,
      assigned_to,
      created_by,
      due_date,
      completed_at,
      created_at,
      updated_at,
      metadata,
      ai_priority_score
    ) VALUES (
      gen_random_uuid(),
      'Update Dependencies',
      'Update all npm packages to latest versions and test thoroughly.',
      'done',
      'medium',
      (SELECT id FROM auth.users LIMIT 1),
      (SELECT id FROM auth.users LIMIT 1),
      NOW() - INTERVAL '1 day',
      NOW() - INTERVAL '6 hours',
      NOW() - INTERVAL '4 days',
      NOW() - INTERVAL '6 hours',
      '{}'::jsonb,
      70.0
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Task 6: Low priority
DO $$
DECLARE
  has_workspace_id BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'workspace_id'
  ) INTO has_workspace_id;

  IF has_workspace_id THEN
    INSERT INTO tasks (
      id,
      workspace_id,
      title,
      description,
      status,
      priority,
      assigned_to,
      created_by,
      due_date,
      created_at,
      updated_at,
      metadata,
      ai_priority_score
    ) VALUES (
      gen_random_uuid(),
      (SELECT id FROM auth.users LIMIT 1),
      'Design New Landing Page',
      'Create mockups for the new marketing landing page. Get feedback from stakeholders.',
      'todo',
      'low',
      (SELECT id FROM auth.users LIMIT 1),
      (SELECT id FROM auth.users LIMIT 1),
      NOW() + INTERVAL '2 weeks',
      NOW() - INTERVAL '1 day',
      NOW() - INTERVAL '1 day',
      '{}'::jsonb,
      45.0
    ) ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO tasks (
      id,
      title,
      description,
      status,
      priority,
      assigned_to,
      created_by,
      due_date,
      created_at,
      updated_at,
      metadata,
      ai_priority_score
    ) VALUES (
      gen_random_uuid(),
      'Design New Landing Page',
      'Create mockups for the new marketing landing page. Get feedback from stakeholders.',
      'todo',
      'low',
      (SELECT id FROM auth.users LIMIT 1),
      (SELECT id FROM auth.users LIMIT 1),
      NOW() + INTERVAL '2 weeks',
      NOW() - INTERVAL '1 day',
      NOW() - INTERVAL '1 day',
      '{}'::jsonb,
      45.0
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Task 7: Blocked by another task
DO $$
DECLARE
  has_workspace_id BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'workspace_id'
  ) INTO has_workspace_id;

  IF has_workspace_id THEN
    INSERT INTO tasks (
      id,
      workspace_id,
      title,
      description,
      status,
      priority,
      assigned_to,
      created_by,
      due_date,
      created_at,
      updated_at,
      metadata,
      ai_priority_score
    ) VALUES (
      gen_random_uuid(),
      (SELECT id FROM auth.users LIMIT 1),
      'Deploy New Features to Production',
      'Deploy after staging environment is ready. Depends on Set Up Staging Environment task.',
      'todo',
      'high',
      (SELECT id FROM auth.users LIMIT 1),
      (SELECT id FROM auth.users LIMIT 1),
      NOW() + INTERVAL '3 days',
      NOW() - INTERVAL '1 day',
      NOW() - INTERVAL '1 day',
      '{}'::jsonb,
      75.0
    ) ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO tasks (
      id,
      title,
      description,
      status,
      priority,
      assigned_to,
      created_by,
      due_date,
      created_at,
      updated_at,
      metadata,
      ai_priority_score
    ) VALUES (
      gen_random_uuid(),
      'Deploy New Features to Production',
      'Deploy after staging environment is ready. Depends on Set Up Staging Environment task.',
      'todo',
      'high',
      (SELECT id FROM auth.users LIMIT 1),
      (SELECT id FROM auth.users LIMIT 1),
      NOW() + INTERVAL '3 days',
      NOW() - INTERVAL '1 day',
      NOW() - INTERVAL '1 day',
      '{}'::jsonb,
      75.0
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================
-- SAMPLE VOTES
-- ============================================

INSERT INTO decision_votes (
  id,
  decision_id,
  user_id,
  vote,
  comment,
  voted_at
)
SELECT
  gen_random_uuid(),
  d.id,
  (SELECT id FROM auth.users LIMIT 1),
  'approve',
  'Sounds good to me!',
  NOW() - INTERVAL '1 day'
FROM decisions d
WHERE d.proposal_text LIKE 'Switch to TypeScript%'
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO decision_votes (
  id,
  decision_id,
  user_id,
  vote,
  comment,
  voted_at
)
SELECT
  gen_random_uuid(),
  d.id,
  (SELECT id FROM auth.users LIMIT 1),
  'approve',
  'This will improve our deployment speed',
  NOW() - INTERVAL '3 hours'
FROM decisions d
WHERE d.proposal_text LIKE 'Migrate to Microservices%'
LIMIT 1
ON CONFLICT DO NOTHING;

-- ============================================
-- VERIFICATION
-- ============================================

SELECT '✅ Sample data created successfully!' AS status;

SELECT
  'Decisions' as type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'voting') as voting,
  COUNT(*) FILTER (WHERE status = 'decided') as decided
FROM decisions;

SELECT
  'Tasks' as type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'todo') as todo,
  COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
  COUNT(*) FILTER (WHERE status = 'done') as done,
  COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'done') as overdue
FROM tasks;

-- Show the decisions
SELECT
  LEFT(proposal_text, 50) as decision_summary,
  status,
  decision_type,
  ai_risk_level
FROM decisions
ORDER BY created_at DESC
LIMIT 10;

-- Show the tasks
SELECT
  title,
  status,
  priority,
  ai_priority_score,
  CASE
    WHEN due_date < NOW() AND status != 'done' THEN 'OVERDUE'
    WHEN due_date < NOW() + INTERVAL '1 day' THEN 'Due today'
    ELSE 'On track'
  END as due_status
FROM tasks
ORDER BY ai_priority_score DESC NULLS LAST
LIMIT 10;
