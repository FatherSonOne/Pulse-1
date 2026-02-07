-- ============================================================================
-- PULSE ANALYTICS ENHANCEMENTS - PHASE 1: ALL DATABASE MIGRATIONS
-- Apply this entire file in Supabase Dashboard > SQL Editor
-- ============================================================================

-- ================================================
-- Migration 038: Relationship Health Tracking System
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
CREATE INDEX IF NOT EXISTS idx_relationship_health_user ON public.relationship_health(user_id);
CREATE INDEX IF NOT EXISTS idx_relationship_health_status ON public.relationship_health(user_id, health_status);
CREATE INDEX IF NOT EXISTS idx_relationship_health_score ON public.relationship_health(user_id, health_score DESC);

-- Enable RLS
ALTER TABLE public.relationship_health ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own relationship health" ON public.relationship_health;
CREATE POLICY "Users can view own relationship health"
  ON public.relationship_health FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own relationship health" ON public.relationship_health;
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


-- ================================================
-- Migration 039: Conflict Detection & Tracking System
-- ================================================

-- Main conflict tracking table
CREATE TABLE IF NOT EXISTS public.conflict_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_identifier TEXT NOT NULL,

  -- Conflict Identification
  conflict_type TEXT,
  severity TEXT DEFAULT 'low',
  status TEXT DEFAULT 'active',

  -- Message Context
  channel TEXT,
  first_message_id TEXT,
  first_detected_at TIMESTAMPTZ NOT NULL,
  related_message_ids TEXT[],

  -- Content Analysis
  trigger_topic TEXT,
  trigger_keywords TEXT[],
  tension_score NUMERIC(3, 2),

  -- Participants
  initiated_by TEXT,
  escalated_by TEXT,

  -- Resolution Tracking
  resolved_at TIMESTAMPTZ,
  resolution_message_id TEXT,
  resolution_method TEXT,
  time_to_resolution_hours NUMERIC(10, 2),

  -- Pattern Analysis
  is_recurring BOOLEAN DEFAULT false,
  previous_conflict_ids UUID[],
  hot_topic BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hot Topics tracking
CREATE TABLE IF NOT EXISTS public.hot_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_identifier TEXT NOT NULL,
  topic TEXT NOT NULL,

  -- Metrics
  conflict_count INTEGER DEFAULT 1,
  avg_severity NUMERIC(3, 2),
  last_conflict_at TIMESTAMPTZ,

  -- Suggestions
  avoidance_recommended BOOLEAN DEFAULT false,
  communication_tip TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, contact_identifier, topic)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conflict_tracking_user ON public.conflict_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_conflict_tracking_status ON public.conflict_tracking(user_id, status);
CREATE INDEX IF NOT EXISTS idx_conflict_tracking_contact ON public.conflict_tracking(user_id, contact_identifier);
CREATE INDEX IF NOT EXISTS idx_hot_topics_user ON public.hot_topics(user_id, conflict_count DESC);

-- Enable RLS
ALTER TABLE public.conflict_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hot_topics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own conflicts" ON public.conflict_tracking;
CREATE POLICY "Users can view own conflicts"
  ON public.conflict_tracking FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own conflicts" ON public.conflict_tracking;
CREATE POLICY "Users can manage own conflicts"
  ON public.conflict_tracking FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own hot topics" ON public.hot_topics;
CREATE POLICY "Users can view own hot topics"
  ON public.hot_topics FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own hot topics" ON public.hot_topics;
CREATE POLICY "Users can manage own hot topics"
  ON public.hot_topics FOR ALL
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conflict_tracking TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hot_topics TO authenticated;


-- ================================================
-- Migration 040: Recognition & Kudos Tracking System
-- ================================================

-- Recognition events table
CREATE TABLE IF NOT EXISTS public.recognition_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Event Details
  event_type TEXT NOT NULL,
  recognition_category TEXT,

  -- Participants
  from_contact_identifier TEXT,
  from_contact_name TEXT,
  to_contact_identifier TEXT,
  to_contact_name TEXT,
  direction TEXT NOT NULL,

  -- Message Context
  channel TEXT NOT NULL,
  message_id TEXT,
  message_excerpt TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Sentiment & Impact
  positivity_score NUMERIC(3, 2),
  impact_level TEXT DEFAULT 'medium',

  -- Recognition Content
  keywords_detected TEXT[],
  topic TEXT,

  -- Milestone Detection
  is_milestone BOOLEAN DEFAULT false,
  milestone_type TEXT,
  milestone_description TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recognition summary (aggregated view)
CREATE TABLE IF NOT EXISTS public.recognition_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_identifier TEXT NOT NULL,
  contact_name TEXT,

  -- Counts
  kudos_received_count INTEGER DEFAULT 0,
  kudos_given_count INTEGER DEFAULT 0,
  total_recognition_events INTEGER DEFAULT 0,

  -- Scores
  appreciation_score NUMERIC(5, 2) DEFAULT 0,
  reciprocity_score NUMERIC(5, 2) DEFAULT 50,

  -- Recent Activity
  last_kudos_received_at TIMESTAMPTZ,
  last_kudos_given_at TIMESTAMPTZ,

  -- Trends
  recognition_trend TEXT DEFAULT 'stable',

  -- Top Categories
  most_appreciated_for TEXT[],
  most_appreciates_about TEXT[],

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, contact_identifier)
);

-- Wins tracker
CREATE TABLE IF NOT EXISTS public.wins_tracker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Win Details
  win_title TEXT NOT NULL,
  win_description TEXT,
  win_type TEXT,

  -- Context
  mentioned_in_message_id TEXT,
  mentioned_by_contact TEXT,
  channel TEXT,
  detected_at TIMESTAMPTZ NOT NULL,

  -- Celebration
  celebrated BOOLEAN DEFAULT false,
  celebration_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recognition_events_user ON public.recognition_events(user_id);
CREATE INDEX IF NOT EXISTS idx_recognition_events_direction ON public.recognition_events(user_id, direction);
CREATE INDEX IF NOT EXISTS idx_recognition_events_date ON public.recognition_events(user_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_recognition_summary_user ON public.recognition_summary(user_id);
CREATE INDEX IF NOT EXISTS idx_recognition_summary_score ON public.recognition_summary(user_id, appreciation_score DESC);
CREATE INDEX IF NOT EXISTS idx_wins_tracker_user ON public.wins_tracker(user_id, detected_at DESC);

-- Enable RLS
ALTER TABLE public.recognition_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recognition_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wins_tracker ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own recognition events" ON public.recognition_events;
CREATE POLICY "Users can view own recognition events"
  ON public.recognition_events FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own recognition events" ON public.recognition_events;
CREATE POLICY "Users can manage own recognition events"
  ON public.recognition_events FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own recognition summary" ON public.recognition_summary;
CREATE POLICY "Users can view own recognition summary"
  ON public.recognition_summary FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own recognition summary" ON public.recognition_summary;
CREATE POLICY "Users can manage own recognition summary"
  ON public.recognition_summary FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own wins" ON public.wins_tracker;
CREATE POLICY "Users can view own wins"
  ON public.wins_tracker FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own wins" ON public.wins_tracker;
CREATE POLICY "Users can manage own wins"
  ON public.wins_tracker FOR ALL
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recognition_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recognition_summary TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wins_tracker TO authenticated;


-- ================================================
-- Migration 041: Predictive Analytics System
-- ================================================

-- Predictions cache table
CREATE TABLE IF NOT EXISTS public.predictions_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Prediction Scope
  prediction_type TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_identifier TEXT,

  -- Prediction Results
  prediction_value NUMERIC(5, 2),
  confidence_level NUMERIC(3, 2),
  prediction_label TEXT,

  -- Supporting Data
  factors JSONB,
  recommendations TEXT[],

  -- Temporal
  predicted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  -- Outcome Tracking
  outcome_tracked BOOLEAN DEFAULT false,
  actual_outcome TEXT,
  prediction_accuracy NUMERIC(3, 2),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ML Training data
CREATE TABLE IF NOT EXISTS public.ml_training_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Feature Vector
  features JSONB NOT NULL,

  -- Labels/Outcomes
  outcome_type TEXT NOT NULL,
  outcome_value BOOLEAN,
  outcome_timestamp TIMESTAMPTZ,

  -- Context
  data_point_date DATE NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Burnout indicators
CREATE TABLE IF NOT EXISTS public.burnout_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Risk Assessment
  burnout_risk_score NUMERIC(5, 2),
  risk_level TEXT,

  -- Contributing Factors
  avg_response_time_increasing BOOLEAN,
  message_volume_increasing BOOLEAN,
  sentiment_declining BOOLEAN,
  working_hours_extending BOOLEAN,
  weekend_activity_high BOOLEAN,
  response_quality_dropping BOOLEAN,

  -- Patterns
  messages_per_day_7d NUMERIC(5, 1),
  messages_per_day_30d NUMERIC(5, 1),
  avg_response_time_7d NUMERIC(10, 2),
  avg_response_time_30d NUMERIC(10, 2),

  -- Recommendations
  recommended_actions TEXT[],

  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_predictions_cache_user ON public.predictions_cache(user_id, prediction_type);
CREATE INDEX IF NOT EXISTS idx_predictions_cache_valid ON public.predictions_cache(user_id, valid_until);
CREATE INDEX IF NOT EXISTS idx_ml_training_data_user ON public.ml_training_data(user_id, outcome_type);
CREATE INDEX IF NOT EXISTS idx_burnout_indicators_user ON public.burnout_indicators(user_id, assessed_at DESC);

-- Enable RLS
ALTER TABLE public.predictions_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ml_training_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.burnout_indicators ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own predictions" ON public.predictions_cache;
CREATE POLICY "Users can view own predictions"
  ON public.predictions_cache FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own predictions" ON public.predictions_cache;
CREATE POLICY "Users can manage own predictions"
  ON public.predictions_cache FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own training data" ON public.ml_training_data;
CREATE POLICY "Users can view own training data"
  ON public.ml_training_data FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own training data" ON public.ml_training_data;
CREATE POLICY "Users can manage own training data"
  ON public.ml_training_data FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own burnout indicators" ON public.burnout_indicators;
CREATE POLICY "Users can view own burnout indicators"
  ON public.burnout_indicators FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own burnout indicators" ON public.burnout_indicators;
CREATE POLICY "Users can manage own burnout indicators"
  ON public.burnout_indicators FOR ALL
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.predictions_cache TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ml_training_data TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.burnout_indicators TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Created tables:
--   - relationship_health
--   - conflict_tracking
--   - hot_topics
--   - recognition_events
--   - recognition_summary
--   - wins_tracker
--   - predictions_cache
--   - ml_training_data
--   - burnout_indicators
--
-- All tables have:
--   ✓ Row Level Security enabled
--   ✓ Proper indexes for performance
--   ✓ User-scoped policies
--   ✓ Grants for authenticated users
-- ============================================================================
