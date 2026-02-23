-- ============================================================================
-- Phase 3: Subtasks & Activity Log
-- Created: 2026-02-22
-- Purpose: Add subtask management and activity tracking for tasks
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- SUBTASKS TABLE
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES extracted_tasks(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  position INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_subtasks_task_id ON subtasks(task_id);
CREATE INDEX idx_subtasks_workspace_id ON subtasks(workspace_id);
CREATE INDEX idx_subtasks_position ON subtasks(task_id, position);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_subtasks_updated_at
  BEFORE UPDATE ON subtasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ────────────────────────────────────────────────────────────────────────────
-- TASK ACTIVITY TABLE
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS task_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES extracted_tasks(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL, -- 'created', 'status_changed', 'assigned', 'unassigned', 'comment', 'subtask_added', 'subtask_completed', 'edited', 'blocked', 'unblocked', 'deadline_changed', 'priority_changed', 'deleted'
  old_value TEXT,
  new_value TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_task_activity_task_id ON task_activity(task_id);
CREATE INDEX idx_task_activity_workspace_id ON task_activity(workspace_id);
CREATE INDEX idx_task_activity_user_id ON task_activity(user_id);
CREATE INDEX idx_task_activity_created_at ON task_activity(created_at DESC);
CREATE INDEX idx_task_activity_action ON task_activity(action);

-- ────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- ────────────────────────────────────────────────────────────────────────────

-- Enable RLS
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_activity ENABLE ROW LEVEL SECURITY;

-- Subtasks policies: Users can manage subtasks in their workspace
CREATE POLICY "Users can view subtasks in their workspace"
  ON subtasks FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM auth.users WHERE id = auth.uid()
      UNION
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert subtasks in their workspace"
  ON subtasks FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM auth.users WHERE id = auth.uid()
      UNION
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update subtasks in their workspace"
  ON subtasks FOR UPDATE
  USING (
    workspace_id IN (
      SELECT id FROM auth.users WHERE id = auth.uid()
      UNION
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete subtasks in their workspace"
  ON subtasks FOR DELETE
  USING (
    workspace_id IN (
      SELECT id FROM auth.users WHERE id = auth.uid()
      UNION
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Task activity policies: Read-only for users, system can write
CREATE POLICY "Users can view activity in their workspace"
  ON task_activity FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM auth.users WHERE id = auth.uid()
      UNION
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert activity in their workspace"
  ON task_activity FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM auth.users WHERE id = auth.uid()
      UNION
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- HELPER FUNCTION: Auto-log task status changes
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION log_task_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO task_activity (
      task_id,
      workspace_id,
      user_id,
      action,
      old_value,
      new_value,
      metadata
    ) VALUES (
      NEW.id,
      NEW.workspace_id,
      auth.uid(),
      'status_changed',
      OLD.status,
      NEW.status,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'timestamp', now()
      )
    );
  END IF;

  -- Log blocked status with reason
  IF NEW.status = 'blocked' AND OLD.status != 'blocked' THEN
    INSERT INTO task_activity (
      task_id,
      workspace_id,
      user_id,
      action,
      old_value,
      new_value,
      metadata
    ) VALUES (
      NEW.id,
      NEW.workspace_id,
      auth.uid(),
      'blocked',
      NULL,
      NEW.blocked_reason,
      jsonb_build_object(
        'reason', NEW.blocked_reason,
        'timestamp', now()
      )
    );
  END IF;

  -- Log unblocked
  IF OLD.status = 'blocked' AND NEW.status != 'blocked' THEN
    INSERT INTO task_activity (
      task_id,
      workspace_id,
      user_id,
      action,
      old_value,
      new_value,
      metadata
    ) VALUES (
      NEW.id,
      NEW.workspace_id,
      auth.uid(),
      'unblocked',
      OLD.blocked_reason,
      NULL,
      jsonb_build_object(
        'previous_reason', OLD.blocked_reason,
        'timestamp', now()
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-log task status changes
CREATE TRIGGER task_status_change_logger
  AFTER UPDATE ON extracted_tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_status_change();

-- ────────────────────────────────────────────────────────────────────────────
-- HELPER FUNCTION: Update parent task progress based on subtasks
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_task_progress()
RETURNS TRIGGER AS $$
DECLARE
  total_subtasks INTEGER;
  completed_subtasks INTEGER;
  progress_percentage INTEGER;
BEGIN
  -- Count total and completed subtasks for this task
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE is_completed = true)
  INTO total_subtasks, completed_subtasks
  FROM subtasks
  WHERE task_id = COALESCE(NEW.task_id, OLD.task_id);

  -- Calculate progress percentage
  IF total_subtasks > 0 THEN
    progress_percentage := (completed_subtasks * 100) / total_subtasks;
  ELSE
    progress_percentage := 0;
  END IF;

  -- Update task metadata with progress
  UPDATE extracted_tasks
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'subtask_progress', progress_percentage,
    'total_subtasks', total_subtasks,
    'completed_subtasks', completed_subtasks
  ),
  updated_at = now()
  WHERE id = COALESCE(NEW.task_id, OLD.task_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update task progress when subtasks change
CREATE TRIGGER subtask_progress_updater
  AFTER INSERT OR UPDATE OR DELETE ON subtasks
  FOR EACH ROW
  EXECUTE FUNCTION update_task_progress();

-- ────────────────────────────────────────────────────────────────────────────
-- COMMENTS
-- ────────────────────────────────────────────────────────────────────────────

COMMENT ON TABLE subtasks IS 'Subtasks for breaking down larger tasks into manageable steps';
COMMENT ON TABLE task_activity IS 'Activity log for tracking all changes to tasks';
COMMENT ON COLUMN subtasks.position IS 'Display order of subtasks (lower numbers first)';
COMMENT ON COLUMN task_activity.action IS 'Type of activity: created, status_changed, assigned, comment, subtask_added, etc.';
COMMENT ON COLUMN task_activity.metadata IS 'Additional context about the activity in JSON format';

-- ────────────────────────────────────────────────────────────────────────────
-- VERIFICATION
-- ────────────────────────────────────────────────────────────────────────────

-- Verify tables exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subtasks') THEN
    RAISE EXCEPTION 'Table subtasks was not created successfully';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_activity') THEN
    RAISE EXCEPTION 'Table task_activity was not created successfully';
  END IF;

  RAISE NOTICE 'Phase 3 migration completed successfully!';
  RAISE NOTICE 'Created tables: subtasks, task_activity';
  RAISE NOTICE 'Created triggers: task_status_change_logger, subtask_progress_updater';
END $$;
