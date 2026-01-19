-- Migration: Advanced Analytics System
-- Provides insights into communication patterns, engagement, and response times

-- Daily communication metrics (aggregated)
CREATE TABLE IF NOT EXISTS analytics_daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Message counts by channel
  messages_sent INTEGER DEFAULT 0,
  messages_received INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  emails_received INTEGER DEFAULT 0,
  sms_sent INTEGER DEFAULT 0,
  sms_received INTEGER DEFAULT 0,
  slack_sent INTEGER DEFAULT 0,
  slack_received INTEGER DEFAULT 0,

  -- Response metrics
  avg_response_time_minutes NUMERIC(10, 2), -- Average time to respond
  fastest_response_minutes NUMERIC(10, 2),
  slowest_response_minutes NUMERIC(10, 2),
  responses_within_1h INTEGER DEFAULT 0,
  responses_within_24h INTEGER DEFAULT 0,
  responses_after_24h INTEGER DEFAULT 0,

  -- Engagement metrics
  active_conversations INTEGER DEFAULT 0,
  new_contacts INTEGER DEFAULT 0,
  unique_contacts_reached INTEGER DEFAULT 0,

  -- Sentiment (if AI analysis is enabled)
  avg_sentiment_score NUMERIC(3, 2), -- -1 to 1
  positive_messages INTEGER DEFAULT 0,
  neutral_messages INTEGER DEFAULT 0,
  negative_messages INTEGER DEFAULT 0,

  -- Time distribution
  peak_hour INTEGER, -- Hour of day with most activity (0-23)
  messages_by_hour JSONB DEFAULT '{}', -- {"0": 5, "1": 2, ...}

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, date)
);

-- Contact engagement scores
CREATE TABLE IF NOT EXISTS analytics_contact_engagement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_identifier TEXT NOT NULL, -- email, phone, or handle
  contact_name TEXT,

  -- Engagement scoring
  engagement_score NUMERIC(5, 2) DEFAULT 0, -- 0-100
  engagement_trend TEXT DEFAULT 'stable', -- rising, falling, stable
  last_interaction_at TIMESTAMPTZ,

  -- Communication stats
  total_messages_sent INTEGER DEFAULT 0,
  total_messages_received INTEGER DEFAULT 0,
  avg_response_time_minutes NUMERIC(10, 2),
  response_rate NUMERIC(5, 2), -- Percentage of messages that got replies

  -- Relationship indicators
  first_contact_at TIMESTAMPTZ,
  days_since_last_contact INTEGER,
  communication_frequency TEXT, -- daily, weekly, monthly, sporadic
  preferred_channel TEXT, -- email, sms, slack

  -- Sentiment history
  avg_sentiment NUMERIC(3, 2),
  sentiment_history JSONB DEFAULT '[]', -- [{date, score}, ...]

  -- Topics/keywords (extracted from conversations)
  common_topics TEXT[] DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, contact_identifier)
);

-- Weekly/Monthly rollup summaries
CREATE TABLE IF NOT EXISTS analytics_period_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL, -- 'week', 'month', 'quarter', 'year'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Totals
  total_messages INTEGER DEFAULT 0,
  total_sent INTEGER DEFAULT 0,
  total_received INTEGER DEFAULT 0,

  -- Channel breakdown
  channel_breakdown JSONB DEFAULT '{}', -- {"email": 100, "sms": 50, ...}

  -- Response performance
  avg_response_time_minutes NUMERIC(10, 2),
  response_rate NUMERIC(5, 2),

  -- Engagement
  active_contacts INTEGER DEFAULT 0,
  new_contacts INTEGER DEFAULT 0,
  churned_contacts INTEGER DEFAULT 0, -- Contacts who stopped responding

  -- Sentiment
  avg_sentiment NUMERIC(3, 2),
  sentiment_trend TEXT, -- improving, declining, stable

  -- Comparison to previous period
  messages_change_percent NUMERIC(5, 2),
  response_time_change_percent NUMERIC(5, 2),
  engagement_change_percent NUMERIC(5, 2),

  -- Insights (AI-generated)
  insights JSONB DEFAULT '[]', -- [{"type": "achievement", "text": "..."}, ...]

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, period_type, period_start)
);

-- Response time tracking (individual messages)
CREATE TABLE IF NOT EXISTS analytics_response_times (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL, -- email, sms, slack
  contact_identifier TEXT NOT NULL,

  -- The message pair
  incoming_message_id TEXT,
  incoming_at TIMESTAMPTZ NOT NULL,
  response_message_id TEXT,
  response_at TIMESTAMPTZ,

  -- Calculated metrics
  response_time_minutes NUMERIC(10, 2),
  was_responded BOOLEAN DEFAULT false,

  -- Context
  thread_id TEXT,
  is_business_hours BOOLEAN, -- If response was during work hours

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_analytics_daily_user_date ON analytics_daily_metrics(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_contact_user ON analytics_contact_engagement(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_contact_score ON analytics_contact_engagement(user_id, engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_period_user ON analytics_period_summary(user_id, period_type, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_response_user ON analytics_response_times(user_id, incoming_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_response_contact ON analytics_response_times(user_id, contact_identifier);

-- Enable RLS
ALTER TABLE analytics_daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_contact_engagement ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_period_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_response_times ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own daily metrics"
  ON analytics_daily_metrics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own daily metrics"
  ON analytics_daily_metrics FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own contact engagement"
  ON analytics_contact_engagement FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own contact engagement"
  ON analytics_contact_engagement FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own period summaries"
  ON analytics_period_summary FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own period summaries"
  ON analytics_period_summary FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own response times"
  ON analytics_response_times FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own response times"
  ON analytics_response_times FOR ALL
  USING (auth.uid() = user_id);

-- Function to calculate engagement score
CREATE OR REPLACE FUNCTION calculate_engagement_score(
  p_total_messages INTEGER,
  p_response_rate NUMERIC,
  p_avg_response_time NUMERIC,
  p_days_since_last INTEGER,
  p_avg_sentiment NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
  v_score NUMERIC := 0;
  v_volume_score NUMERIC;
  v_response_score NUMERIC;
  v_recency_score NUMERIC;
  v_sentiment_score NUMERIC;
BEGIN
  -- Volume score (0-25): More messages = higher score, capped
  v_volume_score := LEAST(p_total_messages / 4.0, 25);

  -- Response score (0-30): Higher response rate = higher score
  v_response_score := COALESCE(p_response_rate, 50) * 0.3;

  -- Recency score (0-25): More recent = higher score
  v_recency_score := CASE
    WHEN p_days_since_last IS NULL THEN 12.5
    WHEN p_days_since_last <= 1 THEN 25
    WHEN p_days_since_last <= 7 THEN 20
    WHEN p_days_since_last <= 30 THEN 15
    WHEN p_days_since_last <= 90 THEN 10
    ELSE 5
  END;

  -- Sentiment score (0-20): Positive sentiment = higher score
  v_sentiment_score := (COALESCE(p_avg_sentiment, 0) + 1) * 10;

  v_score := v_volume_score + v_response_score + v_recency_score + v_sentiment_score;

  RETURN LEAST(GREATEST(v_score, 0), 100);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update daily metrics
CREATE OR REPLACE FUNCTION update_daily_metrics(
  p_user_id UUID,
  p_date DATE,
  p_channel TEXT,
  p_is_sent BOOLEAN,
  p_sentiment_score NUMERIC DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO analytics_daily_metrics (user_id, date, messages_sent, messages_received)
  VALUES (p_user_id, p_date, 0, 0)
  ON CONFLICT (user_id, date) DO NOTHING;

  -- Update counts based on channel and direction
  IF p_is_sent THEN
    UPDATE analytics_daily_metrics
    SET
      messages_sent = messages_sent + 1,
      emails_sent = CASE WHEN p_channel = 'email' THEN emails_sent + 1 ELSE emails_sent END,
      sms_sent = CASE WHEN p_channel = 'sms' THEN sms_sent + 1 ELSE sms_sent END,
      slack_sent = CASE WHEN p_channel = 'slack' THEN slack_sent + 1 ELSE slack_sent END,
      updated_at = NOW()
    WHERE user_id = p_user_id AND date = p_date;
  ELSE
    UPDATE analytics_daily_metrics
    SET
      messages_received = messages_received + 1,
      emails_received = CASE WHEN p_channel = 'email' THEN emails_received + 1 ELSE emails_received END,
      sms_received = CASE WHEN p_channel = 'sms' THEN sms_received + 1 ELSE sms_received END,
      slack_received = CASE WHEN p_channel = 'slack' THEN slack_received + 1 ELSE slack_received END,
      updated_at = NOW()
    WHERE user_id = p_user_id AND date = p_date;
  END IF;

  -- Update sentiment if provided
  IF p_sentiment_score IS NOT NULL THEN
    UPDATE analytics_daily_metrics
    SET
      avg_sentiment_score = COALESCE(
        (avg_sentiment_score * (messages_sent + messages_received - 1) + p_sentiment_score) /
        (messages_sent + messages_received),
        p_sentiment_score
      ),
      positive_messages = CASE WHEN p_sentiment_score > 0.2 THEN positive_messages + 1 ELSE positive_messages END,
      neutral_messages = CASE WHEN p_sentiment_score BETWEEN -0.2 AND 0.2 THEN neutral_messages + 1 ELSE neutral_messages END,
      negative_messages = CASE WHEN p_sentiment_score < -0.2 THEN negative_messages + 1 ELSE negative_messages END,
      updated_at = NOW()
    WHERE user_id = p_user_id AND date = p_date;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get dashboard summary
CREATE OR REPLACE FUNCTION get_analytics_dashboard(
  p_user_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  total_messages BIGINT,
  messages_sent BIGINT,
  messages_received BIGINT,
  avg_response_time NUMERIC,
  response_rate NUMERIC,
  avg_sentiment NUMERIC,
  top_contacts JSONB,
  channel_breakdown JSONB,
  daily_activity JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_data AS (
    SELECT
      SUM(dm.messages_sent + dm.messages_received) as total,
      SUM(dm.messages_sent) as sent,
      SUM(dm.messages_received) as received,
      AVG(dm.avg_response_time_minutes) as avg_resp,
      AVG(dm.avg_sentiment_score) as avg_sent,
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'date', dm.date,
          'sent', dm.messages_sent,
          'received', dm.messages_received,
          'sentiment', dm.avg_sentiment_score
        ) ORDER BY dm.date
      ) as daily
    FROM analytics_daily_metrics dm
    WHERE dm.user_id = p_user_id
      AND dm.date >= CURRENT_DATE - p_days
  ),
  top_contacts_data AS (
    SELECT JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'identifier', ce.contact_identifier,
        'name', ce.contact_name,
        'score', ce.engagement_score,
        'trend', ce.engagement_trend,
        'last_contact', ce.last_interaction_at
      ) ORDER BY ce.engagement_score DESC
    ) as contacts
    FROM (
      SELECT * FROM analytics_contact_engagement
      WHERE user_id = p_user_id
      ORDER BY engagement_score DESC
      LIMIT 10
    ) ce
  ),
  channel_data AS (
    SELECT JSONB_BUILD_OBJECT(
      'email', SUM(COALESCE(emails_sent, 0) + COALESCE(emails_received, 0)),
      'sms', SUM(COALESCE(sms_sent, 0) + COALESCE(sms_received, 0)),
      'slack', SUM(COALESCE(slack_sent, 0) + COALESCE(slack_received, 0))
    ) as channels
    FROM analytics_daily_metrics
    WHERE user_id = p_user_id
      AND date >= CURRENT_DATE - p_days
  )
  SELECT
    COALESCE(dd.total, 0)::BIGINT,
    COALESCE(dd.sent, 0)::BIGINT,
    COALESCE(dd.received, 0)::BIGINT,
    COALESCE(dd.avg_resp, 0)::NUMERIC,
    0::NUMERIC, -- TODO: Calculate actual response rate
    COALESCE(dd.avg_sent, 0)::NUMERIC,
    COALESCE(tc.contacts, '[]'::JSONB),
    COALESCE(cd.channels, '{}'::JSONB),
    COALESCE(dd.daily, '[]'::JSONB)
  FROM daily_data dd
  CROSS JOIN top_contacts_data tc
  CROSS JOIN channel_data cd;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION calculate_engagement_score(INTEGER, NUMERIC, NUMERIC, INTEGER, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION update_daily_metrics(UUID, DATE, TEXT, BOOLEAN, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION get_analytics_dashboard(UUID, INTEGER) TO authenticated;
