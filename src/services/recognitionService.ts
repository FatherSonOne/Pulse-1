/**
 * Recognition Service
 * Tracks kudos, appreciation, wins, and positive interactions
 */

import { supabase } from './supabase';

export interface RecognitionEvent {
  id: string;
  user_id: string;
  event_type: 'kudos' | 'appreciation' | 'praise' | 'thank_you' | 'celebration' | 'win';
  recognition_category: string | null;
  from_contact_identifier: string | null;
  from_contact_name: string | null;
  to_contact_identifier: string | null;
  to_contact_name: string | null;
  direction: 'received' | 'given' | 'self';
  channel: string;
  message_id: string | null;
  message_excerpt: string | null;
  detected_at: string;
  positivity_score: number | null;
  impact_level: 'low' | 'medium' | 'high';
  keywords_detected: string[];
  topic: string | null;
  is_milestone: boolean;
  milestone_type: string | null;
  milestone_description: string | null;
  created_at: string;
}

export interface RecognitionSummary {
  id: string;
  user_id: string;
  contact_identifier: string;
  contact_name: string | null;
  kudos_received_count: number;
  kudos_given_count: number;
  total_recognition_events: number;
  appreciation_score: number;
  reciprocity_score: number;
  last_kudos_received_at: string | null;
  last_kudos_given_at: string | null;
  recognition_trend: 'rising' | 'falling' | 'stable';
  most_appreciated_for: string[];
  most_appreciates_about: string[];
  created_at: string;
  updated_at: string;
}

export interface WinsTracker {
  id: string;
  user_id: string;
  win_title: string;
  win_description: string | null;
  win_type: string | null;
  mentioned_in_message_id: string | null;
  mentioned_by_contact: string | null;
  channel: string | null;
  detected_at: string;
  celebrated: boolean;
  celebration_message: string | null;
  created_at: string;
}

export interface RecognitionOverview {
  total_received: number;
  total_given: number;
  total_wins: number;
  avg_appreciation_score: number;
  top_appreciators: Array<{ contact: string; count: number }>;
  recent_wins: WinsTracker[];
  recognition_trend: 'rising' | 'falling' | 'stable';
}

/**
 * Get all recognition events
 */
export async function getAllRecognitionEvents(
  direction?: 'received' | 'given' | 'self',
  limit?: number
): Promise<{
  success: boolean;
  data?: RecognitionEvent[];
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    let query = supabase
      .from('recognition_events')
      .select('*')
      .eq('user_id', user.id)
      .order('detected_at', { ascending: false });

    if (direction) {
      query = query.eq('direction', direction);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error('Error fetching recognition events:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get recognition summary for a contact
 */
export async function getRecognitionSummary(
  contactIdentifier: string
): Promise<{
  success: boolean;
  data?: RecognitionSummary;
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase
      .from('recognition_summary')
      .select('*')
      .eq('user_id', user.id)
      .eq('contact_identifier', contactIdentifier)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return { success: true, data: data || undefined };
  } catch (err: any) {
    console.error('Error fetching recognition summary:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get all recognition summaries
 */
export async function getAllRecognitionSummaries(): Promise<{
  success: boolean;
  data?: RecognitionSummary[];
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase
      .from('recognition_summary')
      .select('*')
      .eq('user_id', user.id)
      .order('appreciation_score', { ascending: false });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error('Error fetching recognition summaries:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get recognition overview
 */
export async function getRecognitionOverview(): Promise<{
  success: boolean;
  data?: RecognitionOverview;
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get all recognition events
    const { data: events, error: eventsError } = await supabase
      .from('recognition_events')
      .select('*')
      .eq('user_id', user.id);

    if (eventsError) throw eventsError;

    // Get all summaries
    const { data: summaries, error: summariesError } = await supabase
      .from('recognition_summary')
      .select('*')
      .eq('user_id', user.id);

    if (summariesError) throw summariesError;

    // Get recent wins
    const { data: wins, error: winsError } = await supabase
      .from('wins_tracker')
      .select('*')
      .eq('user_id', user.id)
      .order('detected_at', { ascending: false })
      .limit(5);

    if (winsError) throw winsError;

    const allEvents = events || [];
    const allSummaries = summaries || [];

    // Calculate totals
    const totalReceived = allEvents.filter(e => e.direction === 'received').length;
    const totalGiven = allEvents.filter(e => e.direction === 'given').length;
    const totalWins = (wins || []).length;

    // Calculate average appreciation score
    const avgAppreciationScore = allSummaries.length > 0
      ? allSummaries.reduce((sum, s) => sum + s.appreciation_score, 0) / allSummaries.length
      : 0;

    // Find top appreciators
    const appreciatorCounts: Record<string, number> = {};
    allEvents
      .filter(e => e.direction === 'received' && e.from_contact_name)
      .forEach(e => {
        const contact = e.from_contact_name!;
        appreciatorCounts[contact] = (appreciatorCounts[contact] || 0) + 1;
      });

    const topAppreciators = Object.entries(appreciatorCounts)
      .map(([contact, count]) => ({ contact, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Determine trend (compare last 30 days to previous 30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const recentCount = allEvents.filter(e => new Date(e.detected_at) >= thirtyDaysAgo).length;
    const previousCount = allEvents.filter(e =>
      new Date(e.detected_at) >= sixtyDaysAgo && new Date(e.detected_at) < thirtyDaysAgo
    ).length;

    let recognitionTrend: 'rising' | 'falling' | 'stable' = 'stable';
    if (recentCount > previousCount * 1.2) recognitionTrend = 'rising';
    else if (recentCount < previousCount * 0.8) recognitionTrend = 'falling';

    const overview: RecognitionOverview = {
      total_received: totalReceived,
      total_given: totalGiven,
      total_wins: totalWins,
      avg_appreciation_score: avgAppreciationScore,
      top_appreciators: topAppreciators,
      recent_wins: wins || [],
      recognition_trend: recognitionTrend,
    };

    return { success: true, data: overview };
  } catch (err: any) {
    console.error('Error fetching recognition overview:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Detect recognition in message content
 */
export async function detectRecognitionInMessage(
  messageContent: string,
  fromContactIdentifier: string,
  messageId: string,
  channel: string,
  direction: 'received' | 'given'
): Promise<{
  success: boolean;
  recognition_detected?: boolean;
  event_type?: string;
  category?: string;
  keywords?: string[];
  error?: string;
}> {
  try {
    // Recognition keywords by category
    const recognitionPatterns = {
      kudos: ['kudos', 'great job', 'well done', 'awesome', 'amazing', 'excellent', 'outstanding'],
      appreciation: ['thank you', 'thanks', 'appreciate', 'grateful', 'thankful'],
      praise: ['proud', 'impressed', 'admire', 'respect', 'brilliant', 'fantastic'],
      celebration: ['congrats', 'congratulations', 'celebrate', 'achievement', 'milestone', 'success'],
      win: ['win', 'won', 'achieved', 'accomplished', 'completed', 'finished', 'nailed']
    };

    const lowerContent = messageContent.toLowerCase();
    const detectedKeywords: string[] = [];
    let detectedCategory: string | null = null;
    let highestScore = 0;

    // Check each category
    Object.entries(recognitionPatterns).forEach(([category, keywords]) => {
      let score = 0;
      keywords.forEach(keyword => {
        if (lowerContent.includes(keyword)) {
          detectedKeywords.push(keyword);
          score++;
        }
      });

      if (score > highestScore) {
        highestScore = score;
        detectedCategory = category;
      }
    });

    // Recognition detected if we have at least 1 keyword
    const recognitionDetected = detectedKeywords.length > 0;

    if (!recognitionDetected) {
      return {
        success: true,
        recognition_detected: false
      };
    }

    return {
      success: true,
      recognition_detected: true,
      event_type: detectedCategory || 'kudos',
      category: detectedCategory || 'general',
      keywords: detectedKeywords
    };
  } catch (err: any) {
    console.error('Error detecting recognition:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Create a recognition event
 */
export async function createRecognitionEvent(
  eventType: 'kudos' | 'appreciation' | 'praise' | 'thank_you' | 'celebration' | 'win',
  direction: 'received' | 'given' | 'self',
  channel: string,
  messageId?: string,
  messageExcerpt?: string,
  fromContactIdentifier?: string,
  fromContactName?: string,
  toContactIdentifier?: string,
  toContactName?: string,
  category?: string,
  keywords?: string[],
  topic?: string,
  positivityScore?: number
): Promise<{
  success: boolean;
  data?: RecognitionEvent;
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const impactLevel = determineImpactLevel(eventType, positivityScore);

    const { data, error } = await supabase
      .from('recognition_events')
      .insert({
        user_id: user.id,
        event_type: eventType,
        recognition_category: category,
        from_contact_identifier: fromContactIdentifier,
        from_contact_name: fromContactName,
        to_contact_identifier: toContactIdentifier,
        to_contact_name: toContactName,
        direction,
        channel,
        message_id: messageId,
        message_excerpt: messageExcerpt,
        detected_at: new Date().toISOString(),
        positivity_score: positivityScore,
        impact_level: impactLevel,
        keywords_detected: keywords || [],
        topic,
        is_milestone: false,
      })
      .select()
      .single();

    if (error) throw error;

    // Update recognition summary
    const contactIdentifier = direction === 'received' ? fromContactIdentifier : toContactIdentifier;
    const contactName = direction === 'received' ? fromContactName : toContactName;

    if (contactIdentifier) {
      await updateRecognitionSummary(user.id, contactIdentifier, contactName || null, direction, category);
    }

    return { success: true, data };
  } catch (err: any) {
    console.error('Error creating recognition event:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get all wins
 */
export async function getAllWins(limit?: number): Promise<{
  success: boolean;
  data?: WinsTracker[];
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    let query = supabase
      .from('wins_tracker')
      .select('*')
      .eq('user_id', user.id)
      .order('detected_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error('Error fetching wins:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Create a win entry
 */
export async function createWin(
  winTitle: string,
  winDescription?: string,
  winType?: string,
  messageId?: string,
  mentionedByContact?: string,
  channel?: string
): Promise<{
  success: boolean;
  data?: WinsTracker;
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase
      .from('wins_tracker')
      .insert({
        user_id: user.id,
        win_title: winTitle,
        win_description: winDescription,
        win_type: winType,
        mentioned_in_message_id: messageId,
        mentioned_by_contact: mentionedByContact,
        channel,
        detected_at: new Date().toISOString(),
        celebrated: false,
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (err: any) {
    console.error('Error creating win:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Mark win as celebrated
 */
export async function celebrateWin(
  winId: string,
  celebrationMessage?: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { error } = await supabase
      .from('wins_tracker')
      .update({
        celebrated: true,
        celebration_message: celebrationMessage
      })
      .eq('id', winId);

    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    console.error('Error celebrating win:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get uncelebrated wins
 */
export async function getUncelebratedWins(): Promise<{
  success: boolean;
  data?: WinsTracker[];
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase
      .from('wins_tracker')
      .select('*')
      .eq('user_id', user.id)
      .eq('celebrated', false)
      .order('detected_at', { ascending: false });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error('Error fetching uncelebrated wins:', err);
    return { success: false, error: err.message };
  }
}

// Helper functions

/**
 * Determine impact level based on event type and positivity score
 */
function determineImpactLevel(
  eventType: string,
  positivityScore?: number
): 'low' | 'medium' | 'high' {
  if (eventType === 'celebration' || eventType === 'win') return 'high';
  if (positivityScore && positivityScore >= 0.8) return 'high';
  if (positivityScore && positivityScore >= 0.5) return 'medium';
  return 'low';
}

/**
 * Update recognition summary for a contact
 */
async function updateRecognitionSummary(
  userId: string,
  contactIdentifier: string,
  contactName: string | null,
  direction: 'received' | 'given' | 'self',
  category?: string
): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from('recognition_summary')
      .select('*')
      .eq('user_id', userId)
      .eq('contact_identifier', contactIdentifier)
      .single();

    if (existing) {
      // Update existing summary
      const updates: any = {
        total_recognition_events: existing.total_recognition_events + 1,
        updated_at: new Date().toISOString()
      };

      if (direction === 'received') {
        updates.kudos_received_count = existing.kudos_received_count + 1;
        updates.last_kudos_received_at = new Date().toISOString();
        updates.appreciation_score = Math.min(existing.appreciation_score + 1, 100);

        if (category && !existing.most_appreciated_for.includes(category)) {
          updates.most_appreciated_for = [...existing.most_appreciated_for, category].slice(0, 5);
        }
      } else if (direction === 'given') {
        updates.kudos_given_count = existing.kudos_given_count + 1;
        updates.last_kudos_given_at = new Date().toISOString();

        if (category && !existing.most_appreciates_about.includes(category)) {
          updates.most_appreciates_about = [...existing.most_appreciates_about, category].slice(0, 5);
        }
      }

      // Calculate reciprocity score
      const totalKudos = (updates.kudos_received_count || existing.kudos_received_count) +
                        (updates.kudos_given_count || existing.kudos_given_count);
      if (totalKudos > 0) {
        const balance = Math.abs(
          (updates.kudos_received_count || existing.kudos_received_count) -
          (updates.kudos_given_count || existing.kudos_given_count)
        );
        updates.reciprocity_score = Math.max(0, 100 - (balance / totalKudos * 100));
      }

      await supabase
        .from('recognition_summary')
        .update(updates)
        .eq('id', existing.id);
    } else {
      // Create new summary
      await supabase
        .from('recognition_summary')
        .insert({
          user_id: userId,
          contact_identifier: contactIdentifier,
          contact_name: contactName,
          kudos_received_count: direction === 'received' ? 1 : 0,
          kudos_given_count: direction === 'given' ? 1 : 0,
          total_recognition_events: 1,
          appreciation_score: direction === 'received' ? 1 : 0,
          reciprocity_score: 50,
          last_kudos_received_at: direction === 'received' ? new Date().toISOString() : null,
          last_kudos_given_at: direction === 'given' ? new Date().toISOString() : null,
          recognition_trend: 'stable',
          most_appreciated_for: direction === 'received' && category ? [category] : [],
          most_appreciates_about: direction === 'given' && category ? [category] : [],
        });
    }
  } catch (err: any) {
    console.error('Error updating recognition summary:', err);
  }
}
