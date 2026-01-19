-- Phase 5: Organization Tools
-- Migration for tags, collections, favorites, and recent views

-- ============================================
-- DOCUMENT TAGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS document_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#f43f5e', -- hex color
  icon VARCHAR(50) DEFAULT 'fa-tag',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Index for tags
CREATE INDEX IF NOT EXISTS idx_document_tags_user ON document_tags(user_id);

-- ============================================
-- DOCUMENT-TAG JUNCTION TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS doc_tags (
  doc_id UUID REFERENCES knowledge_docs(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES document_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (doc_id, tag_id)
);

-- Indexes for doc_tags
CREATE INDEX IF NOT EXISTS idx_doc_tags_doc ON doc_tags(doc_id);
CREATE INDEX IF NOT EXISTS idx_doc_tags_tag ON doc_tags(tag_id);

-- ============================================
-- DOCUMENT COLLECTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS document_collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  type VARCHAR(20) DEFAULT 'manual', -- 'manual' or 'smart'
  icon VARCHAR(50) DEFAULT 'fa-folder',
  color VARCHAR(7) DEFAULT '#3b82f6',
  rules JSONB, -- For smart collections: { keywords?: string[], tags?: string[], dateRange?: [string, string], fileTypes?: string[] }
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for collections
CREATE INDEX IF NOT EXISTS idx_collections_user ON document_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_type ON document_collections(type);

-- ============================================
-- COLLECTION-DOCUMENT JUNCTION TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS collection_docs (
  collection_id UUID REFERENCES document_collections(id) ON DELETE CASCADE,
  doc_id UUID REFERENCES knowledge_docs(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY (collection_id, doc_id)
);

-- Indexes for collection_docs
CREATE INDEX IF NOT EXISTS idx_collection_docs_collection ON collection_docs(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_docs_doc ON collection_docs(doc_id);

-- ============================================
-- DOCUMENT FAVORITES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS doc_favorites (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_id UUID REFERENCES knowledge_docs(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, doc_id)
);

-- Index for favorites
CREATE INDEX IF NOT EXISTS idx_favorites_user ON doc_favorites(user_id);

-- ============================================
-- RECENT DOCUMENT VIEWS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS doc_recent_views (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_id UUID REFERENCES knowledge_docs(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  view_count INTEGER DEFAULT 1,
  PRIMARY KEY (user_id, doc_id)
);

-- Index for recent views
CREATE INDEX IF NOT EXISTS idx_recent_views_user ON doc_recent_views(user_id);
CREATE INDEX IF NOT EXISTS idx_recent_views_time ON doc_recent_views(viewed_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE document_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_recent_views ENABLE ROW LEVEL SECURITY;

-- Document Tags policies
CREATE POLICY "Users can view their own tags"
  ON document_tags FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tags"
  ON document_tags FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tags"
  ON document_tags FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tags"
  ON document_tags FOR DELETE
  USING (auth.uid() = user_id);

-- Doc Tags junction policies
CREATE POLICY "Users can view tags on their docs"
  ON doc_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_docs d
      WHERE d.id = doc_tags.doc_id
      AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can tag their own docs"
  ON doc_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM knowledge_docs d
      WHERE d.id = doc_tags.doc_id
      AND d.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM document_tags t
      WHERE t.id = doc_tags.tag_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove tags from their docs"
  ON doc_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_docs d
      WHERE d.id = doc_tags.doc_id
      AND d.user_id = auth.uid()
    )
  );

-- Collections policies
CREATE POLICY "Users can view their own collections"
  ON document_collections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own collections"
  ON document_collections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own collections"
  ON document_collections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own collections"
  ON document_collections FOR DELETE
  USING (auth.uid() = user_id);

-- Collection Docs junction policies
CREATE POLICY "Users can view docs in their collections"
  ON collection_docs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM document_collections c
      WHERE c.id = collection_docs.collection_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add docs to their collections"
  ON collection_docs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM document_collections c
      WHERE c.id = collection_docs.collection_id
      AND c.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM knowledge_docs d
      WHERE d.id = collection_docs.doc_id
      AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update docs in their collections"
  ON collection_docs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM document_collections c
      WHERE c.id = collection_docs.collection_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove docs from their collections"
  ON collection_docs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM document_collections c
      WHERE c.id = collection_docs.collection_id
      AND c.user_id = auth.uid()
    )
  );

-- Favorites policies
CREATE POLICY "Users can view their own favorites"
  ON doc_favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add favorites"
  ON doc_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove favorites"
  ON doc_favorites FOR DELETE
  USING (auth.uid() = user_id);

-- Recent Views policies
CREATE POLICY "Users can view their own recent views"
  ON doc_recent_views FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create recent views"
  ON doc_recent_views FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recent views"
  ON doc_recent_views FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recent views"
  ON doc_recent_views FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- UPDATED_AT TRIGGER FOR COLLECTIONS
-- ============================================
CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON document_collections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTION: Get documents for smart collection
-- ============================================
CREATE OR REPLACE FUNCTION get_smart_collection_docs(collection_id UUID)
RETURNS TABLE(doc_id UUID) AS $$
DECLARE
  collection_rules JSONB;
  collection_user UUID;
BEGIN
  -- Get the collection rules and user
  SELECT rules, user_id INTO collection_rules, collection_user
  FROM document_collections
  WHERE id = collection_id AND type = 'smart';

  IF collection_rules IS NULL THEN
    RETURN;
  END IF;

  -- Return matching documents
  RETURN QUERY
  SELECT d.id
  FROM knowledge_docs d
  WHERE d.user_id = collection_user
    AND d.processing_status = 'completed'
    -- Filter by keywords in title or content
    AND (
      collection_rules->'keywords' IS NULL
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(collection_rules->'keywords') k
        WHERE d.title ILIKE '%' || k || '%'
           OR d.text_content ILIKE '%' || k || '%'
      )
    )
    -- Filter by file types
    AND (
      collection_rules->'fileTypes' IS NULL
      OR d.file_type = ANY(
        SELECT jsonb_array_elements_text(collection_rules->'fileTypes')
      )
    )
    -- Filter by date range
    AND (
      collection_rules->'dateRange' IS NULL
      OR (
        d.created_at >= (collection_rules->'dateRange'->>0)::timestamp
        AND d.created_at <= (collection_rules->'dateRange'->>1)::timestamp
      )
    )
    -- Filter by tags
    AND (
      collection_rules->'tags' IS NULL
      OR EXISTS (
        SELECT 1 FROM doc_tags dt
        JOIN document_tags t ON t.id = dt.tag_id
        WHERE dt.doc_id = d.id
        AND t.name = ANY(
          SELECT jsonb_array_elements_text(collection_rules->'tags')
        )
      )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
