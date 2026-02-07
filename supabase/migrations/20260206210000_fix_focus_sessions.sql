-- Fix migration 037: Add missing thread_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'focus_sessions'
    AND column_name = 'thread_id'
  ) THEN
    ALTER TABLE public.focus_sessions ADD COLUMN thread_id TEXT;
    CREATE INDEX IF NOT EXISTS idx_focus_sessions_thread_id ON public.focus_sessions(thread_id);
  END IF;
END $$;
