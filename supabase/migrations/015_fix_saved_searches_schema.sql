-- Fix saved_searches table schema
-- Adds missing columns and ensures compatibility with briefingService.ts

-- Add last_used column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saved_searches' AND column_name = 'last_used'
  ) THEN
    ALTER TABLE saved_searches ADD COLUMN last_used TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Add include_archives column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saved_searches' AND column_name = 'include_archives'
  ) THEN
    ALTER TABLE saved_searches ADD COLUMN include_archives BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

-- Add include_messages column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saved_searches' AND column_name = 'include_messages'
  ) THEN
    ALTER TABLE saved_searches ADD COLUMN include_messages BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

-- Add include_contacts column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saved_searches' AND column_name = 'include_contacts'
  ) THEN
    ALTER TABLE saved_searches ADD COLUMN include_contacts BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

-- Add include_events column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saved_searches' AND column_name = 'include_events'
  ) THEN
    ALTER TABLE saved_searches ADD COLUMN include_events BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

-- Add is_pinned column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saved_searches' AND column_name = 'is_pinned'
  ) THEN
    ALTER TABLE saved_searches ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add result_count column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saved_searches' AND column_name = 'result_count'
  ) THEN
    ALTER TABLE saved_searches ADD COLUMN result_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Create index on last_used if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_saved_searches_last_used ON saved_searches(user_id, last_used DESC);

-- Create index on pinned if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_saved_searches_pinned ON saved_searches(is_pinned) WHERE is_pinned = TRUE;
