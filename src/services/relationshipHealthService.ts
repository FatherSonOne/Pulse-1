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
 * Get relationships that need attention (at risk or declining)
 */
export async function getRelationshipsNeedingAttention(): Promise<{
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
      .in('health_status', ['at_risk', 'cooling', 'dormant'])
      .order('health_score', { ascending: true })
      .limit(10);

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error('Error fetching relationships needing attention:', err);
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
      const sentimentTrend = determineSentimentTrend(contact);
      const interactionFrequency = determineInteractionFrequency(contact);

      const updates = {
        user_id: user.id,
        contact_identifier: contact.contact_identifier,
        contact_name: contact.contact_name,
        health_score: healthScore,
        health_status: healthStatus,
        days_since_last_message: contact.days_since_last_contact,
        message_count_30d: contact.total_messages_sent + contact.total_messages_received,
        conversation_count_30d: Math.floor((contact.total_messages_sent + contact.total_messages_received) / 3),
        sentiment_trend: sentimentTrend,
        sentiment_balance: contact.avg_sentiment || null,
        interaction_frequency: interactionFrequency,
        response_reciprocity_score: contact.response_rate || null,
        avg_response_time_user: contact.avg_response_time_minutes || null,
        at_risk_reason: riskReasons,
        intervention_suggested: riskReasons.length > 0,
        intervention_message: riskReasons.length > 0 ? generateInterventionMessage(riskReasons, contact) : null,
        last_calculated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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

/**
 * Update a single relationship health score
 */
export async function updateRelationshipHealth(
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

    // Get contact engagement data
    const { data: contact, error: contactError } = await supabase
      .from('analytics_contact_engagement')
      .select('*')
      .eq('user_id', user.id)
      .eq('contact_identifier', contactIdentifier)
      .single();

    if (contactError) throw contactError;

    const healthScore = calculateHealthScore(contact);
    const healthStatus = determineHealthStatus(healthScore);
    const riskReasons = identifyRiskReasons(contact);
    const sentimentTrend = determineSentimentTrend(contact);
    const interactionFrequency = determineInteractionFrequency(contact);

    const updates = {
      user_id: user.id,
      contact_identifier: contact.contact_identifier,
      contact_name: contact.contact_name,
      health_score: healthScore,
      health_status: healthStatus,
      days_since_last_message: contact.days_since_last_contact,
      message_count_30d: contact.total_messages_sent + contact.total_messages_received,
      conversation_count_30d: Math.floor((contact.total_messages_sent + contact.total_messages_received) / 3),
      sentiment_trend: sentimentTrend,
      sentiment_balance: contact.avg_sentiment || null,
      interaction_frequency: interactionFrequency,
      response_reciprocity_score: contact.response_rate || null,
      avg_response_time_user: contact.avg_response_time_minutes || null,
      at_risk_reason: riskReasons,
      intervention_suggested: riskReasons.length > 0,
      intervention_message: riskReasons.length > 0 ? generateInterventionMessage(riskReasons, contact) : null,
      last_calculated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error: upsertError } = await supabase
      .from('relationship_health')
      .upsert(updates, { onConflict: 'user_id,contact_identifier' })
      .select()
      .single();

    if (upsertError) throw upsertError;

    return { success: true, data };
  } catch (err: any) {
    console.error('Error updating relationship health:', err);
    return { success: false, error: err.message };
  }
}

// Helper functions

/**
 * Calculate overall health score (0-100)
 */
function calculateHealthScore(contact: any): number {
  const recencyScore = calculateRecencyScore(contact.days_since_last_contact);
  const frequencyScore = Math.min((contact.total_messages_sent + contact.total_messages_received) * 0.5, 25);
  const reciprocityScore = (contact.engagement_score || 50) * 0.2;
  const sentimentScore = ((contact.avg_sentiment || 0) + 1) * 7.5;
  const engagementScore = Math.min((contact.total_messages_sent + contact.total_messages_received) * 0.1, 10);

  return Math.min(Math.max(recencyScore + frequencyScore + reciprocityScore + sentimentScore + engagementScore, 0), 100);
}

/**
 * Calculate recency component of health score
 */
function calculateRecencyScore(daysSince: number | null): number {
  if (daysSince === null) return 15;
  if (daysSince === 0) return 30;
  if (daysSince <= 3) return 25;
  if (daysSince <= 7) return 20;
  if (daysSince <= 14) return 15;
  if (daysSince <= 30) return 10;
  return 5;
}

/**
 * Determine health status based on score
 */
function determineHealthStatus(score: number): 'active' | 'warming' | 'cooling' | 'at_risk' | 'dormant' {
  if (score >= 80) return 'active';
  if (score >= 60) return 'warming';
  if (score >= 40) return 'cooling';
  if (score >= 20) return 'at_risk';
  return 'dormant';
}

/**
 * Determine sentiment trend
 */
function determineSentimentTrend(contact: any): 'improving' | 'declining' | 'stable' {
  if (contact.engagement_trend === 'rising' && contact.avg_sentiment > 0) {
    return 'improving';
  }
  if (contact.engagement_trend === 'falling' || contact.avg_sentiment < -0.2) {
    return 'declining';
  }
  return 'stable';
}

/**
 * Determine interaction frequency category
 */
function determineInteractionFrequency(contact: any): 'daily' | 'weekly' | 'monthly' | 'sporadic' {
  const totalMessages = contact.total_messages_sent + contact.total_messages_received;
  const daysSinceFirst = contact.first_contact_at
    ? Math.floor((Date.now() - new Date(contact.first_contact_at).getTime()) / (1000 * 60 * 60 * 24))
    : 30;

  const avgMessagesPerDay = totalMessages / Math.max(daysSinceFirst, 1);

  if (avgMessagesPerDay >= 1) return 'daily';
  if (avgMessagesPerDay >= 0.3) return 'weekly';
  if (avgMessagesPerDay >= 0.05) return 'monthly';
  return 'sporadic';
}

/**
 * Identify risk factors
 */
function identifyRiskReasons(contact: any): string[] {
  const reasons: string[] = [];

  if (contact.days_since_last_contact > 14) {
    reasons.push('long_gap');
  }
  if (contact.days_since_last_contact > 30) {
    reasons.push('dormant');
  }
  if (contact.engagement_trend === 'falling') {
    reasons.push('declining_frequency');
  }
  if (contact.avg_sentiment < -0.2) {
    reasons.push('negative_sentiment');
  }
  if (contact.response_rate < 30) {
    reasons.push('low_response_rate');
  }
  if (contact.total_messages_received === 0 && contact.total_messages_sent > 5) {
    reasons.push('one_sided_communication');
  }

  return reasons;
}

/**
 * Generate intervention message based on risk reasons
 */
function generateInterventionMessage(reasons: string[], contact: any): string {
  const contactName = contact.contact_name || 'this contact';

  if (reasons.includes('dormant')) {
    return `You haven't messaged ${contactName} in over 30 days. Consider reaching out to reconnect.`;
  }
  if (reasons.includes('long_gap')) {
    return `It's been ${contact.days_since_last_contact} days since your last message with ${contactName}. Time to check in?`;
  }
  if (reasons.includes('declining_frequency')) {
    return `Your interaction frequency with ${contactName} is declining. Consider scheduling a catch-up.`;
  }
  if (reasons.includes('negative_sentiment')) {
    return `Recent messages with ${contactName} have had negative sentiment. You may want to address any concerns.`;
  }
  if (reasons.includes('one_sided_communication')) {
    return `You've sent several messages to ${contactName} without responses. They may need more time or a different approach.`;
  }
  if (reasons.includes('low_response_rate')) {
    return `${contactName} has a low response rate. Consider adjusting your communication style or timing.`;
  }

  return `Your relationship with ${contactName} may need attention. Review recent interactions.`;
}
