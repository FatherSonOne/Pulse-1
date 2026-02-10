-- Full-Text Search Migration for Messages
-- Enables fast, powerful message search with filters

-- Add search vector column to messages table
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_messages_search
ON messages USING gin(search_vector);

-- Function to generate search vector on insert/update
CREATE OR REPLACE FUNCTION messages_search_trigger()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.text, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.sender, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists, then create
DROP TRIGGER IF EXISTS messages_search_update ON messages;
CREATE TRIGGER messages_search_update
BEFORE INSERT OR UPDATE OF text, sender ON messages
FOR EACH ROW
EXECUTE FUNCTION messages_search_trigger();

-- Backfill existing messages with search vectors
UPDATE messages SET
  search_vector =
    setweight(to_tsvector('english', COALESCE(text, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(sender, '')), 'B')
WHERE search_vector IS NULL;

-- Create function for advanced message search
CREATE OR REPLACE FUNCTION search_messages(
  search_query TEXT,
  p_thread_id UUID DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_has_attachments BOOLEAN DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  text TEXT,
  thread_id UUID,
  sender TEXT,
  created_at TIMESTAMPTZ,
  attachment_url TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.text,
    m.thread_id,
    m.sender,
    m.created_at,
    m.attachment_url,
    ts_rank(m.search_vector, websearch_to_tsquery('english', search_query)) AS rank
  FROM messages m
  WHERE
    m.search_vector @@ websearch_to_tsquery('english', search_query)
    AND (p_thread_id IS NULL OR m.thread_id = p_thread_id)
    AND (p_start_date IS NULL OR m.created_at >= p_start_date)
    AND (p_end_date IS NULL OR m.created_at <= p_end_date)
    AND (p_has_attachments IS NULL OR
         (p_has_attachments = true AND m.attachment_url IS NOT NULL) OR
         (p_has_attachments = false AND m.attachment_url IS NULL))
  ORDER BY rank DESC, m.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create search suggestions function (autocomplete)
CREATE OR REPLACE FUNCTION get_search_suggestions(
  partial_query TEXT,
  p_thread_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  suggestion TEXT,
  frequency BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    word AS suggestion,
    ndoc AS frequency
  FROM ts_stat(
    'SELECT search_vector FROM messages WHERE thread_id = ''' || p_thread_id || ''''
  )
  WHERE word ILIKE partial_query || '%'
  ORDER BY ndoc DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION search_messages TO authenticated;
GRANT EXECUTE ON FUNCTION get_search_suggestions TO authenticated;
