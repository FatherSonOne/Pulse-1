-- Phase 6: Collaboration - Sharing & Permissions
-- Migration for document sharing, project sharing, and activity feed

-- ============================================
-- DOCUMENT SHARES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS document_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doc_id UUID REFERENCES knowledge_docs(id) ON DELETE CASCADE,
  shared_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_user UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  shared_with_email VARCHAR(255), -- For email invites before user signs up
  permissions JSONB DEFAULT '{"canView": true, "canComment": false, "canEdit": false, "canShare": false}'::jsonb,
  public_link VARCHAR(64) UNIQUE, -- Short UUID for public access
  expires_at TIMESTAMP WITH TIME ZONE,
  message TEXT, -- Optional message when sharing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Either shared_with_user OR shared_with_email OR public_link must be set
  CONSTRAINT valid_share_target CHECK (
    (shared_with_user IS NOT NULL) OR
    (shared_with_email IS NOT NULL) OR
    (public_link IS NOT NULL)
  )
);

-- Indexes for document shares
CREATE INDEX IF NOT EXISTS idx_doc_shares_doc ON document_shares(doc_id);
CREATE INDEX IF NOT EXISTS idx_doc_shares_shared_by ON document_shares(shared_by);
CREATE INDEX IF NOT EXISTS idx_doc_shares_shared_with_user ON document_shares(shared_with_user);
CREATE INDEX IF NOT EXISTS idx_doc_shares_shared_with_email ON document_shares(shared_with_email);
CREATE INDEX IF NOT EXISTS idx_doc_shares_public_link ON document_shares(public_link);

-- ============================================
-- PROJECT SHARES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS project_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES ai_projects(id) ON DELETE CASCADE,
  shared_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_user UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  shared_with_email VARCHAR(255),
  permissions JSONB DEFAULT '{"canView": true, "canComment": false, "canEdit": false, "canShare": false, "canAddDocs": false}'::jsonb,
  public_link VARCHAR(64) UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_project_share_target CHECK (
    (shared_with_user IS NOT NULL) OR
    (shared_with_email IS NOT NULL) OR
    (public_link IS NOT NULL)
  )
);

-- Indexes for project shares
CREATE INDEX IF NOT EXISTS idx_project_shares_project ON project_shares(project_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_shared_by ON project_shares(shared_by);
CREATE INDEX IF NOT EXISTS idx_project_shares_shared_with_user ON project_shares(shared_with_user);
CREATE INDEX IF NOT EXISTS idx_project_shares_public_link ON project_shares(public_link);

-- ============================================
-- ACTIVITY FEED TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS activity_feed (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES ai_projects(id) ON DELETE CASCADE,
  doc_id UUID REFERENCES knowledge_docs(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  -- Common actions: 'doc_uploaded', 'doc_viewed', 'doc_shared', 'doc_commented',
  -- 'project_created', 'project_shared', 'annotation_added', 'highlight_added',
  -- 'user_joined', 'user_left', 'audio_generated', 'study_guide_created'
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  details JSONB, -- Action-specific details
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for activity feed
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_feed(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_project ON activity_feed(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_doc ON activity_feed(doc_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_feed(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_unread ON activity_feed(user_id, is_read) WHERE is_read = FALSE;

-- ============================================
-- SHARE INVITES TABLE (for pending email invites)
-- ============================================
CREATE TABLE IF NOT EXISTS share_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL,
  invite_type VARCHAR(20) NOT NULL, -- 'document' or 'project'
  resource_id UUID NOT NULL, -- doc_id or project_id
  invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  permissions JSONB,
  token VARCHAR(64) UNIQUE NOT NULL, -- Unique invite token
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for share invites
CREATE INDEX IF NOT EXISTS idx_invites_email ON share_invites(email);
CREATE INDEX IF NOT EXISTS idx_invites_token ON share_invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_resource ON share_invites(invite_type, resource_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE document_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_invites ENABLE ROW LEVEL SECURITY;

-- Document Shares policies
CREATE POLICY "Users can view shares for their docs or shared with them"
  ON document_shares FOR SELECT
  USING (
    auth.uid() = shared_by
    OR auth.uid() = shared_with_user
    OR EXISTS (
      SELECT 1 FROM knowledge_docs d
      WHERE d.id = document_shares.doc_id
      AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Doc owners can create shares"
  ON document_shares FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM knowledge_docs d
      WHERE d.id = document_shares.doc_id
      AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Doc owners can update shares"
  ON document_shares FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_docs d
      WHERE d.id = document_shares.doc_id
      AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Doc owners can delete shares"
  ON document_shares FOR DELETE
  USING (
    auth.uid() = shared_by
    OR EXISTS (
      SELECT 1 FROM knowledge_docs d
      WHERE d.id = document_shares.doc_id
      AND d.user_id = auth.uid()
    )
  );

-- Project Shares policies
CREATE POLICY "Users can view shares for their projects or shared with them"
  ON project_shares FOR SELECT
  USING (
    auth.uid() = shared_by
    OR auth.uid() = shared_with_user
    OR EXISTS (
      SELECT 1 FROM ai_projects p
      WHERE p.id = project_shares.project_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can create shares"
  ON project_shares FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_projects p
      WHERE p.id = project_shares.project_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can update shares"
  ON project_shares FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM ai_projects p
      WHERE p.id = project_shares.project_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can delete shares"
  ON project_shares FOR DELETE
  USING (
    auth.uid() = shared_by
    OR EXISTS (
      SELECT 1 FROM ai_projects p
      WHERE p.id = project_shares.project_id
      AND p.user_id = auth.uid()
    )
  );

-- Activity Feed policies
CREATE POLICY "Users can view their own activity or activity in shared resources"
  ON activity_feed FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() = actor_id
    OR EXISTS (
      SELECT 1 FROM document_shares ds
      WHERE ds.doc_id = activity_feed.doc_id
      AND ds.shared_with_user = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_shares ps
      WHERE ps.project_id = activity_feed.project_id
      AND ps.shared_with_user = auth.uid()
    )
  );

CREATE POLICY "System can insert activity"
  ON activity_feed FOR INSERT
  WITH CHECK (auth.uid() = actor_id OR auth.uid() = user_id);

CREATE POLICY "Users can mark their activity as read"
  ON activity_feed FOR UPDATE
  USING (auth.uid() = user_id);

-- Share Invites policies
CREATE POLICY "Inviters can view their invites"
  ON share_invites FOR SELECT
  USING (auth.uid() = invited_by);

CREATE POLICY "Users can create invites for their resources"
  ON share_invites FOR INSERT
  WITH CHECK (auth.uid() = invited_by);

CREATE POLICY "Inviters can delete their invites"
  ON share_invites FOR DELETE
  USING (auth.uid() = invited_by);

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
CREATE TRIGGER update_doc_shares_updated_at
  BEFORE UPDATE ON document_shares
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_shares_updated_at
  BEFORE UPDATE ON project_shares
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if a user has access to a document
CREATE OR REPLACE FUNCTION user_has_doc_access(check_user_id UUID, check_doc_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user owns the document
  IF EXISTS (
    SELECT 1 FROM knowledge_docs d
    WHERE d.id = check_doc_id AND d.user_id = check_user_id
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check if document is shared with user (not expired)
  IF EXISTS (
    SELECT 1 FROM document_shares ds
    WHERE ds.doc_id = check_doc_id
    AND ds.shared_with_user = check_user_id
    AND (ds.expires_at IS NULL OR ds.expires_at > NOW())
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check if document's project is shared with user
  IF EXISTS (
    SELECT 1 FROM knowledge_docs d
    JOIN project_shares ps ON ps.project_id = d.project_id
    WHERE d.id = check_doc_id
    AND ps.shared_with_user = check_user_id
    AND (ps.expires_at IS NULL OR ps.expires_at > NOW())
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check document permissions
CREATE OR REPLACE FUNCTION get_doc_permissions(check_user_id UUID, check_doc_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- Check if user owns the document (full permissions)
  IF EXISTS (
    SELECT 1 FROM knowledge_docs d
    WHERE d.id = check_doc_id AND d.user_id = check_user_id
  ) THEN
    RETURN '{"canView": true, "canComment": true, "canEdit": true, "canShare": true, "isOwner": true}'::jsonb;
  END IF;

  -- Get direct document share permissions
  SELECT ds.permissions INTO result
  FROM document_shares ds
  WHERE ds.doc_id = check_doc_id
  AND ds.shared_with_user = check_user_id
  AND (ds.expires_at IS NULL OR ds.expires_at > NOW())
  LIMIT 1;

  IF result IS NOT NULL THEN
    RETURN result;
  END IF;

  -- Get project share permissions
  SELECT ps.permissions INTO result
  FROM knowledge_docs d
  JOIN project_shares ps ON ps.project_id = d.project_id
  WHERE d.id = check_doc_id
  AND ps.shared_with_user = check_user_id
  AND (ps.expires_at IS NULL OR ps.expires_at > NOW())
  LIMIT 1;

  IF result IS NOT NULL THEN
    RETURN result;
  END IF;

  -- No access
  RETURN '{"canView": false, "canComment": false, "canEdit": false, "canShare": false}'::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get document by public link
CREATE OR REPLACE FUNCTION get_doc_by_public_link(link VARCHAR)
RETURNS TABLE(doc_id UUID, permissions JSONB) AS $$
BEGIN
  RETURN QUERY
  SELECT ds.doc_id, ds.permissions
  FROM document_shares ds
  WHERE ds.public_link = link
  AND (ds.expires_at IS NULL OR ds.expires_at > NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record activity
CREATE OR REPLACE FUNCTION record_activity(
  p_user_id UUID,
  p_actor_id UUID,
  p_action VARCHAR,
  p_project_id UUID DEFAULT NULL,
  p_doc_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  activity_id UUID;
BEGIN
  INSERT INTO activity_feed (user_id, actor_id, action, project_id, doc_id, details)
  VALUES (p_user_id, p_actor_id, p_action, p_project_id, p_doc_id, p_details)
  RETURNING id INTO activity_id;

  RETURN activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate short public link
CREATE OR REPLACE FUNCTION generate_public_link()
RETURNS VARCHAR AS $$
BEGIN
  RETURN encode(gen_random_bytes(24), 'base64');
END;
$$ LANGUAGE plpgsql;
