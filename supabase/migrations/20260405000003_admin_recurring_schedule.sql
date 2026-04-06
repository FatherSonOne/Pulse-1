-- Add recurring_schedule column to in_app_messages
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'in_app_messages' AND column_name = 'recurring_schedule') THEN
    ALTER TABLE in_app_messages ADD COLUMN recurring_schedule TEXT DEFAULT 'none'
      CHECK (recurring_schedule IN ('none', 'daily', 'weekly', 'monthly'));
  END IF;
END $$;
