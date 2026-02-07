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
  resolved_last_30d: number;
  avg_resolution_time_hours: number;
  hot_topics_count: number;
  conflict_free_days: number;
  most_common_type: string | null;
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
 * Get all conflicts (with optional filters)
 */
export async function getAllConflicts(
  status?: 'active' | 'resolving' | 'resolved' | 'unresolved',
  limit?: number
): Promise<{
  success: boolean;
  data?: ConflictTracking[];
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    let query = supabase
      .from('conflict_tracking')
      .select('*')
      .eq('user_id', user.id)
      .order('first_detected_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error('Error fetching conflicts:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get conflict by ID
 */
export async function getConflictById(
  conflictId: string
): Promise<{
  success: boolean;
  data?: ConflictTracking;
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
      .eq('id', conflictId)
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return { success: true, data: data || undefined };
  } catch (err: any) {
    console.error('Error fetching conflict:', err);
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
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const activeConflicts = conflicts.filter(c => c.status === 'active').length;

    const resolvedLast7d = conflicts.filter(c =>
      c.status === 'resolved' &&
      c.resolved_at &&
      new Date(c.resolved_at) >= sevenDaysAgo
    ).length;

    const resolvedLast30d = conflicts.filter(c =>
      c.status === 'resolved' &&
      c.resolved_at &&
      new Date(c.resolved_at) >= thirtyDaysAgo
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

    // Find most common conflict type
    const typeCounts: Record<string, number> = {};
    conflicts.forEach(c => {
      if (c.conflict_type) {
        typeCounts[c.conflict_type] = (typeCounts[c.conflict_type] || 0) + 1;
      }
    });
    const mostCommonType = Object.keys(typeCounts).length > 0
      ? Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0][0]
      : null;

    const summary: ConflictSummary = {
      active_conflicts: activeConflicts,
      resolved_last_7d: resolvedLast7d,
      resolved_last_30d: resolvedLast30d,
      avg_resolution_time_hours: avgResolutionTime,
      hot_topics_count: (hotTopics || []).length,
      conflict_free_days: conflictFreeDays,
      most_common_type: mostCommonType,
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
 * This is a placeholder that uses keyword detection
 * In production, this should use Claude AI API for better analysis
 */
export async function detectConflictInMessage(
  messageContent: string,
  contactIdentifier: string,
  messageId: string,
  channel: string
): Promise<{
  success: boolean;
  conflict_detected?: boolean;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  topic?: string;
  keywords?: string[];
  tension_score?: number;
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Conflict detection keywords (basic implementation)
    const conflictKeywords = {
      high: ['disagree', 'wrong', 'never', 'always', 'frustrated', 'disappointed', 'upset', 'angry'],
      medium: ['however', 'but', 'concern', 'issue', 'problem', 'confused', 'worried'],
      low: ['no', 'not sure', 'maybe not', 'reconsider', 'alternative']
    };

    const lowerContent = messageContent.toLowerCase();
    const detectedKeywords: string[] = [];
    let maxSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let severityScore = 0;

    // Check for keywords
    Object.entries(conflictKeywords).forEach(([severity, keywords]) => {
      keywords.forEach(keyword => {
        if (lowerContent.includes(keyword)) {
          detectedKeywords.push(keyword);
          if (severity === 'high') severityScore += 3;
          else if (severity === 'medium') severityScore += 2;
          else severityScore += 1;
        }
      });
    });

    // Determine if conflict detected (threshold: 2+ keywords or any high severity)
    const hasHighSeverityKeyword = conflictKeywords.high.some(kw => lowerContent.includes(kw));
    const conflictDetected = detectedKeywords.length >= 2 || hasHighSeverityKeyword;

    if (!conflictDetected) {
      return {
        success: true,
        conflict_detected: false
      };
    }

    // Calculate tension score and severity
    const tensionScore = Math.min(severityScore / 10, 1);

    if (severityScore >= 9) maxSeverity = 'critical';
    else if (severityScore >= 6) maxSeverity = 'high';
    else if (severityScore >= 3) maxSeverity = 'medium';
    else maxSeverity = 'low';

    // TODO: Use Claude AI API for better topic extraction and analysis
    const topic = 'unspecified'; // Would be extracted by AI

    return {
      success: true,
      conflict_detected: true,
      severity: maxSeverity,
      topic,
      keywords: detectedKeywords,
      tension_score: tensionScore
    };
  } catch (err: any) {
    console.error('Error detecting conflict:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Create a new conflict tracking record
 */
export async function createConflict(
  contactIdentifier: string,
  messageId: string,
  channel: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  conflictType?: string,
  topic?: string,
  keywords?: string[],
  tensionScore?: number
): Promise<{
  success: boolean;
  data?: ConflictTracking;
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Check if there's an existing active conflict with this contact
    const { data: existingConflicts } = await supabase
      .from('conflict_tracking')
      .select('*')
      .eq('user_id', user.id)
      .eq('contact_identifier', contactIdentifier)
      .eq('status', 'active');

    // If there's a recent active conflict (within 24 hours), update it instead
    const recentConflict = existingConflicts?.find(c => {
      const hoursSince = (Date.now() - new Date(c.first_detected_at).getTime()) / (1000 * 60 * 60);
      return hoursSince < 24;
    });

    if (recentConflict) {
      // Update existing conflict
      const updatedMessageIds = [...recentConflict.related_message_ids, messageId];
      const updatedKeywords = [...new Set([...recentConflict.trigger_keywords, ...(keywords || [])])];

      const { data, error } = await supabase
        .from('conflict_tracking')
        .update({
          related_message_ids: updatedMessageIds,
          trigger_keywords: updatedKeywords,
          tension_score: Math.max(recentConflict.tension_score || 0, tensionScore || 0),
          severity: severityIsHigher(severity, recentConflict.severity) ? severity : recentConflict.severity,
          updated_at: new Date().toISOString()
        })
        .eq('id', recentConflict.id)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    }

    // Create new conflict
    const { data, error } = await supabase
      .from('conflict_tracking')
      .insert({
        user_id: user.id,
        contact_identifier: contactIdentifier,
        conflict_type: conflictType || 'disagreement',
        severity,
        status: 'active',
        channel,
        first_message_id: messageId,
        first_detected_at: new Date().toISOString(),
        related_message_ids: [messageId],
        trigger_topic: topic,
        trigger_keywords: keywords || [],
        tension_score: tensionScore,
        is_recurring: false,
        hot_topic: false,
      })
      .select()
      .single();

    if (error) throw error;

    // Update or create hot topic
    if (topic && topic !== 'unspecified') {
      await updateHotTopic(user.id, contactIdentifier, topic, severity);
    }

    return { success: true, data };
  } catch (err: any) {
    console.error('Error creating conflict:', err);
    return { success: false, error: err.message };
  }
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
  data?: ConflictTracking;
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

    const { data, error: updateError } = await supabase
      .from('conflict_tracking')
      .update({
        status: 'resolved',
        resolved_at: resolvedAt.toISOString(),
        resolution_method: resolutionMethod,
        resolution_message_id: resolutionMessageId,
        time_to_resolution_hours: hoursToResolve,
        updated_at: new Date().toISOString()
      })
      .eq('id', conflictId)
      .select()
      .single();

    if (updateError) throw updateError;

    return { success: true, data };
  } catch (err: any) {
    console.error('Error resolving conflict:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Update conflict status
 */
export async function updateConflictStatus(
  conflictId: string,
  status: 'active' | 'resolving' | 'resolved' | 'unresolved'
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { error } = await supabase
      .from('conflict_tracking')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', conflictId);

    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    console.error('Error updating conflict status:', err);
    return { success: false, error: err.message };
  }
}

// Helper functions

/**
 * Compare severity levels
 */
function severityIsHigher(
  severity1: 'low' | 'medium' | 'high' | 'critical',
  severity2: 'low' | 'medium' | 'high' | 'critical'
): boolean {
  const levels = { low: 1, medium: 2, high: 3, critical: 4 };
  return levels[severity1] > levels[severity2];
}

/**
 * Update or create hot topic
 */
async function updateHotTopic(
  userId: string,
  contactIdentifier: string,
  topic: string,
  severity: 'low' | 'medium' | 'high' | 'critical'
): Promise<void> {
  try {
    const severityValue = { low: 0.25, medium: 0.5, high: 0.75, critical: 1 }[severity];

    const { data: existing } = await supabase
      .from('hot_topics')
      .select('*')
      .eq('user_id', userId)
      .eq('contact_identifier', contactIdentifier)
      .eq('topic', topic)
      .single();

    if (existing) {
      // Update existing hot topic
      const newCount = existing.conflict_count + 1;
      const newAvgSeverity = ((existing.avg_severity || 0) * existing.conflict_count + severityValue) / newCount;

      await supabase
        .from('hot_topics')
        .update({
          conflict_count: newCount,
          avg_severity: newAvgSeverity,
          last_conflict_at: new Date().toISOString(),
          avoidance_recommended: newCount >= 3,
          communication_tip: newCount >= 3 ? generateCommunicationTip(topic, newAvgSeverity) : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      // Create new hot topic
      await supabase
        .from('hot_topics')
        .insert({
          user_id: userId,
          contact_identifier: contactIdentifier,
          topic,
          conflict_count: 1,
          avg_severity: severityValue,
          last_conflict_at: new Date().toISOString(),
          avoidance_recommended: false,
        });
    }
  } catch (err: any) {
    console.error('Error updating hot topic:', err);
  }
}

/**
 * Generate communication tip for hot topic
 */
function generateCommunicationTip(topic: string, avgSeverity: number): string {
  if (avgSeverity >= 0.75) {
    return `This topic (${topic}) consistently causes high tension. Consider avoiding it or seeking mediation.`;
  }
  if (avgSeverity >= 0.5) {
    return `This topic (${topic}) often leads to disagreements. Approach it carefully and listen actively.`;
  }
  return `This topic (${topic}) has caused some friction. Try to find common ground when discussing it.`;
}
