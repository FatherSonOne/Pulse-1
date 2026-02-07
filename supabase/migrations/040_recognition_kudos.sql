-- ================================================
-- Recognition & Kudos Tracking System
-- ================================================

-- Recognition events table
CREATE TABLE IF NOT EXISTS public.recognition_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Event Details
  event_type TEXT NOT NULL,
  recognition_category TEXT,

  -- Participants
  from_contact_identifier TEXT,
  from_contact_name TEXT,
  to_contact_identifier TEXT,
  to_contact_name TEXT,
  direction TEXT NOT NULL,

  -- Message Context
  channel TEXT NOT NULL,
  message_id TEXT,
  message_excerpt TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Sentiment & Impact
  positivity_score NUMERIC(3, 2),
  impact_level TEXT DEFAULT 'medium',

  -- Recognition Content
  keywords_detected TEXT[],
  topic TEXT,

  -- Milestone Detection
  is_milestone BOOLEAN DEFAULT false,
  milestone_type TEXT,
  milestone_description TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recognition summary (aggregated view)
CREATE TABLE IF NOT EXISTS public.recognition_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_identifier TEXT NOT NULL,
  contact_name TEXT,

  -- Counts
  kudos_received_count INTEGER DEFAULT 0,
  kudos_given_count INTEGER DEFAULT 0,
  total_recognition_events INTEGER DEFAULT 0,

  -- Scores
  appreciation_score NUMERIC(5, 2) DEFAULT 0,
  reciprocity_score NUMERIC(5, 2) DEFAULT 50,

  -- Recent Activity
  last_kudos_received_at TIMESTAMPTZ,
  last_kudos_given_at TIMESTAMPTZ,

  -- Trends
  recognition_trend TEXT DEFAULT 'stable',

  -- Top Categories
  most_appreciated_for TEXT[],
  most_appreciates_about TEXT[],

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, contact_identifier)
);

-- Wins tracker
CREATE TABLE IF NOT EXISTS public.wins_tracker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Win Details
  win_title TEXT NOT NULL,
  win_description TEXT,
  win_type TEXT,

  -- Context
  mentioned_in_message_id TEXT,
  mentioned_by_contact TEXT,
  channel TEXT,
  detected_at TIMESTAMPTZ NOT NULL,

  -- Celebration
  celebrated BOOLEAN DEFAULT false,
  celebration_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_recognition_events_user ON public.recognition_events(user_id);
CREATE INDEX idx_recognition_events_direction ON public.recognition_events(user_id, direction);
CREATE INDEX idx_recognition_events_date ON public.recognition_events(user_id, detected_at DESC);
CREATE INDEX idx_recognition_summary_user ON public.recognition_summary(user_id);
CREATE INDEX idx_recognition_summary_score ON public.recognition_summary(user_id, appreciation_score DESC);
CREATE INDEX idx_wins_tracker_user ON public.wins_tracker(user_id, detected_at DESC);

-- Enable RLS
ALTER TABLE public.recognition_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recognition_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wins_tracker ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own recognition events"
  ON public.recognition_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own recognition events"
  ON public.recognition_events FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own recognition summary"
  ON public.recognition_summary FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own recognition summary"
  ON public.recognition_summary FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own wins"
  ON public.wins_tracker FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own wins"
  ON public.wins_tracker FOR ALL
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recognition_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recognition_summary TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wins_tracker TO authenticated;
