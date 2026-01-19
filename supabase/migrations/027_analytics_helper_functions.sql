-- Additional helper functions for analytics

-- Update contact recency (days since last contact)
CREATE OR REPLACE FUNCTION update_contact_recency(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE analytics_contact_engagement
  SET 
    days_since_last_contact = EXTRACT(DAY FROM (NOW() - last_interaction_at))::INTEGER,
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND last_interaction_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Calculate response rate for a contact
CREATE OR REPLACE FUNCTION calculate_response_rate(
  p_user_id UUID,
  p_contact_identifier TEXT
)
RETURNS NUMERIC AS $$
DECLARE
  v_total_received INTEGER;
  v_total_responded INTEGER;
  v_rate NUMERIC;
BEGIN
  -- Count messages received from contact
  SELECT COUNT(*) INTO v_total_received
  FROM analytics_response_times
  WHERE user_id = p_user_id
    AND contact_identifier = p_contact_identifier;

  -- Count how many we responded to
  SELECT COUNT(*) INTO v_total_responded
  FROM analytics_response_times
  WHERE user_id = p_user_id
    AND contact_identifier = p_contact_identifier
    AND was_responded = true;

  IF v_total_received = 0 THEN
    RETURN 100; -- No data yet, assume 100%
  END IF;

  v_rate := (v_total_responded::NUMERIC / v_total_received::NUMERIC) * 100;
  RETURN ROUND(v_rate, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get average response time for a contact
CREATE OR REPLACE FUNCTION get_avg_response_time(
  p_user_id UUID,
  p_contact_identifier TEXT
)
RETURNS NUMERIC AS $$
DECLARE
  v_avg NUMERIC;
BEGIN
  SELECT AVG(response_time_minutes) INTO v_avg
  FROM analytics_response_times
  WHERE user_id = p_user_id
    AND contact_identifier = p_contact_identifier
    AND was_responded = true;

  RETURN COALESCE(ROUND(v_avg, 2), 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recalculate engagement scores for all contacts
CREATE OR REPLACE FUNCTION recalculate_all_engagement_scores(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_contact RECORD;
  v_new_score NUMERIC;
BEGIN
  FOR v_contact IN 
    SELECT * FROM analytics_contact_engagement WHERE user_id = p_user_id
  LOOP
    -- Calculate new score
    v_new_score := calculate_engagement_score(
      v_contact.total_messages_sent + v_contact.total_messages_received,
      COALESCE(v_contact.response_rate, 50),
      COALESCE(v_contact.avg_response_time_minutes, 60),
      v_contact.days_since_last_contact,
      COALESCE(v_contact.avg_sentiment, 0)
    );

    -- Update the score
    UPDATE analytics_contact_engagement
    SET 
      engagement_score = v_new_score,
      updated_at = NOW()
    WHERE id = v_contact.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get communication trends over time
CREATE OR REPLACE FUNCTION get_communication_trends(
  p_user_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  date DATE,
  total_messages INTEGER,
  sent INTEGER,
  received INTEGER,
  avg_response_time NUMERIC,
  avg_sentiment NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dm.date,
    (dm.messages_sent + dm.messages_received)::INTEGER as total_messages,
    dm.messages_sent::INTEGER as sent,
    dm.messages_received::INTEGER as received,
    dm.avg_response_time_minutes,
    dm.avg_sentiment_score
  FROM analytics_daily_metrics dm
  WHERE dm.user_id = p_user_id
    AND dm.date >= CURRENT_DATE - p_days
  ORDER BY dm.date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_contact_recency(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_response_rate(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_avg_response_time(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_all_engagement_scores(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_communication_trends(UUID, INTEGER) TO authenticated;
