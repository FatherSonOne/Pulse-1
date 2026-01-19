-- ============================================
-- Brainstorm Sessions and AI Cache Tables
-- ============================================
-- Created: 2026-01-19
-- Purpose: Support AI-powered brainstorming features with session persistence and AI response caching

-- ============================================
-- Brainstorm Sessions Table
-- ============================================

CREATE TABLE IF NOT EXISTS brainstorm_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  framework TEXT, -- 'scamper', 'six_hats', 'free_form'
  ideas JSONB DEFAULT '[]'::JSONB,
  clusters JSONB DEFAULT '[]'::JSONB,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collaborators UUID[] DEFAULT ARRAY[]::UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AI Cache Table
-- ============================================
-- Stores AI responses to reduce API calls and costs
-- Expires after 24 hours by default

CREATE TABLE IF NOT EXISTS brainstorm_ai_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT,
  operation_type TEXT NOT NULL, -- 'cluster', 'expand', 'synthesize', 'gaps', etc.
  input_hash TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

-- ============================================
-- Indexes for Performance
-- ============================================

CREATE INDEX idx_brainstorm_sessions_owner ON brainstorm_sessions(owner_id);
CREATE INDEX idx_brainstorm_sessions_updated ON brainstorm_sessions(updated_at DESC);
CREATE INDEX idx_brainstorm_sessions_framework ON brainstorm_sessions(framework) WHERE framework IS NOT NULL;

CREATE INDEX idx_brainstorm_ai_cache_lookup ON brainstorm_ai_cache(session_id, operation_type, input_hash);
CREATE INDEX idx_brainstorm_ai_cache_expires ON brainstorm_ai_cache(expires_at);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

ALTER TABLE brainstorm_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE brainstorm_ai_cache ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions and sessions they're invited to
CREATE POLICY "Users can view their own brainstorm sessions"
  ON brainstorm_sessions FOR SELECT
  USING (auth.uid() = owner_id OR auth.uid() = ANY(collaborators));

-- Users can create their own sessions
CREATE POLICY "Users can create brainstorm sessions"
  ON brainstorm_sessions FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Users can update their own sessions or sessions where they're collaborators
CREATE POLICY "Users can update their brainstorm sessions"
  ON brainstorm_sessions FOR UPDATE
  USING (auth.uid() = owner_id OR auth.uid() = ANY(collaborators));

-- Users can delete their own sessions
CREATE POLICY "Users can delete their brainstorm sessions"
  ON brainstorm_sessions FOR DELETE
  USING (auth.uid() = owner_id);

-- AI Cache is accessible to all authenticated users (shared cache)
-- This allows caching to work across users for common operations
CREATE POLICY "Authenticated users can read AI cache"
  ON brainstorm_ai_cache FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can write AI cache"
  ON brainstorm_ai_cache FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- Automatic Cleanup Function
-- ============================================
-- Periodically clean up expired cache entries

CREATE OR REPLACE FUNCTION cleanup_expired_brainstorm_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM brainstorm_ai_cache
  WHERE expires_at < NOW();
END;
$$;

-- ============================================
-- Trigger to Update updated_at Timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_brainstorm_session_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_brainstorm_session_timestamp
  BEFORE UPDATE ON brainstorm_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_brainstorm_session_updated_at();

-- ============================================
-- Comments for Documentation
-- ============================================

COMMENT ON TABLE brainstorm_sessions IS 'Stores AI-powered brainstorming sessions with ideas and clusters';
COMMENT ON TABLE brainstorm_ai_cache IS 'Caches AI responses to reduce API costs and improve performance';

COMMENT ON COLUMN brainstorm_sessions.framework IS 'Brainstorming framework used: scamper, six_hats, or free_form';
COMMENT ON COLUMN brainstorm_sessions.ideas IS 'Array of brainstorm ideas with votes, tags, and metadata';
COMMENT ON COLUMN brainstorm_sessions.clusters IS 'Array of idea clusters created by AI or user';
COMMENT ON COLUMN brainstorm_sessions.collaborators IS 'Array of user IDs who can view and edit this session';

COMMENT ON COLUMN brainstorm_ai_cache.operation_type IS 'Type of AI operation: cluster, expand, synthesize, gaps, etc.';
COMMENT ON COLUMN brainstorm_ai_cache.input_hash IS 'Hash of input data for cache lookup';
COMMENT ON COLUMN brainstorm_ai_cache.expires_at IS 'Cache expiration time (default 24 hours)';
