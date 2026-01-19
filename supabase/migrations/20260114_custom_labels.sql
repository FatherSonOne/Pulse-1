-- Migration: Custom Labels
-- Created: 2026-01-14
-- Description: Enhanced label system with nested labels, color coding, and Gmail sync

-- Create custom_labels table
CREATE TABLE IF NOT EXISTS custom_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280', -- Default gray
  parent_label_id UUID REFERENCES custom_labels(id) ON DELETE CASCADE,
  gmail_label_id TEXT, -- For Gmail sync
  is_system BOOLEAN DEFAULT false, -- System labels (Inbox, Sent, etc.)
  message_count INTEGER DEFAULT 0,
  unread_count INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT label_name_unique_per_user UNIQUE(user_id, name),
  CONSTRAINT color_hex_format CHECK (color ~* '^#[0-9a-f]{6}$')
);

-- Create email_labels junction table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS email_labels (
  email_id TEXT NOT NULL, -- References cached_emails.id
  label_id UUID NOT NULL REFERENCES custom_labels(id) ON DELETE CASCADE,
  applied_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  PRIMARY KEY (email_id, label_id)
);

-- Create indexes for performance
CREATE INDEX idx_custom_labels_user_id ON custom_labels(user_id);
CREATE INDEX idx_custom_labels_parent ON custom_labels(parent_label_id) WHERE parent_label_id IS NOT NULL;
CREATE INDEX idx_custom_labels_gmail ON custom_labels(gmail_label_id) WHERE gmail_label_id IS NOT NULL;
CREATE INDEX idx_custom_labels_system ON custom_labels(user_id, is_system) WHERE is_system = true;
CREATE INDEX idx_email_labels_email ON email_labels(email_id);
CREATE INDEX idx_email_labels_label ON email_labels(label_id);
CREATE INDEX idx_email_labels_composite ON email_labels(label_id, email_id);

-- Enable Row Level Security
ALTER TABLE custom_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_labels ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom_labels
CREATE POLICY "Users can view own labels"
  ON custom_labels
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own labels"
  ON custom_labels
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_system = false);

CREATE POLICY "Users can update own labels"
  ON custom_labels
  FOR UPDATE
  USING (auth.uid() = user_id AND is_system = false)
  WITH CHECK (auth.uid() = user_id AND is_system = false);

CREATE POLICY "Users can delete own labels"
  ON custom_labels
  FOR DELETE
  USING (auth.uid() = user_id AND is_system = false);

-- RLS Policies for email_labels
CREATE POLICY "Users can view own email labels"
  ON email_labels
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cached_emails
      WHERE cached_emails.id = email_labels.email_id
        AND cached_emails.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own email labels"
  ON email_labels
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM cached_emails
      WHERE cached_emails.id = email_labels.email_id
        AND cached_emails.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cached_emails
      WHERE cached_emails.id = email_labels.email_id
        AND cached_emails.user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_custom_label_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER custom_labels_updated_at
  BEFORE UPDATE ON custom_labels
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_label_updated_at();

-- Function to update message counts when labels are applied/removed
CREATE OR REPLACE FUNCTION update_label_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment message count
    UPDATE custom_labels
    SET message_count = message_count + 1
    WHERE id = NEW.label_id;
    
    -- Increment unread count if email is unread
    IF EXISTS (
      SELECT 1 FROM cached_emails
      WHERE id = NEW.email_id
        AND is_read = false
    ) THEN
      UPDATE custom_labels
      SET unread_count = unread_count + 1
      WHERE id = NEW.label_id;
    END IF;
    
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement message count
    UPDATE custom_labels
    SET message_count = GREATEST(0, message_count - 1)
    WHERE id = OLD.label_id;
    
    -- Decrement unread count if email is unread
    IF EXISTS (
      SELECT 1 FROM cached_emails
      WHERE id = OLD.email_id
        AND is_read = false
    ) THEN
      UPDATE custom_labels
      SET unread_count = GREATEST(0, unread_count - 1)
      WHERE id = OLD.label_id;
    END IF;
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain label counts
CREATE TRIGGER update_label_counts_trigger
  AFTER INSERT OR DELETE ON email_labels
  FOR EACH ROW
  EXECUTE FUNCTION update_label_counts();

-- Function to update unread counts when email read status changes
CREATE OR REPLACE FUNCTION update_label_unread_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_read = false AND NEW.is_read = true THEN
    -- Email marked as read, decrement unread counts
    UPDATE custom_labels
    SET unread_count = GREATEST(0, unread_count - 1)
    WHERE id IN (
      SELECT label_id FROM email_labels WHERE email_id = NEW.id
    );
  ELSIF OLD.is_read = true AND NEW.is_read = false THEN
    -- Email marked as unread, increment unread counts
    UPDATE custom_labels
    SET unread_count = unread_count + 1
    WHERE id IN (
      SELECT label_id FROM email_labels WHERE email_id = NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update unread counts (assuming cached_emails table exists)
-- Note: This will be created after we confirm cached_emails table structure
-- CREATE TRIGGER update_label_unread_counts_trigger
--   AFTER UPDATE OF is_read ON cached_emails
--   FOR EACH ROW
--   WHEN (OLD.is_read IS DISTINCT FROM NEW.is_read)
--   EXECUTE FUNCTION update_label_unread_counts();

-- Function to prevent circular label nesting
CREATE OR REPLACE FUNCTION prevent_circular_label_nesting()
RETURNS TRIGGER AS $$
DECLARE
  current_parent UUID;
  depth INTEGER := 0;
  max_depth INTEGER := 10;
BEGIN
  IF NEW.parent_label_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  current_parent := NEW.parent_label_id;
  
  -- Check if parent exists and belongs to same user
  IF NOT EXISTS (
    SELECT 1 FROM custom_labels
    WHERE id = current_parent
      AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Parent label does not exist or belongs to different user';
  END IF;
  
  -- Traverse up the parent chain to detect cycles
  WHILE current_parent IS NOT NULL AND depth < max_depth LOOP
    IF current_parent = NEW.id THEN
      RAISE EXCEPTION 'Circular label nesting detected';
    END IF;
    
    SELECT parent_label_id INTO current_parent
    FROM custom_labels
    WHERE id = current_parent;
    
    depth := depth + 1;
  END LOOP;
  
  IF depth >= max_depth THEN
    RAISE EXCEPTION 'Label nesting depth exceeds maximum of %', max_depth;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent circular nesting
CREATE TRIGGER prevent_circular_label_nesting_trigger
  BEFORE INSERT OR UPDATE ON custom_labels
  FOR EACH ROW
  WHEN (NEW.parent_label_id IS NOT NULL)
  EXECUTE FUNCTION prevent_circular_label_nesting();

-- Add comments
COMMENT ON TABLE custom_labels IS 'User-created labels for organizing emails';
COMMENT ON TABLE email_labels IS 'Junction table linking emails to labels';
COMMENT ON COLUMN custom_labels.parent_label_id IS 'Parent label for nested label structure';
COMMENT ON COLUMN custom_labels.gmail_label_id IS 'Gmail label ID for bi-directional sync';
COMMENT ON COLUMN custom_labels.is_system IS 'System labels cannot be modified or deleted';
COMMENT ON COLUMN custom_labels.message_count IS 'Total number of emails with this label';
COMMENT ON COLUMN custom_labels.unread_count IS 'Number of unread emails with this label';
COMMENT ON COLUMN custom_labels.display_order IS 'Order for displaying labels in UI';
