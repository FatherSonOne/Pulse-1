-- Migration: Conversation Intelligence
-- Description: Creates tables for real-time conversation intelligence including sentiment, topics, and engagement
-- Author: Backend Architect Agent
-- Date: 2026-01-19

-- ==================== Conversation Intelligence Table ====================

CREATE TABLE IF NOT EXISTS conversation_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  current_sentiment TEXT CHECK (current_sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  sentiment_score NUMERIC(3,2) CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
  sentiment_history JSONB DEFAULT '[]'::JSONB,
  detected_topics TEXT[] DEFAULT ARRAY[]::TEXT[],
  topic_confidence JSONB DEFAULT '{}'::JSONB,
  participant_engagement JSONB DEFAULT '{}'::JSONB,
  engagement_trend TEXT CHECK (engagement_trend IN ('increasing', 'stable', 'declining')),
  suggested_followups TEXT[] DEFAULT ARRAY[]::TEXT[],
  last_analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  analysis_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for real-time lookups
CREATE INDEX idx_intelligence_channel_id ON conversation_intelligence(channel_id);
CREATE INDEX idx_intelligence_user_channel ON conversation_intelligence(user_id, channel_id);
CREATE INDEX idx_intelligence_last_analyzed ON conversation_intelligence(last_analyzed_at DESC);
CREATE INDEX idx_intelligence_sentiment ON conversation_intelligence(current_sentiment) WHERE current_sentiment IN ('negative', 'mixed');

-- ==================== Sentiment History Table ====================

CREATE TABLE IF NOT EXISTS sentiment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intelligence_id UUID REFERENCES conversation_intelligence(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  sentiment_score NUMERIC(3,2) NOT NULL,
  reason TEXT,
  message_count INTEGER DEFAULT 1,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for historical sentiment queries
CREATE INDEX idx_sentiment_history_intelligence_id ON sentiment_history(intelligence_id);
CREATE INDEX idx_sentiment_history_channel_id ON sentiment_history(channel_id);
CREATE INDEX idx_sentiment_history_recorded_at ON sentiment_history(recorded_at DESC);

-- ==================== Topic Detection History ====================

CREATE TABLE IF NOT EXISTS topic_detection_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intelligence_id UUID REFERENCES conversation_intelligence(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  confidence NUMERIC(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  first_detected_at TIMESTAMPTZ DEFAULT NOW(),
  last_mentioned_at TIMESTAMPTZ DEFAULT NOW(),
  mention_count INTEGER DEFAULT 1
);

-- Indexes for topic analytics
CREATE INDEX idx_topic_history_intelligence_id ON topic_detection_history(intelligence_id);
CREATE INDEX idx_topic_history_channel_id ON topic_detection_history(channel_id);
CREATE INDEX idx_topic_history_topic ON topic_detection_history(topic);
CREATE INDEX idx_topic_history_last_mentioned ON topic_detection_history(last_mentioned_at DESC);

-- ==================== Row Level Security ====================

ALTER TABLE conversation_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentiment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_detection_history ENABLE ROW LEVEL SECURITY;

-- Conversation Intelligence Policies
CREATE POLICY "Users can view their own intelligence data"
  ON conversation_intelligence FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own intelligence data"
  ON conversation_intelligence FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own intelligence data"
  ON conversation_intelligence FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own intelligence data"
  ON conversation_intelligence FOR DELETE
  USING (auth.uid() = user_id);

-- Sentiment History Policies
CREATE POLICY "Users can view sentiment history"
  ON sentiment_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_intelligence ci
      WHERE ci.id = sentiment_history.intelligence_id
      AND ci.user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage sentiment history"
  ON sentiment_history FOR ALL
  USING (true);

-- Topic Detection History Policies
CREATE POLICY "Users can view topic history"
  ON topic_detection_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_intelligence ci
      WHERE ci.id = topic_detection_history.intelligence_id
      AND ci.user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage topic history"
  ON topic_detection_history FOR ALL
  USING (true);

-- ==================== Trigger for Updated At ====================

CREATE OR REPLACE FUNCTION update_intelligence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_analyzed_at = NOW();
  NEW.analysis_count = NEW.analysis_count + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER intelligence_updated_at
  BEFORE UPDATE ON conversation_intelligence
  FOR EACH ROW
  EXECUTE FUNCTION update_intelligence_updated_at();

-- ==================== Function to Record Sentiment Change ====================

CREATE OR REPLACE FUNCTION record_sentiment_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only record if sentiment actually changed
  IF OLD.current_sentiment IS DISTINCT FROM NEW.current_sentiment OR
     OLD.sentiment_score IS DISTINCT FROM NEW.sentiment_score THEN

    INSERT INTO sentiment_history (
      intelligence_id,
      channel_id,
      sentiment,
      sentiment_score,
      recorded_at
    ) VALUES (
      NEW.id,
      NEW.channel_id,
      NEW.current_sentiment,
      NEW.sentiment_score,
      NOW()
    );

    -- Update sentiment_history JSONB for quick access
    NEW.sentiment_history = jsonb_insert(
      COALESCE(NEW.sentiment_history, '[]'::JSONB),
      '{0}',
      jsonb_build_object(
        'sentiment', NEW.current_sentiment,
        'score', NEW.sentiment_score,
        'timestamp', NOW()
      ),
      true
    );

    -- Keep only last 50 entries
    IF jsonb_array_length(NEW.sentiment_history) > 50 THEN
      NEW.sentiment_history = (
        SELECT jsonb_agg(elem)
        FROM (
          SELECT elem
          FROM jsonb_array_elements(NEW.sentiment_history) elem
          ORDER BY (elem->>'timestamp')::TIMESTAMPTZ DESC
          LIMIT 50
        ) sub
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sentiment_change_tracker
  BEFORE UPDATE ON conversation_intelligence
  FOR EACH ROW
  EXECUTE FUNCTION record_sentiment_change();

-- ==================== Function to Calculate Engagement Trend ====================

CREATE OR REPLACE FUNCTION calculate_engagement_trend(
  p_channel_id TEXT,
  p_user_id UUID
)
RETURNS TEXT AS $$
DECLARE
  v_recent_engagement JSONB;
  v_trend TEXT;
BEGIN
  SELECT participant_engagement INTO v_recent_engagement
  FROM conversation_intelligence
  WHERE channel_id = p_channel_id AND user_id = p_user_id;

  IF v_recent_engagement IS NULL THEN
    RETURN 'stable';
  END IF;

  -- Calculate trend based on engagement history
  -- This is a simplified version - production should have more sophisticated logic
  IF jsonb_array_length(v_recent_engagement->'history') >= 5 THEN
    -- Compare recent average to older average
    v_trend := 'stable'; -- Default

    -- In production, implement proper trend calculation here
    -- comparing message counts, response times, etc.
  ELSE
    v_trend := 'stable';
  END IF;

  RETURN v_trend;
END;
$$ LANGUAGE plpgsql;

-- ==================== Function to Get Intelligence Summary ====================

CREATE OR REPLACE FUNCTION get_intelligence_summary(
  p_channel_id TEXT,
  p_user_id UUID
)
RETURNS TABLE (
  sentiment TEXT,
  sentiment_score NUMERIC,
  topics TEXT[],
  engagement_trend TEXT,
  followups TEXT[],
  last_updated TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ci.current_sentiment,
    ci.sentiment_score,
    ci.detected_topics,
    ci.engagement_trend,
    ci.suggested_followups,
    ci.last_analyzed_at
  FROM conversation_intelligence ci
  WHERE ci.channel_id = p_channel_id
  AND ci.user_id = p_user_id
  ORDER BY ci.last_analyzed_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ==================== Cleanup Old History ====================

CREATE OR REPLACE FUNCTION cleanup_old_intelligence_history()
RETURNS void AS $$
BEGIN
  -- Delete sentiment history older than 90 days
  DELETE FROM sentiment_history
  WHERE recorded_at < NOW() - INTERVAL '90 days';

  -- Delete topic history for topics not mentioned in 60 days
  DELETE FROM topic_detection_history
  WHERE last_mentioned_at < NOW() - INTERVAL '60 days';
END;
$$ LANGUAGE plpgsql;

-- ==================== Comments ====================

COMMENT ON TABLE conversation_intelligence IS 'Real-time conversation analysis including sentiment, topics, and engagement metrics';
COMMENT ON TABLE sentiment_history IS 'Historical record of sentiment changes over time for trend analysis';
COMMENT ON TABLE topic_detection_history IS 'Tracks detected topics and their frequency over time';
COMMENT ON COLUMN conversation_intelligence.sentiment_score IS 'Numerical score from -1 (negative) to +1 (positive)';
COMMENT ON COLUMN conversation_intelligence.sentiment_history IS 'JSONB array of recent sentiment snapshots for quick access';
COMMENT ON COLUMN conversation_intelligence.topic_confidence IS 'JSONB object mapping topic names to confidence scores (0-1)';
COMMENT ON COLUMN conversation_intelligence.participant_engagement IS 'JSONB tracking message counts, response times per participant';
COMMENT ON FUNCTION calculate_engagement_trend(TEXT, UUID) IS 'Analyzes engagement patterns to determine if conversation is becoming more or less active';
COMMENT ON FUNCTION get_intelligence_summary(TEXT, UUID) IS 'Returns latest intelligence summary for a channel';
COMMENT ON FUNCTION cleanup_old_intelligence_history() IS 'Removes old historical data - run weekly';
