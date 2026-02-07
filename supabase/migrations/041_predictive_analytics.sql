-- ================================================
-- Predictive Analytics System
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
CREATE INDEX idx_predictions_cache_user ON public.predictions_cache(user_id, prediction_type);
CREATE INDEX idx_predictions_cache_valid ON public.predictions_cache(user_id, valid_until);
CREATE INDEX idx_ml_training_data_user ON public.ml_training_data(user_id, outcome_type);
CREATE INDEX idx_burnout_indicators_user ON public.burnout_indicators(user_id, assessed_at DESC);

-- Enable RLS
ALTER TABLE public.predictions_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ml_training_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.burnout_indicators ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own predictions"
  ON public.predictions_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own predictions"
  ON public.predictions_cache FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own training data"
  ON public.ml_training_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own training data"
  ON public.ml_training_data FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own burnout indicators"
  ON public.burnout_indicators FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own burnout indicators"
  ON public.burnout_indicators FOR ALL
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.predictions_cache TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ml_training_data TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.burnout_indicators TO authenticated;
