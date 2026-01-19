-- Email Labels Table
-- Stores user-created labels for email organization

CREATE TABLE IF NOT EXISTS public.email_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#8b5cf6',
  icon TEXT,
  email_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Enable RLS
ALTER TABLE public.email_labels ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY email_labels_policy ON public.email_labels
  FOR ALL USING (auth.uid() = user_id);

-- Email Filters Table
-- Stores rules for automatically applying labels, archiving, etc.

CREATE TABLE IF NOT EXISTS public.email_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,

  -- Filter conditions (all conditions must match)
  from_contains TEXT,
  to_contains TEXT,
  subject_contains TEXT,
  body_contains TEXT,
  has_attachment BOOLEAN,

  -- Actions to apply
  apply_labels TEXT[] DEFAULT '{}',
  mark_as_read BOOLEAN DEFAULT false,
  archive BOOLEAN DEFAULT false,
  star BOOLEAN DEFAULT false,
  forward_to TEXT,
  delete BOOLEAN DEFAULT false,

  -- Status
  enabled BOOLEAN DEFAULT true,
  match_count INTEGER DEFAULT 0,
  last_matched_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.email_filters ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY email_filters_policy ON public.email_filters
  FOR ALL USING (auth.uid() = user_id);

-- Function to apply filters to new emails
CREATE OR REPLACE FUNCTION apply_email_filters()
RETURNS TRIGGER AS $$
DECLARE
  filter_record RECORD;
  matches BOOLEAN;
BEGIN
  -- Get all enabled filters for this user
  FOR filter_record IN
    SELECT * FROM public.email_filters
    WHERE user_id = NEW.user_id AND enabled = true
  LOOP
    matches := true;

    -- Check each condition
    IF filter_record.from_contains IS NOT NULL AND
       NOT (COALESCE(NEW.from_email, '') ILIKE '%' || filter_record.from_contains || '%' OR
            COALESCE(NEW.from_name, '') ILIKE '%' || filter_record.from_contains || '%') THEN
      matches := false;
    END IF;

    IF matches AND filter_record.subject_contains IS NOT NULL AND
       NOT COALESCE(NEW.subject, '') ILIKE '%' || filter_record.subject_contains || '%' THEN
      matches := false;
    END IF;

    IF matches AND filter_record.body_contains IS NOT NULL AND
       NOT COALESCE(NEW.body_text, '') ILIKE '%' || filter_record.body_contains || '%' THEN
      matches := false;
    END IF;

    IF matches AND filter_record.has_attachment IS NOT NULL AND
       NEW.has_attachments != filter_record.has_attachment THEN
      matches := false;
    END IF;

    -- Apply actions if matched
    IF matches THEN
      -- Apply labels
      IF array_length(filter_record.apply_labels, 1) > 0 THEN
        NEW.labels := array_cat(COALESCE(NEW.labels, '{}'), filter_record.apply_labels);
      END IF;

      -- Mark as read
      IF filter_record.mark_as_read THEN
        NEW.is_read := true;
      END IF;

      -- Archive
      IF filter_record.archive THEN
        NEW.is_archived := true;
      END IF;

      -- Star
      IF filter_record.star THEN
        NEW.is_starred := true;
      END IF;

      -- Delete (move to trash)
      IF filter_record.delete THEN
        NEW.is_trashed := true;
      END IF;

      -- Update filter match count
      UPDATE public.email_filters
      SET match_count = match_count + 1,
          last_matched_at = NOW()
      WHERE id = filter_record.id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to apply filters on new emails
DROP TRIGGER IF EXISTS apply_filters_trigger ON public.cached_emails;
CREATE TRIGGER apply_filters_trigger
  BEFORE INSERT ON public.cached_emails
  FOR EACH ROW
  EXECUTE FUNCTION apply_email_filters();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_labels_user ON public.email_labels(user_id);
CREATE INDEX IF NOT EXISTS idx_email_filters_user ON public.email_filters(user_id);
CREATE INDEX IF NOT EXISTS idx_email_filters_enabled ON public.email_filters(user_id, enabled);
