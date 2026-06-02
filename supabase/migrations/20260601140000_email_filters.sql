-- Email Filters: user-defined rules for automatic email processing.
-- Applied to live pulse-chat 2026-06-01 (WI-10, email repair plan).
-- Consumer: src/services/emailFilterService.ts + src/components/Email/FilterManager.tsx.
-- Forward-migrated from migrations_backup/20260114_email_filters.sql with:
--   * search_path pinned on all 5 functions (2026-05-31 security baseline)
--   * filter_execution_log INSERT policy ownership-scoped (the backup used a
--     wide-open WITH CHECK(true), which trips a permissive-policy advisor)
-- NOTE: the execution engine (emailFilterService.applyFilters/executeAction)
-- has no production caller yet — this ships rule CRUD + schema; automatic
-- application to incoming mail is not wired.

CREATE TABLE IF NOT EXISTS email_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  execution_order INTEGER DEFAULT 0,
  match_type TEXT NOT NULL CHECK (match_type IN ('all', 'any')),
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  emails_processed INTEGER DEFAULT 0,
  last_applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT valid_conditions CHECK (jsonb_typeof(conditions) = 'array'),
  CONSTRAINT valid_actions CHECK (jsonb_typeof(actions) = 'array')
);

CREATE TABLE IF NOT EXISTS filter_execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filter_id UUID REFERENCES email_filters(id) ON DELETE CASCADE NOT NULL,
  email_id TEXT NOT NULL,
  executed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  matched BOOLEAN NOT NULL,
  actions_applied JSONB,
  error_message TEXT,
  execution_time_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_email_filters_user_id ON email_filters(user_id);
CREATE INDEX IF NOT EXISTS idx_email_filters_enabled ON email_filters(user_id, enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_email_filters_order ON email_filters(user_id, execution_order, enabled);
CREATE INDEX IF NOT EXISTS idx_filter_execution_log_filter ON filter_execution_log(filter_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_filter_execution_log_email ON filter_execution_log(email_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_filter_execution_log_recent ON filter_execution_log(executed_at DESC);

ALTER TABLE email_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE filter_execution_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own filters" ON email_filters FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own filters" ON email_filters FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own filters" ON email_filters FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own filters" ON email_filters FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own filter logs" ON filter_execution_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM email_filters WHERE email_filters.id = filter_execution_log.filter_id AND email_filters.user_id = auth.uid()));
CREATE POLICY "Users can insert own filter logs" ON filter_execution_log FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM email_filters WHERE email_filters.id = filter_execution_log.filter_id AND email_filters.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION update_email_filter_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $func$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $func$;

CREATE TRIGGER email_filters_updated_at BEFORE UPDATE ON email_filters
  FOR EACH ROW EXECUTE FUNCTION update_email_filter_updated_at();

CREATE OR REPLACE FUNCTION validate_filter_conditions()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $func$
DECLARE
  condition JSONB;
  valid_fields TEXT[] := ARRAY['from','to','subject','body','has_attachment','size','label','is_starred','is_important'];
  valid_operators TEXT[] := ARRAY['contains','not_contains','is','is_not','starts_with','ends_with','matches_regex','greater_than','less_than'];
BEGIN
  FOR condition IN SELECT * FROM jsonb_array_elements(NEW.conditions) LOOP
    IF NOT (condition ? 'field' AND condition ? 'operator' AND condition ? 'value') THEN
      RAISE EXCEPTION 'Each condition must have field, operator, and value'; END IF;
    IF NOT (condition->>'field' = ANY(valid_fields)) THEN
      RAISE EXCEPTION 'Invalid condition field: %', condition->>'field'; END IF;
    IF NOT (condition->>'operator' = ANY(valid_operators)) THEN
      RAISE EXCEPTION 'Invalid operator: %', condition->>'operator'; END IF;
  END LOOP;
  RETURN NEW;
END; $func$;

CREATE TRIGGER validate_filter_conditions_trigger BEFORE INSERT OR UPDATE ON email_filters
  FOR EACH ROW EXECUTE FUNCTION validate_filter_conditions();

CREATE OR REPLACE FUNCTION validate_filter_actions()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $func$
DECLARE
  action JSONB;
  valid_action_types TEXT[] := ARRAY['apply_label','remove_label','mark_read','mark_unread','star','unstar','archive','trash','forward','mark_important','categorize'];
BEGIN
  FOR action IN SELECT * FROM jsonb_array_elements(NEW.actions) LOOP
    IF NOT (action ? 'type') THEN RAISE EXCEPTION 'Each action must have a type'; END IF;
    IF NOT (action->>'type' = ANY(valid_action_types)) THEN
      RAISE EXCEPTION 'Invalid action type: %', action->>'type'; END IF;
    IF action->>'type' IN ('apply_label','remove_label') THEN
      IF NOT (action->'params' ? 'label_id') THEN RAISE EXCEPTION 'Action % requires label_id parameter', action->>'type'; END IF;
    END IF;
    IF action->>'type' = 'forward' THEN
      IF NOT (action->'params' ? 'to_email') THEN RAISE EXCEPTION 'Action forward requires to_email parameter'; END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END; $func$;

CREATE TRIGGER validate_filter_actions_trigger BEFORE INSERT OR UPDATE ON email_filters
  FOR EACH ROW EXECUTE FUNCTION validate_filter_actions();

CREATE OR REPLACE FUNCTION set_filter_execution_order()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $func$
BEGIN
  IF NEW.execution_order = 0 THEN
    SELECT COALESCE(MAX(execution_order), 0) + 1 INTO NEW.execution_order
    FROM email_filters WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END; $func$;

CREATE TRIGGER set_filter_execution_order_trigger BEFORE INSERT ON email_filters
  FOR EACH ROW WHEN (NEW.execution_order = 0) EXECUTE FUNCTION set_filter_execution_order();

CREATE OR REPLACE FUNCTION cleanup_old_filter_logs()
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $func$
BEGIN DELETE FROM filter_execution_log WHERE executed_at < NOW() - INTERVAL '30 days'; END; $func$;

COMMENT ON TABLE email_filters IS 'User-defined rules for automatic email processing';
COMMENT ON TABLE filter_execution_log IS 'Log of filter executions for debugging and analytics';
