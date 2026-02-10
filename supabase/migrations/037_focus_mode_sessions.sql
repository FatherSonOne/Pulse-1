-- Focus Mode Sessions Table
-- Tracks Pomodoro-style focus sessions with analytics
-- Created: 2026-01-19
-- Phase: 5 - Focus Mode

-- Table already exists from remote schema - just add missing columns if needed
DO $$
BEGIN
  -- Add thread_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'focus_sessions'
    AND column_name = 'thread_id'
  ) THEN
    ALTER TABLE focus_sessions ADD COLUMN thread_id TEXT;
  END IF;

  -- Add break_count column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'focus_sessions'
    AND column_name = 'break_count'
  ) THEN
    ALTER TABLE focus_sessions ADD COLUMN break_count INTEGER NOT NULL DEFAULT 0;
  END IF;

  -- Add updated_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'focus_sessions'
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE focus_sessions ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_id ON focus_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_thread_id ON focus_sessions(thread_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_started_at ON focus_sessions(started_at DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_focus_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER focus_sessions_updated_at
  BEFORE UPDATE ON focus_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_focus_sessions_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (drop existing and recreate to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own focus sessions" ON focus_sessions;
DROP POLICY IF EXISTS "Users can create their own focus sessions" ON focus_sessions;
DROP POLICY IF EXISTS "Users can update their own focus sessions" ON focus_sessions;
DROP POLICY IF EXISTS "Users can delete their own focus sessions" ON focus_sessions;

-- Users can only see their own focus sessions
CREATE POLICY "Users can view their own focus sessions"
  ON focus_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own focus sessions
CREATE POLICY "Users can create their own focus sessions"
  ON focus_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own focus sessions
CREATE POLICY "Users can update their own focus sessions"
  ON focus_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own focus sessions
CREATE POLICY "Users can delete their own focus sessions"
  ON focus_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE focus_sessions IS 'Tracks Pomodoro-style focus sessions for productivity analytics';
COMMENT ON COLUMN focus_sessions.id IS 'Unique identifier for the focus session';
COMMENT ON COLUMN focus_sessions.user_id IS 'User who created the focus session';
COMMENT ON COLUMN focus_sessions.thread_id IS 'Thread/conversation being focused on';
COMMENT ON COLUMN focus_sessions.planned_duration_minutes IS 'Planned duration in minutes (default 25 for Pomodoro)';
COMMENT ON COLUMN focus_sessions.actual_duration_minutes IS 'Actual time spent in focus mode';
COMMENT ON COLUMN focus_sessions.started_at IS 'When the focus session started';
COMMENT ON COLUMN focus_sessions.ended_at IS 'When the focus session ended';
COMMENT ON COLUMN focus_sessions.break_count IS 'Number of breaks taken during the session';
COMMENT ON COLUMN focus_sessions.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN focus_sessions.updated_at IS 'Record last update timestamp';
