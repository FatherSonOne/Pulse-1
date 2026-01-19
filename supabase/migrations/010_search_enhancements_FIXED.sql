-- ============================================
-- SEARCH ENHANCEMENTS
-- Tables for search history, saved searches, and suggestions
-- ============================================

-- Search history table
CREATE TABLE IF NOT EXISTS search_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  query TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  count INTEGER NOT NULL DEFAULT 1
);

-- Ensure all columns exist (in case table was created without them)
DO $$ 
BEGIN
  -- Ensure count column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'search_history' AND column_name = 'count'
  ) THEN
    ALTER TABLE search_history ADD COLUMN count INTEGER NOT NULL DEFAULT 1;
  END IF;
  
  -- Ensure updated_at column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'search_history' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE search_history ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
  
  -- Ensure created_at column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'search_history' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE search_history ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'search_history_user_id_query_key'
  ) THEN
    ALTER TABLE search_history ADD CONSTRAINT search_history_user_id_query_key UNIQUE(user_id, query);
  END IF;
END $$;

-- Create indexes (ensure columns exist first)
CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id);

-- Only create count index if count column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'search_history' AND column_name = 'count'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_search_history_count ON search_history(user_id, count DESC)';
  END IF;
END $$;

-- Only create updated_at index if column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'search_history' AND column_name = 'updated_at'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_search_history_updated ON search_history(user_id, updated_at DESC)';
  END IF;
END $$;

-- Saved searches table
CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  filters JSONB DEFAULT '{}',
  alert_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  alert_frequency TEXT CHECK (alert_frequency IN ('daily', 'weekly', 'instant')) DEFAULT 'daily',
  last_alert_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all columns exist for saved_searches (in case table was created without them)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'saved_searches' AND column_name = 'alert_enabled'
  ) THEN
    ALTER TABLE saved_searches ADD COLUMN alert_enabled BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'saved_searches' AND column_name = 'alert_frequency'
  ) THEN
    ALTER TABLE saved_searches ADD COLUMN alert_frequency TEXT DEFAULT 'daily';
    -- Add check constraint if it doesn't exist
    BEGIN
      ALTER TABLE saved_searches ADD CONSTRAINT saved_searches_alert_frequency_check 
        CHECK (alert_frequency IN ('daily', 'weekly', 'instant'));
    EXCEPTION WHEN duplicate_object THEN
      -- Constraint already exists, ignore
      NULL;
    END;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'saved_searches' AND column_name = 'last_alert_at'
  ) THEN
    ALTER TABLE saved_searches ADD COLUMN last_alert_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'saved_searches' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE saved_searches ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'saved_searches' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE saved_searches ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'saved_searches' AND column_name = 'filters'
  ) THEN
    ALTER TABLE saved_searches ADD COLUMN filters JSONB DEFAULT '{}';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON saved_searches(user_id);

-- Only create alert index if alert_enabled column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'saved_searches' AND column_name = 'alert_enabled'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_saved_searches_alerts ON saved_searches(user_id, alert_enabled) WHERE alert_enabled = TRUE';
  END IF;
END $$;

-- RLS Policies
DO $$ 
BEGIN
  ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN
  NULL;
END $$;

DO $$ 
BEGIN
  ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN
  NULL;
END $$;

DROP POLICY IF EXISTS "Users can manage their own search history" ON search_history;
CREATE POLICY "Users can manage their own search history"
  ON search_history FOR ALL
  USING (user_id::text = COALESCE(auth.uid()::text, '')::text OR user_id::text = COALESCE(auth.jwt() ->> 'email', '')::text);

DROP POLICY IF EXISTS "Users can manage their own saved searches" ON saved_searches;
CREATE POLICY "Users can manage their own saved searches"
  ON saved_searches FOR ALL
  USING (user_id::text = COALESCE(auth.uid()::text, '')::text OR user_id::text = COALESCE(auth.jwt() ->> 'email', '')::text);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_search_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_search_history_updated_at ON search_history;
CREATE TRIGGER trigger_update_search_history_updated_at
  BEFORE UPDATE ON search_history
  FOR EACH ROW
  EXECUTE FUNCTION update_search_history_updated_at();

CREATE OR REPLACE FUNCTION update_saved_searches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_saved_searches_updated_at ON saved_searches;
CREATE TRIGGER trigger_update_saved_searches_updated_at
  BEFORE UPDATE ON saved_searches
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_searches_updated_at();
