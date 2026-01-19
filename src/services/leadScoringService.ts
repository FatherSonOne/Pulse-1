// ============================================
// LEAD SCORING SERVICE
// Lead scoring, pipeline intelligence, and buying signal detection
// ============================================

import { supabase } from './supabase';
import { askAI } from './unifiedAIService';
import {
  LeadScore,
  LeadScoreRow,
  LeadGrade,
  LeadStatus,
  BuyingSignal,
  ScoreBreakdown,
  ScoreHistoryEntry,
  RelationshipProfile,
} from '../types/relationshipTypes';

// ==================== TYPE CONVERTER ====================

function rowToLeadScore(row: LeadScoreRow): LeadScore {
  return {
    id: row.id,
    userId: row.user_id,
    profileId: row.profile_id,
    leadScore: row.lead_score,
    leadGrade: row.lead_grade as LeadGrade,
    leadStatus: row.lead_status as LeadStatus,
    engagementScore: row.engagement_score,
    recencyScore: row.recency_score,
    frequencyScore: row.frequency_score,
    behaviorScore: row.behavior_score,
    sentimentScore: row.sentiment_score,
    scoreBreakdown: row.score_breakdown,
    buyingSignals: row.buying_signals || [],
    buyingSignalCount: row.buying_signal_count,
    lastBuyingSignalAt: row.last_buying_signal_at ? new Date(row.last_buying_signal_at) : undefined,
    pipelineStage: row.pipeline_stage,
    pipelineStageChangedAt: row.pipeline_stage_changed_at ? new Date(row.pipeline_stage_changed_at) : undefined,
    estimatedValue: row.estimated_value,
    probability: row.probability,
    expectedCloseDate: row.expected_close_date ? new Date(row.expected_close_date) : undefined,
    aiConversionProbability: row.ai_conversion_probability,
    aiChurnRisk: row.ai_churn_risk,
    aiNextActionPrediction: row.ai_next_action_prediction,
    aiBestContactTime: row.ai_best_contact_time,
    aiPredictedValue: row.ai_predicted_value,
    scoreHistory: row.score_history || [],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    lastScoredAt: row.last_scored_at ? new Date(row.last_scored_at) : undefined,
  };
}

function getGradeFromScore(score: number): LeadGrade {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'F';
}

function getStatusFromScore(score: number, buyingSignals: number): LeadStatus {
  if (score >= 80 && buyingSignals >= 2) return 'hot';
  if (score >= 70 || buyingSignals >= 1) return 'warm';
  if (score >= 50) return 'warming';
  return 'cold';
}

// ==================== LEAD SCORING SERVICE ====================

export class LeadScoringService {
  private userId: string | null = null;

  setUserId(userId: string) {
    this.userId = userId;
  }

  private getUserId(): string {
    if (!this.userId) {
      throw new Error('User ID not set. Call setUserId() first.');
    }
    return this.userId;
  }

  // ==================== SCORE MANAGEMENT ====================

  async getOrCreateLeadScore(profileId: string): Promise<LeadScore> {
    const userId = this.getUserId();

    // Try to find existing
    const { data: existing } = await supabase
      .from('lead_scores')
      .select('*')
      .eq('user_id', userId)
      .eq('profile_id', profileId)
      .single();

    if (existing) {
      return rowToLeadScore(existing);
    }

    // Create new lead score
    const { data: newScore, error } = await supabase
      .from('lead_scores')
      .insert({
        user_id: userId,
        profile_id: profileId,
        lead_score: 0,
        lead_grade: 'F',
        lead_status: 'unknown',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create lead score: ${error.message}`);
    }

    return rowToLeadScore(newScore);
  }

  async getLeadScore(profileId: string): Promise<LeadScore | null> {
    const userId = this.getUserId();

    const { data, error } = await supabase
      .from('lead_scores')
      .select('*')
      .eq('user_id', userId)
      .eq('profile_id', profileId)
      .single();

    if (error || !data) return null;
    return rowToLeadScore(data);
  }

  async getTopLeads(limit = 20): Promise<LeadScore[]> {
    const userId = this.getUserId();

    const { data, error } = await supabase
      .from('lead_scores')
      .select('*')
      .eq('user_id', userId)
      .in('lead_status', ['hot', 'warm', 'warming'])
      .order('lead_score', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching top leads:', error);
      return [];
    }

    return (data || []).map(rowToLeadScore);
  }

  async getLeadsByStatus(status: LeadStatus): Promise<LeadScore[]> {
    const userId = this.getUserId();

    const { data, error } = await supabase
      .from('lead_scores')
      .select('*')
      .eq('user_id', userId)
      .eq('lead_status', status)
      .order('lead_score', { ascending: false });

    if (error) {
      console.error('Error fetching leads by status:', error);
      return [];
    }

    return (data || []).map(rowToLeadScore);
  }

  // ==================== SCORE CALCULATION ====================

  async calculateLeadScore(profileId: string): Promise<LeadScore> {
    const userId = this.getUserId();

    // Get profile data
    const { data: profile } = await supabase
      .from('relationship_profiles')
      .select('*')
      .eq('id', profileId)
      .eq('user_id', userId)
      .single();

    if (!profile) {
      throw new Error('Profile not found');
    }

    // Calculate component scores
    const engagementScore = await this.computeEngagementScore(profile);
    const recencyScore = this.computeRecencyScore(profile);
    const frequencyScore = this.computeFrequencyScore(profile);
    const behaviorScore = await this.computeBehaviorScore(profileId);
    const sentimentScore = this.computeSentimentScore(profile);

    // Weighted total (adjust weights based on your needs)
    const weights = {
      engagement: 0.25,
      recency: 0.25,
      frequency: 0.20,
      behavior: 0.15,
      sentiment: 0.15,
    };

    const totalScore = Math.round(
      engagementScore * weights.engagement +
      recencyScore * weights.recency +
      frequencyScore * weights.frequency +
      behaviorScore * weights.behavior +
      sentimentScore * weights.sentiment
    );

    const leadScore = Math.min(Math.max(totalScore, 0), 100);

    // Get existing buying signals count
    const { data: existingScore } = await supabase
      .from('lead_scores')
      .select('buying_signals, score_history')
      .eq('profile_id', profileId)
      .single();

    const buyingSignals = existingScore?.buying_signals || [];
    const scoreHistory: ScoreHistoryEntry[] = existingScore?.score_history || [];

    const grade = getGradeFromScore(leadScore);
    const status = getStatusFromScore(leadScore, buyingSignals.length);

    // Add to history
    scoreHistory.push({
      date: new Date().toISOString(),
      score: leadScore,
      grade,
      trigger: 'recalculation',
    });

    // Keep only last 30 entries
    const trimmedHistory = scoreHistory.slice(-30);

    const scoreBreakdown: ScoreBreakdown = {
      engagement: {
        responses: Math.round(engagementScore),
      },
      recency: {
        daysSinceContact: profile.last_interaction_at
          ? Math.floor((Date.now() - new Date(profile.last_interaction_at).getTime()) / (1000 * 60 * 60 * 24))
          : 999,
        score: recencyScore,
      },
      frequency: {
        interactionsPerWeek: this.calculateInteractionsPerWeek(profile),
        score: frequencyScore,
      },
      behavior: {
        buyingSignals: buyingSignals.length,
        score: behaviorScore,
      },
      sentiment: {
        average: profile.ai_sentiment_average || 0,
        trend: profile.relationship_trend || 'stable',
        score: sentimentScore,
      },
    };

    // Upsert lead score
    const { data: updatedScore, error } = await supabase
      .from('lead_scores')
      .upsert({
        user_id: userId,
        profile_id: profileId,
        lead_score: leadScore,
        lead_grade: grade,
        lead_status: status,
        engagement_score: engagementScore,
        recency_score: recencyScore,
        frequency_score: frequencyScore,
        behavior_score: behaviorScore,
        sentiment_score: sentimentScore,
        score_breakdown: scoreBreakdown,
        buying_signal_count: buyingSignals.length,
        score_history: trimmedHistory,
        last_scored_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'profile_id',
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating lead score:', error);
      throw error;
    }

    return rowToLeadScore(updatedScore);
  }

  private async computeEngagementScore(profile: any): Promise<number> {
    // Based on response rate and two-way communication
    const responseRate = profile.response_rate || 0;
    const sent = profile.total_emails_sent || 0;
    const received = profile.total_emails_received || 0;

    // Balance factor (penalize one-sided communication)
    let balanceFactor = 1;
    if (sent + received > 0) {
      const ratio = Math.min(sent, received) / Math.max(sent, received);
      balanceFactor = 0.5 + (ratio * 0.5);
    }

    const baseScore = responseRate * 100;
    return Math.round(baseScore * balanceFactor);
  }

  private computeRecencyScore(profile: any): number {
    if (!profile.last_interaction_at) return 0;

    const daysSince = Math.floor(
      (Date.now() - new Date(profile.last_interaction_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSince <= 1) return 100;
    if (daysSince <= 3) return 90;
    if (daysSince <= 7) return 80;
    if (daysSince <= 14) return 65;
    if (daysSince <= 30) return 50;
    if (daysSince <= 60) return 30;
    if (daysSince <= 90) return 15;
    return 5;
  }

  private computeFrequencyScore(profile: any): number {
    const frequency = profile.communication_frequency;

    switch (frequency) {
      case 'daily': return 100;
      case 'weekly': return 80;
      case 'monthly': return 50;
      case 'sporadic': return 25;
      case 'dormant': return 5;
      default: return 0;
    }
  }

  private async computeBehaviorScore(profileId: string): Promise<number> {
    const userId = this.getUserId();

    // Get buying signals count
    const { data: leadScore } = await supabase
      .from('lead_scores')
      .select('buying_signals')
      .eq('user_id', userId)
      .eq('profile_id', profileId)
      .single();

    const signals = leadScore?.buying_signals || [];

    // Each buying signal adds points
    const signalScore = Math.min(signals.length * 20, 100);
    return signalScore;
  }

  private computeSentimentScore(profile: any): number {
    const sentiment = profile.ai_sentiment_average;
    if (sentiment === undefined || sentiment === null) return 50;

    // Convert -1 to 1 range to 0-100
    return Math.round((sentiment + 1) / 2 * 100);
  }

  private calculateInteractionsPerWeek(profile: any): number {
    const totalInteractions =
      (profile.total_emails_sent || 0) +
      (profile.total_emails_received || 0) +
      (profile.total_meetings || 0);

    if (!profile.first_interaction_at) return 0;

    const daysSinceFirst = Math.max(
      1,
      Math.floor((Date.now() - new Date(profile.first_interaction_at).getTime()) / (1000 * 60 * 60 * 24))
    );

    return totalInteractions / (daysSinceFirst / 7);
  }

  // ==================== BUYING SIGNALS ====================

  async detectBuyingSignals(profileId: string): Promise<BuyingSignal[]> {
    const userId = this.getUserId();
    const newSignals: BuyingSignal[] = [];

    // Get recent interactions
    const { data: interactions } = await supabase
      .from('contact_interactions')
      .select('*')
      .eq('user_id', userId)
      .eq('profile_id', profileId)
      .order('interaction_date', { ascending: false })
      .limit(20);

    if (!interactions || interactions.length === 0) return newSignals;

    // Analyze interactions for buying signals
    const recentSubjects = interactions
      .filter(i => i.subject)
      .map(i => i.subject)
      .join('\n');

    if (recentSubjects) {
      try {
        const prompt = `Analyze these email subjects for buying signals (interest in purchasing, requesting pricing, asking for demos, etc.):

${recentSubjects}

Return JSON array of detected signals:
[{"signal": "signal_type", "confidence": 0.8, "details": "explanation"}]

Signal types: pricing_inquiry, demo_request, competitor_mention, timeline_mention, budget_discussion, decision_maker_involved, urgency_expressed, requirements_gathering

Return empty array [] if no signals found.`;

        const response = await askAI(prompt);
        if (response) {
          const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const detected = JSON.parse(cleaned);

          if (Array.isArray(detected)) {
            for (const signal of detected) {
              if (signal.confidence >= 0.6) {
                newSignals.push({
                  signal: signal.signal,
                  date: new Date().toISOString(),
                  confidence: signal.confidence,
                  source: 'email_analysis',
                  details: signal.details,
                });
              }
            }
          }
        }
      } catch (error) {
        console.error('Error detecting buying signals:', error);
      }
    }

    // Store new signals
    if (newSignals.length > 0) {
      const { data: existing } = await supabase
        .from('lead_scores')
        .select('buying_signals')
        .eq('user_id', userId)
        .eq('profile_id', profileId)
        .single();

      const existingSignals = existing?.buying_signals || [];
      const allSignals = [...existingSignals, ...newSignals].slice(-50); // Keep last 50

      await supabase
        .from('lead_scores')
        .upsert({
          user_id: userId,
          profile_id: profileId,
          buying_signals: allSignals,
          buying_signal_count: allSignals.length,
          last_buying_signal_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'profile_id',
        });
    }

    return newSignals;
  }

  async addBuyingSignal(
    profileId: string,
    signal: string,
    confidence: number,
    source: string,
    details?: string
  ): Promise<boolean> {
    const userId = this.getUserId();

    const newSignal: BuyingSignal = {
      signal,
      date: new Date().toISOString(),
      confidence,
      source,
      details,
    };

    const { data: existing } = await supabase
      .from('lead_scores')
      .select('buying_signals')
      .eq('user_id', userId)
      .eq('profile_id', profileId)
      .single();

    const signals = [...(existing?.buying_signals || []), newSignal];

    const { error } = await supabase
      .from('lead_scores')
      .upsert({
        user_id: userId,
        profile_id: profileId,
        buying_signals: signals,
        buying_signal_count: signals.length,
        last_buying_signal_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'profile_id',
      });

    return !error;
  }

  // ==================== AI PREDICTIONS ====================

  async predictConversion(profileId: string): Promise<number> {
    const userId = this.getUserId();

    // Get profile and lead score data
    const { data: profile } = await supabase
      .from('relationship_profiles')
      .select('*')
      .eq('id', profileId)
      .eq('user_id', userId)
      .single();

    const { data: leadScore } = await supabase
      .from('lead_scores')
      .select('*')
      .eq('profile_id', profileId)
      .single();

    if (!profile) return 0;

    // Simple heuristic-based prediction
    let probability = 0.1; // Base probability

    // Add based on lead score
    if (leadScore) {
      probability += (leadScore.lead_score / 100) * 0.3;
      probability += (leadScore.buying_signal_count * 0.1);
    }

    // Add based on relationship strength
    probability += (profile.relationship_score / 100) * 0.2;

    // Add based on engagement
    if (profile.response_rate) {
      probability += profile.response_rate * 0.2;
    }

    // Cap at 95%
    probability = Math.min(probability, 0.95);

    // Store prediction
    await supabase
      .from('lead_scores')
      .update({
        ai_conversion_probability: probability,
        updated_at: new Date().toISOString(),
      })
      .eq('profile_id', profileId);

    return probability;
  }

  async predictChurnRisk(profileId: string): Promise<number> {
    const userId = this.getUserId();

    const { data: profile } = await supabase
      .from('relationship_profiles')
      .select('*')
      .eq('id', profileId)
      .eq('user_id', userId)
      .single();

    if (!profile) return 0.5;

    let risk = 0.1; // Base risk

    // Increase risk for falling trend
    if (profile.relationship_trend === 'falling') {
      risk += 0.3;
    }

    // Increase risk for dormant communication
    if (profile.communication_frequency === 'dormant') {
      risk += 0.3;
    } else if (profile.communication_frequency === 'sporadic') {
      risk += 0.15;
    }

    // Increase risk for low score
    if (profile.relationship_score < 30) {
      risk += 0.2;
    } else if (profile.relationship_score < 50) {
      risk += 0.1;
    }

    // Increase risk for negative sentiment
    if (profile.ai_sentiment_average && profile.ai_sentiment_average < -0.3) {
      risk += 0.2;
    }

    // Cap at 95%
    risk = Math.min(risk, 0.95);

    // Store prediction
    await supabase
      .from('lead_scores')
      .update({
        ai_churn_risk: risk,
        updated_at: new Date().toISOString(),
      })
      .eq('profile_id', profileId);

    return risk;
  }

  // ==================== PIPELINE MANAGEMENT ====================

  async updatePipelineStage(profileId: string, stage: string): Promise<boolean> {
    const userId = this.getUserId();

    const { error } = await supabase
      .from('lead_scores')
      .update({
        pipeline_stage: stage,
        pipeline_stage_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('profile_id', profileId)
      .eq('user_id', userId);

    return !error;
  }

  async getPipeline(): Promise<Record<string, LeadScore[]>> {
    const userId = this.getUserId();

    const { data } = await supabase
      .from('lead_scores')
      .select('*')
      .eq('user_id', userId)
      .not('pipeline_stage', 'is', null)
      .order('lead_score', { ascending: false });

    const pipeline: Record<string, LeadScore[]> = {};

    for (const row of data || []) {
      const score = rowToLeadScore(row);
      const stage = score.pipelineStage || 'unassigned';
      if (!pipeline[stage]) pipeline[stage] = [];
      pipeline[stage].push(score);
    }

    return pipeline;
  }

  // ==================== BATCH OPERATIONS ====================

  async scoreAllProfiles(): Promise<number> {
    const userId = this.getUserId();

    const { data: profiles } = await supabase
      .from('relationship_profiles')
      .select('id')
      .eq('user_id', userId)
      .eq('is_merged', false)
      .eq('is_blocked', false);

    if (!profiles) return 0;

    let scored = 0;
    for (const profile of profiles) {
      try {
        await this.calculateLeadScore(profile.id);
        scored++;
      } catch (error) {
        console.error(`Error scoring profile ${profile.id}:`, error);
      }
    }

    return scored;
  }
}

// Export singleton instance
export const leadScoringService = new LeadScoringService();
