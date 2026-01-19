-- Migration: Auto-Response Rules
-- Description: Creates tables for message auto-response system with rule-based triggers and AI customization
-- Author: Backend Architect Agent
-- Date: 2026-01-19

-- ==================== Auto-Response Rules Table ====================

CREATE TABLE IF NOT EXISTS message_auto_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('smart_reply', 'rule_based', 'out_of_office', 'template')),
  enabled BOOLEAN DEFAULT TRUE,
  trigger_conditions JSONB NOT NULL DEFAULT '{}',
  response_template TEXT NOT NULL,
  ai_customize BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0,
  times_triggered INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_auto_responses_user_id ON message_auto_responses(user_id);
CREATE INDEX idx_auto_responses_enabled ON message_auto_responses(user_id, enabled) WHERE enabled = TRUE;
CREATE INDEX idx_auto_responses_priority ON message_auto_responses(user_id, priority DESC) WHERE enabled = TRUE;

-- ==================== Auto-Response Log Table ====================

CREATE TABLE IF NOT EXISTS message_auto_response_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES message_auto_responses(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  response_sent TEXT NOT NULL,
  ai_customized BOOLEAN DEFAULT FALSE,
  triggered_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for log queries and analytics
CREATE INDEX idx_auto_response_log_rule_id ON message_auto_response_log(rule_id);
CREATE INDEX idx_auto_response_log_channel_id ON message_auto_response_log(channel_id);
CREATE INDEX idx_auto_response_log_triggered_at ON message_auto_response_log(triggered_at DESC);

-- ==================== Row Level Security ====================

ALTER TABLE message_auto_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_auto_response_log ENABLE ROW LEVEL SECURITY;

-- Auto-Response Rules Policies
CREATE POLICY "Users can view their own auto-response rules"
  ON message_auto_responses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own auto-response rules"
  ON message_auto_responses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own auto-response rules"
  ON message_auto_responses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own auto-response rules"
  ON message_auto_responses FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-Response Log Policies
CREATE POLICY "Users can view their own auto-response logs"
  ON message_auto_response_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM message_auto_responses
      WHERE message_auto_responses.id = message_auto_response_log.rule_id
      AND message_auto_responses.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert auto-response logs"
  ON message_auto_response_log FOR INSERT
  WITH CHECK (true);

-- ==================== Trigger Function for Updated At ====================

CREATE OR REPLACE FUNCTION update_auto_response_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_response_updated_at
  BEFORE UPDATE ON message_auto_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_auto_response_updated_at();

-- ==================== Trigger Function for Times Triggered ====================

CREATE OR REPLACE FUNCTION increment_auto_response_trigger_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE message_auto_responses
  SET
    times_triggered = times_triggered + 1,
    last_triggered_at = NEW.triggered_at
  WHERE id = NEW.rule_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_response_log_insert
  AFTER INSERT ON message_auto_response_log
  FOR EACH ROW
  EXECUTE FUNCTION increment_auto_response_trigger_count();

-- ==================== Sample Data (Optional) ====================

-- Example out-of-office rule
-- INSERT INTO message_auto_responses (user_id, rule_type, trigger_conditions, response_template, ai_customize, priority)
-- VALUES (
--   (SELECT id FROM auth.users LIMIT 1),
--   'out_of_office',
--   '{"keywords": [], "timeRange": {"start": "18:00", "end": "09:00"}}'::JSONB,
--   'Thanks for your message! I''m currently out of office and will respond when I return on {date}.',
--   TRUE,
--   100
-- );

-- ==================== Comments ====================

COMMENT ON TABLE message_auto_responses IS 'Stores auto-response rules with trigger conditions and templates';
COMMENT ON TABLE message_auto_response_log IS 'Logs all auto-response triggers for analytics and debugging';
COMMENT ON COLUMN message_auto_responses.trigger_conditions IS 'JSONB with keywords[], senders[], channels[], timeRange {start, end}';
COMMENT ON COLUMN message_auto_responses.response_template IS 'Template with variables: {sender_name}, {date}, {time}';
COMMENT ON COLUMN message_auto_responses.ai_customize IS 'Whether to use AI to personalize the response based on context';
COMMENT ON COLUMN message_auto_responses.priority IS 'Higher priority rules are evaluated first (descending order)';
