-- ============================================
-- UNIFIED SEARCH - CLIPBOARD/STICKY NOTES
-- Table for saving search results, notes, and building blocks
-- ============================================

CREATE TABLE IF NOT EXISTS search_clipboard (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  
  -- Content details
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'note' CHECK (content_type IN ('note', 'message', 'conversation', 'snippet', 'reminder')),
  
  -- Source reference (what was this clipped from?)
  source_type TEXT, -- 'message', 'email', 'vox', 'task', etc.
  source_id TEXT, -- ID of the original item
  source_url TEXT, -- Optional URL to the original item
  
  -- Organization
  tags TEXT[] DEFAULT '{}',
  category TEXT, -- 'ideas', 'todo', 'reference', 'conversation', etc.
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Relationships
  related_items JSONB DEFAULT '[]', -- Array of {type, id} for related items
  conversation_id TEXT, -- Link to conversation if this is part of one
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Position for sticky notes (if using visual board)
  position_x INTEGER,
  position_y INTEGER,
  
  -- Color/theme
  color TEXT DEFAULT '#FFD700' -- Default yellow sticky note color
);

CREATE INDEX IF NOT EXISTS idx_search_clipboard_user_id ON search_clipboard(user_id);
CREATE INDEX IF NOT EXISTS idx_search_clipboard_category ON search_clipboard(user_id, category);
CREATE INDEX IF NOT EXISTS idx_search_clipboard_tags ON search_clipboard USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_search_clipboard_pinned ON search_clipboard(user_id, pinned DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_clipboard_source ON search_clipboard(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_search_clipboard_updated ON search_clipboard(user_id, updated_at DESC);

-- Create GIN index for full-text search on clipboard content
CREATE INDEX IF NOT EXISTS idx_search_clipboard_content_gin ON search_clipboard USING gin(content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_search_clipboard_title_gin ON search_clipboard USING gin(title gin_trgm_ops);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_search_clipboard_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_search_clipboard_updated_at ON search_clipboard;
CREATE TRIGGER trigger_update_search_clipboard_updated_at
  BEFORE UPDATE ON search_clipboard
  FOR EACH ROW
  EXECUTE FUNCTION update_search_clipboard_updated_at();

-- RLS Policies
DO $$ 
BEGIN
  ALTER TABLE search_clipboard ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN
  -- RLS already enabled, ignore
  NULL;
END $$;

DROP POLICY IF EXISTS "Users can view their own clipboard items" ON search_clipboard;
CREATE POLICY "Users can view their own clipboard items"
  ON search_clipboard FOR SELECT
  USING (auth.uid()::text = user_id OR auth.jwt() ->> 'email' = user_id);

DROP POLICY IF EXISTS "Users can insert their own clipboard items" ON search_clipboard;
CREATE POLICY "Users can insert their own clipboard items"
  ON search_clipboard FOR INSERT
  WITH CHECK (auth.uid()::text = user_id OR auth.jwt() ->> 'email' = user_id);

DROP POLICY IF EXISTS "Users can update their own clipboard items" ON search_clipboard;
CREATE POLICY "Users can update their own clipboard items"
  ON search_clipboard FOR UPDATE
  USING (auth.uid()::text = user_id OR auth.jwt() ->> 'email' = user_id);

DROP POLICY IF EXISTS "Users can delete their own clipboard items" ON search_clipboard;
CREATE POLICY "Users can delete their own clipboard items"
  ON search_clipboard FOR DELETE
  USING (auth.uid()::text = user_id OR auth.jwt() ->> 'email' = user_id);

COMMENT ON TABLE search_clipboard IS 'Clipboard/sticky notes for saving and organizing search results and snippets from Pulse';