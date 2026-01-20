-- Focus Mode Sessions Table
-- Tracks Pomodoro-style focus sessions with analytics
-- Created: 2026-01-19
-- Phase: 5 - Focus Mode

-- Create focus_sessions table
CREATE TABLE IF NOT EXISTS focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 25,
  actual_duration_minutes INTEGER,
  completed BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  break_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_id ON focus_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_thread_id ON focus_sessions(thread_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_started_at ON focus_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_completed ON focus_sessions(completed);

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

-- RLS Policies
-- Users can only see their own focus sessions
CREATE POLICY "Users can view their own focus sessions"
  ON focus_sessions
  FOR SELECT
  USING (auth.uid()::text = user_id);

-- Users can insert their own focus sessions
CREATE POLICY "Users can create their own focus sessions"
  ON focus_sessions
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Users can update their own focus sessions
CREATE POLICY "Users can update their own focus sessions"
  ON focus_sessions
  FOR UPDATE
  USING (auth.uid()::text = user_id);

-- Users can delete their own focus sessions
CREATE POLICY "Users can delete their own focus sessions"
  ON focus_sessions
  FOR DELETE
  USING (auth.uid()::text = user_id);

-- Add comments for documentation
COMMENT ON TABLE focus_sessions IS 'Tracks Pomodoro-style focus sessions for productivity analytics';
COMMENT ON COLUMN focus_sessions.id IS 'Unique identifier for the focus session';
COMMENT ON COLUMN focus_sessions.user_id IS 'User who created the focus session';
COMMENT ON COLUMN focus_sessions.thread_id IS 'Thread/conversation being focused on';
COMMENT ON COLUMN focus_sessions.duration_minutes IS 'Planned duration in minutes (default 25 for Pomodoro)';
COMMENT ON COLUMN focus_sessions.actual_duration_minutes IS 'Actual time spent in focus mode';
COMMENT ON COLUMN focus_sessions.completed IS 'Whether the session was completed successfully';
COMMENT ON COLUMN focus_sessions.started_at IS 'When the focus session started';
COMMENT ON COLUMN focus_sessions.ended_at IS 'When the focus session ended';
COMMENT ON COLUMN focus_sessions.break_count IS 'Number of breaks taken during the session';
COMMENT ON COLUMN focus_sessions.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN focus_sessions.updated_at IS 'Record last update timestamp';
