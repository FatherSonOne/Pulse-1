-- Fix: Add workspace_id column to tasks table
-- This aligns tasks table with decisions table and the TypeScript service expectations

-- Add workspace_id column to tasks table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'workspace_id'
  ) THEN
    -- Add the column (nullable at first)
    ALTER TABLE public.tasks ADD COLUMN workspace_id UUID;

    -- Populate workspace_id for existing tasks
    -- Option 1: If you have a way to map user_id to workspace_id, use that
    -- Option 2: Set all existing tasks to the first workspace (for dev/testing)
    -- Uncomment ONE of the following:

    -- For single workspace scenario (testing/dev):
    -- UPDATE public.tasks SET workspace_id = (SELECT id FROM auth.users LIMIT 1) WHERE workspace_id IS NULL;

    -- For multi-workspace scenario, you'll need to map user_id to workspace_id
    -- based on your business logic

    RAISE NOTICE 'Added workspace_id column to tasks table';
  ELSE
    RAISE NOTICE 'workspace_id column already exists in tasks table';
  END IF;
END $$;

-- Add index for workspace_id queries
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_id ON public.tasks(workspace_id);

-- Verify the change
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tasks'
  AND column_name = 'workspace_id';
