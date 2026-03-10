-- Sample Data for AI-Enhanced Decisions & Tasks (WORKING VERSION)
-- This creates realistic test data using the ACTUAL database schema
-- Based on actual table structure from migrations

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
-- SAMPLE TASKS (using ACTUAL schema)
-- Actual columns: id, user_id, title, completed, due_date, list_id, assignee_id, origin_message_id, priority, created_at, updated_at
-- AI columns added by migration: ai_priority_score, ai_suggested_assignee, ai_predicted_duration
-- ============================================

-- Task 1: Overdue and urgent (INCOMPLETE - shows as urgent in UI)
INSERT INTO tasks (
  id,
  user_id,
  title,
  completed,
  priority,
  assignee_id,
  due_date,
  list_id,
  created_at,
  updated_at,
  ai_priority_score
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  'Fix Critical Security Vulnerability - SQL injection in auth',
  false,
  'urgent',
  (SELECT id FROM auth.users LIMIT 1),
  NOW() - INTERVAL '2 days', -- OVERDUE!
  'work',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '1 hour',
  95.0
) ON CONFLICT DO NOTHING;

-- Task 2: Due today (high priority, in progress)
INSERT INTO tasks (
  id,
  user_id,
  title,
  completed,
  priority,
  assignee_id,
  due_date,
  list_id,
  created_at,
  updated_at,
  ai_priority_score,
  ai_predicted_duration
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  'Complete API Documentation for new endpoints',
  false,
  'high',
  (SELECT id FROM auth.users LIMIT 1),
  NOW() + INTERVAL '8 hours', -- Due today
  'work',
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '2 hours',
  82.0,
  '4-6 hours'
) ON CONFLICT DO NOTHING;

-- Task 3: High priority blocker
INSERT INTO tasks (
  id,
  user_id,
  title,
  completed,
  priority,
  assignee_id,
  due_date,
  list_id,
  created_at,
  updated_at,
  ai_priority_score,
  ai_predicted_duration
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  'Set Up Staging Environment (blocking 3 other tasks)',
  false,
  'high',
  (SELECT id FROM auth.users LIMIT 1),
  NOW() + INTERVAL '2 days',
  'work',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day',
  88.0,
  '1-2 days'
) ON CONFLICT DO NOTHING;

-- Task 4: Medium priority refactoring
INSERT INTO tasks (
  id,
  user_id,
  title,
  completed,
  priority,
  assignee_id,
  due_date,
  list_id,
  created_at,
  updated_at,
  ai_priority_score
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  'Refactor User Service - extract duplicate logic',
  false,
  'medium',
  (SELECT id FROM auth.users LIMIT 1),
  NOW() + INTERVAL '1 week',
  'work',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days',
  65.0
) ON CONFLICT DO NOTHING;

-- Task 5: Completed task (for metrics)
INSERT INTO tasks (
  id,
  user_id,
  title,
  completed,
  priority,
  assignee_id,
  due_date,
  list_id,
  created_at,
  updated_at,
  ai_priority_score
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  'Update Dependencies to latest versions',
  true, -- COMPLETED
  'medium',
  (SELECT id FROM auth.users LIMIT 1),
  NOW() - INTERVAL '1 day',
  'work',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '6 hours',
  70.0
) ON CONFLICT DO NOTHING;

-- Task 6: Low priority future task
INSERT INTO tasks (
  id,
  user_id,
  title,
  completed,
  priority,
  assignee_id,
  due_date,
  list_id,
  created_at,
  updated_at,
  ai_priority_score
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  'Design New Landing Page - create mockups',
  false,
  'low',
  (SELECT id FROM auth.users LIMIT 1),
  NOW() + INTERVAL '2 weeks',
  'work',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day',
  45.0
) ON CONFLICT DO NOTHING;

-- Task 7: High priority deployment task
INSERT INTO tasks (
  id,
  user_id,
  title,
  completed,
  priority,
  assignee_id,
  due_date,
  list_id,
  created_at,
  updated_at,
  ai_priority_score
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  'Deploy New Features to Production (after staging ready)',
  false,
  'high',
  (SELECT id FROM auth.users LIMIT 1),
  NOW() + INTERVAL '3 days',
  'work',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day',
  75.0
) ON CONFLICT DO NOTHING;

-- Task 8: Personal task (different list)
INSERT INTO tasks (
  id,
  user_id,
  title,
  completed,
  priority,
  due_date,
  list_id,
  created_at,
  updated_at,
  ai_priority_score
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  'Review Q1 Performance Metrics',
  false,
  'medium',
  NOW() + INTERVAL '5 days',
  'personal',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day',
  55.0
) ON CONFLICT DO NOTHING;

-- ============================================
-- SAMPLE VOTES
-- ============================================

INSERT INTO decision_votes (
  id,
  decision_id,
  user_id,
  choice,
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
  choice,
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
  COUNT(*) FILTER (WHERE completed = false) as active,
  COUNT(*) FILTER (WHERE completed = true) as completed,
  COUNT(*) FILTER (WHERE due_date < NOW() AND completed = false) as overdue,
  COUNT(*) FILTER (WHERE priority = 'urgent') as urgent,
  COUNT(*) FILTER (WHERE priority = 'high') as high_priority
FROM tasks;

-- Show the decisions
SELECT
  LEFT(proposal_text, 60) as decision_summary,
  status,
  decision_type,
  ai_risk_level,
  DATE_PART('day', NOW() - created_at) || ' days old' as age
FROM decisions
ORDER BY created_at DESC
LIMIT 10;

-- Show the tasks with AI scores
SELECT
  title,
  completed,
  priority,
  ai_priority_score,
  CASE
    WHEN due_date < NOW() AND completed = false THEN '🔴 OVERDUE'
    WHEN due_date < NOW() + INTERVAL '1 day' AND completed = false THEN '🟡 Due today'
    WHEN completed = true THEN '✅ Done'
    ELSE '🟢 On track'
  END as status_indicator,
  TO_CHAR(due_date, 'Mon DD') as due
FROM tasks
ORDER BY
  CASE WHEN completed THEN 1 ELSE 0 END,
  ai_priority_score DESC NULLS LAST
LIMIT 15;
