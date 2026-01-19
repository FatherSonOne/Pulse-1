-- Migration: Notification Rules
-- Created: 2026-01-14
-- Description: Custom notification rules for email events

CREATE TABLE IF NOT EXISTS notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,

  -- Conditions
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Notification settings
  notify_desktop BOOLEAN DEFAULT true,
  notify_mobile BOOLEAN DEFAULT true,
  notify_email BOOLEAN DEFAULT false,
  notify_sound TEXT,

  -- Quiet hours
  respect_quiet_hours BOOLEAN DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,

  -- Priority
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT notification_rules_conditions_array CHECK (jsonb_typeof(conditions) = 'array'),
  CONSTRAINT notification_rules_quiet_hours_valid CHECK (
    respect_quiet_hours = false OR (quiet_hours_start IS NOT NULL AND quiet_hours_end IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_notification_rules_user ON notification_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_rules_enabled ON notification_rules(user_id, enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_notification_rules_priority ON notification_rules(user_id, priority);

ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification rules"
  ON notification_rules
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own notification rules"
  ON notification_rules
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification rules"
  ON notification_rules
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notification rules"
  ON notification_rules
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_notification_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notification_rules_updated_at
  BEFORE UPDATE ON notification_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_rules_updated_at();

COMMENT ON TABLE notification_rules IS 'User-defined notification rules for email events';
COMMENT ON COLUMN notification_rules.conditions IS 'Array of conditions for when to notify';
COMMENT ON COLUMN notification_rules.notify_sound IS 'Custom notification sound identifier';
COMMENT ON COLUMN notification_rules.respect_quiet_hours IS 'Whether to suppress notifications during quiet hours';
