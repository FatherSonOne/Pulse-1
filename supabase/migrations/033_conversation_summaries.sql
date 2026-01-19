-- Migration: Conversation Summaries
-- Description: Creates tables for storing AI-generated summaries of threads and daily digests
-- Author: Backend Architect Agent
-- Date: 2026-01-19

-- ==================== Conversation Summaries Table ====================

CREATE TABLE IF NOT EXISTS conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_type TEXT NOT NULL CHECK (summary_type IN ('thread', 'daily_digest', 'catch_up', 'channel')),
  reference_id TEXT NOT NULL,
  summary_text TEXT NOT NULL,
  key_points TEXT[] DEFAULT ARRAY[]::TEXT[],
  action_items TEXT[] DEFAULT ARRAY[]::TEXT[],
  decisions TEXT[] DEFAULT ARRAY[]::TEXT[],
  participants TEXT[] DEFAULT ARRAY[]::TEXT[],
  message_count INTEGER DEFAULT 0,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

-- Indexes for efficient lookups
CREATE INDEX idx_summaries_user_id ON conversation_summaries(user_id);
CREATE INDEX idx_summaries_type_reference ON conversation_summaries(summary_type, reference_id);
CREATE INDEX idx_summaries_user_type ON conversation_summaries(user_id, summary_type);
CREATE INDEX idx_summaries_expires_at ON conversation_summaries(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_summaries_generated_at ON conversation_summaries(generated_at DESC);

-- ==================== Summary Cache Table ====================

CREATE TABLE IF NOT EXISTS summary_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,
  summary_data JSONB NOT NULL,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '10 minutes'
);

-- Index for cache lookups and cleanup
CREATE INDEX idx_summary_cache_key ON summary_cache(cache_key);
CREATE INDEX idx_summary_cache_expires_at ON summary_cache(expires_at);

-- ==================== Row Level Security ====================

ALTER TABLE conversation_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE summary_cache ENABLE ROW LEVEL SECURITY;

-- Conversation Summaries Policies
CREATE POLICY "Users can view their own summaries"
  ON conversation_summaries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own summaries"
  ON conversation_summaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own summaries"
  ON conversation_summaries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own summaries"
  ON conversation_summaries FOR DELETE
  USING (auth.uid() = user_id);

-- Summary Cache Policies (shared cache)
CREATE POLICY "Users can view cache entries"
  ON summary_cache FOR SELECT
  USING (true);

CREATE POLICY "System can manage cache"
  ON summary_cache FOR ALL
  USING (true);

-- ==================== Cleanup Function for Expired Records ====================

CREATE OR REPLACE FUNCTION cleanup_expired_summaries()
RETURNS void AS $$
BEGIN
  -- Delete expired summaries
  DELETE FROM conversation_summaries
  WHERE expires_at IS NOT NULL AND expires_at < NOW();

  -- Delete expired cache entries
  DELETE FROM summary_cache
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ==================== Scheduled Cleanup (Run via pg_cron or application) ====================

-- Note: This requires pg_cron extension. If not available, run cleanup from application.
-- SELECT cron.schedule('cleanup-expired-summaries', '0 2 * * *', 'SELECT cleanup_expired_summaries()');

-- ==================== Function to Get or Generate Summary ====================

CREATE OR REPLACE FUNCTION get_cached_summary(
  p_summary_type TEXT,
  p_reference_id TEXT,
  p_user_id UUID
)
RETURNS TABLE (
  summary_text TEXT,
  key_points TEXT[],
  action_items TEXT[],
  decisions TEXT[],
  participants TEXT[],
  message_count INTEGER,
  from_cache BOOLEAN
) AS $$
DECLARE
  v_cache_key TEXT;
BEGIN
  v_cache_key := p_summary_type || ':' || p_reference_id;

  -- Try to get from cache first
  RETURN QUERY
  SELECT
    (summary_data->>'summary_text')::TEXT,
    ARRAY(SELECT jsonb_array_elements_text(summary_data->'key_points'))::TEXT[],
    ARRAY(SELECT jsonb_array_elements_text(summary_data->'action_items'))::TEXT[],
    ARRAY(SELECT jsonb_array_elements_text(summary_data->'decisions'))::TEXT[],
    ARRAY(SELECT jsonb_array_elements_text(summary_data->'participants'))::TEXT[],
    (summary_data->>'message_count')::INTEGER,
    TRUE as from_cache
  FROM summary_cache
  WHERE cache_key = v_cache_key
  AND expires_at > NOW()
  LIMIT 1;

  -- If cache hit, return
  IF FOUND THEN
    RETURN;
  END IF;

  -- Otherwise, try to get from conversation_summaries (within last 10 minutes)
  RETURN QUERY
  SELECT
    cs.summary_text,
    cs.key_points,
    cs.action_items,
    cs.decisions,
    cs.participants,
    cs.message_count,
    FALSE as from_cache
  FROM conversation_summaries cs
  WHERE cs.summary_type = p_summary_type
  AND cs.reference_id = p_reference_id
  AND cs.user_id = p_user_id
  AND cs.generated_at > NOW() - INTERVAL '10 minutes'
  ORDER BY cs.generated_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ==================== Function to Cache Summary ====================

CREATE OR REPLACE FUNCTION cache_summary(
  p_summary_type TEXT,
  p_reference_id TEXT,
  p_summary_data JSONB,
  p_ttl_minutes INTEGER DEFAULT 10
)
RETURNS void AS $$
DECLARE
  v_cache_key TEXT;
BEGIN
  v_cache_key := p_summary_type || ':' || p_reference_id;

  INSERT INTO summary_cache (cache_key, summary_data, message_count, expires_at)
  VALUES (
    v_cache_key,
    p_summary_data,
    (p_summary_data->>'message_count')::INTEGER,
    NOW() + (p_ttl_minutes || ' minutes')::INTERVAL
  )
  ON CONFLICT (cache_key) DO UPDATE
  SET
    summary_data = EXCLUDED.summary_data,
    message_count = EXCLUDED.message_count,
    created_at = NOW(),
    expires_at = EXCLUDED.expires_at;
END;
$$ LANGUAGE plpgsql;

-- ==================== Comments ====================

COMMENT ON TABLE conversation_summaries IS 'Stores AI-generated summaries of conversations, threads, and daily activity';
COMMENT ON TABLE summary_cache IS 'Short-term cache for frequently requested summaries to reduce AI API calls';
COMMENT ON COLUMN conversation_summaries.reference_id IS 'Thread ID, channel ID, or date string depending on summary_type';
COMMENT ON COLUMN conversation_summaries.expires_at IS 'Summaries auto-expire after 30 days to keep storage manageable';
COMMENT ON FUNCTION cleanup_expired_summaries() IS 'Removes expired summaries and cache entries - run daily';
COMMENT ON FUNCTION get_cached_summary(TEXT, TEXT, UUID) IS 'Retrieves summary from cache or recent summaries table';
COMMENT ON FUNCTION cache_summary(TEXT, TEXT, JSONB, INTEGER) IS 'Stores summary in cache with configurable TTL';
