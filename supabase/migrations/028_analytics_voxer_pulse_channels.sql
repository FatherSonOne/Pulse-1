-- Migration: Add Voxer and Pulse channels to Analytics
-- Extends analytics system to track voxer voice messages and pulse messages

-- Add new columns to analytics_daily_metrics for voxer and pulse channels
ALTER TABLE analytics_daily_metrics
ADD COLUMN IF NOT EXISTS voxer_sent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS voxer_received INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pulse_sent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pulse_received INTEGER DEFAULT 0;

-- Update the daily metrics function to handle voxer and pulse channels
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
      voxer_sent = CASE WHEN p_channel = 'voxer' THEN voxer_sent + 1 ELSE voxer_sent END,
      pulse_sent = CASE WHEN p_channel = 'pulse' THEN pulse_sent + 1 ELSE pulse_sent END,
      updated_at = NOW()
    WHERE user_id = p_user_id AND date = p_date;
  ELSE
    UPDATE analytics_daily_metrics
    SET
      messages_received = messages_received + 1,
      emails_received = CASE WHEN p_channel = 'email' THEN emails_received + 1 ELSE emails_received END,
      sms_received = CASE WHEN p_channel = 'sms' THEN sms_received + 1 ELSE sms_received END,
      slack_received = CASE WHEN p_channel = 'slack' THEN slack_received + 1 ELSE slack_received END,
      voxer_received = CASE WHEN p_channel = 'voxer' THEN voxer_received + 1 ELSE voxer_received END,
      pulse_received = CASE WHEN p_channel = 'pulse' THEN pulse_received + 1 ELSE pulse_received END,
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

-- Update the dashboard function to include voxer and pulse in channel breakdown
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
      'slack', SUM(COALESCE(slack_sent, 0) + COALESCE(slack_received, 0)),
      'voxer', SUM(COALESCE(voxer_sent, 0) + COALESCE(voxer_received, 0)),
      'pulse', SUM(COALESCE(pulse_sent, 0) + COALESCE(pulse_received, 0))
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
GRANT EXECUTE ON FUNCTION update_daily_metrics(UUID, DATE, TEXT, BOOLEAN, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION get_analytics_dashboard(UUID, INTEGER) TO authenticated;
