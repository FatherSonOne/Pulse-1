-- Fix existing tables - Add missing columns
-- This migration runs FIRST (timestamp 00000000) to fix any existing tables
-- before other migrations try to use them

-- ===========================================
-- FIX CONTACTS TABLE
-- ===========================================
DO $$ 
BEGIN
  -- Add platform column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'platform'
  ) THEN
    ALTER TABLE contacts ADD COLUMN platform TEXT NOT NULL DEFAULT 'unknown';
    RAISE NOTICE 'Added platform column to contacts';
  END IF;

  -- Add external_id column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'external_id'
  ) THEN
    ALTER TABLE contacts ADD COLUMN external_id TEXT NOT NULL DEFAULT '';
    RAISE NOTICE 'Added external_id column to contacts';
  END IF;
END $$;

-- ===========================================
-- FIX UNIFIED_MESSAGES TABLE
-- ===========================================
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unified_messages') THEN
    -- Add platform column if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'unified_messages' AND column_name = 'platform'
    ) THEN
      ALTER TABLE unified_messages ADD COLUMN platform TEXT NOT NULL DEFAULT 'unknown';
      RAISE NOTICE 'Added platform column to unified_messages';
    END IF;

    -- Add timestamp column if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'unified_messages' AND column_name = 'timestamp'
    ) THEN
      ALTER TABLE unified_messages ADD COLUMN timestamp TIMESTAMPTZ DEFAULT NOW();
      RAISE NOTICE 'Added timestamp column to unified_messages';
    END IF;

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
      ALTER TABLE unified_messages ADD COLUMN external_id TEXT NOT NULL DEFAULT '';
      RAISE NOTICE 'Added external_id column to unified_messages';
    END IF;
  END IF;
END $$;

-- ===========================================
-- FIX CHANNELS TABLE
-- ===========================================
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'channels') THEN
    -- Add platform column if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'channels' AND column_name = 'platform'
    ) THEN
      ALTER TABLE channels ADD COLUMN platform TEXT NOT NULL DEFAULT 'unknown';
      RAISE NOTICE 'Added platform column to channels';
    END IF;

    -- Add external_id column if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'channels' AND column_name = 'external_id'
    ) THEN
      ALTER TABLE channels ADD COLUMN external_id TEXT NOT NULL DEFAULT '';
      RAISE NOTICE 'Added external_id column to channels';
    END IF;
  END IF;
END $$;

-- All fixes applied
SELECT 'Table fixes completed successfully' as status;
