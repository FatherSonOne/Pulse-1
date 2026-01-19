-- Migration: Email 2.0 Cache & AI Features
-- Description: Database schema for AI-powered email caching, analysis, and intelligent features

-- ========================================
-- CACHED EMAILS TABLE
-- ========================================
-- Stores locally cached emails for offline access & fast search
CREATE TABLE IF NOT EXISTS cached_emails (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_id TEXT UNIQUE,

  -- Core fields
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_emails JSONB DEFAULT '[]',
  cc_emails JSONB DEFAULT '[]',
  bcc_emails JSONB DEFAULT '[]',
  subject TEXT,
  snippet TEXT,
  body_text TEXT,
  body_html TEXT,

  -- Metadata
  labels JSONB DEFAULT '[]',
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  is_important BOOLEAN DEFAULT false,
  is_draft BOOLEAN DEFAULT false,
  is_sent BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  is_trashed BOOLEAN DEFAULT false,
  has_attachments BOOLEAN DEFAULT false,
  attachments JSONB DEFAULT '[]',

  -- AI-generated fields
  ai_summary TEXT,
  ai_category TEXT, -- 'priority', 'updates', 'social', 'promotions', 'newsletters', 'spam'
  ai_priority_score INTEGER DEFAULT 50, -- 0-100
  ai_action_items JSONB DEFAULT '[]',
  ai_sentiment TEXT, -- 'positive', 'neutral', 'negative', 'urgent'
  ai_suggested_replies JSONB DEFAULT '[]',
  ai_entities JSONB DEFAULT '{}', -- extracted dates, people, amounts, links, meeting requests

  -- Timestamps
  received_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for cached_emails
CREATE INDEX IF NOT EXISTS idx_cached_emails_user_id ON cached_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_cached_emails_thread_id ON cached_emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_cached_emails_gmail_id ON cached_emails(gmail_id);
CREATE INDEX IF NOT EXISTS idx_cached_emails_received_at ON cached_emails(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_cached_emails_ai_category ON cached_emails(ai_category);
CREATE INDEX IF NOT EXISTS idx_cached_emails_ai_priority ON cached_emails(ai_priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_cached_emails_labels ON cached_emails USING GIN(labels);

-- ========================================
-- EMAIL THREADS TABLE
-- ========================================
-- Groups emails into conversation threads
CREATE TABLE IF NOT EXISTS email_threads (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT,
  participant_emails JSONB DEFAULT '[]',
  participant_names JSONB DEFAULT '[]',
  message_count INTEGER DEFAULT 0,
  unread_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  first_message_at TIMESTAMPTZ,

  -- AI-generated
  ai_thread_summary TEXT,
  ai_thread_status TEXT, -- 'active', 'awaiting_reply', 'resolved', 'stale'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_threads_user_id ON email_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_last_message ON email_threads(last_message_at DESC);

-- ========================================
-- SCHEDULED EMAILS TABLE
-- ========================================
-- Emails scheduled to be sent later
CREATE TABLE IF NOT EXISTS scheduled_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  to_emails JSONB NOT NULL,
  cc_emails JSONB DEFAULT '[]',
  bcc_emails JSONB DEFAULT '[]',
  subject TEXT,
  body TEXT,
  body_html TEXT,
  is_html BOOLEAN DEFAULT false,
  thread_id TEXT,
  in_reply_to TEXT,

  -- Scheduling
  scheduled_for TIMESTAMPTZ NOT NULL,
  timezone TEXT DEFAULT 'UTC',

  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'cancelled'
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_emails_user_id ON scheduled_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_scheduled_for ON scheduled_emails(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_status ON scheduled_emails(status);

-- ========================================
-- SNOOZED EMAILS TABLE
-- ========================================
-- Emails temporarily hidden until a specified time
CREATE TABLE IF NOT EXISTS snoozed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email_id TEXT REFERENCES cached_emails(id) ON DELETE CASCADE,
  gmail_id TEXT,

  snooze_until TIMESTAMPTZ NOT NULL,
  original_labels JSONB DEFAULT '[]',

  -- Status
  status TEXT DEFAULT 'snoozed', -- 'snoozed', 'restored', 'cancelled'
  restored_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snoozed_emails_user_id ON snoozed_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_snoozed_emails_snooze_until ON snoozed_emails(snooze_until);
CREATE INDEX IF NOT EXISTS idx_snoozed_emails_status ON snoozed_emails(status);

-- ========================================
-- EMAIL TEMPLATES TABLE
-- ========================================
-- User-created email templates with variable substitution
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  body TEXT,
  body_html TEXT,

  -- Template variables like {{name}}, {{company}}
  variables JSONB DEFAULT '[]',

  -- Categorization
  category TEXT, -- 'follow-up', 'introduction', 'meeting', 'thank-you', etc.
  is_favorite BOOLEAN DEFAULT false,

  -- Usage tracking
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_user_id ON email_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category);

-- ========================================
-- EMAIL CONTACTS TABLE
-- ========================================
-- Contact intelligence and relationship tracking
CREATE TABLE IF NOT EXISTS email_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  email TEXT NOT NULL,
  name TEXT,
  company TEXT,
  title TEXT,
  avatar_url TEXT,
  phone TEXT,

  -- Communication stats
  first_contacted_at TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,
  last_email_from_them TIMESTAMPTZ,
  last_email_to_them TIMESTAMPTZ,

  email_count_total INTEGER DEFAULT 0,
  email_count_from_them INTEGER DEFAULT 0,
  email_count_to_them INTEGER DEFAULT 0,

  -- Response metrics
  avg_response_time_hours FLOAT,
  response_rate FLOAT, -- 0-1

  -- AI-generated insights
  relationship_strength INTEGER DEFAULT 50, -- 0-100
  ai_notes TEXT,
  ai_relationship_type TEXT, -- 'colleague', 'client', 'vendor', 'personal', 'unknown'
  ai_communication_style TEXT, -- 'formal', 'casual', 'brief', 'detailed'

  -- User notes
  custom_notes TEXT,
  is_important BOOLEAN DEFAULT false,
  is_blocked BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_email_contacts_user_id ON email_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_contacts_email ON email_contacts(email);
CREATE INDEX IF NOT EXISTS idx_email_contacts_relationship ON email_contacts(relationship_strength DESC);

-- ========================================
-- EMAIL SYNC STATE TABLE
-- ========================================
-- Tracks sync state for incremental updates
CREATE TABLE IF NOT EXISTS email_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- Gmail sync tokens
  history_id TEXT,
  last_full_sync_at TIMESTAMPTZ,
  last_incremental_sync_at TIMESTAMPTZ,

  -- Sync status
  sync_status TEXT DEFAULT 'idle', -- 'idle', 'syncing', 'error'
  last_error TEXT,
  error_count INTEGER DEFAULT 0,

  -- Stats
  total_emails_cached INTEGER DEFAULT 0,
  total_threads_cached INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_sync_state_user_id ON email_sync_state(user_id);

-- ========================================
-- EMAIL FOLLOW-UPS TABLE
-- ========================================
-- Tracks emails needing follow-up (Smart Nudge)
CREATE TABLE IF NOT EXISTS email_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email_id TEXT REFERENCES cached_emails(id) ON DELETE CASCADE,
  thread_id TEXT,

  -- Follow-up details
  follow_up_reason TEXT, -- 'no_response', 'awaiting_action', 'scheduled', 'manual'
  suggested_follow_up_date TIMESTAMPTZ,

  -- AI-generated follow-up draft
  ai_follow_up_draft TEXT,

  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'dismissed', 'completed'
  completed_at TIMESTAMPTZ,

  -- How many days since original email
  days_waiting INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_follow_ups_user_id ON email_follow_ups(user_id);
CREATE INDEX IF NOT EXISTS idx_email_follow_ups_status ON email_follow_ups(status);
CREATE INDEX IF NOT EXISTS idx_email_follow_ups_suggested_date ON email_follow_ups(suggested_follow_up_date);

-- ========================================
-- EMAIL DAILY BRIEFING TABLE
-- ========================================
-- Pre-computed daily briefings
CREATE TABLE IF NOT EXISTS email_daily_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  briefing_date DATE NOT NULL,

  -- Briefing content
  new_email_count INTEGER DEFAULT 0,
  urgent_count INTEGER DEFAULT 0,
  meeting_requests_count INTEGER DEFAULT 0,
  follow_ups_needed_count INTEGER DEFAULT 0,

  -- Top priority emails (IDs and summaries)
  priority_emails JSONB DEFAULT '[]',

  -- AI-generated summary
  ai_summary TEXT,

  -- Computed at
  computed_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, briefing_date)
);

CREATE INDEX IF NOT EXISTS idx_email_daily_briefings_user_date ON email_daily_briefings(user_id, briefing_date DESC);

-- ========================================
-- ROW LEVEL SECURITY POLICIES
-- ========================================

-- Enable RLS on all tables
ALTER TABLE cached_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE snoozed_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_daily_briefings ENABLE ROW LEVEL SECURITY;

-- cached_emails policies
CREATE POLICY "Users can view own cached emails" ON cached_emails
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cached emails" ON cached_emails
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cached emails" ON cached_emails
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cached emails" ON cached_emails
  FOR DELETE USING (auth.uid() = user_id);

-- email_threads policies
CREATE POLICY "Users can view own email threads" ON email_threads
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own email threads" ON email_threads
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own email threads" ON email_threads
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own email threads" ON email_threads
  FOR DELETE USING (auth.uid() = user_id);

-- scheduled_emails policies
CREATE POLICY "Users can view own scheduled emails" ON scheduled_emails
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own scheduled emails" ON scheduled_emails
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own scheduled emails" ON scheduled_emails
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own scheduled emails" ON scheduled_emails
  FOR DELETE USING (auth.uid() = user_id);

-- snoozed_emails policies
CREATE POLICY "Users can view own snoozed emails" ON snoozed_emails
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own snoozed emails" ON snoozed_emails
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own snoozed emails" ON snoozed_emails
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own snoozed emails" ON snoozed_emails
  FOR DELETE USING (auth.uid() = user_id);

-- email_templates policies
CREATE POLICY "Users can view own email templates" ON email_templates
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own email templates" ON email_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own email templates" ON email_templates
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own email templates" ON email_templates
  FOR DELETE USING (auth.uid() = user_id);

-- email_contacts policies
CREATE POLICY "Users can view own email contacts" ON email_contacts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own email contacts" ON email_contacts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own email contacts" ON email_contacts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own email contacts" ON email_contacts
  FOR DELETE USING (auth.uid() = user_id);

-- email_sync_state policies
CREATE POLICY "Users can view own sync state" ON email_sync_state
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sync state" ON email_sync_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sync state" ON email_sync_state
  FOR UPDATE USING (auth.uid() = user_id);

-- email_follow_ups policies
CREATE POLICY "Users can view own follow ups" ON email_follow_ups
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own follow ups" ON email_follow_ups
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own follow ups" ON email_follow_ups
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own follow ups" ON email_follow_ups
  FOR DELETE USING (auth.uid() = user_id);

-- email_daily_briefings policies
CREATE POLICY "Users can view own daily briefings" ON email_daily_briefings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own daily briefings" ON email_daily_briefings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own daily briefings" ON email_daily_briefings
  FOR UPDATE USING (auth.uid() = user_id);

-- ========================================
-- HELPER FUNCTIONS
-- ========================================

-- Function to update email thread stats when a cached email is inserted/updated
CREATE OR REPLACE FUNCTION update_email_thread_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update thread stats
  UPDATE email_threads
  SET
    message_count = (SELECT COUNT(*) FROM cached_emails WHERE thread_id = NEW.thread_id AND user_id = NEW.user_id),
    unread_count = (SELECT COUNT(*) FROM cached_emails WHERE thread_id = NEW.thread_id AND user_id = NEW.user_id AND is_read = false),
    last_message_at = (SELECT MAX(received_at) FROM cached_emails WHERE thread_id = NEW.thread_id AND user_id = NEW.user_id),
    updated_at = NOW()
  WHERE id = NEW.thread_id AND user_id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating thread stats
DROP TRIGGER IF EXISTS trigger_update_email_thread_stats ON cached_emails;
CREATE TRIGGER trigger_update_email_thread_stats
  AFTER INSERT OR UPDATE ON cached_emails
  FOR EACH ROW
  EXECUTE FUNCTION update_email_thread_stats();

-- Function to update contact stats when emails are cached
CREATE OR REPLACE FUNCTION update_email_contact_stats()
RETURNS TRIGGER AS $$
DECLARE
  contact_record RECORD;
BEGIN
  -- Update or create contact for sender
  INSERT INTO email_contacts (user_id, email, name, last_email_from_them, email_count_from_them, email_count_total)
  VALUES (NEW.user_id, NEW.from_email, NEW.from_name, NEW.received_at, 1, 1)
  ON CONFLICT (user_id, email)
  DO UPDATE SET
    name = COALESCE(EXCLUDED.name, email_contacts.name),
    last_email_from_them = GREATEST(EXCLUDED.last_email_from_them, email_contacts.last_email_from_them),
    email_count_from_them = email_contacts.email_count_from_them + 1,
    email_count_total = email_contacts.email_count_total + 1,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating contact stats
DROP TRIGGER IF EXISTS trigger_update_email_contact_stats ON cached_emails;
CREATE TRIGGER trigger_update_email_contact_stats
  AFTER INSERT ON cached_emails
  FOR EACH ROW
  EXECUTE FUNCTION update_email_contact_stats();

-- Function to get or create email thread
CREATE OR REPLACE FUNCTION get_or_create_email_thread(
  p_thread_id TEXT,
  p_user_id UUID,
  p_subject TEXT
)
RETURNS TEXT AS $$
BEGIN
  INSERT INTO email_threads (id, user_id, subject, first_message_at)
  VALUES (p_thread_id, p_user_id, p_subject, NOW())
  ON CONFLICT (id) DO NOTHING;

  RETURN p_thread_id;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- COMMENTS
-- ========================================
COMMENT ON TABLE cached_emails IS 'Locally cached emails from Gmail for offline access and AI analysis';
COMMENT ON TABLE email_threads IS 'Email conversation threads grouping related messages';
COMMENT ON TABLE scheduled_emails IS 'Emails scheduled to be sent at a future time';
COMMENT ON TABLE snoozed_emails IS 'Emails temporarily hidden until a specified time';
COMMENT ON TABLE email_templates IS 'User-created email templates with variable substitution';
COMMENT ON TABLE email_contacts IS 'Contact intelligence and relationship tracking for email correspondents';
COMMENT ON TABLE email_sync_state IS 'Tracks Gmail sync state for incremental updates';
COMMENT ON TABLE email_follow_ups IS 'Emails flagged for follow-up with AI-generated suggestions';
COMMENT ON TABLE email_daily_briefings IS 'Pre-computed daily email briefings and summaries';
