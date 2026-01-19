/**
 * Analytics Data Collector
 * Automatically tracks messages, response times, and engagement
 * Integrates with existing message services to populate analytics tables
 */

import { supabase } from './supabase';
import { trackMessage, trackResponseTime } from './analyticsService';

export interface MessageEvent {
  id: string;
  channel: 'email' | 'sms' | 'slack' | 'voxer' | 'pulse';
  contactIdentifier: string;
  contactName?: string;
  isSent: boolean;
  timestamp: Date;
  threadId?: string;
  replyToId?: string;
  content?: string;
  /** Duration in seconds for voice/video messages */
  duration?: number;
  /** Message subtype for more specific categorization */
  messageType?: 'quick_vox' | 'team_vox' | 'voice_thread' | 'broadcast' | 'vox_note' | 'standard';
}

/**
 * Analytics Collector Service
 * Call these methods whenever messages are sent/received
 */
export const analyticsCollector = {
  /**
   * Track a message event
   * Call this whenever a message is sent or received
   */
  async trackMessageEvent(event: MessageEvent): Promise<void> {
    try {
      // Calculate sentiment score if content is available
      let sentimentScore: number | undefined;
      if (event.content) {
        sentimentScore = await this.calculateSentiment(event.content);
      }

      // Track the message
      await trackMessage(
        event.channel,
        event.isSent,
        event.contactIdentifier,
        sentimentScore
      );

      // If this is a reply, track response time
      if (event.isSent && event.replyToId) {
        await this.trackReplyTime(event);
      }

      // Update contact engagement asynchronously
      this.updateContactEngagement(event).catch(err => {
        console.error('Failed to update contact engagement:', err);
      });
    } catch (error) {
      console.error('Error tracking message event:', error);
      // Don't throw - analytics should never break the main flow
    }
  },

  /**
   * Track response time for a reply
   */
  async trackReplyTime(event: MessageEvent): Promise<void> {
    if (!event.replyToId) return;

    try {
      // Find the original message we're replying to
      const { data: originalMessage } = await supabase
        .from('unified_messages')
        .select('timestamp, external_id')
        .eq('id', event.replyToId)
        .single();

      if (originalMessage) {
        await trackResponseTime(
          event.channel,
          event.contactIdentifier,
          originalMessage.external_id,
          new Date(originalMessage.timestamp),
          event.id,
          event.timestamp
        );
      }
    } catch (error) {
      console.error('Error tracking reply time:', error);
    }
  },

  /**
   * Update contact engagement metrics
   */
  async updateContactEngagement(event: MessageEvent): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: existing } = await supabase
        .from('analytics_contact_engagement')
        .select('*')
        .eq('user_id', user.id)
        .eq('contact_identifier', event.contactIdentifier)
        .single();

      const now = new Date();
      const daysSinceLastContact = existing?.last_interaction_at
        ? Math.floor((now.getTime() - new Date(existing.last_interaction_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      if (existing) {
        // Calculate engagement score
        const totalMessages = existing.total_messages_sent + existing.total_messages_received + 1;
        const responseRate = existing.response_rate || 50;
        const avgResponseTime = existing.avg_response_time_minutes || 60;
        const avgSentiment = existing.avg_sentiment || 0;

        const { data: scoreData } = await supabase.rpc('calculate_engagement_score', {
          p_total_messages: totalMessages,
          p_response_rate: responseRate,
          p_avg_response_time: avgResponseTime,
          p_days_since_last: daysSinceLastContact,
          p_avg_sentiment: avgSentiment
        });

        // Determine engagement trend
        const oldScore = existing.engagement_score || 0;
        const newScore = scoreData || 0;
        let trend: 'rising' | 'falling' | 'stable' = 'stable';
        if (newScore > oldScore + 5) trend = 'rising';
        else if (newScore < oldScore - 5) trend = 'falling';

        // Determine communication frequency
        const frequency = this.calculateCommunicationFrequency(
          totalMessages,
          existing.first_contact_at ? new Date(existing.first_contact_at) : now
        );

        await supabase
          .from('analytics_contact_engagement')
          .update({
            contact_name: event.contactName || existing.contact_name,
            engagement_score: newScore,
            engagement_trend: trend,
            last_interaction_at: now.toISOString(),
            total_messages_sent: event.isSent ? existing.total_messages_sent + 1 : existing.total_messages_sent,
            total_messages_received: event.isSent ? existing.total_messages_received : existing.total_messages_received + 1,
            days_since_last_contact: 0,
            communication_frequency: frequency,
            preferred_channel: event.channel,
            updated_at: now.toISOString()
          })
          .eq('id', existing.id);
      } else {
        // Create new contact engagement record
        await supabase.from('analytics_contact_engagement').insert({
          user_id: user.id,
          contact_identifier: event.contactIdentifier,
          contact_name: event.contactName,
          engagement_score: 50, // Starting score
          engagement_trend: 'stable',
          last_interaction_at: now.toISOString(),
          first_contact_at: now.toISOString(),
          total_messages_sent: event.isSent ? 1 : 0,
          total_messages_received: event.isSent ? 0 : 1,
          days_since_last_contact: 0,
          communication_frequency: 'sporadic',
          preferred_channel: event.channel,
          avg_sentiment: 0
        });
      }
    } catch (error) {
      console.error('Error updating contact engagement:', error);
    }
  },

  /**
   * Calculate communication frequency based on message count and time span
   */
  calculateCommunicationFrequency(
    totalMessages: number,
    firstContactAt: Date
  ): 'daily' | 'weekly' | 'monthly' | 'sporadic' {
    const daysSinceFirst = Math.max(1, Math.floor((Date.now() - firstContactAt.getTime()) / (1000 * 60 * 60 * 24)));
    const messagesPerDay = totalMessages / daysSinceFirst;

    if (messagesPerDay >= 1) return 'daily';
    if (messagesPerDay >= 0.14) return 'weekly'; // ~1 per week
    if (messagesPerDay >= 0.03) return 'monthly'; // ~1 per month
    return 'sporadic';
  },

  /**
   * Simple sentiment analysis
   * Returns a score from -1 (negative) to 1 (positive)
   */
  async calculateSentiment(text: string): Promise<number> {
    // Simple keyword-based sentiment (can be replaced with AI service)
    const positiveWords = ['thanks', 'thank', 'great', 'awesome', 'excellent', 'love', 'perfect', 'good', 'nice', 'happy', 'appreciate', 'wonderful'];
    const negativeWords = ['sorry', 'issue', 'problem', 'error', 'bug', 'broken', 'failed', 'wrong', 'bad', 'terrible', 'awful', 'hate', 'disappointed'];
    
    const lowerText = text.toLowerCase();
    let score = 0;
    
    positiveWords.forEach(word => {
      if (lowerText.includes(word)) score += 0.1;
    });
    
    negativeWords.forEach(word => {
      if (lowerText.includes(word)) score -= 0.1;
    });
    
    // Clamp between -1 and 1
    return Math.max(-1, Math.min(1, score));
  },

  /**
   * Batch track multiple messages
   * Useful for initial sync or bulk imports
   */
  async trackMessageBatch(events: MessageEvent[]): Promise<void> {
    const batchSize = 10;
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      await Promise.all(batch.map(event => this.trackMessageEvent(event)));
      
      // Small delay to avoid rate limits
      if (i + batchSize < events.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  },

  /**
   * Run daily aggregation
   * Should be called once per day (via cron or scheduled task)
   */
  async runDailyAggregation(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Update days_since_last_contact for all contacts
      await supabase.rpc('update_contact_recency', {
        p_user_id: user.id
      }).catch(() => {
        // Function might not exist yet, that's ok
      });

      // Calculate peak hours for yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      // Get all messages from yesterday to calculate peak hour
      const { data: messages } = await supabase
        .from('unified_messages')
        .select('timestamp')
        .eq('user_id', user.id)
        .gte('timestamp', `${yesterdayStr}T00:00:00`)
        .lt('timestamp', `${yesterdayStr}T23:59:59`);

      if (messages && messages.length > 0) {
        const hourCounts: Record<number, number> = {};
        messages.forEach(msg => {
          const hour = new Date(msg.timestamp).getHours();
          hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });

        const peakHour = Object.entries(hourCounts)
          .sort(([, a], [, b]) => b - a)[0]?.[0];

        // Update daily metrics with peak hour
        await supabase
          .from('analytics_daily_metrics')
          .update({
            peak_hour: parseInt(peakHour || '12'),
            messages_by_hour: hourCounts
          })
          .eq('user_id', user.id)
          .eq('date', yesterdayStr);
      }

      console.log('Daily aggregation completed');
    } catch (error) {
      console.error('Error running daily aggregation:', error);
    }
  },

  /**
   * Backfill analytics from existing messages
   * Call this once to populate analytics from historical data
   */
  async backfillAnalytics(daysBack: number = 90): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('User not authenticated');
        return;
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      console.log(`Starting analytics backfill for last ${daysBack} days...`);

      // Get all messages from the specified period
      const { data: messages, error } = await supabase
        .from('unified_messages')
        .select('*')
        .eq('user_id', user.id)
        .gte('timestamp', startDate.toISOString())
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }

      if (!messages || messages.length === 0) {
        console.log('No messages found to backfill');
        return;
      }

      console.log(`Found ${messages.length} messages to process`);

      // Convert to MessageEvent format
      const events: MessageEvent[] = messages.map(msg => ({
        id: msg.id,
        channel: msg.platform as 'email' | 'sms' | 'slack',
        contactIdentifier: msg.sender_id || 'unknown',
        isSent: msg.metadata?.is_sent || false,
        timestamp: new Date(msg.timestamp),
        threadId: msg.thread_id,
        replyToId: msg.reply_to_id,
        content: msg.content
      }));

      // Process in batches
      await this.trackMessageBatch(events);

      console.log('Analytics backfill completed!');
    } catch (error) {
      console.error('Error during analytics backfill:', error);
    }
  }
};

// Export singleton instance
export default analyticsCollector;
