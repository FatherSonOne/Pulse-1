-- Sample Data for AI-Enhanced Decisions & Tasks (SIMPLE VERSION)
-- Only uses columns that definitely exist

-- ============================================
-- SAMPLE DECISIONS
-- ============================================

-- Decision 1: Stale (2 days old, no votes)
INSERT INTO decisions (
  workspace_id,
  proposal_text,
  status,
  decision_type,
  created_by,
  created_at,
  updated_at
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'Choose CI/CD Platform: GitHub Actions vs GitLab CI vs Jenkins',
  'voting',
  'technical',
  (SELECT id FROM auth.users LIMIT 1),
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days'
);

-- Decision 2: Recent voting
INSERT INTO decisions (
  workspace_id,
  proposal_text,
  status,
  decision_type,
  created_by,
  created_at,
  updated_at,
  ai_risk_level
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'Migrate to Microservices Architecture',
  'voting',
  'technical',
  (SELECT id FROM auth.users LIMIT 1),
  NOW() - INTERVAL '6 hours',
  NOW() - INTERVAL '6 hours',
  'high'
);

-- Decision 3: Decided
INSERT INTO decisions (
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
  (SELECT id FROM auth.users LIMIT 1),
  'Switch to TypeScript for better type safety',
  'decided',
  'technical',
  (SELECT id FROM auth.users LIMIT 1),
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day',
  'medium'
);

-- Decision 4: Product decision
INSERT INTO decisions (
  workspace_id,
  proposal_text,
  status,
  decision_type,
  created_by,
  created_at,
  updated_at
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'Add Dark Mode to Mobile App',
  'voting',
  'product',
  (SELECT id FROM auth.users LIMIT 1),
  NOW() - INTERVAL '12 hours',
  NOW() - INTERVAL '12 hours'
);

-- ============================================
-- SAMPLE TASKS
-- ============================================

-- Task 1: OVERDUE AND URGENT
INSERT INTO tasks (
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
  ai_priority_score
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'Fix Critical Security Vulnerability',
  'SQL injection vulnerability in authentication',
  'in_progress',
  'urgent',
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM auth.users LIMIT 1),
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '5 days',
  NOW(),
  95.0
);

-- Task 2: Due today
INSERT INTO tasks (
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
  ai_priority_score,
  ai_predicted_duration
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'Complete API Documentation',
  'Write comprehensive API docs',
  'in_progress',
  'high',
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM auth.users LIMIT 1),
  NOW() + INTERVAL '8 hours',
  NOW() - INTERVAL '3 days',
  NOW(),
  82.0,
  '4-6 hours'
);

-- Task 3: High priority
INSERT INTO tasks (
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
  ai_priority_score
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'Set Up Staging Environment',
  'Configure staging server (blocks 3 tasks)',
  'todo',
  'high',
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM auth.users LIMIT 1),
  NOW() + INTERVAL '2 days',
  NOW() - INTERVAL '1 day',
  NOW(),
  88.0
);

-- Task 4: Medium priority
INSERT INTO tasks (
  workspace_id,
  title,
  status,
  priority,
  assigned_to,
  created_by,
  due_date,
  created_at,
  updated_at,
  ai_priority_score
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'Refactor User Service',
  'todo',
  'medium',
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM auth.users LIMIT 1),
  NOW() + INTERVAL '1 week',
  NOW() - INTERVAL '2 days',
  NOW(),
  65.0
);

-- Task 5: Completed
INSERT INTO tasks (
  workspace_id,
  title,
  status,
  priority,
  assigned_to,
  created_by,
  due_date,
  completed_at,
  created_at,
  updated_at,
  ai_priority_score
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'Update Dependencies',
  'done',
  'medium',
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM auth.users LIMIT 1),
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '6 hours',
  NOW() - INTERVAL '4 days',
  NOW(),
  70.0
);

-- Task 6: Low priority
INSERT INTO tasks (
  workspace_id,
  title,
  status,
  priority,
  assigned_to,
  created_by,
  due_date,
  created_at,
  updated_at,
  ai_priority_score
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'Design New Landing Page',
  'todo',
  'low',
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM auth.users LIMIT 1),
  NOW() + INTERVAL '2 weeks',
  NOW() - INTERVAL '1 day',
  NOW(),
  45.0
);

-- Task 7: Future task
INSERT INTO tasks (
  workspace_id,
  title,
  status,
  priority,
  assigned_to,
  created_by,
  due_date,
  created_at,
  updated_at,
  ai_priority_score
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'Deploy New Features to Production',
  'todo',
  'high',
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM auth.users LIMIT 1),
  NOW() + INTERVAL '3 days',
  NOW() - INTERVAL '1 day',
  NOW(),
  75.0
);

-- ============================================
-- VERIFICATION
-- ============================================

SELECT '✅ Sample data created successfully!' AS status;

SELECT
  'Decisions Created' as info,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'voting') as voting,
  COUNT(*) FILTER (WHERE status = 'decided') as decided
FROM decisions
WHERE created_at > NOW() - INTERVAL '1 week';

SELECT
  'Tasks Created' as info,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'todo') as todo,
  COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
  COUNT(*) FILTER (WHERE status = 'done') as done,
  COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'done') as overdue
FROM tasks
WHERE created_at > NOW() - INTERVAL '1 week';
