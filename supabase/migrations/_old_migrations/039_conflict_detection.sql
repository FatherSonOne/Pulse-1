-- ================================================
-- Conflict Detection & Tracking System
-- ================================================

-- Main conflict tracking table
CREATE TABLE IF NOT EXISTS public.conflict_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_identifier TEXT NOT NULL,

  -- Conflict Identification
  conflict_type TEXT,
  severity TEXT DEFAULT 'low',
  status TEXT DEFAULT 'active',

  -- Message Context
  channel TEXT,
  first_message_id TEXT,
  first_detected_at TIMESTAMPTZ NOT NULL,
  related_message_ids TEXT[],

  -- Content Analysis
  trigger_topic TEXT,
  trigger_keywords TEXT[],
  tension_score NUMERIC(3, 2),

  -- Participants
  initiated_by TEXT,
  escalated_by TEXT,

  -- Resolution Tracking
  resolved_at TIMESTAMPTZ,
  resolution_message_id TEXT,
  resolution_method TEXT,
  time_to_resolution_hours NUMERIC(10, 2),

  -- Pattern Analysis
  is_recurring BOOLEAN DEFAULT false,
  previous_conflict_ids UUID[],
  hot_topic BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hot Topics tracking
CREATE TABLE IF NOT EXISTS public.hot_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_identifier TEXT NOT NULL,
  topic TEXT NOT NULL,

  -- Metrics
  conflict_count INTEGER DEFAULT 1,
  avg_severity NUMERIC(3, 2),
  last_conflict_at TIMESTAMPTZ,

  -- Suggestions
  avoidance_recommended BOOLEAN DEFAULT false,
  communication_tip TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, contact_identifier, topic)
);

-- Indexes
CREATE INDEX idx_conflict_tracking_user ON public.conflict_tracking(user_id);
CREATE INDEX idx_conflict_tracking_status ON public.conflict_tracking(user_id, status);
CREATE INDEX idx_conflict_tracking_contact ON public.conflict_tracking(user_id, contact_identifier);
CREATE INDEX idx_hot_topics_user ON public.hot_topics(user_id, conflict_count DESC);

-- Enable RLS
ALTER TABLE public.conflict_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hot_topics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own conflicts"
  ON public.conflict_tracking FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own conflicts"
  ON public.conflict_tracking FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own hot topics"
  ON public.hot_topics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own hot topics"
  ON public.hot_topics FOR ALL
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conflict_tracking TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hot_topics TO authenticated;
