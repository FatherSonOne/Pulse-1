-- Migration: Email Filters
-- Created: 2026-01-14
-- Description: Automated email processing with custom rules and actions

-- Create email_filters table
CREATE TABLE IF NOT EXISTS email_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  execution_order INTEGER DEFAULT 0,
  
  -- Conditions
  match_type TEXT NOT NULL CHECK (match_type IN ('all', 'any')),
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Actions
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Statistics
  emails_processed INTEGER DEFAULT 0,
  last_applied_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT valid_conditions CHECK (jsonb_typeof(conditions) = 'array'),
  CONSTRAINT valid_actions CHECK (jsonb_typeof(actions) = 'array')
);

-- Create filter_execution_log for debugging and analytics
CREATE TABLE IF NOT EXISTS filter_execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filter_id UUID REFERENCES email_filters(id) ON DELETE CASCADE NOT NULL,
  email_id TEXT NOT NULL, -- References cached_emails.id
  executed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  matched BOOLEAN NOT NULL,
  actions_applied JSONB,
  error_message TEXT,
  execution_time_ms INTEGER
);

-- Create indexes
CREATE INDEX idx_email_filters_user_id ON email_filters(user_id);
CREATE INDEX idx_email_filters_enabled ON email_filters(user_id, enabled) WHERE enabled = true;
CREATE INDEX idx_email_filters_order ON email_filters(user_id, execution_order, enabled);
CREATE INDEX idx_filter_execution_log_filter ON filter_execution_log(filter_id, executed_at DESC);
CREATE INDEX idx_filter_execution_log_email ON filter_execution_log(email_id, executed_at DESC);
CREATE INDEX idx_filter_execution_log_recent ON filter_execution_log(executed_at DESC);

-- Enable RLS
ALTER TABLE email_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE filter_execution_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_filters
CREATE POLICY "Users can view own filters"
  ON email_filters
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own filters"
  ON email_filters
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own filters"
  ON email_filters
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own filters"
  ON email_filters
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for filter_execution_log
CREATE POLICY "Users can view own filter logs"
  ON filter_execution_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM email_filters
      WHERE email_filters.id = filter_execution_log.filter_id
        AND email_filters.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert filter logs"
  ON filter_execution_log
  FOR INSERT
  WITH CHECK (true); -- Allow insert from backend/edge functions

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_email_filter_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_filters_updated_at
  BEFORE UPDATE ON email_filters
  FOR EACH ROW
  EXECUTE FUNCTION update_email_filter_updated_at();

-- Function to validate filter conditions JSON structure
CREATE OR REPLACE FUNCTION validate_filter_conditions()
RETURNS TRIGGER AS $$
DECLARE
  condition JSONB;
  valid_fields TEXT[] := ARRAY['from', 'to', 'subject', 'body', 'has_attachment', 'size', 'label', 'is_starred', 'is_important'];
  valid_operators TEXT[] := ARRAY['contains', 'not_contains', 'is', 'is_not', 'starts_with', 'ends_with', 'matches_regex', 'greater_than', 'less_than'];
BEGIN
  -- Validate conditions array
  FOR condition IN SELECT * FROM jsonb_array_elements(NEW.conditions)
  LOOP
    -- Check required fields
    IF NOT (condition ? 'field' AND condition ? 'operator' AND condition ? 'value') THEN
      RAISE EXCEPTION 'Each condition must have field, operator, and value';
    END IF;
    
    -- Validate field
    IF NOT (condition->>'field' = ANY(valid_fields)) THEN
      RAISE EXCEPTION 'Invalid condition field: %. Valid fields are: %', 
        condition->>'field', array_to_string(valid_fields, ', ');
    END IF;
    
    -- Validate operator
    IF NOT (condition->>'operator' = ANY(valid_operators)) THEN
      RAISE EXCEPTION 'Invalid operator: %. Valid operators are: %', 
        condition->>'operator', array_to_string(valid_operators, ', ');
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_filter_conditions_trigger
  BEFORE INSERT OR UPDATE ON email_filters
  FOR EACH ROW
  EXECUTE FUNCTION validate_filter_conditions();

-- Function to validate filter actions JSON structure
CREATE OR REPLACE FUNCTION validate_filter_actions()
RETURNS TRIGGER AS $$
DECLARE
  action JSONB;
  valid_action_types TEXT[] := ARRAY['apply_label', 'remove_label', 'mark_read', 'mark_unread', 'star', 'unstar', 'archive', 'trash', 'forward', 'mark_important', 'categorize'];
BEGIN
  -- Validate actions array
  FOR action IN SELECT * FROM jsonb_array_elements(NEW.actions)
  LOOP
    -- Check required fields
    IF NOT (action ? 'type') THEN
      RAISE EXCEPTION 'Each action must have a type';
    END IF;
    
    -- Validate action type
    IF NOT (action->>'type' = ANY(valid_action_types)) THEN
      RAISE EXCEPTION 'Invalid action type: %. Valid types are: %', 
        action->>'type', array_to_string(valid_action_types, ', ');
    END IF;
    
    -- Validate required params for specific actions
    IF action->>'type' IN ('apply_label', 'remove_label') THEN
      IF NOT (action->'params' ? 'label_id') THEN
        RAISE EXCEPTION 'Action % requires label_id parameter', action->>'type';
      END IF;
    END IF;
    
    IF action->>'type' = 'forward' THEN
      IF NOT (action->'params' ? 'to_email') THEN
        RAISE EXCEPTION 'Action forward requires to_email parameter';
      END IF;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_filter_actions_trigger
  BEFORE INSERT OR UPDATE ON email_filters
  FOR EACH ROW
  EXECUTE FUNCTION validate_filter_actions();

-- Function to auto-increment execution_order for new filters
CREATE OR REPLACE FUNCTION set_filter_execution_order()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.execution_order = 0 THEN
    SELECT COALESCE(MAX(execution_order), 0) + 1
    INTO NEW.execution_order
    FROM email_filters
    WHERE user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_filter_execution_order_trigger
  BEFORE INSERT ON email_filters
  FOR EACH ROW
  WHEN (NEW.execution_order = 0)
  EXECUTE FUNCTION set_filter_execution_order();

-- Function to cleanup old filter execution logs (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_filter_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM filter_execution_log
  WHERE executed_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON TABLE email_filters IS 'User-defined rules for automatic email processing';
COMMENT ON TABLE filter_execution_log IS 'Log of filter executions for debugging and analytics';
COMMENT ON COLUMN email_filters.match_type IS 'Whether ALL or ANY conditions must match';
COMMENT ON COLUMN email_filters.conditions IS 'Array of condition objects: [{field, operator, value}]';
COMMENT ON COLUMN email_filters.actions IS 'Array of action objects: [{type, params}]';
COMMENT ON COLUMN email_filters.execution_order IS 'Order in which filters are applied (lower number = earlier)';
COMMENT ON COLUMN email_filters.emails_processed IS 'Total count of emails processed by this filter';

-- Example filter condition structure:
-- [
--   {"field": "from", "operator": "contains", "value": "newsletter"},
--   {"field": "has_attachment", "operator": "is", "value": true}
-- ]

-- Example filter action structure:
-- [
--   {"type": "apply_label", "params": {"label_id": "uuid"}},
--   {"type": "mark_read", "params": {}},
--   {"type": "archive", "params": {}}
-- ]
