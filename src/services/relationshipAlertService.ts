// ============================================
// RELATIONSHIP ALERT SERVICE
// Proactive relationship management alerts and reminders
// ============================================

import { supabase } from './supabase';
import {
  RelationshipAlert,
  RelationshipAlertRow,
  AlertType,
  AlertSeverity,
  AlertStatus,
  AlertActionType,
  CreateAlertInput,
  RelationshipProfile,
} from '../types/relationshipTypes';

// ==================== TYPE CONVERTER ====================

function rowToAlert(row: RelationshipAlertRow): RelationshipAlert {
  return {
    id: row.id,
    userId: row.user_id,
    profileId: row.profile_id,
    alertType: row.alert_type as AlertType,
    severity: row.severity as AlertSeverity,
    priority: row.priority,
    title: row.title,
    description: row.description,
    contextData: row.context_data,
    suggestedAction: row.suggested_action,
    actionType: row.action_type as AlertActionType,
    actionTemplate: row.action_template,
    actionData: row.action_data,
    status: row.status as AlertStatus,
    snoozedUntil: row.snoozed_until ? new Date(row.snoozed_until) : undefined,
    actionedAt: row.actioned_at ? new Date(row.actioned_at) : undefined,
    actionedType: row.actioned_type,
    dismissedReason: row.dismissed_reason,
    triggerDate: row.trigger_date ? new Date(row.trigger_date) : undefined,
    expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    recurring: row.recurring,
    recurrenceRule: row.recurrence_rule,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// ==================== RELATIONSHIP ALERT SERVICE ====================

export class RelationshipAlertService {
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

  // ==================== ALERT CRUD ====================

  async createAlert(input: CreateAlertInput): Promise<RelationshipAlert | null> {
    const { data, error } = await supabase
      .from('relationship_alerts')
      .insert({
        user_id: input.userId,
        profile_id: input.profileId,
        alert_type: input.alertType,
        severity: input.severity || 'info',
        priority: input.priority || 50,
        title: input.title,
        description: input.description,
        suggested_action: input.suggestedAction,
        action_type: input.actionType,
        action_template: input.actionTemplate,
        trigger_date: input.triggerDate?.toISOString().split('T')[0],
        expires_at: input.expiresAt?.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating alert:', error);
      return null;
    }

    return rowToAlert(data);
  }

  async getActiveAlerts(): Promise<RelationshipAlert[]> {
    const userId = this.getUserId();

    const { data, error } = await supabase
      .from('relationship_alerts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .or(`snoozed_until.is.null,snoozed_until.lt.${new Date().toISOString()}`)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching alerts:', error);
      return [];
    }

    return (data || []).map(rowToAlert);
  }

  async getAlertsByProfile(profileId: string): Promise<RelationshipAlert[]> {
    const userId = this.getUserId();

    const { data, error } = await supabase
      .from('relationship_alerts')
      .select('*')
      .eq('user_id', userId)
      .eq('profile_id', profileId)
      .in('status', ['active', 'snoozed'])
      .order('priority', { ascending: false });

    if (error) {
      console.error('Error fetching profile alerts:', error);
      return [];
    }

    return (data || []).map(rowToAlert);
  }

  async dismissAlert(alertId: string, reason?: string): Promise<boolean> {
    const userId = this.getUserId();

    const { error } = await supabase
      .from('relationship_alerts')
      .update({
        status: 'dismissed',
        dismissed_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', alertId)
      .eq('user_id', userId);

    return !error;
  }

  async snoozeAlert(alertId: string, until: Date): Promise<boolean> {
    const userId = this.getUserId();

    const { error } = await supabase
      .from('relationship_alerts')
      .update({
        status: 'snoozed',
        snoozed_until: until.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', alertId)
      .eq('user_id', userId);

    return !error;
  }

  async markActioned(alertId: string, actionType: string): Promise<boolean> {
    const userId = this.getUserId();

    const { error } = await supabase
      .from('relationship_alerts')
      .update({
        status: 'actioned',
        actioned_at: new Date().toISOString(),
        actioned_type: actionType,
        updated_at: new Date().toISOString(),
      })
      .eq('id', alertId)
      .eq('user_id', userId);

    return !error;
  }

  // ==================== ALERT DETECTION ====================

  async checkRelationshipDecay(): Promise<RelationshipAlert[]> {
    const userId = this.getUserId();
    const alerts: RelationshipAlert[] = [];

    // Find profiles with falling trend and decent score that hasn't been alerted recently
    const { data: profiles } = await supabase
      .from('relationship_profiles')
      .select('id, contact_name, contact_email, relationship_score, relationship_trend')
      .eq('user_id', userId)
      .eq('relationship_trend', 'falling')
      .gte('relationship_score', 40) // Still worth saving
      .eq('is_blocked', false);

    if (!profiles) return alerts;

    for (const profile of profiles) {
      // Check if we already have an active decay alert for this profile
      const { data: existingAlert } = await supabase
        .from('relationship_alerts')
        .select('id')
        .eq('user_id', userId)
        .eq('profile_id', profile.id)
        .eq('alert_type', 'relationship_decay')
        .eq('status', 'active')
        .single();

      if (existingAlert) continue;

      const alert = await this.createAlert({
        userId,
        profileId: profile.id,
        alertType: 'relationship_decay',
        severity: profile.relationship_score < 50 ? 'warning' : 'info',
        priority: 70,
        title: `Relationship with ${profile.contact_name || profile.contact_email} is declining`,
        description: `Engagement has dropped. Score is now ${profile.relationship_score}%. Consider reaching out to maintain this relationship.`,
        suggestedAction: 'Send a check-in message',
        actionType: 'send_email',
      });

      if (alert) alerts.push(alert);
    }

    return alerts;
  }

  async checkColdContacts(daysSinceContact = 60): Promise<RelationshipAlert[]> {
    const userId = this.getUserId();
    const alerts: RelationshipAlert[] = [];

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceContact);

    const { data: profiles } = await supabase
      .from('relationship_profiles')
      .select('id, contact_name, contact_email, last_interaction_at, relationship_score')
      .eq('user_id', userId)
      .lt('last_interaction_at', cutoffDate.toISOString())
      .gte('relationship_score', 30) // Worth re-engaging
      .eq('is_blocked', false)
      .eq('is_merged', false);

    if (!profiles) return alerts;

    for (const profile of profiles) {
      // Check for existing alert
      const { data: existingAlert } = await supabase
        .from('relationship_alerts')
        .select('id')
        .eq('user_id', userId)
        .eq('profile_id', profile.id)
        .eq('alert_type', 'cold_contact')
        .in('status', ['active', 'snoozed'])
        .single();

      if (existingAlert) continue;

      const daysSince = Math.floor(
        (Date.now() - new Date(profile.last_interaction_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      const alert = await this.createAlert({
        userId,
        profileId: profile.id,
        alertType: 'cold_contact',
        severity: daysSince > 90 ? 'warning' : 'info',
        priority: Math.min(50 + daysSince, 80),
        title: `No contact with ${profile.contact_name || profile.contact_email} for ${daysSince} days`,
        description: `It's been a while since you've connected. A quick message could help maintain this relationship.`,
        suggestedAction: 'Send a reconnection message',
        actionType: 'send_email',
        actionTemplate: `Hi ${profile.contact_name?.split(' ')[0] || 'there'},\n\nIt's been a while since we connected. I wanted to reach out and see how things are going.\n\nBest regards`,
      });

      if (alert) alerts.push(alert);
    }

    return alerts;
  }

  async checkBirthdayReminders(daysAhead = 7): Promise<RelationshipAlert[]> {
    const userId = this.getUserId();
    const alerts: RelationshipAlert[] = [];

    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    // Get profiles with birthdays in the upcoming window
    const { data: profiles } = await supabase
      .from('relationship_profiles')
      .select('id, contact_name, contact_email, birthday')
      .eq('user_id', userId)
      .not('birthday', 'is', null)
      .eq('is_blocked', false);

    if (!profiles) return alerts;

    for (const profile of profiles) {
      if (!profile.birthday) continue;

      const birthday = new Date(profile.birthday);
      // Set birthday to this year
      birthday.setFullYear(today.getFullYear());

      // If birthday has passed this year, check next year
      if (birthday < today) {
        birthday.setFullYear(today.getFullYear() + 1);
      }

      const daysUntil = Math.ceil((birthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntil > 0 && daysUntil <= daysAhead) {
        // Check for existing alert
        const { data: existingAlert } = await supabase
          .from('relationship_alerts')
          .select('id')
          .eq('user_id', userId)
          .eq('profile_id', profile.id)
          .eq('alert_type', 'birthday_reminder')
          .gte('trigger_date', today.toISOString().split('T')[0])
          .single();

        if (existingAlert) continue;

        const alert = await this.createAlert({
          userId,
          profileId: profile.id,
          alertType: 'birthday_reminder',
          severity: daysUntil <= 1 ? 'warning' : 'info',
          priority: 85 - daysUntil,
          title: `${profile.contact_name || profile.contact_email}'s birthday ${daysUntil === 0 ? 'is today!' : daysUntil === 1 ? 'is tomorrow' : `in ${daysUntil} days`}`,
          description: `Don't forget to send birthday wishes!`,
          suggestedAction: 'Send birthday message',
          actionType: 'send_message',
          actionTemplate: `Happy Birthday, ${profile.contact_name?.split(' ')[0] || ''}! Hope you have a wonderful day!`,
          triggerDate: birthday,
        });

        if (alert) alerts.push(alert);
      }
    }

    return alerts;
  }

  async checkFollowUpsDue(): Promise<RelationshipAlert[]> {
    const userId = this.getUserId();
    const alerts: RelationshipAlert[] = [];

    // Find conversations where we sent the last message and haven't heard back
    const { data: profiles } = await supabase
      .from('relationship_profiles')
      .select('id, contact_name, contact_email, last_email_sent_at, last_email_received_at')
      .eq('user_id', userId)
      .not('last_email_sent_at', 'is', null)
      .eq('is_blocked', false);

    if (!profiles) return alerts;

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    for (const profile of profiles) {
      const lastSent = profile.last_email_sent_at ? new Date(profile.last_email_sent_at) : null;
      const lastReceived = profile.last_email_received_at ? new Date(profile.last_email_received_at) : null;

      // We sent last and it's been more than 3 days with no response
      if (lastSent && lastSent < threeDaysAgo && (!lastReceived || lastReceived < lastSent)) {
        // Check for existing alert
        const { data: existingAlert } = await supabase
          .from('relationship_alerts')
          .select('id')
          .eq('user_id', userId)
          .eq('profile_id', profile.id)
          .eq('alert_type', 'no_response')
          .in('status', ['active', 'snoozed'])
          .single();

        if (existingAlert) continue;

        const daysSince = Math.floor((Date.now() - lastSent.getTime()) / (1000 * 60 * 60 * 24));

        const alert = await this.createAlert({
          userId,
          profileId: profile.id,
          alertType: 'no_response',
          severity: daysSince > 7 ? 'warning' : 'info',
          priority: Math.min(60 + daysSince * 2, 85),
          title: `No response from ${profile.contact_name || profile.contact_email}`,
          description: `You sent a message ${daysSince} days ago but haven't heard back. Consider a follow-up.`,
          suggestedAction: 'Send follow-up message',
          actionType: 'send_email',
        });

        if (alert) alerts.push(alert);
      }
    }

    return alerts;
  }

  async checkVIPActivity(): Promise<RelationshipAlert[]> {
    const userId = this.getUserId();
    const alerts: RelationshipAlert[] = [];

    // Find VIP contacts with recent inbound activity
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const { data: profiles } = await supabase
      .from('relationship_profiles')
      .select('id, contact_name, contact_email, last_email_received_at')
      .eq('user_id', userId)
      .eq('is_vip', true)
      .gte('last_email_received_at', oneDayAgo.toISOString());

    if (!profiles) return alerts;

    for (const profile of profiles) {
      // Check for existing alert
      const { data: existingAlert } = await supabase
        .from('relationship_alerts')
        .select('id')
        .eq('user_id', userId)
        .eq('profile_id', profile.id)
        .eq('alert_type', 'vip_activity')
        .gte('created_at', oneDayAgo.toISOString())
        .single();

      if (existingAlert) continue;

      const alert = await this.createAlert({
        userId,
        profileId: profile.id,
        alertType: 'vip_activity',
        severity: 'info',
        priority: 90,
        title: `VIP ${profile.contact_name || profile.contact_email} reached out`,
        description: `Your VIP contact has sent you a message. Prioritize your response.`,
        suggestedAction: 'Review and respond',
        actionType: 'review',
      });

      if (alert) alerts.push(alert);
    }

    return alerts;
  }

  // ==================== BATCH OPERATIONS ====================

  async runAllChecks(): Promise<RelationshipAlert[]> {
    const allAlerts: RelationshipAlert[] = [];

    const [decay, cold, birthday, followUp, vip] = await Promise.all([
      this.checkRelationshipDecay(),
      this.checkColdContacts(),
      this.checkBirthdayReminders(),
      this.checkFollowUpsDue(),
      this.checkVIPActivity(),
    ]);

    allAlerts.push(...decay, ...cold, ...birthday, ...followUp, ...vip);

    return allAlerts.sort((a, b) => b.priority - a.priority);
  }

  async cleanupExpiredAlerts(): Promise<number> {
    const userId = this.getUserId();

    const { data } = await supabase
      .from('relationship_alerts')
      .update({
        status: 'expired',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('status', 'active')
      .lt('expires_at', new Date().toISOString())
      .select('id');

    return data?.length || 0;
  }

  async getAlertCounts(): Promise<Record<AlertType, number>> {
    const userId = this.getUserId();

    const { data } = await supabase
      .from('relationship_alerts')
      .select('alert_type')
      .eq('user_id', userId)
      .eq('status', 'active');

    const counts: Record<string, number> = {};
    for (const row of data || []) {
      counts[row.alert_type] = (counts[row.alert_type] || 0) + 1;
    }

    return counts as Record<AlertType, number>;
  }
}

// Export singleton instance
export const relationshipAlertService = new RelationshipAlertService();
