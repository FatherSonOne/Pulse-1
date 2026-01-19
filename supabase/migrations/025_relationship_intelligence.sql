-- Migration: Relationship Intelligence System
-- Description: Comprehensive relationship management with AI-powered insights,
--              smart lists, lead scoring, and proactive alerts
-- Version: 025

-- ========================================
-- RELATIONSHIP PROFILES TABLE
-- ========================================
-- Central hub for all relationship data per contact
CREATE TABLE IF NOT EXISTS relationship_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_email TEXT NOT NULL,
  contact_name TEXT,

  -- Relationship Scoring (0-100)
  relationship_score INTEGER DEFAULT 50 CHECK (relationship_score >= 0 AND relationship_score <= 100),
  relationship_trend TEXT DEFAULT 'stable' CHECK (relationship_trend IN ('rising', 'falling', 'stable')),
  relationship_type TEXT DEFAULT 'unknown' CHECK (relationship_type IN ('colleague', 'client', 'prospect', 'personal', 'vendor', 'unknown')),

  -- Communication Pattern Analysis
  communication_frequency TEXT DEFAULT 'unknown' CHECK (communication_frequency IN ('daily', 'weekly', 'monthly', 'sporadic', 'dormant', 'unknown')),
  preferred_channel TEXT DEFAULT 'email' CHECK (preferred_channel IN ('email', 'calendar', 'slack', 'sms', 'mixed')),
  avg_response_time_hours FLOAT,
  response_rate FLOAT CHECK (response_rate >= 0 AND response_rate <= 1),

  -- Interaction History Aggregates
  total_emails_sent INTEGER DEFAULT 0,
  total_emails_received INTEGER DEFAULT 0,
  total_meetings INTEGER DEFAULT 0,
  total_shared_files INTEGER DEFAULT 0,
  total_calls INTEGER DEFAULT 0,

  -- Last Interaction Tracking
  last_email_sent_at TIMESTAMPTZ,
  last_email_received_at TIMESTAMPTZ,
  last_meeting_at TIMESTAMPTZ,
  last_call_at TIMESTAMPTZ,
  last_interaction_at TIMESTAMPTZ,
  first_interaction_at TIMESTAMPTZ,

  -- AI-Generated Insights (JSONB for flexibility)
  ai_communication_style TEXT CHECK (ai_communication_style IN ('formal', 'casual', 'brief', 'detailed', NULL)),
  ai_topics JSONB DEFAULT '[]',
  ai_sentiment_average FLOAT CHECK (ai_sentiment_average >= -1 AND ai_sentiment_average <= 1),
  ai_relationship_summary TEXT,
  ai_talking_points JSONB DEFAULT '[]',
  ai_next_action_suggestion TEXT,
  ai_buying_signals JSONB DEFAULT '[]',

  -- Enrichment Data (from email signatures, LinkedIn, etc.)
  company TEXT,
  title TEXT,
  department TEXT,
  linkedin_url TEXT,
  twitter_handle TEXT,
  phone TEXT,
  timezone TEXT,
  location TEXT,
  extracted_signature JSONB DEFAULT '{}',

  -- Duplicate Detection
  canonical_email TEXT,
  merged_from JSONB DEFAULT '[]',
  is_merged BOOLEAN DEFAULT false,

  -- User Customizations
  custom_tags JSONB DEFAULT '[]',
  custom_notes TEXT,
  is_favorite BOOLEAN DEFAULT false,
  is_vip BOOLEAN DEFAULT false,
  is_blocked BOOLEAN DEFAULT false,
  birthday DATE,
  anniversary DATE,

  -- Metadata
  source TEXT DEFAULT 'email' CHECK (source IN ('email', 'google_contacts', 'calendar', 'manual', 'import')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_analyzed_at TIMESTAMPTZ,

  UNIQUE(user_id, contact_email)
);

-- Indexes for relationship_profiles
CREATE INDEX IF NOT EXISTS idx_relationship_profiles_user_id ON relationship_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_relationship_profiles_email ON relationship_profiles(contact_email);
CREATE INDEX IF NOT EXISTS idx_relationship_profiles_canonical ON relationship_profiles(canonical_email);
CREATE INDEX IF NOT EXISTS idx_relationship_profiles_score ON relationship_profiles(relationship_score DESC);
CREATE INDEX IF NOT EXISTS idx_relationship_profiles_last_interaction ON relationship_profiles(last_interaction_at DESC);
CREATE INDEX IF NOT EXISTS idx_relationship_profiles_type ON relationship_profiles(relationship_type);
CREATE INDEX IF NOT EXISTS idx_relationship_profiles_frequency ON relationship_profiles(communication_frequency);
CREATE INDEX IF NOT EXISTS idx_relationship_profiles_company ON relationship_profiles(company);
CREATE INDEX IF NOT EXISTS idx_relationship_profiles_vip ON relationship_profiles(is_vip) WHERE is_vip = true;
CREATE INDEX IF NOT EXISTS idx_relationship_profiles_favorite ON relationship_profiles(is_favorite) WHERE is_favorite = true;

-- ========================================
-- CONTACT INTERACTIONS TABLE
-- ========================================
-- Unified log of all interactions across channels
CREATE TABLE IF NOT EXISTS contact_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES relationship_profiles(id) ON DELETE CASCADE,

  -- Interaction Classification
  interaction_type TEXT NOT NULL CHECK (interaction_type IN (
    'email_sent', 'email_received',
    'meeting_scheduled', 'meeting_attended', 'meeting_declined',
    'file_shared', 'file_received',
    'call_made', 'call_received',
    'slack_sent', 'slack_received',
    'sms_sent', 'sms_received'
  )),
  interaction_date TIMESTAMPTZ NOT NULL,

  -- Source References
  source_type TEXT CHECK (source_type IN ('gmail', 'calendar', 'drive', 'slack', 'sms', 'manual')),
  source_id TEXT,
  thread_id TEXT,

  -- Interaction Details
  subject TEXT,
  snippet TEXT,
  body_preview TEXT,
  sentiment FLOAT CHECK (sentiment >= -1 AND sentiment <= 1),
  sentiment_label TEXT CHECK (sentiment_label IN ('positive', 'neutral', 'negative', 'urgent')),

  -- Participants (for meetings, group emails)
  participants JSONB DEFAULT '[]',
  participant_count INTEGER DEFAULT 1,

  -- Attachment/File Info
  has_attachment BOOLEAN DEFAULT false,
  attachment_count INTEGER DEFAULT 0,
  attachment_types JSONB DEFAULT '[]',

  -- Meeting Specific
  meeting_duration_minutes INTEGER,
  meeting_type TEXT CHECK (meeting_type IN ('one_on_one', 'small_group', 'large_meeting', 'recurring', NULL)),
  meeting_outcome TEXT,

  -- Response Tracking
  response_time_hours FLOAT,
  is_response BOOLEAN DEFAULT false,
  responded_to_id UUID REFERENCES contact_interactions(id),

  -- AI Analysis
  ai_topics JSONB DEFAULT '[]',
  ai_action_items JSONB DEFAULT '[]',
  ai_key_points JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for contact_interactions
CREATE INDEX IF NOT EXISTS idx_contact_interactions_user_id ON contact_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_interactions_profile_id ON contact_interactions(profile_id);
CREATE INDEX IF NOT EXISTS idx_contact_interactions_date ON contact_interactions(interaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_contact_interactions_type ON contact_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_contact_interactions_source ON contact_interactions(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_contact_interactions_thread ON contact_interactions(thread_id);
CREATE INDEX IF NOT EXISTS idx_contact_interactions_sentiment ON contact_interactions(sentiment_label);

-- ========================================
-- RELATIONSHIP ALERTS TABLE
-- ========================================
-- Proactive relationship management notifications
CREATE TABLE IF NOT EXISTS relationship_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES relationship_profiles(id) ON DELETE CASCADE,

  -- Alert Classification
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'relationship_decay',      -- Score dropping, need attention
    'cold_contact',            -- No interaction for extended period
    'warm_lead',               -- Engagement increasing, opportunity
    'birthday_reminder',       -- Upcoming birthday
    'anniversary_reminder',    -- Work anniversary or relationship milestone
    'follow_up_due',           -- Promised follow-up
    'no_response',             -- They haven't responded
    'awaiting_response',       -- You haven't responded
    'milestone',               -- Relationship milestone (1 year, 100 emails, etc.)
    'meeting_prep',            -- Upcoming meeting needs prep
    're_engagement',           -- Good time to re-engage dormant contact
    'vip_activity'             -- VIP contact activity detected
  )),
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  priority INTEGER DEFAULT 50 CHECK (priority >= 0 AND priority <= 100),

  -- Alert Content
  title TEXT NOT NULL,
  description TEXT,
  context_data JSONB DEFAULT '{}',

  -- Suggested Actions
  suggested_action TEXT,
  action_type TEXT CHECK (action_type IN ('send_email', 'schedule_meeting', 'make_call', 'send_message', 'review', 'dismiss', NULL)),
  action_template TEXT,
  action_data JSONB DEFAULT '{}',

  -- Status Management
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'snoozed', 'dismissed', 'actioned', 'expired')),
  snoozed_until TIMESTAMPTZ,
  actioned_at TIMESTAMPTZ,
  actioned_type TEXT,
  dismissed_reason TEXT,

  -- Scheduling
  trigger_date DATE,
  expires_at TIMESTAMPTZ,
  recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for relationship_alerts
CREATE INDEX IF NOT EXISTS idx_relationship_alerts_user_id ON relationship_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_relationship_alerts_profile_id ON relationship_alerts(profile_id);
CREATE INDEX IF NOT EXISTS idx_relationship_alerts_status ON relationship_alerts(status);
CREATE INDEX IF NOT EXISTS idx_relationship_alerts_type ON relationship_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_relationship_alerts_severity ON relationship_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_relationship_alerts_priority ON relationship_alerts(priority DESC);
CREATE INDEX IF NOT EXISTS idx_relationship_alerts_trigger ON relationship_alerts(trigger_date);
CREATE INDEX IF NOT EXISTS idx_relationship_alerts_active ON relationship_alerts(user_id, status) WHERE status = 'active';

-- ========================================
-- SMART CONTACT GROUPS TABLE
-- ========================================
-- AI-suggested and rule-based contact groupings
CREATE TABLE IF NOT EXISTS smart_contact_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Group Identity
  name TEXT NOT NULL,
  description TEXT,
  group_type TEXT NOT NULL CHECK (group_type IN ('system', 'ai_suggested', 'manual', 'smart_rule', 'company', 'tag')),

  -- Smart List Criteria (JSONB for flexible rules)
  criteria JSONB DEFAULT '{}',
  -- Example criteria structures:
  -- {"type": "needs_follow_up", "days_since_response": 7, "min_score": 50}
  -- {"type": "warm_leads", "min_score": 70, "trend": "rising"}
  -- {"type": "inactive", "days_since_contact": 30}
  -- {"type": "company", "company_name": "Acme Corp"}
  -- {"type": "tag", "tags": ["vip", "prospect"]}
  -- {"type": "custom", "rules": [{"field": "score", "op": ">=", "value": 80}]}

  -- Visual Customization
  icon TEXT DEFAULT 'users',
  color TEXT DEFAULT '#3b82f6',
  emoji TEXT,

  -- Membership (cached for performance)
  member_profile_ids JSONB DEFAULT '[]',
  member_count INTEGER DEFAULT 0,

  -- AI Metadata (for ai_suggested groups)
  ai_confidence FLOAT CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
  ai_reasoning TEXT,
  ai_suggested_at TIMESTAMPTZ,

  -- Flags
  is_pinned BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT false,
  is_hidden BOOLEAN DEFAULT false,
  auto_refresh BOOLEAN DEFAULT true,

  -- Timestamps
  last_refreshed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, name)
);

-- Indexes for smart_contact_groups
CREATE INDEX IF NOT EXISTS idx_smart_contact_groups_user_id ON smart_contact_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_smart_contact_groups_type ON smart_contact_groups(group_type);
CREATE INDEX IF NOT EXISTS idx_smart_contact_groups_system ON smart_contact_groups(is_system) WHERE is_system = true;
CREATE INDEX IF NOT EXISTS idx_smart_contact_groups_pinned ON smart_contact_groups(is_pinned) WHERE is_pinned = true;

-- ========================================
-- LEAD SCORES TABLE
-- ========================================
-- Lead scoring and pipeline intelligence
CREATE TABLE IF NOT EXISTS lead_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES relationship_profiles(id) ON DELETE CASCADE UNIQUE,

  -- Overall Score (0-100)
  lead_score INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100),
  lead_grade TEXT CHECK (lead_grade IN ('A', 'B', 'C', 'D', 'F')),
  lead_status TEXT DEFAULT 'unknown' CHECK (lead_status IN ('cold', 'warming', 'warm', 'hot', 'customer', 'churned', 'unknown')),

  -- Score Components (each 0-100)
  engagement_score INTEGER DEFAULT 0,
  recency_score INTEGER DEFAULT 0,
  frequency_score INTEGER DEFAULT 0,
  behavior_score INTEGER DEFAULT 0,
  sentiment_score INTEGER DEFAULT 0,

  -- Score Breakdown (JSONB for detailed analysis)
  score_breakdown JSONB DEFAULT '{}',
  -- Example: {"engagement": {"emails_opened": 80, "responses": 70}, ...}

  -- Buying Signals
  buying_signals JSONB DEFAULT '[]',
  -- Example: [{"signal": "requested_pricing", "date": "...", "confidence": 0.8, "source": "email"}]
  buying_signal_count INTEGER DEFAULT 0,
  last_buying_signal_at TIMESTAMPTZ,

  -- Pipeline Stage
  pipeline_stage TEXT,
  pipeline_stage_changed_at TIMESTAMPTZ,
  estimated_value DECIMAL(12, 2),
  probability INTEGER CHECK (probability >= 0 AND probability <= 100),
  expected_close_date DATE,

  -- AI Predictions
  ai_conversion_probability FLOAT CHECK (ai_conversion_probability >= 0 AND ai_conversion_probability <= 1),
  ai_churn_risk FLOAT CHECK (ai_churn_risk >= 0 AND ai_churn_risk <= 1),
  ai_next_action_prediction TEXT,
  ai_best_contact_time TEXT,
  ai_predicted_value DECIMAL(12, 2),

  -- History
  score_history JSONB DEFAULT '[]',
  -- [{date, score, grade, trigger}]

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_scored_at TIMESTAMPTZ
);

-- Indexes for lead_scores
CREATE INDEX IF NOT EXISTS idx_lead_scores_user_id ON lead_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_scores_profile_id ON lead_scores(profile_id);
CREATE INDEX IF NOT EXISTS idx_lead_scores_score ON lead_scores(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_lead_scores_grade ON lead_scores(lead_grade);
CREATE INDEX IF NOT EXISTS idx_lead_scores_status ON lead_scores(lead_status);
CREATE INDEX IF NOT EXISTS idx_lead_scores_stage ON lead_scores(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_lead_scores_hot ON lead_scores(user_id, lead_status) WHERE lead_status IN ('warm', 'hot');

-- ========================================
-- MEETING PREP CARDS TABLE
-- ========================================
-- Pre-meeting context and preparation cards
CREATE TABLE IF NOT EXISTS meeting_prep_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_event_id TEXT NOT NULL,

  -- Event Info
  event_title TEXT,
  event_description TEXT,
  event_start TIMESTAMPTZ NOT NULL,
  event_end TIMESTAMPTZ,
  event_location TEXT,
  event_type TEXT CHECK (event_type IN ('one_on_one', 'small_group', 'large_meeting', 'recurring', 'external')),

  -- Attendee Profiles
  attendee_profiles JSONB DEFAULT '[]',
  -- [{profile_id, email, name, relationship_score, relationship_type, last_interaction, company, title}]
  attendee_count INTEGER DEFAULT 0,
  known_attendees INTEGER DEFAULT 0,

  -- AI-Generated Prep Content
  ai_summary TEXT,
  ai_meeting_purpose TEXT,
  ai_talking_points JSONB DEFAULT '[]',
  ai_questions_to_ask JSONB DEFAULT '[]',
  ai_topics_to_avoid JSONB DEFAULT '[]',
  ai_relationship_notes JSONB DEFAULT '{}',
  -- {email: {notes, last_topic, sentiment_trend}}
  ai_recent_context TEXT,
  ai_follow_up_items JSONB DEFAULT '[]',

  -- Historical Context
  recent_emails JSONB DEFAULT '[]',
  -- [{id, subject, date, snippet, sentiment}]
  recent_meetings JSONB DEFAULT '[]',
  -- [{id, title, date, notes, outcome}]
  shared_files JSONB DEFAULT '[]',
  -- [{id, name, date, type}]
  open_action_items JSONB DEFAULT '[]',

  -- User Notes
  user_notes TEXT,
  user_objectives JSONB DEFAULT '[]',

  -- Status
  status TEXT DEFAULT 'generated' CHECK (status IN ('pending', 'generated', 'viewed', 'used', 'archived')),
  viewed_at TIMESTAMPTZ,

  -- Timestamps
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, calendar_event_id)
);

-- Indexes for meeting_prep_cards
CREATE INDEX IF NOT EXISTS idx_meeting_prep_user_id ON meeting_prep_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_prep_event_id ON meeting_prep_cards(calendar_event_id);
CREATE INDEX IF NOT EXISTS idx_meeting_prep_event_start ON meeting_prep_cards(event_start);
CREATE INDEX IF NOT EXISTS idx_meeting_prep_status ON meeting_prep_cards(status);
-- Note: Partial indexes with NOW() are not allowed (requires IMMUTABLE function)
-- Filtering for upcoming meetings is done at query time instead
CREATE INDEX IF NOT EXISTS idx_meeting_prep_upcoming ON meeting_prep_cards(user_id, event_start, status)
  WHERE status != 'archived';

-- ========================================
-- DUPLICATE CONTACTS TABLE
-- ========================================
-- Track potential duplicate contacts for merging
CREATE TABLE IF NOT EXISTS duplicate_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Duplicate Group
  group_id UUID NOT NULL,
  profile_id UUID REFERENCES relationship_profiles(id) ON DELETE CASCADE,

  -- Matching Details
  match_confidence FLOAT CHECK (match_confidence >= 0 AND match_confidence <= 1),
  match_reasons JSONB DEFAULT '[]',
  -- ["same_canonical_email", "similar_name", "same_company", "same_phone"]

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'merged')),
  reviewed_at TIMESTAMPTZ,
  merged_into_id UUID REFERENCES relationship_profiles(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for duplicate_contacts
CREATE INDEX IF NOT EXISTS idx_duplicate_contacts_user_id ON duplicate_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_contacts_group_id ON duplicate_contacts(group_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_contacts_profile_id ON duplicate_contacts(profile_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_contacts_status ON duplicate_contacts(status);
CREATE INDEX IF NOT EXISTS idx_duplicate_contacts_pending ON duplicate_contacts(user_id, status) WHERE status = 'pending';

-- ========================================
-- RELATIONSHIP MILESTONES TABLE
-- ========================================
-- Track significant relationship events
CREATE TABLE IF NOT EXISTS relationship_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES relationship_profiles(id) ON DELETE CASCADE,

  milestone_type TEXT NOT NULL CHECK (milestone_type IN (
    'first_contact',
    'first_meeting',
    'email_milestone',      -- 10, 50, 100, 500 emails
    'meeting_milestone',    -- 5, 10, 25 meetings
    'anniversary',          -- 1, 2, 5 year relationship
    'score_milestone',      -- Score reached 80, 90, etc.
    'converted',            -- Lead to customer
    'custom'
  )),
  milestone_value TEXT,
  milestone_date DATE NOT NULL,

  -- Details
  title TEXT NOT NULL,
  description TEXT,
  celebration_sent BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for relationship_milestones
CREATE INDEX IF NOT EXISTS idx_relationship_milestones_user_id ON relationship_milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_relationship_milestones_profile_id ON relationship_milestones(profile_id);
CREATE INDEX IF NOT EXISTS idx_relationship_milestones_date ON relationship_milestones(milestone_date DESC);
CREATE INDEX IF NOT EXISTS idx_relationship_milestones_type ON relationship_milestones(milestone_type);

-- ========================================
-- ROW LEVEL SECURITY POLICIES
-- ========================================

-- Enable RLS on all tables
ALTER TABLE relationship_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationship_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_contact_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_prep_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE duplicate_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationship_milestones ENABLE ROW LEVEL SECURITY;

-- RLS Policies for relationship_profiles
CREATE POLICY "Users can view own relationship profiles"
  ON relationship_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own relationship profiles"
  ON relationship_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own relationship profiles"
  ON relationship_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own relationship profiles"
  ON relationship_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for contact_interactions
CREATE POLICY "Users can view own contact interactions"
  ON contact_interactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contact interactions"
  ON contact_interactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contact interactions"
  ON contact_interactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own contact interactions"
  ON contact_interactions FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for relationship_alerts
CREATE POLICY "Users can view own relationship alerts"
  ON relationship_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own relationship alerts"
  ON relationship_alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own relationship alerts"
  ON relationship_alerts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own relationship alerts"
  ON relationship_alerts FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for smart_contact_groups
CREATE POLICY "Users can view own smart contact groups"
  ON smart_contact_groups FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own smart contact groups"
  ON smart_contact_groups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own smart contact groups"
  ON smart_contact_groups FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own smart contact groups"
  ON smart_contact_groups FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for lead_scores
CREATE POLICY "Users can view own lead scores"
  ON lead_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lead scores"
  ON lead_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lead scores"
  ON lead_scores FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own lead scores"
  ON lead_scores FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for meeting_prep_cards
CREATE POLICY "Users can view own meeting prep cards"
  ON meeting_prep_cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meeting prep cards"
  ON meeting_prep_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meeting prep cards"
  ON meeting_prep_cards FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own meeting prep cards"
  ON meeting_prep_cards FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for duplicate_contacts
CREATE POLICY "Users can view own duplicate contacts"
  ON duplicate_contacts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own duplicate contacts"
  ON duplicate_contacts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own duplicate contacts"
  ON duplicate_contacts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own duplicate contacts"
  ON duplicate_contacts FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for relationship_milestones
CREATE POLICY "Users can view own relationship milestones"
  ON relationship_milestones FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own relationship milestones"
  ON relationship_milestones FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own relationship milestones"
  ON relationship_milestones FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own relationship milestones"
  ON relationship_milestones FOR DELETE
  USING (auth.uid() = user_id);

-- ========================================
-- HELPER FUNCTIONS
-- ========================================

-- Function to normalize email addresses for deduplication
CREATE OR REPLACE FUNCTION normalize_email(email TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Lowercase, remove dots from gmail local part, handle + aliases
  RETURN LOWER(
    CASE
      WHEN email LIKE '%@gmail.com' OR email LIKE '%@googlemail.com' THEN
        REPLACE(SPLIT_PART(SPLIT_PART(email, '@', 1), '+', 1), '.', '') || '@gmail.com'
      ELSE
        SPLIT_PART(email, '+', 1) || '@' || SPLIT_PART(email, '@', 2)
    END
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate relationship score
CREATE OR REPLACE FUNCTION calculate_relationship_score(
  p_response_rate FLOAT,
  p_avg_response_hours FLOAT,
  p_days_since_interaction INTEGER,
  p_total_interactions INTEGER,
  p_sentiment_avg FLOAT
)
RETURNS INTEGER AS $$
DECLARE
  v_score FLOAT := 50;
  v_response_factor FLOAT;
  v_recency_factor FLOAT;
  v_volume_factor FLOAT;
  v_sentiment_factor FLOAT;
BEGIN
  -- Response rate contributes 25 points (0-25)
  v_response_factor := COALESCE(p_response_rate, 0.5) * 25;

  -- Response time contributes 20 points (faster is better)
  v_response_factor := v_response_factor + CASE
    WHEN p_avg_response_hours IS NULL THEN 10
    WHEN p_avg_response_hours <= 1 THEN 20
    WHEN p_avg_response_hours <= 4 THEN 17
    WHEN p_avg_response_hours <= 24 THEN 14
    WHEN p_avg_response_hours <= 72 THEN 10
    ELSE 5
  END;

  -- Recency contributes 25 points
  v_recency_factor := CASE
    WHEN p_days_since_interaction IS NULL THEN 12
    WHEN p_days_since_interaction <= 1 THEN 25
    WHEN p_days_since_interaction <= 7 THEN 22
    WHEN p_days_since_interaction <= 14 THEN 18
    WHEN p_days_since_interaction <= 30 THEN 14
    WHEN p_days_since_interaction <= 60 THEN 10
    WHEN p_days_since_interaction <= 90 THEN 6
    ELSE 2
  END;

  -- Volume contributes 15 points
  v_volume_factor := CASE
    WHEN p_total_interactions >= 100 THEN 15
    WHEN p_total_interactions >= 50 THEN 13
    WHEN p_total_interactions >= 20 THEN 11
    WHEN p_total_interactions >= 10 THEN 9
    WHEN p_total_interactions >= 5 THEN 7
    ELSE p_total_interactions
  END;

  -- Sentiment contributes 15 points
  v_sentiment_factor := CASE
    WHEN p_sentiment_avg IS NULL THEN 7.5
    ELSE (p_sentiment_avg + 1) / 2 * 15  -- Convert -1 to 1 range to 0-15
  END;

  v_score := v_response_factor + v_recency_factor + v_volume_factor + v_sentiment_factor;

  RETURN LEAST(GREATEST(ROUND(v_score)::INTEGER, 0), 100);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to determine lead grade from score
CREATE OR REPLACE FUNCTION get_lead_grade(score INTEGER)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE
    WHEN score >= 80 THEN 'A'
    WHEN score >= 60 THEN 'B'
    WHEN score >= 40 THEN 'C'
    WHEN score >= 20 THEN 'D'
    ELSE 'F'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to determine communication frequency
CREATE OR REPLACE FUNCTION get_communication_frequency(
  p_total_interactions INTEGER,
  p_first_interaction_at TIMESTAMPTZ,
  p_last_interaction_at TIMESTAMPTZ
)
RETURNS TEXT AS $$
DECLARE
  v_days_active INTEGER;
  v_avg_per_week FLOAT;
BEGIN
  IF p_first_interaction_at IS NULL OR p_last_interaction_at IS NULL THEN
    RETURN 'unknown';
  END IF;

  v_days_active := GREATEST(EXTRACT(EPOCH FROM (p_last_interaction_at - p_first_interaction_at)) / 86400, 1)::INTEGER;
  v_avg_per_week := (p_total_interactions::FLOAT / v_days_active) * 7;

  RETURN CASE
    WHEN v_avg_per_week >= 5 THEN 'daily'
    WHEN v_avg_per_week >= 1 THEN 'weekly'
    WHEN v_avg_per_week >= 0.25 THEN 'monthly'
    WHEN v_avg_per_week > 0 THEN 'sporadic'
    ELSE 'dormant'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get or create relationship profile
CREATE OR REPLACE FUNCTION get_or_create_relationship_profile(
  p_user_id UUID,
  p_contact_email TEXT,
  p_contact_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_profile_id UUID;
  v_canonical_email TEXT;
BEGIN
  v_canonical_email := normalize_email(p_contact_email);

  -- Try to find existing profile
  SELECT id INTO v_profile_id
  FROM relationship_profiles
  WHERE user_id = p_user_id AND (contact_email = p_contact_email OR canonical_email = v_canonical_email);

  -- Create if not exists
  IF v_profile_id IS NULL THEN
    INSERT INTO relationship_profiles (user_id, contact_email, contact_name, canonical_email)
    VALUES (p_user_id, LOWER(p_contact_email), p_contact_name, v_canonical_email)
    RETURNING id INTO v_profile_id;
  END IF;

  RETURN v_profile_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update profile stats after interaction
CREATE OR REPLACE FUNCTION update_profile_stats_from_interaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the relationship profile with new stats
  UPDATE relationship_profiles
  SET
    last_interaction_at = GREATEST(last_interaction_at, NEW.interaction_date),
    last_email_sent_at = CASE
      WHEN NEW.interaction_type = 'email_sent' THEN GREATEST(last_email_sent_at, NEW.interaction_date)
      ELSE last_email_sent_at
    END,
    last_email_received_at = CASE
      WHEN NEW.interaction_type = 'email_received' THEN GREATEST(last_email_received_at, NEW.interaction_date)
      ELSE last_email_received_at
    END,
    last_meeting_at = CASE
      WHEN NEW.interaction_type IN ('meeting_scheduled', 'meeting_attended') THEN GREATEST(last_meeting_at, NEW.interaction_date)
      ELSE last_meeting_at
    END,
    total_emails_sent = total_emails_sent + CASE WHEN NEW.interaction_type = 'email_sent' THEN 1 ELSE 0 END,
    total_emails_received = total_emails_received + CASE WHEN NEW.interaction_type = 'email_received' THEN 1 ELSE 0 END,
    total_meetings = total_meetings + CASE WHEN NEW.interaction_type IN ('meeting_scheduled', 'meeting_attended') THEN 1 ELSE 0 END,
    first_interaction_at = COALESCE(first_interaction_at, NEW.interaction_date),
    updated_at = NOW()
  WHERE id = NEW.profile_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update profile stats on new interaction
CREATE TRIGGER trigger_update_profile_stats
  AFTER INSERT ON contact_interactions
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_stats_from_interaction();

-- Function to auto-set canonical email on profile insert/update
CREATE OR REPLACE FUNCTION set_canonical_email()
RETURNS TRIGGER AS $$
BEGIN
  NEW.canonical_email := normalize_email(NEW.contact_email);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-set canonical email
CREATE TRIGGER trigger_set_canonical_email
  BEFORE INSERT OR UPDATE OF contact_email ON relationship_profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_canonical_email();

-- ========================================
-- SEED SYSTEM SMART LISTS
-- ========================================

-- Insert default system smart lists (these are user-agnostic templates)
-- Actual user lists will be created on first access

-- Function to initialize smart lists for a user
CREATE OR REPLACE FUNCTION initialize_user_smart_lists(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Needs Follow-up
  INSERT INTO smart_contact_groups (user_id, name, description, group_type, criteria, icon, color, is_system)
  VALUES (
    p_user_id,
    'Needs Follow-up',
    'Contacts awaiting your response or needing follow-up',
    'system',
    '{"type": "needs_follow_up", "days_since_response": 7, "has_pending_thread": true}'::jsonb,
    'clock',
    '#8b5cf6',
    true
  )
  ON CONFLICT (user_id, name) DO NOTHING;

  -- Warm Leads
  INSERT INTO smart_contact_groups (user_id, name, description, group_type, criteria, icon, color, is_system)
  VALUES (
    p_user_id,
    'Warm Leads',
    'Contacts with high engagement and positive interactions',
    'system',
    '{"type": "warm_leads", "min_score": 70, "trends": ["rising", "stable"], "recent_activity": true}'::jsonb,
    'fire',
    '#f97316',
    true
  )
  ON CONFLICT (user_id, name) DO NOTHING;

  -- Inactive > 30 Days
  INSERT INTO smart_contact_groups (user_id, name, description, group_type, criteria, icon, color, is_system)
  VALUES (
    p_user_id,
    'Inactive > 30 Days',
    'Contacts with no interaction in over 30 days',
    'system',
    '{"type": "inactive", "days_since_contact": 30}'::jsonb,
    'moon',
    '#eab308',
    true
  )
  ON CONFLICT (user_id, name) DO NOTHING;

  -- VIP Contacts
  INSERT INTO smart_contact_groups (user_id, name, description, group_type, criteria, icon, color, is_system)
  VALUES (
    p_user_id,
    'VIP Contacts',
    'Your most important contacts',
    'system',
    '{"type": "vip", "is_vip": true}'::jsonb,
    'star',
    '#eab308',
    true
  )
  ON CONFLICT (user_id, name) DO NOTHING;

  -- Hot Leads
  INSERT INTO smart_contact_groups (user_id, name, description, group_type, criteria, icon, color, is_system)
  VALUES (
    p_user_id,
    'Hot Leads',
    'Contacts showing strong buying signals',
    'system',
    '{"type": "hot_leads", "min_lead_score": 80, "has_buying_signals": true}'::jsonb,
    'trending-up',
    '#ef4444',
    true
  )
  ON CONFLICT (user_id, name) DO NOTHING;

  -- At Risk Relationships
  INSERT INTO smart_contact_groups (user_id, name, description, group_type, criteria, icon, color, is_system)
  VALUES (
    p_user_id,
    'At Risk',
    'Relationships showing signs of decline',
    'system',
    '{"type": "at_risk", "trend": "falling", "score_drop": 15}'::jsonb,
    'alert-triangle',
    '#ef4444',
    true
  )
  ON CONFLICT (user_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- GRANT PERMISSIONS
-- ========================================

GRANT ALL ON relationship_profiles TO authenticated;
GRANT ALL ON contact_interactions TO authenticated;
GRANT ALL ON relationship_alerts TO authenticated;
GRANT ALL ON smart_contact_groups TO authenticated;
GRANT ALL ON lead_scores TO authenticated;
GRANT ALL ON meeting_prep_cards TO authenticated;
GRANT ALL ON duplicate_contacts TO authenticated;
GRANT ALL ON relationship_milestones TO authenticated;

-- ========================================
-- COMMENTS
-- ========================================

COMMENT ON TABLE relationship_profiles IS 'Central hub for relationship intelligence data per contact';
COMMENT ON TABLE contact_interactions IS 'Unified log of all interactions across email, calendar, and other channels';
COMMENT ON TABLE relationship_alerts IS 'Proactive relationship management alerts and reminders';
COMMENT ON TABLE smart_contact_groups IS 'AI-suggested and rule-based contact groupings';
COMMENT ON TABLE lead_scores IS 'Lead scoring and pipeline intelligence';
COMMENT ON TABLE meeting_prep_cards IS 'Pre-meeting context and preparation cards';
COMMENT ON TABLE duplicate_contacts IS 'Potential duplicate contacts for merging';
COMMENT ON TABLE relationship_milestones IS 'Significant relationship events and milestones';

COMMENT ON FUNCTION normalize_email(TEXT) IS 'Normalizes email addresses for deduplication (handles Gmail dots, + aliases)';
COMMENT ON FUNCTION calculate_relationship_score(FLOAT, FLOAT, INTEGER, INTEGER, FLOAT) IS 'Calculates relationship health score (0-100) from various factors';
COMMENT ON FUNCTION get_lead_grade(INTEGER) IS 'Converts numeric lead score to letter grade (A-F)';
COMMENT ON FUNCTION get_communication_frequency(INTEGER, TIMESTAMPTZ, TIMESTAMPTZ) IS 'Determines communication frequency pattern';
COMMENT ON FUNCTION get_or_create_relationship_profile(UUID, TEXT, TEXT) IS 'Gets existing or creates new relationship profile';
COMMENT ON FUNCTION initialize_user_smart_lists(UUID) IS 'Creates default system smart lists for a new user';
