-- Enhanced Archives System Migration
-- Collections, Smart Folders, AI Features, Google Drive Integration

-- ============= EXTEND ARCHIVES TABLE =============

-- Add new columns to archives table
ALTER TABLE archives
ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES archive_collections(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS drive_file_id TEXT,
ADD COLUMN IF NOT EXISTS drive_folder_id TEXT,
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS mime_type TEXT,
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS ai_tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS related_item_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
ADD COLUMN IF NOT EXISTS ai_summary TEXT,
ADD COLUMN IF NOT EXISTS exported_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS starred BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'enterprise')),
ADD COLUMN IF NOT EXISTS shared_with UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add index for new columns
CREATE INDEX IF NOT EXISTS idx_archives_collection_id ON archives(collection_id);
CREATE INDEX IF NOT EXISTS idx_archives_starred ON archives(starred) WHERE starred = TRUE;
CREATE INDEX IF NOT EXISTS idx_archives_pinned ON archives(pinned_at) WHERE pinned_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_archives_drive_file_id ON archives(drive_file_id) WHERE drive_file_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_archives_visibility ON archives(visibility);
CREATE INDEX IF NOT EXISTS idx_archives_ai_tags ON archives USING GIN(ai_tags);

-- ============= ARCHIVE COLLECTIONS TABLE =============

CREATE TABLE IF NOT EXISTS archive_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#ef4444',
  icon TEXT NOT NULL DEFAULT 'fa-folder',
  pinned_at TIMESTAMPTZ,
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'enterprise')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for collections
CREATE INDEX IF NOT EXISTS idx_archive_collections_user_id ON archive_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_archive_collections_pinned ON archive_collections(pinned_at) WHERE pinned_at IS NOT NULL;

-- RLS for collections
ALTER TABLE archive_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own collections" ON archive_collections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own collections" ON archive_collections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own collections" ON archive_collections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own collections" ON archive_collections
  FOR DELETE USING (auth.uid() = user_id);

-- ============= SMART FOLDERS TABLE =============

CREATE TABLE IF NOT EXISTS smart_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  icon TEXT NOT NULL DEFAULT 'fa-wand-magic-sparkles',
  rules JSONB NOT NULL DEFAULT '[]',
  rule_operator TEXT NOT NULL DEFAULT 'and' CHECK (rule_operator IN ('and', 'or')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for smart folders
CREATE INDEX IF NOT EXISTS idx_smart_folders_user_id ON smart_folders(user_id);

-- RLS for smart folders
ALTER TABLE smart_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own smart folders" ON smart_folders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own smart folders" ON smart_folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own smart folders" ON smart_folders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own smart folders" ON smart_folders
  FOR DELETE USING (auth.uid() = user_id);

-- ============= USER SETTINGS TABLE (for Drive export settings) =============

CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  drive_export_settings JSONB DEFAULT '{
    "enabled": false,
    "autoSync": false,
    "folderStructure": {
      "transcripts": "Message Transcripts",
      "voxTranscripts": "Vox Transcripts",
      "voxSummaries": "Vox Summaries",
      "meetingNotes": "Meeting Notes",
      "decisionLogs": "Decision Logs",
      "journals": "Journals",
      "aiSummaries": "AI Summaries",
      "images": "Images",
      "videos": "Videos",
      "documents": "Documents",
      "artifacts": "Artifacts"
    },
    "syncFrequency": "manual"
  }',
  notification_settings JSONB DEFAULT '{}',
  theme_settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for user settings
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own settings" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- ============= ARCHIVE SHARES TABLE (for team/enterprise sharing) =============

CREATE TABLE IF NOT EXISTS archive_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archive_id UUID NOT NULL REFERENCES archives(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(archive_id, shared_with)
);

-- Indexes for archive shares
CREATE INDEX IF NOT EXISTS idx_archive_shares_archive_id ON archive_shares(archive_id);
CREATE INDEX IF NOT EXISTS idx_archive_shares_shared_with ON archive_shares(shared_with);

-- RLS for archive shares
ALTER TABLE archive_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shares for their archives" ON archive_shares
  FOR SELECT USING (
    auth.uid() = shared_by OR auth.uid() = shared_with
  );

CREATE POLICY "Users can create shares for own archives" ON archive_shares
  FOR INSERT WITH CHECK (auth.uid() = shared_by);

CREATE POLICY "Users can delete shares they created" ON archive_shares
  FOR DELETE USING (auth.uid() = shared_by);

-- ============= SAVED SEARCHES TABLE (for Unified Search integration) =============

CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  filters JSONB DEFAULT '{}',
  include_archives BOOLEAN DEFAULT TRUE,
  include_messages BOOLEAN DEFAULT TRUE,
  include_contacts BOOLEAN DEFAULT TRUE,
  include_events BOOLEAN DEFAULT TRUE,
  is_pinned BOOLEAN DEFAULT FALSE,
  last_used TIMESTAMPTZ DEFAULT NOW(),
  result_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for saved searches
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_pinned ON saved_searches(is_pinned) WHERE is_pinned = TRUE;

-- RLS for saved searches
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saved searches" ON saved_searches
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own saved searches" ON saved_searches
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved searches" ON saved_searches
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved searches" ON saved_searches
  FOR DELETE USING (auth.uid() = user_id);

-- ============= FULL-TEXT SEARCH CONFIGURATION =============

-- Add full-text search column to archives
ALTER TABLE archives
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create function to update search vector
CREATE OR REPLACE FUNCTION archives_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for search vector
DROP TRIGGER IF EXISTS archives_search_vector_trigger ON archives;
CREATE TRIGGER archives_search_vector_trigger
  BEFORE INSERT OR UPDATE ON archives
  FOR EACH ROW
  EXECUTE FUNCTION archives_search_vector_update();

-- Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_archives_search_vector ON archives USING GIN(search_vector);

-- Update existing records
UPDATE archives SET search_vector =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(content, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'C');

-- ============= HELPER FUNCTIONS =============

-- Function to search archives with full-text search
CREATE OR REPLACE FUNCTION search_archives(
  search_query TEXT,
  user_id_param UUID,
  type_filter TEXT DEFAULT NULL,
  limit_param INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  archive_type TEXT,
  title TEXT,
  content TEXT,
  date TIMESTAMPTZ,
  tags TEXT[],
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.archive_type,
    a.title,
    a.content,
    a.date,
    a.tags,
    ts_rank(a.search_vector, websearch_to_tsquery('english', search_query)) AS rank
  FROM archives a
  WHERE a.user_id = user_id_param
    AND a.search_vector @@ websearch_to_tsquery('english', search_query)
    AND (type_filter IS NULL OR a.archive_type = type_filter)
  ORDER BY rank DESC
  LIMIT limit_param;
END;
$$ LANGUAGE plpgsql;

-- ============= GRANT PERMISSIONS =============

GRANT ALL ON archive_collections TO authenticated;
GRANT ALL ON smart_folders TO authenticated;
GRANT ALL ON user_settings TO authenticated;
GRANT ALL ON archive_shares TO authenticated;
GRANT ALL ON saved_searches TO authenticated;
