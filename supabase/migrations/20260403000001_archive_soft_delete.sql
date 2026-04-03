-- Add soft delete support to archives table
-- Items are marked with deleted_at instead of hard-deleted, allowing undo

ALTER TABLE public.archives
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_archives_deleted_at
  ON public.archives(deleted_at)
  WHERE deleted_at IS NOT NULL;
