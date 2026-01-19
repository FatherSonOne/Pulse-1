/**
 * Advanced Analytics Service
 * Provides communication insights, engagement scoring, and response tracking
 */

import { supabase } from './supabase';

// Types
export interface DailyMetrics {
  id: string;
  user_id: string;
  date: string;
  messages_sent: number;
  messages_received: number;
  emails_sent: number;
  emails_received: number;
  sms_sent: number;
  sms_received: number;
  slack_sent: number;
  slack_received: number;
  avg_response_time_minutes: number | null;
  fastest_response_minutes: number | null;
  slowest_response_minutes: number | null;
  responses_within_1h: number;
  responses_within_24h: number;
  responses_after_24h: number;
  active_conversations: number;
  new_contacts: number;
  unique_contacts_reached: number;
  avg_sentiment_score: number | null;
  positive_messages: number;
  neutral_messages: number;
  negative_messages: number;
  peak_hour: number | null;
  messages_by_hour: Record<string, number>;
}

export interface ContactEngagement {
  id: string;
  contact_identifier: string;
  contact_name: string | null;
  engagement_score: number;
  engagement_trend: 'rising' | 'falling' | 'stable';
  last_interaction_at: string | null;
  total_messages_sent: number;
  total_messages_received: number;
  avg_response_time_minutes: number | null;
  response_rate: number | null;
  first_contact_at: string | null;
  days_since_last_contact: number | null;
  communication_frequency: 'daily' | 'weekly' | 'monthly' | 'sporadic';
  preferred_channel: string | null;
  avg_sentiment: number | null;
  common_topics: string[];
}

export interface PeriodSummary {
  id: string;
  period_type: 'week' | 'month' | 'quarter' | 'year';
  period_start: string;
  period_end: string;
  total_messages: number;
  total_sent: number;
  total_received: number;
  channel_breakdown: Record<string, number>;
  avg_response_time_minutes: number | null;
  response_rate: number | null;
  active_contacts: number;
  new_contacts: number;
  churned_contacts: number;
  avg_sentiment: number | null;
  sentiment_trend: 'improving' | 'declining' | 'stable';
  messages_change_percent: number | null;
  response_time_change_percent: number | null;
  engagement_change_percent: number | null;
  insights: Array<{ type: string; text: string }>;
}

export interface DashboardData {
  total_messages: number;
  messages_sent: number;
  messages_received: number;
  avg_response_time: number;
  response_rate: number;
  avg_sentiment: number;
  top_contacts: ContactEngagement[];
  channel_breakdown: Record<string, number>;
  daily_activity: Array<{
    date: string;
    sent: number;
    received: number;
    sentiment: number | null;
  }>;
}

export interface AnalyticsOverview {
  currentPeriod: {
    totalMessages: number;
    sent: number;
    received: number;
    avgResponseTime: number;
    responseRate: number;
  };
  previousPeriod: {
    totalMessages: number;
    sent: number;
    received: number;
    avgResponseTime: number;
    responseRate: number;
  };
  changes: {
    messages: number;
    responseTime: number;
    responseRate: number;
  };
  channelBreakdown: Record<string, number>;
  hourlyDistribution: Record<string, number>;
}

/**
 * Get analytics dashboard data
 */
export async function getDashboardData(days: number = 30): Promise<{
  success: boolean;
  data?: DashboardData;
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase.rpc('get_analytics_dashboard', {
      p_user_id: user.id,
      p_days: days
    });

    if (error) throw error;

    const result = data?.[0];
    if (!result) {
      // Return empty data if no analytics yet
      return {
        success: true,
        data: {
          total_messages: 0,
          messages_sent: 0,
          messages_received: 0,
          avg_response_time: 0,
          response_rate: 0,
          avg_sentiment: 0,
          top_contacts: [],
          channel_breakdown: { email: 0, sms: 0, slack: 0, voxer: 0, pulse: 0 },
          daily_activity: []
        }
      };
    }

    return { success: true, data: result };
  } catch (err: any) {
    console.error('Error fetching dashboard data:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get daily metrics for a date range
 */
export async function getDailyMetrics(
  startDate: Date,
  endDate: Date
): Promise<{ success: boolean; data?: DailyMetrics[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('analytics_daily_metrics')
      .select('*')
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error('Error fetching daily metrics:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get top engaged contacts
 */
export async function getTopContacts(
  limit: number = 10
): Promise<{ success: boolean; data?: ContactEngagement[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('analytics_contact_engagement')
      .select('*')
      .order('engagement_score', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error('Error fetching top contacts:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get contact engagement details
 */
export async function getContactEngagement(
  contactIdentifier: string
): Promise<{ success: boolean; data?: ContactEngagement; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('analytics_contact_engagement')
      .select('*')
      .eq('contact_identifier', contactIdentifier)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return { success: true, data: data || undefined };
  } catch (err: any) {
    console.error('Error fetching contact engagement:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get period summary (week, month, etc.)
 */
export async function getPeriodSummary(
  periodType: 'week' | 'month' | 'quarter' | 'year',
  periodStart?: Date
): Promise<{ success: boolean; data?: PeriodSummary; error?: string }> {
  try {
    let query = supabase
      .from('analytics_period_summary')
      .select('*')
      .eq('period_type', periodType)
      .order('period_start', { ascending: false })
      .limit(1);

    if (periodStart) {
      query = query.eq('period_start', periodStart.toISOString().split('T')[0]);
    }

    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') throw error;

    return { success: true, data: data || undefined };
  } catch (err: any) {
    console.error('Error fetching period summary:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Track a message for analytics
 */
export async function trackMessage(
  channel: 'email' | 'sms' | 'slack' | 'voxer' | 'pulse',
  isSent: boolean,
  contactIdentifier: string,
  sentimentScore?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const today = new Date().toISOString().split('T')[0];

    // Update daily metrics
    await supabase.rpc('update_daily_metrics', {
      p_user_id: user.id,
      p_date: today,
      p_channel: channel,
      p_is_sent: isSent,
      p_sentiment_score: sentimentScore || null
    });

    // Update or create contact engagement
    const { data: existing } = await supabase
      .from('analytics_contact_engagement')
      .select('*')
      .eq('user_id', user.id)
      .eq('contact_identifier', contactIdentifier)
      .single();

    if (existing) {
      // Update existing
      const updates: any = {
        last_interaction_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (isSent) {
        updates.total_messages_sent = existing.total_messages_sent + 1;
      } else {
        updates.total_messages_received = existing.total_messages_received + 1;
      }

      await supabase
        .from('analytics_contact_engagement')
        .update(updates)
        .eq('id', existing.id);
    } else {
      // Create new
      await supabase.from('analytics_contact_engagement').insert({
        user_id: user.id,
        contact_identifier: contactIdentifier,
        last_interaction_at: new Date().toISOString(),
        first_contact_at: new Date().toISOString(),
        total_messages_sent: isSent ? 1 : 0,
        total_messages_received: isSent ? 0 : 1,
        preferred_channel: channel
      });
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error tracking message:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Track response time
 */
export async function trackResponseTime(
  channel: 'email' | 'sms' | 'slack' | 'voxer' | 'pulse',
  contactIdentifier: string,
  incomingMessageId: string,
  incomingAt: Date,
  responseMessageId: string,
  responseAt: Date
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const responseTimeMinutes =
      (responseAt.getTime() - incomingAt.getTime()) / (1000 * 60);

    // Check if it was during business hours (9-5)
    const responseHour = responseAt.getHours();
    const isBusinessHours = responseHour >= 9 && responseHour < 17;

    await supabase.from('analytics_response_times').insert({
      user_id: user.id,
      channel,
      contact_identifier: contactIdentifier,
      incoming_message_id: incomingMessageId,
      incoming_at: incomingAt.toISOString(),
      response_message_id: responseMessageId,
      response_at: responseAt.toISOString(),
      response_time_minutes: responseTimeMinutes,
      was_responded: true,
      is_business_hours: isBusinessHours
    });

    return { success: true };
  } catch (err: any) {
    console.error('Error tracking response time:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get response time stats
 */
export async function getResponseTimeStats(
  days: number = 30
): Promise<{
  success: boolean;
  data?: {
    avgResponseTime: number;
    fastestResponse: number;
    slowestResponse: number;
    within1h: number;
    within24h: number;
    after24h: number;
    byChannel: Record<string, number>;
  };
  error?: string;
}> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('analytics_response_times')
      .select('*')
      .gte('incoming_at', startDate.toISOString())
      .eq('was_responded', true);

    if (error) throw error;

    if (!data || data.length === 0) {
      return {
        success: true,
        data: {
          avgResponseTime: 0,
          fastestResponse: 0,
          slowestResponse: 0,
          within1h: 0,
          within24h: 0,
          after24h: 0,
          byChannel: {}
        }
      };
    }

    const times = data.map(d => d.response_time_minutes);
    const avgResponseTime = times.reduce((a, b) => a + b, 0) / times.length;
    const fastestResponse = Math.min(...times);
    const slowestResponse = Math.max(...times);

    const within1h = data.filter(d => d.response_time_minutes <= 60).length;
    const within24h = data.filter(
      d => d.response_time_minutes > 60 && d.response_time_minutes <= 1440
    ).length;
    const after24h = data.filter(d => d.response_time_minutes > 1440).length;

    const byChannel: Record<string, number> = {};
    data.forEach(d => {
      if (!byChannel[d.channel]) {
        byChannel[d.channel] = 0;
      }
      byChannel[d.channel] += d.response_time_minutes;
    });
    Object.keys(byChannel).forEach(channel => {
      const count = data.filter(d => d.channel === channel).length;
      byChannel[channel] = byChannel[channel] / count;
    });

    return {
      success: true,
      data: {
        avgResponseTime,
        fastestResponse,
        slowestResponse,
        within1h,
        within24h,
        after24h,
        byChannel
      }
    };
  } catch (err: any) {
    console.error('Error fetching response time stats:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get communication trends
 */
export async function getCommunicationTrends(
  days: number = 30
): Promise<{
  success: boolean;
  data?: {
    dailyVolume: Array<{ date: string; sent: number; received: number }>;
    weekdayDistribution: Record<string, number>;
    hourlyDistribution: Record<string, number>;
    channelTrends: Record<string, Array<{ date: string; count: number }>>;
  };
  error?: string;
}> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: metrics, error } = await supabase
      .from('analytics_daily_metrics')
      .select('*')
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) throw error;

    const dailyVolume = (metrics || []).map(m => ({
      date: m.date,
      sent: m.messages_sent,
      received: m.messages_received
    }));

    // Weekday distribution
    const weekdayDistribution: Record<string, number> = {
      Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0
    };
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    (metrics || []).forEach(m => {
      const day = new Date(m.date).getDay();
      weekdayDistribution[weekdays[day]] += m.messages_sent + m.messages_received;
    });

    // Hourly distribution (aggregated)
    const hourlyDistribution: Record<string, number> = {};
    for (let i = 0; i < 24; i++) {
      hourlyDistribution[i.toString()] = 0;
    }
    (metrics || []).forEach(m => {
      if (m.messages_by_hour) {
        Object.entries(m.messages_by_hour).forEach(([hour, count]) => {
          hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + (count as number);
        });
      }
    });

    // Channel trends
    const channelTrends: Record<string, Array<{ date: string; count: number }>> = {
      email: [],
      sms: [],
      slack: []
    };
    (metrics || []).forEach(m => {
      channelTrends.email.push({
        date: m.date,
        count: (m.emails_sent || 0) + (m.emails_received || 0)
      });
      channelTrends.sms.push({
        date: m.date,
        count: (m.sms_sent || 0) + (m.sms_received || 0)
      });
      channelTrends.slack.push({
        date: m.date,
        count: (m.slack_sent || 0) + (m.slack_received || 0)
      });
    });

    return {
      success: true,
      data: {
        dailyVolume,
        weekdayDistribution,
        hourlyDistribution,
        channelTrends
      }
    };
  } catch (err: any) {
    console.error('Error fetching communication trends:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get sentiment analysis overview
 */
export async function getSentimentOverview(
  days: number = 30
): Promise<{
  success: boolean;
  data?: {
    avgSentiment: number;
    sentimentTrend: 'improving' | 'declining' | 'stable';
    positivePercent: number;
    neutralPercent: number;
    negativePercent: number;
    dailySentiment: Array<{ date: string; sentiment: number }>;
  };
  error?: string;
}> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: metrics, error } = await supabase
      .from('analytics_daily_metrics')
      .select('date, avg_sentiment_score, positive_messages, neutral_messages, negative_messages')
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) throw error;

    if (!metrics || metrics.length === 0) {
      return {
        success: true,
        data: {
          avgSentiment: 0,
          sentimentTrend: 'stable',
          positivePercent: 0,
          neutralPercent: 0,
          negativePercent: 0,
          dailySentiment: []
        }
      };
    }

    const sentiments = metrics
      .filter(m => m.avg_sentiment_score !== null)
      .map(m => m.avg_sentiment_score);

    const avgSentiment = sentiments.length > 0
      ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length
      : 0;

    // Calculate trend (compare first half to second half)
    const midpoint = Math.floor(sentiments.length / 2);
    const firstHalf = sentiments.slice(0, midpoint);
    const secondHalf = sentiments.slice(midpoint);

    const firstHalfAvg = firstHalf.length > 0
      ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
      : 0;
    const secondHalfAvg = secondHalf.length > 0
      ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
      : 0;

    let sentimentTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (secondHalfAvg - firstHalfAvg > 0.1) {
      sentimentTrend = 'improving';
    } else if (firstHalfAvg - secondHalfAvg > 0.1) {
      sentimentTrend = 'declining';
    }

    // Calculate percentages
    const totalPositive = metrics.reduce((sum, m) => sum + (m.positive_messages || 0), 0);
    const totalNeutral = metrics.reduce((sum, m) => sum + (m.neutral_messages || 0), 0);
    const totalNegative = metrics.reduce((sum, m) => sum + (m.negative_messages || 0), 0);
    const total = totalPositive + totalNeutral + totalNegative;

    const positivePercent = total > 0 ? (totalPositive / total) * 100 : 0;
    const neutralPercent = total > 0 ? (totalNeutral / total) * 100 : 0;
    const negativePercent = total > 0 ? (totalNegative / total) * 100 : 0;

    const dailySentiment = metrics
      .filter(m => m.avg_sentiment_score !== null)
      .map(m => ({
        date: m.date,
        sentiment: m.avg_sentiment_score
      }));

    return {
      success: true,
      data: {
        avgSentiment,
        sentimentTrend,
        positivePercent,
        neutralPercent,
        negativePercent,
        dailySentiment
      }
    };
  } catch (err: any) {
    console.error('Error fetching sentiment overview:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Generate AI insights from analytics data
 */
export async function generateInsights(): Promise<{
  success: boolean;
  data?: Array<{ type: string; title: string; description: string; priority: 'high' | 'medium' | 'low' }>;
  error?: string;
}> {
  try {
    // Get various analytics data
    const [dashboardResult, responseResult, sentimentResult] = await Promise.all([
      getDashboardData(30),
      getResponseTimeStats(30),
      getSentimentOverview(30)
    ]);

    const insights: Array<{ type: string; title: string; description: string; priority: 'high' | 'medium' | 'low' }> = [];

    // Response time insights
    if (responseResult.success && responseResult.data) {
      const { avgResponseTime, within1h, within24h, after24h } = responseResult.data;

      if (avgResponseTime > 120) {
        insights.push({
          type: 'warning',
          title: 'Slow Response Times',
          description: `Your average response time is ${Math.round(avgResponseTime)} minutes. Try to respond within 60 minutes for better engagement.`,
          priority: 'high'
        });
      } else if (avgResponseTime < 30) {
        insights.push({
          type: 'achievement',
          title: 'Quick Responder',
          description: `Great job! Your average response time is just ${Math.round(avgResponseTime)} minutes.`,
          priority: 'low'
        });
      }

      const totalResponses = within1h + within24h + after24h;
      if (totalResponses > 0 && after24h / totalResponses > 0.2) {
        insights.push({
          type: 'suggestion',
          title: 'Delayed Responses',
          description: `${Math.round((after24h / totalResponses) * 100)}% of your responses take over 24 hours. Consider setting up reminders.`,
          priority: 'medium'
        });
      }
    }

    // Sentiment insights
    if (sentimentResult.success && sentimentResult.data) {
      const { avgSentiment, sentimentTrend, negativePercent } = sentimentResult.data;

      if (sentimentTrend === 'declining') {
        insights.push({
          type: 'warning',
          title: 'Declining Sentiment',
          description: 'The overall sentiment in your conversations has been declining. Review recent interactions for patterns.',
          priority: 'high'
        });
      } else if (sentimentTrend === 'improving') {
        insights.push({
          type: 'achievement',
          title: 'Improving Relationships',
          description: 'The sentiment in your conversations is improving. Keep up the positive interactions!',
          priority: 'low'
        });
      }

      if (negativePercent > 30) {
        insights.push({
          type: 'suggestion',
          title: 'High Negative Sentiment',
          description: `${Math.round(negativePercent)}% of your messages have negative sentiment. Consider reviewing your communication style.`,
          priority: 'medium'
        });
      }
    }

    // Volume insights
    if (dashboardResult.success && dashboardResult.data) {
      const { messages_sent, messages_received } = dashboardResult.data;
      const ratio = messages_sent / (messages_received || 1);

      if (ratio > 3) {
        insights.push({
          type: 'info',
          title: 'High Outbound Volume',
          description: 'You\'re sending significantly more messages than you receive. This could indicate one-way communication.',
          priority: 'low'
        });
      }
    }

    return { success: true, data: insights };
  } catch (err: any) {
    console.error('Error generating insights:', err);
    return { success: false, error: err.message };
  }
}
