-- Attention Service Tables
-- Manages attention budget, notification batching, and focus time protection

-- ============= ATTENTION SETTINGS TABLE =============
CREATE TABLE IF NOT EXISTS attention_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  max_daily_notifications INTEGER DEFAULT 50,
  batch_interval_minutes INTEGER DEFAULT 30,
  focus_hours_start TEXT DEFAULT '09:00',
  focus_hours_end TEXT DEFAULT '12:00',
  high_priority_bypass BOOLEAN DEFAULT true,
  weekly_attention_goal INTEGER DEFAULT 20,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for attention settings
ALTER TABLE attention_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attention settings" ON attention_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own attention settings" ON attention_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own attention settings" ON attention_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own attention settings" ON attention_settings
  FOR DELETE USING (auth.uid() = user_id);

-- ============= ATTENTION LOGS TABLE =============
CREATE TABLE IF NOT EXISTS attention_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('notification', 'focus_start', 'focus_end', 'interrupt', 'batch_viewed')),
  source TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_attention_logs_user_date ON attention_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attention_logs_event_type ON attention_logs(user_id, event_type, created_at DESC);

-- RLS for attention logs
ALTER TABLE attention_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attention logs" ON attention_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own attention logs" ON attention_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own attention logs" ON attention_logs
  FOR DELETE USING (auth.uid() = user_id);

-- ============= FOCUS SESSIONS TABLE =============
CREATE TABLE IF NOT EXISTS focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  planned_duration_minutes INTEGER NOT NULL DEFAULT 25,
  actual_duration_minutes INTEGER,
  interruption_count INTEGER DEFAULT 0,
  topic TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'interrupted')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for focus sessions
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_status ON focus_sessions(user_id, status, started_at DESC);

-- RLS for focus sessions
ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own focus sessions" ON focus_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own focus sessions" ON focus_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own focus sessions" ON focus_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own focus sessions" ON focus_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- ============= GRANT PERMISSIONS =============
GRANT ALL ON attention_settings TO authenticated;
GRANT ALL ON attention_logs TO authenticated;
GRANT ALL ON focus_sessions TO authenticated;
