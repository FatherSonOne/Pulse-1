-- Test Matrix Results Table
-- Stores test statuses and notes for each tester

CREATE TABLE IF NOT EXISTS test_matrix_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pass', 'fail', 'pending', 'blocked')),
  notes TEXT DEFAULT '',
  tester_name TEXT DEFAULT '',
  user_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one result per test per user
  CONSTRAINT unique_test_per_user UNIQUE (test_id, user_id)
);

-- Create index for faster queries by user
CREATE INDEX IF NOT EXISTS idx_test_matrix_user_id ON test_matrix_results(user_id);

-- Create index for faster queries by test_id
CREATE INDEX IF NOT EXISTS idx_test_matrix_test_id ON test_matrix_results(test_id);

-- Enable Row Level Security
ALTER TABLE test_matrix_results ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own test results
CREATE POLICY "Users can read own test results"
  ON test_matrix_results
  FOR SELECT
  USING (auth.uid()::text = user_id OR user_id = 'anonymous');

-- Policy: Users can insert their own test results
CREATE POLICY "Users can insert own test results"
  ON test_matrix_results
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id OR user_id = 'anonymous');

-- Policy: Users can update their own test results
CREATE POLICY "Users can update own test results"
  ON test_matrix_results
  FOR UPDATE
  USING (auth.uid()::text = user_id OR user_id = 'anonymous');

-- Policy: Users can delete their own test results
CREATE POLICY "Users can delete own test results"
  ON test_matrix_results
  FOR DELETE
  USING (auth.uid()::text = user_id OR user_id = 'anonymous');
