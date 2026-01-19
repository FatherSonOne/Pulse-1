// ============================================
// IN-APP MESSAGE SERVICE
// ============================================

import { supabase } from './supabase';
import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import {
  InAppMessage,
  CreateMessagePayload,
  MessageInteraction,
  MessageMetrics,
  RetentionByExposure,
  MessageEventTrigger,
  TriggerEvent,
  UserSegment
} from '../types/inAppMessages';

/**
 * Service for managing in-app messages and interactions
 */
export class MessageService {
  private supabase: SupabaseClient;

  constructor() {
    // Use the shared singleton Supabase client to avoid multiple GoTrueClient instances
    this.supabase = supabase;
  }

  // ==================== MESSAGE CRUD ====================

  /**
   * Create a new in-app message
   */
  async createMessage(payload: CreateMessagePayload): Promise<InAppMessage> {
    const { data: user } = await this.supabase.auth.getUser();

    const messageData = {
      id: uuidv4(),
      title: payload.title,
      body: payload.body,
      cta_text: payload.ctaText,
      cta_url: payload.ctaUrl,
      trigger_event: payload.eventTrigger,
      target_segment: payload.segment,
      segment_filter: payload.customSegmentQuery,
      start_date: payload.startsAt,
      end_date: payload.endsAt,
      active: true,
      priority: payload.priority ?? 0,
      max_displays_per_user: 1,
      auto_dismiss_seconds: payload.displayDurationSeconds ?? 8,
      position: payload.position ?? 'bottom-right',
      style_type: payload.styleType ?? 'info',
      created_by: user?.user?.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('in_app_messages')
      .insert(messageData)
      .select()
      .single();

    if (error) throw new Error(`Failed to create message: ${error.message}`);
    return this.mapToInAppMessage(data);
  }

  /**
   * Get all active messages
   */
  async getActiveMessages(): Promise<InAppMessage[]> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('in_app_messages')
      .select('*')
      .eq('active', true)
      .or(`start_date.is.null,start_date.lte.${now}`)
      .or(`end_date.is.null,end_date.gte.${now}`)
      .order('priority', { ascending: false });

    if (error) throw new Error(`Failed to fetch messages: ${error.message}`);
    return (data || []).map(this.mapToInAppMessage);
  }

  /**
   * Get messages by event trigger
   */
  async getMessagesByEvent(eventTrigger: MessageEventTrigger): Promise<InAppMessage[]> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('in_app_messages')
      .select('*')
      .eq('trigger_event', eventTrigger)
      .eq('active', true)
      .or(`start_date.is.null,start_date.lte.${now}`)
      .or(`end_date.is.null,end_date.gte.${now}`)
      .order('priority', { ascending: false });

    if (error) throw new Error(`Failed to fetch messages: ${error.message}`);
    return (data || []).map(this.mapToInAppMessage);
  }

  /**
   * Update a message
   */
  async updateMessage(id: string, updates: Partial<CreateMessagePayload>): Promise<InAppMessage> {
    // Map from camelCase to snake_case for DB
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.body !== undefined) updateData.body = updates.body;
    if (updates.ctaText !== undefined) updateData.cta_text = updates.ctaText;
    if (updates.ctaUrl !== undefined) updateData.cta_url = updates.ctaUrl;
    if (updates.eventTrigger !== undefined) updateData.trigger_event = updates.eventTrigger;
    if (updates.segment !== undefined) updateData.target_segment = updates.segment;
    if (updates.customSegmentQuery !== undefined) updateData.segment_filter = updates.customSegmentQuery;
    if (updates.startsAt !== undefined) updateData.start_date = updates.startsAt;
    if (updates.endsAt !== undefined) updateData.end_date = updates.endsAt;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.displayDurationSeconds !== undefined) updateData.auto_dismiss_seconds = updates.displayDurationSeconds;
    if (updates.position !== undefined) updateData.position = updates.position;
    if (updates.styleType !== undefined) updateData.style_type = updates.styleType;

    const { data, error } = await this.supabase
      .from('in_app_messages')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update message: ${error.message}`);
    return this.mapToInAppMessage(data);
  }

  /**
   * Delete a message
   */
  async deleteMessage(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('in_app_messages')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete message: ${error.message}`);
  }

  /**
   * Toggle message active status
   */
  async toggleMessageStatus(id: string, isActive: boolean): Promise<void> {
    const { error } = await this.supabase
      .from('in_app_messages')
      .update({ active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(`Failed to toggle status: ${error.message}`);
  }

  // ==================== INTERACTIONS ====================

  /**
   * Record that a message was shown to a user
   */
  async recordMessageShown(
    messageId: string,
    userId: string,
    triggeredBy: string,
    userSegment: string,
    context?: { sessionId?: string; pageUrl?: string; deviceType?: string }
  ): Promise<string> {
    const interactionData = {
      id: uuidv4(),
      message_id: messageId,
      user_id: userId,
      shown_at: new Date().toISOString(),
      triggered_by: triggeredBy,
      user_segment: userSegment,
      session_id: context?.sessionId,
      page_url: context?.pageUrl,
      device_type: context?.deviceType,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('message_interactions')
      .insert(interactionData)
      .select('id')
      .single();

    if (error) throw new Error(`Failed to record interaction: ${error.message}`);

    // Update retention tracking
    await this.incrementMessageSeenCount(userId);

    return data.id;
  }

  /**
   * Record that a user opened/read the message
   */
  async recordMessageOpened(interactionId: string): Promise<void> {
    const { error } = await this.supabase
      .from('message_interactions')
      .update({ opened_at: new Date().toISOString() })
      .eq('id', interactionId);

    if (error) throw new Error(`Failed to record open: ${error.message}`);
  }

  /**
   * Record that a user clicked the CTA button
   */
  async recordMessageClicked(interactionId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('message_interactions')
      .update({ clicked_at: new Date().toISOString() })
      .eq('id', interactionId);

    if (error) throw new Error(`Failed to record click: ${error.message}`);

    // Update retention tracking
    await this.incrementMessageClickedCount(userId);
  }

  /**
   * Record that a user dismissed the message
   */
  async recordMessageDismissed(interactionId: string): Promise<void> {
    const { error } = await this.supabase
      .from('message_interactions')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', interactionId);

    if (error) throw new Error(`Failed to record dismissal: ${error.message}`);
  }

  // ==================== TARGETING ====================

  /**
   * Check if user matches message segment
   */
  async userMatchesSegment(userId: string, segment: UserSegment): Promise<boolean> {
    const { data: user } = await this.supabase.auth.getUser();
    if (!user) return false;

    switch (segment) {
      case 'all':
        return true;

      case 'new_users':
        // Users who signed up in last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return new Date(user.user?.created_at || '') > sevenDaysAgo;

      case 'dormant_users':
        // Users who haven't been active in 7+ days
        const { data: cohort } = await this.supabase
          .from('user_retention_cohorts')
          .select('last_seen_at')
          .eq('user_id', userId)
          .single();

        if (!cohort) return false;

        const daysSinceLastSeen = Math.floor(
          (Date.now() - new Date(cohort.last_seen_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysSinceLastSeen >= 7;

      case 'active_teams':
        // Custom logic: check if user is in a team with 3+ members
        // that sent messages in last 48h
        // TODO: Implement based on your team/message schema
        return true;

      default:
        return true;
    }
  }

  /**
   * Find messages to display for a specific event
   */
  async getMessagesToDisplay(event: TriggerEvent): Promise<InAppMessage[]> {
    // Get all messages for this event
    const messages = await this.getMessagesByEvent(event.type);

    // Filter by segment matching
    const matchedMessages: InAppMessage[] = [];
    for (const message of messages) {
      const matches = await this.userMatchesSegment(event.userId, message.segment);
      if (matches) {
        matchedMessages.push(message);
      }
    }

    // Sort by priority (already sorted from query, but just in case)
    return matchedMessages.sort((a, b) => b.priority - a.priority);
  }

  // ==================== ANALYTICS ====================

  /**
   * Get metrics for a specific message
   */
  async getMessageMetrics(messageId: string): Promise<MessageMetrics> {
    const { data, error } = await this.supabase
      .rpc('get_message_metrics', { message_uuid: messageId });

    if (error) throw new Error(`Failed to get metrics: ${error.message}`);

    return {
      messageId,
      totalShown: parseInt(data[0].total_shown) || 0,
      totalOpened: parseInt(data[0].total_opened) || 0,
      totalClicked: parseInt(data[0].total_clicked) || 0,
      totalDismissed: parseInt(data[0].total_dismissed) || 0,
      openRate: parseFloat(data[0].open_rate) || 0,
      clickRate: parseFloat(data[0].click_rate) || 0,
      avgTimeToAction: this.intervalToSeconds(data[0].avg_time_to_action) || 0,
    };
  }

  /**
   * Get retention metrics by message exposure
   */
  async getRetentionByExposure(): Promise<RetentionByExposure[]> {
    const { data, error } = await this.supabase
      .rpc('get_retention_by_message_exposure');

    if (error) throw new Error(`Failed to get retention: ${error.message}`);

    return (data || []).map((row: any) => ({
      exposedToMessages: row.exposed_to_messages,
      day1Retention: parseFloat(row.day_1_retention) || 0,
      day7Retention: parseFloat(row.day_7_retention) || 0,
      day30Retention: parseFloat(row.day_30_retention) || 0,
      userCount: parseInt(row.user_count) || 0,
    }));
  }

  // ==================== RETENTION TRACKING ====================

  /**
   * Initialize retention tracking for a new user
   */
  async initializeUserRetention(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('user_retention_cohorts')
      .insert({
        id: uuidv4(),
        user_id: userId,
        cohort_date: new Date().toISOString().split('T')[0],
        returned_day_1: false,
        returned_day_7: false,
        returned_day_30: false,
        messages_seen_count: 0,
        messages_clicked_count: 0,
        last_seen_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });

    if (error && error.code !== '23505') { // Ignore duplicate key errors
      throw new Error(`Failed to initialize retention: ${error.message}`);
    }
  }

  /**
   * Update last seen timestamp (call on every user activity)
   */
  async updateUserActivity(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('user_retention_cohorts')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) console.error('Failed to update activity:', error);
  }

  // ==================== PRIVATE HELPERS ====================

  private mapToInAppMessage(data: any): InAppMessage {
    return {
      id: data.id,
      title: data.title,
      body: data.body,
      ctaText: data.cta_text,
      ctaUrl: data.cta_url,
      eventTrigger: data.trigger_event,
      segment: data.target_segment,
      customSegmentQuery: data.segment_filter,
      startsAt: data.start_date ? new Date(data.start_date) : undefined,
      endsAt: data.end_date ? new Date(data.end_date) : undefined,
      isActive: data.active,
      priority: data.priority,
      displayDurationSeconds: data.auto_dismiss_seconds,
      position: data.position || 'bottom-right',
      styleType: data.style_type || 'info',
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  private intervalToSeconds(interval: string | null): number {
    if (!interval) return 0;
    // Parse PostgreSQL interval format (e.g., "00:01:23")
    const parts = interval.split(':');
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
  }

  private async incrementMessageSeenCount(userId: string): Promise<void> {
    const { error } = await this.supabase
      .rpc('increment_messages_seen', { user_uuid: userId });

    if (error) console.error('Failed to increment seen count:', error);
  }

  private async incrementMessageClickedCount(userId: string): Promise<void> {
    const { error } = await this.supabase
      .rpc('increment_messages_clicked', { user_uuid: userId });

    if (error) console.error('Failed to increment clicked count:', error);
  }
}

// Export singleton instance (uses shared Supabase client)
export const messageService = new MessageService();

