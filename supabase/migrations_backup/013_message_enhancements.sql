-- Message Enhancements Database Migration
-- Adds support for thread actions, message analytics, and conversation features

-- ============================================
-- THREAD ACTIONS & MANAGEMENT
-- ============================================

-- Add thread management columns to conversations or create thread_actions table
CREATE TABLE IF NOT EXISTS thread_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_starred BOOLEAN DEFAULT FALSE,
  is_muted BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  pinned_at TIMESTAMPTZ,
  starred_at TIMESTAMPTZ,
  muted_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, conversation_id)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_thread_actions_user ON thread_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_thread_actions_pinned ON thread_actions(user_id, is_pinned) WHERE is_pinned = TRUE;
CREATE INDEX IF NOT EXISTS idx_thread_actions_starred ON thread_actions(user_id, is_starred) WHERE is_starred = TRUE;

-- RLS Policies for thread_actions
ALTER TABLE thread_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own thread actions"
  ON thread_actions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own thread actions"
  ON thread_actions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own thread actions"
  ON thread_actions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own thread actions"
  ON thread_actions FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- MESSAGE IMPACT & ANALYTICS
-- ============================================

CREATE TABLE IF NOT EXISTS message_impact (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  impact_score NUMERIC(4,2) DEFAULT 0,
  immediate_readers INTEGER DEFAULT 0,
  total_readers INTEGER DEFAULT 0,
  decisions_generated INTEGER DEFAULT 0,
  actions_generated INTEGER DEFAULT 0,
  referenced_count INTEGER DEFAULT 0,
  cross_channel_mentions INTEGER DEFAULT 0,
  engagement_rate NUMERIC(5,2) DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id)
);

CREATE INDEX IF NOT EXISTS idx_message_impact_score ON message_impact(impact_score DESC);
CREATE INDEX IF NOT EXISTS idx_message_impact_conversation ON message_impact(conversation_id);

-- ============================================
-- CONVERSATION HEALTH TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS conversation_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  health_score INTEGER DEFAULT 50,
  avg_response_time_hours NUMERIC(8,2),
  response_trend TEXT, -- 'improving', 'declining', 'stable'
  engagement_level TEXT, -- 'high', 'medium', 'low'
  participation_rate NUMERIC(5,2),
  overall_sentiment TEXT, -- 'positive', 'neutral', 'negative'
  sentiment_trend TEXT,
  tasks_created INTEGER DEFAULT 0,
  decisions_count INTEGER DEFAULT 0,
  action_items_created INTEGER DEFAULT 0,
  communication_style TEXT, -- 'collaborative', 'informational'
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_health_user ON conversation_health(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_health_score ON conversation_health(health_score DESC);

-- RLS for conversation health
ALTER TABLE conversation_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversation health"
  ON conversation_health FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversation health"
  ON conversation_health FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversation health"
  ON conversation_health FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- CONVERSATION MEMORY & DNA
-- ============================================

CREATE TABLE IF NOT EXISTS conversation_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  common_topics TEXT[] DEFAULT ARRAY[]::TEXT[],
  usual_participants TEXT[] DEFAULT ARRAY[]::TEXT[],
  typical_deadlines TEXT[] DEFAULT ARRAY[]::TEXT[],
  frequent_links TEXT[] DEFAULT ARRAY[]::TEXT[],
  milestones JSONB DEFAULT '[]'::JSONB,
  dna_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_memory_user ON conversation_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_memory_dna ON conversation_memory(dna_hash);

-- RLS for conversation memory
ALTER TABLE conversation_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversation memory"
  ON conversation_memory FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own conversation memory"
  ON conversation_memory FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- MESSAGE TRANSLATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS message_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  confidence NUMERIC(3,2) DEFAULT 0.95,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, target_language)
);

CREATE INDEX IF NOT EXISTS idx_message_translations_message ON message_translations(message_id);

-- RLS for translations
ALTER TABLE message_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own translations"
  ON message_translations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own translations"
  ON message_translations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- USER ACHIEVEMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL,
  rarity TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  max_progress INTEGER NOT NULL,
  unlocked BOOLEAN DEFAULT FALSE,
  unlocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_unlocked ON user_achievements(user_id, unlocked) WHERE unlocked = TRUE;

-- RLS for achievements
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own achievements"
  ON user_achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own achievements"
  ON user_achievements FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- USER STATISTICS (for achievement tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS user_message_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  messages_sent INTEGER DEFAULT 0,
  fast_responses INTEGER DEFAULT 0,
  tasks_created INTEGER DEFAULT 0,
  decisions_made INTEGER DEFAULT 0,
  people_helped TEXT[] DEFAULT ARRAY[]::TEXT[],
  active_conversations TEXT[] DEFAULT ARRAY[]::TEXT[],
  login_streak INTEGER DEFAULT 0,
  last_login_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_stats_user ON user_message_statistics(user_id);

-- RLS for statistics
ALTER TABLE user_message_statistics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own statistics"
  ON user_message_statistics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own statistics"
  ON user_message_statistics FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- SMART SUGGESTIONS CACHE
-- ============================================

CREATE TABLE IF NOT EXISTS smart_suggestions_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  context_hash TEXT NOT NULL,
  suggestions JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour',
  UNIQUE(user_id, conversation_id, context_hash)
);

CREATE INDEX IF NOT EXISTS idx_suggestions_user_conversation ON smart_suggestions_cache(user_id, conversation_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_expires ON smart_suggestions_cache(expires_at);

-- RLS for suggestions cache
ALTER TABLE smart_suggestions_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their own suggestions"
  ON smart_suggestions_cache FOR ALL
  USING (auth.uid() = user_id);

-- Auto-cleanup expired suggestions
CREATE OR REPLACE FUNCTION cleanup_expired_suggestions()
RETURNS void AS $$
BEGIN
  DELETE FROM smart_suggestions_cache
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get or create thread actions
CREATE OR REPLACE FUNCTION get_or_create_thread_actions(
  p_user_id UUID,
  p_conversation_id UUID
)
RETURNS thread_actions AS $$
DECLARE
  v_actions thread_actions;
BEGIN
  SELECT * INTO v_actions
  FROM thread_actions
  WHERE user_id = p_user_id AND conversation_id = p_conversation_id;
  
  IF NOT FOUND THEN
    INSERT INTO thread_actions (user_id, conversation_id)
    VALUES (p_user_id, p_conversation_id)
    RETURNING * INTO v_actions;
  END IF;
  
  RETURN v_actions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Toggle thread pin
CREATE OR REPLACE FUNCTION toggle_thread_pin(
  p_user_id UUID,
  p_conversation_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_pinned BOOLEAN;
BEGIN
  -- Get or create actions
  PERFORM get_or_create_thread_actions(p_user_id, p_conversation_id);
  
  -- Toggle pin
  UPDATE thread_actions
  SET 
    is_pinned = NOT is_pinned,
    pinned_at = CASE WHEN NOT is_pinned THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE user_id = p_user_id AND conversation_id = p_conversation_id
  RETURNING is_pinned INTO v_is_pinned;
  
  RETURN v_is_pinned;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Similar functions for star, mute, archive
CREATE OR REPLACE FUNCTION toggle_thread_star(p_user_id UUID, p_conversation_id UUID)
RETURNS BOOLEAN AS $$
DECLARE v_is_starred BOOLEAN;
BEGIN
  PERFORM get_or_create_thread_actions(p_user_id, p_conversation_id);
  UPDATE thread_actions SET is_starred = NOT is_starred, starred_at = CASE WHEN NOT is_starred THEN NOW() ELSE NULL END, updated_at = NOW()
  WHERE user_id = p_user_id AND conversation_id = p_conversation_id RETURNING is_starred INTO v_is_starred;
  RETURN v_is_starred;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION toggle_thread_mute(p_user_id UUID, p_conversation_id UUID)
RETURNS BOOLEAN AS $$
DECLARE v_is_muted BOOLEAN;
BEGIN
  PERFORM get_or_create_thread_actions(p_user_id, p_conversation_id);
  UPDATE thread_actions SET is_muted = NOT is_muted, muted_at = CASE WHEN NOT is_muted THEN NOW() ELSE NULL END, updated_at = NOW()
  WHERE user_id = p_user_id AND conversation_id = p_conversation_id RETURNING is_muted INTO v_is_muted;
  RETURN v_is_muted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION toggle_thread_archive(p_user_id UUID, p_conversation_id UUID)
RETURNS BOOLEAN AS $$
DECLARE v_is_archived BOOLEAN;
BEGIN
  PERFORM get_or_create_thread_actions(p_user_id, p_conversation_id);
  UPDATE thread_actions SET is_archived = NOT is_archived, archived_at = CASE WHEN NOT is_archived THEN NOW() ELSE NULL END, updated_at = NOW()
  WHERE user_id = p_user_id AND conversation_id = p_conversation_id RETURNING is_archived INTO v_is_archived;
  RETURN v_is_archived;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update user statistics
CREATE OR REPLACE FUNCTION increment_user_stat(
  p_user_id UUID,
  p_stat_name TEXT,
  p_increment INTEGER DEFAULT 1
)
RETURNS void AS $$
BEGIN
  INSERT INTO user_message_statistics (user_id, messages_sent, fast_responses, tasks_created, decisions_made)
  VALUES (p_user_id, 
    CASE WHEN p_stat_name = 'messages_sent' THEN p_increment ELSE 0 END,
    CASE WHEN p_stat_name = 'fast_responses' THEN p_increment ELSE 0 END,
    CASE WHEN p_stat_name = 'tasks_created' THEN p_increment ELSE 0 END,
    CASE WHEN p_stat_name = 'decisions_made' THEN p_increment ELSE 0 END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    messages_sent = user_message_statistics.messages_sent + 
      CASE WHEN p_stat_name = 'messages_sent' THEN p_increment ELSE 0 END,
    fast_responses = user_message_statistics.fast_responses + 
      CASE WHEN p_stat_name = 'fast_responses' THEN p_increment ELSE 0 END,
    tasks_created = user_message_statistics.tasks_created + 
      CASE WHEN p_stat_name = 'tasks_created' THEN p_increment ELSE 0 END,
    decisions_made = user_message_statistics.decisions_made + 
      CASE WHEN p_stat_name = 'decisions_made' THEN p_increment ELSE 0 END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE thread_actions IS 'User-specific actions on conversation threads (pin, star, mute, archive)';
COMMENT ON TABLE message_impact IS 'Analytics data tracking the impact and reach of individual messages';
COMMENT ON TABLE conversation_health IS 'Health metrics for conversations including response times and engagement';
COMMENT ON TABLE conversation_memory IS 'Long-term memory and patterns detected in conversations';
COMMENT ON TABLE message_translations IS 'Cached translations of messages for multi-language support';
COMMENT ON TABLE user_achievements IS 'Gamification achievements earned by users';
COMMENT ON TABLE user_message_statistics IS 'Aggregated statistics for achievement tracking';
COMMENT ON TABLE smart_suggestions_cache IS 'Cached AI-generated suggestions to reduce API calls';
