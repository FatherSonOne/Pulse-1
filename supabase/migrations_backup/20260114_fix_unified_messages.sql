-- Fix unified_messages table - Add missing columns
-- This ensures the unified_messages table has all required columns

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unified_messages') THEN
    
    -- Add is_starred column if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'unified_messages' AND column_name = 'is_starred'
    ) THEN
      ALTER TABLE unified_messages ADD COLUMN is_starred BOOLEAN DEFAULT false;
      RAISE NOTICE 'Added is_starred column to unified_messages';
    END IF;

    -- Add external_id column if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'unified_messages' AND column_name = 'external_id'
    ) THEN
      ALTER TABLE unified_messages ADD COLUMN external_id TEXT;
      -- Set default value for existing rows
      UPDATE unified_messages SET external_id = id::text WHERE external_id IS NULL;
      -- Now make it NOT NULL
      ALTER TABLE unified_messages ALTER COLUMN external_id SET NOT NULL;
      RAISE NOTICE 'Added external_id column to unified_messages';
    END IF;

    -- Add is_read column if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'unified_messages' AND column_name = 'is_read'
    ) THEN
      ALTER TABLE unified_messages ADD COLUMN is_read BOOLEAN DEFAULT false;
      RAISE NOTICE 'Added is_read column to unified_messages';
    END IF;

    -- Add content_type column if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'unified_messages' AND column_name = 'content_type'
    ) THEN
      ALTER TABLE unified_messages ADD COLUMN content_type TEXT DEFAULT 'text';
      RAISE NOTICE 'Added content_type column to unified_messages';
    END IF;

    -- Add thread_id column if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'unified_messages' AND column_name = 'thread_id'
    ) THEN
      ALTER TABLE unified_messages ADD COLUMN thread_id TEXT;
      RAISE NOTICE 'Added thread_id column to unified_messages';
    END IF;

    -- Add tags column if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'unified_messages' AND column_name = 'tags'
    ) THEN
      ALTER TABLE unified_messages ADD COLUMN tags TEXT[] DEFAULT '{}';
      RAISE NOTICE 'Added tags column to unified_messages';
    END IF;

  END IF;
END $$;

-- Create indexes now that columns exist
CREATE INDEX IF NOT EXISTS idx_messages_starred ON unified_messages(user_id, is_starred, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_platform ON unified_messages(user_id, platform, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_read_status ON unified_messages(user_id, is_read, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON unified_messages(thread_id);

SELECT 'unified_messages table fixed successfully' as status;
