# Pulse Analytics Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance Pulse Analytics with Relationship Health Tracker, Conflict Detection, Kudos Recognition, and AI Predictive Analytics.

**Architecture:** Four new analytics modules built on existing Supabase backend with new tables, TypeScript services, and React components integrated into the Observatory dashboard. AI analysis via Claude API for sentiment, conflict detection, and predictions.

**Tech Stack:** React, TypeScript, Supabase (PostgreSQL), TailwindCSS, Claude AI API

---

## Phase 1: Database Foundation

### Task 1.1: Create Relationship Health Schema

**Files:**
- Create: `supabase/migrations/038_relationship_health.sql`

**Step 1: Write migration file**

```sql
-- ================================================
-- Relationship Health Tracking System
-- ================================================

-- Main relationship health table
CREATE TABLE IF NOT EXISTS public.relationship_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_identifier TEXT NOT NULL,
  contact_name TEXT,

  -- Health Metrics
  health_score NUMERIC(5, 2) DEFAULT 50,
  health_status TEXT DEFAULT 'active',

  -- Engagement Patterns
  avg_response_time_user NUMERIC(10, 2),
  avg_response_time_contact NUMERIC(10, 2),
  response_reciprocity_score NUMERIC(5, 2),

  -- Sentiment Tracking
  sentiment_trend TEXT DEFAULT 'stable',
  sentiment_balance NUMERIC(3, 2),
  last_positive_interaction_at TIMESTAMPTZ,
  last_negative_interaction_at TIMESTAMPTZ,

  -- Activity Tracking
  days_since_last_message INTEGER,
  interaction_frequency TEXT,
  longest_gap_days INTEGER,
  conversation_count_30d INTEGER DEFAULT 0,
  message_count_30d INTEGER DEFAULT 0,

  -- Risk Indicators
  at_risk_reason TEXT[],
  intervention_suggested BOOLEAN DEFAULT false,
  intervention_message TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, contact_identifier)
);

-- Indexes
CREATE INDEX idx_relationship_health_user ON public.relationship_health(user_id);
CREATE INDEX idx_relationship_health_status ON public.relationship_health(user_id, health_status);
CREATE INDEX idx_relationship_health_score ON public.relationship_health(user_id, health_score DESC);

-- Enable RLS
ALTER TABLE public.relationship_health ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own relationship health"
  ON public.relationship_health FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own relationship health"
  ON public.relationship_health FOR ALL
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.relationship_health TO authenticated;

-- Function to calculate health score
CREATE OR REPLACE FUNCTION calculate_relationship_health_score(
  p_days_since_last INTEGER,
  p_message_count_30d INTEGER,
  p_reciprocity_score NUMERIC,
  p_sentiment_balance NUMERIC,
  p_conversation_count_30d INTEGER
)
RETURNS NUMERIC AS $$
DECLARE
  v_recency_score NUMERIC := 0;
  v_frequency_score NUMERIC := 0;
  v_reciprocity_score NUMERIC := 0;
  v_sentiment_score NUMERIC := 0;
  v_engagement_score NUMERIC := 0;
  v_total_score NUMERIC;
BEGIN
  -- Recency (30%): Days since last interaction
  v_recency_score := CASE
    WHEN p_days_since_last IS NULL THEN 15
    WHEN p_days_since_last = 0 THEN 30
    WHEN p_days_since_last <= 3 THEN 25
    WHEN p_days_since_last <= 7 THEN 20
    WHEN p_days_since_last <= 14 THEN 15
    WHEN p_days_since_last <= 30 THEN 10
    ELSE 5
  END;

  -- Frequency (25%): Message consistency
  v_frequency_score := LEAST(p_message_count_30d * 0.5, 25);

  -- Reciprocity (20%): Balance in response times
  v_reciprocity_score := COALESCE(p_reciprocity_score, 50) * 0.2;

  -- Sentiment (15%): Overall positive tone
  v_sentiment_score := (COALESCE(p_sentiment_balance, 0) + 1) * 7.5;

  -- Engagement (10%): Depth of conversations
  v_engagement_score := LEAST(p_conversation_count_30d * 2, 10);

  v_total_score := v_recency_score + v_frequency_score + v_reciprocity_score +
                   v_sentiment_score + v_engagement_score;

  RETURN LEAST(GREATEST(v_total_score, 0), 100);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

GRANT EXECUTE ON FUNCTION calculate_relationship_health_score(INTEGER, INTEGER, NUMERIC, NUMERIC, INTEGER) TO authenticated;
```

**Step 2: Apply migration**

Run: `supabase migration up` or via Supabase dashboard
Expected: Migration applies successfully, tables created

**Step 3: Verify schema**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'relationship_health';
```
Expected: Returns 1 row

**Step 4: Commit**

```bash
git add supabase/migrations/038_relationship_health.sql
git commit -m "feat(db): add relationship health tracking schema"
```

---

### Task 1.2: Create Conflict Detection Schema

**Files:**
- Create: `supabase/migrations/039_conflict_detection.sql`

**Step 1: Write migration file**

```sql
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
```

**Step 2: Apply migration**

Run: `supabase migration up`
Expected: Migration applies successfully

**Step 3: Verify schema**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('conflict_tracking', 'hot_topics');
```
Expected: Returns 2 rows

**Step 4: Commit**

```bash
git add supabase/migrations/039_conflict_detection.sql
git commit -m "feat(db): add conflict detection and tracking schema"
```

---

### Task 1.3: Create Recognition & Kudos Schema

**Files:**
- Create: `supabase/migrations/040_recognition_kudos.sql`

**Step 1: Write migration file**

```sql
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
```

**Step 2: Apply migration**

Run: `supabase migration up`
Expected: Migration applies successfully

**Step 3: Verify schema**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('recognition_events', 'recognition_summary', 'wins_tracker');
```
Expected: Returns 3 rows

**Step 4: Commit**

```bash
git add supabase/migrations/040_recognition_kudos.sql
git commit -m "feat(db): add recognition and kudos tracking schema"
```

---

### Task 1.4: Create Predictive Analytics Schema

**Files:**
- Create: `supabase/migrations/041_predictive_analytics.sql`

**Step 1: Write migration file**

```sql
-- ================================================
-- Predictive Analytics System
-- ================================================

-- Predictions cache table
CREATE TABLE IF NOT EXISTS public.predictions_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Prediction Scope
  prediction_type TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_identifier TEXT,

  -- Prediction Results
  prediction_value NUMERIC(5, 2),
  confidence_level NUMERIC(3, 2),
  prediction_label TEXT,

  -- Supporting Data
  factors JSONB,
  recommendations TEXT[],

  -- Temporal
  predicted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  -- Outcome Tracking
  outcome_tracked BOOLEAN DEFAULT false,
  actual_outcome TEXT,
  prediction_accuracy NUMERIC(3, 2),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ML Training data
CREATE TABLE IF NOT EXISTS public.ml_training_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Feature Vector
  features JSONB NOT NULL,

  -- Labels/Outcomes
  outcome_type TEXT NOT NULL,
  outcome_value BOOLEAN,
  outcome_timestamp TIMESTAMPTZ,

  -- Context
  data_point_date DATE NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Burnout indicators
CREATE TABLE IF NOT EXISTS public.burnout_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Risk Assessment
  burnout_risk_score NUMERIC(5, 2),
  risk_level TEXT,

  -- Contributing Factors
  avg_response_time_increasing BOOLEAN,
  message_volume_increasing BOOLEAN,
  sentiment_declining BOOLEAN,
  working_hours_extending BOOLEAN,
  weekend_activity_high BOOLEAN,
  response_quality_dropping BOOLEAN,

  -- Patterns
  messages_per_day_7d NUMERIC(5, 1),
  messages_per_day_30d NUMERIC(5, 1),
  avg_response_time_7d NUMERIC(10, 2),
  avg_response_time_30d NUMERIC(10, 2),

  -- Recommendations
  recommended_actions TEXT[],

  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_predictions_cache_user ON public.predictions_cache(user_id, prediction_type);
CREATE INDEX idx_predictions_cache_valid ON public.predictions_cache(user_id, valid_until);
CREATE INDEX idx_ml_training_data_user ON public.ml_training_data(user_id, outcome_type);
CREATE INDEX idx_burnout_indicators_user ON public.burnout_indicators(user_id, assessed_at DESC);

-- Enable RLS
ALTER TABLE public.predictions_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ml_training_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.burnout_indicators ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own predictions"
  ON public.predictions_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own predictions"
  ON public.predictions_cache FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own training data"
  ON public.ml_training_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own training data"
  ON public.ml_training_data FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own burnout indicators"
  ON public.burnout_indicators FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own burnout indicators"
  ON public.burnout_indicators FOR ALL
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.predictions_cache TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ml_training_data TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.burnout_indicators TO authenticated;
```

**Step 2: Apply migration**

Run: `supabase migration up`
Expected: Migration applies successfully

**Step 3: Verify schema**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('predictions_cache', 'ml_training_data', 'burnout_indicators');
```
Expected: Returns 3 rows

**Step 4: Commit**

```bash
git add supabase/migrations/041_predictive_analytics.sql
git commit -m "feat(db): add predictive analytics and burnout tracking schema"
```

---

## Phase 2: Backend Services

### Task 2.1: Relationship Health Service

**Files:**
- Create: `src/services/relationshipHealthService.ts`

**Step 1: Create service file with types**

```typescript
/**
 * Relationship Health Service
 * Tracks and analyzes relationship strength with contacts
 */

import { supabase } from './supabase';

export interface RelationshipHealth {
  id: string;
  user_id: string;
  contact_identifier: string;
  contact_name: string | null;
  health_score: number;
  health_status: 'active' | 'warming' | 'cooling' | 'at_risk' | 'dormant';
  avg_response_time_user: number | null;
  avg_response_time_contact: number | null;
  response_reciprocity_score: number | null;
  sentiment_trend: 'improving' | 'declining' | 'stable';
  sentiment_balance: number | null;
  last_positive_interaction_at: string | null;
  last_negative_interaction_at: string | null;
  days_since_last_message: number | null;
  interaction_frequency: 'daily' | 'weekly' | 'monthly' | 'sporadic' | null;
  longest_gap_days: number | null;
  conversation_count_30d: number;
  message_count_30d: number;
  at_risk_reason: string[];
  intervention_suggested: boolean;
  intervention_message: string | null;
  created_at: string;
  updated_at: string;
  last_calculated_at: string;
}

export interface RelationshipHealthSummary {
  total_relationships: number;
  active_count: number;
  at_risk_count: number;
  dormant_count: number;
  avg_health_score: number;
  trending_up: number;
  trending_down: number;
}
```

**Step 2: Add core functions**

```typescript
/**
 * Get all relationship health records for current user
 */
export async function getAllRelationshipHealth(): Promise<{
  success: boolean;
  data?: RelationshipHealth[];
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase
      .from('relationship_health')
      .select('*')
      .eq('user_id', user.id)
      .order('health_score', { ascending: false });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error('Error fetching relationship health:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get relationship health summary stats
 */
export async function getRelationshipHealthSummary(): Promise<{
  success: boolean;
  data?: RelationshipHealthSummary;
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase
      .from('relationship_health')
      .select('*')
      .eq('user_id', user.id);

    if (error) throw error;

    const relationships = data || [];

    const summary: RelationshipHealthSummary = {
      total_relationships: relationships.length,
      active_count: relationships.filter(r => r.health_status === 'active').length,
      at_risk_count: relationships.filter(r => r.health_status === 'at_risk').length,
      dormant_count: relationships.filter(r => r.health_status === 'dormant').length,
      avg_health_score: relationships.length > 0
        ? relationships.reduce((sum, r) => sum + r.health_score, 0) / relationships.length
        : 0,
      trending_up: relationships.filter(r => r.sentiment_trend === 'improving').length,
      trending_down: relationships.filter(r => r.sentiment_trend === 'declining').length,
    };

    return { success: true, data: summary };
  } catch (err: any) {
    console.error('Error fetching relationship summary:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get single relationship health by contact
 */
export async function getRelationshipHealth(
  contactIdentifier: string
): Promise<{
  success: boolean;
  data?: RelationshipHealth;
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase
      .from('relationship_health')
      .select('*')
      .eq('user_id', user.id)
      .eq('contact_identifier', contactIdentifier)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return { success: true, data: data || undefined };
  } catch (err: any) {
    console.error('Error fetching relationship health:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Calculate and update relationship health scores
 * Should be run periodically (daily recommended)
 */
export async function recalculateRelationshipHealth(): Promise<{
  success: boolean;
  updated_count?: number;
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get all contact engagement data
    const { data: contacts, error: contactsError } = await supabase
      .from('analytics_contact_engagement')
      .select('*')
      .eq('user_id', user.id);

    if (contactsError) throw contactsError;

    let updateCount = 0;

    // Process each contact
    for (const contact of contacts || []) {
      const healthScore = calculateHealthScore(contact);
      const healthStatus = determineHealthStatus(healthScore);
      const riskReasons = identifyRiskReasons(contact);

      const updates = {
        user_id: user.id,
        contact_identifier: contact.contact_identifier,
        contact_name: contact.contact_name,
        health_score: healthScore,
        health_status: healthStatus,
        days_since_last_message: contact.days_since_last_contact,
        message_count_30d: contact.total_messages_sent + contact.total_messages_received,
        at_risk_reason: riskReasons,
        intervention_suggested: riskReasons.length > 0,
        last_calculated_at: new Date().toISOString(),
      };

      const { error: upsertError } = await supabase
        .from('relationship_health')
        .upsert(updates, { onConflict: 'user_id,contact_identifier' });

      if (upsertError) {
        console.error('Error updating relationship health:', upsertError);
      } else {
        updateCount++;
      }
    }

    return { success: true, updated_count: updateCount };
  } catch (err: any) {
    console.error('Error recalculating relationship health:', err);
    return { success: false, error: err.message };
  }
}

// Helper functions
function calculateHealthScore(contact: any): number {
  const recencyScore = calculateRecencyScore(contact.days_since_last_contact);
  const frequencyScore = Math.min((contact.total_messages_sent + contact.total_messages_received) * 0.5, 25);
  const reciprocityScore = (contact.engagement_score || 50) * 0.2;
  const sentimentScore = ((contact.avg_sentiment || 0) + 1) * 7.5;
  const engagementScore = Math.min((contact.total_messages_sent + contact.total_messages_received) * 0.1, 10);

  return Math.min(Math.max(recencyScore + frequencyScore + reciprocityScore + sentimentScore + engagementScore, 0), 100);
}

function calculateRecencyScore(daysSince: number | null): number {
  if (daysSince === null) return 15;
  if (daysSince === 0) return 30;
  if (daysSince <= 3) return 25;
  if (daysSince <= 7) return 20;
  if (daysSince <= 14) return 15;
  if (daysSince <= 30) return 10;
  return 5;
}

function determineHealthStatus(score: number): string {
  if (score >= 80) return 'active';
  if (score >= 60) return 'warming';
  if (score >= 40) return 'cooling';
  if (score >= 20) return 'at_risk';
  return 'dormant';
}

function identifyRiskReasons(contact: any): string[] {
  const reasons: string[] = [];

  if (contact.days_since_last_contact > 14) {
    reasons.push('long_gap');
  }
  if (contact.engagement_trend === 'falling') {
    reasons.push('declining_frequency');
  }
  if (contact.avg_sentiment < -0.2) {
    reasons.push('negative_sentiment');
  }

  return reasons;
}
```

**Step 3: Commit**

```bash
git add src/services/relationshipHealthService.ts
git commit -m "feat(services): add relationship health tracking service"
```

---

### Task 2.2: Conflict Detection Service

**Files:**
- Create: `src/services/conflictDetectionService.ts`

**Step 1: Create service file**

```typescript
/**
 * Conflict Detection Service
 * AI-powered detection and tracking of disagreements and tensions
 */

import { supabase } from './supabase';

export interface ConflictTracking {
  id: string;
  user_id: string;
  contact_identifier: string;
  conflict_type: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'resolving' | 'resolved' | 'unresolved';
  channel: string | null;
  first_message_id: string | null;
  first_detected_at: string;
  related_message_ids: string[];
  trigger_topic: string | null;
  trigger_keywords: string[];
  tension_score: number | null;
  initiated_by: string | null;
  escalated_by: string | null;
  resolved_at: string | null;
  resolution_message_id: string | null;
  resolution_method: string | null;
  time_to_resolution_hours: number | null;
  is_recurring: boolean;
  previous_conflict_ids: string[];
  hot_topic: boolean;
  created_at: string;
  updated_at: string;
}

export interface HotTopic {
  id: string;
  user_id: string;
  contact_identifier: string;
  topic: string;
  conflict_count: number;
  avg_severity: number | null;
  last_conflict_at: string | null;
  avoidance_recommended: boolean;
  communication_tip: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConflictSummary {
  active_conflicts: number;
  resolved_last_7d: number;
  avg_resolution_time_hours: number;
  hot_topics_count: number;
  conflict_free_days: number;
}

/**
 * Get all active conflicts
 */
export async function getActiveConflicts(): Promise<{
  success: boolean;
  data?: ConflictTracking[];
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase
      .from('conflict_tracking')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('first_detected_at', { ascending: false });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error('Error fetching active conflicts:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get conflict summary statistics
 */
export async function getConflictSummary(): Promise<{
  success: boolean;
  data?: ConflictSummary;
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data: allConflicts, error: allError } = await supabase
      .from('conflict_tracking')
      .select('*')
      .eq('user_id', user.id);

    if (allError) throw allError;

    const conflicts = allConflicts || [];
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const activeConflicts = conflicts.filter(c => c.status === 'active').length;
    const resolvedLast7d = conflicts.filter(c =>
      c.status === 'resolved' &&
      c.resolved_at &&
      new Date(c.resolved_at) >= sevenDaysAgo
    ).length;

    const resolvedWithTime = conflicts.filter(c =>
      c.time_to_resolution_hours !== null
    );
    const avgResolutionTime = resolvedWithTime.length > 0
      ? resolvedWithTime.reduce((sum, c) => sum + (c.time_to_resolution_hours || 0), 0) / resolvedWithTime.length
      : 0;

    const { data: hotTopics, error: hotError } = await supabase
      .from('hot_topics')
      .select('*')
      .eq('user_id', user.id);

    if (hotError) throw hotError;

    const lastConflict = conflicts
      .filter(c => c.first_detected_at)
      .sort((a, b) => new Date(b.first_detected_at).getTime() - new Date(a.first_detected_at).getTime())[0];

    const conflictFreeDays = lastConflict
      ? Math.floor((now.getTime() - new Date(lastConflict.first_detected_at).getTime()) / (1000 * 60 * 60 * 24))
      : 365;

    const summary: ConflictSummary = {
      active_conflicts: activeConflicts,
      resolved_last_7d: resolvedLast7d,
      avg_resolution_time_hours: avgResolutionTime,
      hot_topics_count: (hotTopics || []).length,
      conflict_free_days: conflictFreeDays,
    };

    return { success: true, data: summary };
  } catch (err: any) {
    console.error('Error fetching conflict summary:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get hot topics
 */
export async function getHotTopics(): Promise<{
  success: boolean;
  data?: HotTopic[];
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase
      .from('hot_topics')
      .select('*')
      .eq('user_id', user.id)
      .order('conflict_count', { ascending: false });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error('Error fetching hot topics:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Detect conflict in message content (AI-powered)
 */
export async function detectConflictInMessage(
  messageContent: string,
  contactIdentifier: string,
  messageId: string,
  channel: string
): Promise<{
  success: boolean;
  conflict_detected?: boolean;
  severity?: string;
  topic?: string;
  error?: string;
}> {
  try {
    // This would integrate with Claude AI API for analysis
    // For now, simple keyword detection
    const conflictKeywords = [
      'disagree', 'wrong', 'no', 'however', 'but',
      'frustrated', 'disappointed', 'upset', 'angry',
      'problem', 'issue', 'concern'
    ];

    const lowerContent = messageContent.toLowerCase();
    const detectedKeywords = conflictKeywords.filter(keyword =>
      lowerContent.includes(keyword)
    );

    if (detectedKeywords.length >= 2) {
      const tensionScore = Math.min(detectedKeywords.length / 10, 1);
      const severity = determineSeverity(tensionScore);

      // TODO: Use Claude AI API for better analysis
      // const aiAnalysis = await analyzeWithClaude(messageContent);

      return {
        success: true,
        conflict_detected: true,
        severity,
        topic: 'unspecified' // Would be extracted by AI
      };
    }

    return {
      success: true,
      conflict_detected: false
    };
  } catch (err: any) {
    console.error('Error detecting conflict:', err);
    return { success: false, error: err.message };
  }
}

function determineSeverity(tensionScore: number): string {
  if (tensionScore >= 0.75) return 'critical';
  if (tensionScore >= 0.5) return 'high';
  if (tensionScore >= 0.25) return 'medium';
  return 'low';
}

/**
 * Mark conflict as resolved
 */
export async function resolveConflict(
  conflictId: string,
  resolutionMethod: string,
  resolutionMessageId?: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { data: conflict, error: fetchError } = await supabase
      .from('conflict_tracking')
      .select('*')
      .eq('id', conflictId)
      .single();

    if (fetchError) throw fetchError;

    const resolvedAt = new Date();
    const firstDetected = new Date(conflict.first_detected_at);
    const hoursToResolve = (resolvedAt.getTime() - firstDetected.getTime()) / (1000 * 60 * 60);

    const { error: updateError } = await supabase
      .from('conflict_tracking')
      .update({
        status: 'resolved',
        resolved_at: resolvedAt.toISOString(),
        resolution_method: resolutionMethod,
        resolution_message_id: resolutionMessageId,
        time_to_resolution_hours: hoursToResolve,
        updated_at: new Date().toISOString()
      })
      .eq('id', conflictId);

    if (updateError) throw updateError;

    return { success: true };
  } catch (err: any) {
    console.error('Error resolving conflict:', err);
    return { success: false, error: err.message };
  }
}
```

**Step 2: Commit**

```bash
git add src/services/conflictDetectionService.ts
git commit -m "feat(services): add conflict detection and tracking service"
```

---

*[Plan continues with remaining services and components...]*

## Execution Instructions

**Plan saved to:** `docs/plans/2026-02-06-analytics-enhancements.md`

**Total Tasks:** 25+ (Database: 4, Services: 6, Components: 12, Integration: 3+)

**Estimated Time:** 3-5 days for full implementation

---

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
