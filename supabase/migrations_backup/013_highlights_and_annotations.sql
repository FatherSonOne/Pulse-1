-- Phase 4: Highlights and Annotations System
-- Migration for document highlighting and annotation features

-- ============================================
-- HIGHLIGHTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS doc_highlights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doc_id UUID REFERENCES knowledge_docs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  highlighted_text TEXT NOT NULL,
  color VARCHAR(20) DEFAULT 'yellow',
  note TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for highlights
CREATE INDEX IF NOT EXISTS idx_highlights_doc ON doc_highlights(doc_id);
CREATE INDEX IF NOT EXISTS idx_highlights_user ON doc_highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_highlights_created ON doc_highlights(created_at DESC);

-- ============================================
-- ANNOTATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS doc_annotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doc_id UUID REFERENCES knowledge_docs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  position JSONB NOT NULL, -- { page?: number, offset: number, x?: number, y?: number }
  content TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'note', -- 'note', 'question', 'important', 'todo'
  resolved BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for annotations
CREATE INDEX IF NOT EXISTS idx_annotations_doc ON doc_annotations(doc_id);
CREATE INDEX IF NOT EXISTS idx_annotations_user ON doc_annotations(user_id);
CREATE INDEX IF NOT EXISTS idx_annotations_type ON doc_annotations(type);
CREATE INDEX IF NOT EXISTS idx_annotations_resolved ON doc_annotations(resolved);

-- ============================================
-- ANNOTATION REPLIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS annotation_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  annotation_id UUID REFERENCES doc_annotations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for replies
CREATE INDEX IF NOT EXISTS idx_replies_annotation ON annotation_replies(annotation_id);
CREATE INDEX IF NOT EXISTS idx_replies_user ON annotation_replies(user_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE doc_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotation_replies ENABLE ROW LEVEL SECURITY;

-- Highlights policies
CREATE POLICY "Users can view highlights on docs they can access"
  ON doc_highlights FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_docs d
      WHERE d.id = doc_highlights.doc_id
      AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create highlights on their docs"
  ON doc_highlights FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM knowledge_docs d
      WHERE d.id = doc_highlights.doc_id
      AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own highlights"
  ON doc_highlights FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own highlights"
  ON doc_highlights FOR DELETE
  USING (auth.uid() = user_id);

-- Annotations policies
CREATE POLICY "Users can view annotations on docs they can access"
  ON doc_annotations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_docs d
      WHERE d.id = doc_annotations.doc_id
      AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create annotations on their docs"
  ON doc_annotations FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM knowledge_docs d
      WHERE d.id = doc_annotations.doc_id
      AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own annotations"
  ON doc_annotations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own annotations"
  ON doc_annotations FOR DELETE
  USING (auth.uid() = user_id);

-- Annotation replies policies
CREATE POLICY "Users can view replies on annotations they can access"
  ON annotation_replies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM doc_annotations a
      JOIN knowledge_docs d ON d.id = a.doc_id
      WHERE a.id = annotation_replies.annotation_id
      AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create replies"
  ON annotation_replies FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM doc_annotations a
      JOIN knowledge_docs d ON d.id = a.doc_id
      WHERE a.id = annotation_replies.annotation_id
      AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own replies"
  ON annotation_replies FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own replies"
  ON annotation_replies FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_highlights_updated_at
  BEFORE UPDATE ON doc_highlights
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_annotations_updated_at
  BEFORE UPDATE ON doc_annotations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_replies_updated_at
  BEFORE UPDATE ON annotation_replies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
