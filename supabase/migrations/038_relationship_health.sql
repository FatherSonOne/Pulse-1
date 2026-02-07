-- ================================================
-- Relationship Health Tracking System
-- ================================================

-- Main relationship health table
CREATE TABLE IF NOT EXISTS public.relationship_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_identifier TEXT NOT NULL,
  contact_name TEXT,

  -- Health Metrics
  health_score NUMERIC(5, 2) DEFAULT 50,
  health_status TEXT DEFAULT 'active',

  -- Engagement Patterns
  avg_response_time_user NUMERIC(10, 2),
  avg_response_time_contact NUMERIC(10, 2),
  response_reciprocity_score NUMERIC(5, 2),

  -- Sentiment Tracking
  sentiment_trend TEXT DEFAULT 'stable',
  sentiment_balance NUMERIC(3, 2),
  last_positive_interaction_at TIMESTAMPTZ,
  last_negative_interaction_at TIMESTAMPTZ,

  -- Activity Tracking
  days_since_last_message INTEGER,
  interaction_frequency TEXT,
  longest_gap_days INTEGER,
  conversation_count_30d INTEGER DEFAULT 0,
  message_count_30d INTEGER DEFAULT 0,

  -- Risk Indicators
  at_risk_reason TEXT[],
  intervention_suggested BOOLEAN DEFAULT false,
  intervention_message TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, contact_identifier)
);

-- Indexes
CREATE INDEX idx_relationship_health_user ON public.relationship_health(user_id);
CREATE INDEX idx_relationship_health_status ON public.relationship_health(user_id, health_status);
CREATE INDEX idx_relationship_health_score ON public.relationship_health(user_id, health_score DESC);

-- Enable RLS
ALTER TABLE public.relationship_health ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own relationship health"
  ON public.relationship_health FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own relationship health"
  ON public.relationship_health FOR ALL
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.relationship_health TO authenticated;

-- Function to calculate health score
CREATE OR REPLACE FUNCTION calculate_relationship_health_score(
  p_days_since_last INTEGER,
  p_message_count_30d INTEGER,
  p_reciprocity_score NUMERIC,
  p_sentiment_balance NUMERIC,
  p_conversation_count_30d INTEGER
)
RETURNS NUMERIC AS $$
DECLARE
  v_recency_score NUMERIC := 0;
  v_frequency_score NUMERIC := 0;
  v_reciprocity_score NUMERIC := 0;
  v_sentiment_score NUMERIC := 0;
  v_engagement_score NUMERIC := 0;
  v_total_score NUMERIC;
BEGIN
  -- Recency (30%): Days since last interaction
  v_recency_score := CASE
    WHEN p_days_since_last IS NULL THEN 15
    WHEN p_days_since_last = 0 THEN 30
    WHEN p_days_since_last <= 3 THEN 25
    WHEN p_days_since_last <= 7 THEN 20
    WHEN p_days_since_last <= 14 THEN 15
    WHEN p_days_since_last <= 30 THEN 10
    ELSE 5
  END;

  -- Frequency (25%): Message consistency
  v_frequency_score := LEAST(p_message_count_30d * 0.5, 25);

  -- Reciprocity (20%): Balance in response times
  v_reciprocity_score := COALESCE(p_reciprocity_score, 50) * 0.2;

  -- Sentiment (15%): Overall positive tone
  v_sentiment_score := (COALESCE(p_sentiment_balance, 0) + 1) * 7.5;

  -- Engagement (10%): Depth of conversations
  v_engagement_score := LEAST(p_conversation_count_30d * 2, 10);

  v_total_score := v_recency_score + v_frequency_score + v_reciprocity_score +
                   v_sentiment_score + v_engagement_score;

  RETURN LEAST(GREATEST(v_total_score, 0), 100);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

GRANT EXECUTE ON FUNCTION calculate_relationship_health_score(INTEGER, INTEGER, NUMERIC, NUMERIC, INTEGER) TO authenticated;
