// Notification Rule Service
// Evaluate custom notification rules for emails

import { supabase } from './supabase';
import type { CachedEmail } from './emailSyncService';

export interface NotificationRule {
  id: string;
  user_id: string;
  name: string;
  enabled: boolean;
  conditions: NotificationCondition[];
  notify_desktop: boolean;
  notify_mobile: boolean;
  notify_email: boolean;
  notify_sound: string | null;
  respect_quiet_hours: boolean;
  quiet_hours_start: string | null; // HH:mm:ss
  quiet_hours_end: string | null; // HH:mm:ss
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
}

export interface NotificationCondition {
  field: 'from' | 'to' | 'subject' | 'body' | 'has_attachment' | 'is_starred' | 'is_important' | 'category' | 'label';
  operator: 'contains' | 'not_contains' | 'is' | 'is_not' | 'starts_with' | 'ends_with' | 'matches_regex';
  value: string | boolean;
}

export type NotificationRuleInput = Omit<NotificationRule, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export interface NotificationDecision {
  notify: boolean;
  rule?: NotificationRule;
  channels?: {
    desktop: boolean;
    mobile: boolean;
    email: boolean;
  };
  priority?: NotificationRule['priority'];
  reason?: string;
}

class NotificationRuleService {
  /**
   * Get all notification rules
   */
  async getRules(): Promise<NotificationRule[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('notification_rules')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch notification rules: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Create a notification rule
   */
  async createRule(rule: NotificationRuleInput): Promise<NotificationRule> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('notification_rules')
      .insert({
        user_id: user.id,
        name: rule.name,
        enabled: rule.enabled,
        conditions: rule.conditions,
        notify_desktop: rule.notify_desktop,
        notify_mobile: rule.notify_mobile,
        notify_email: rule.notify_email,
        notify_sound: rule.notify_sound,
        respect_quiet_hours: rule.respect_quiet_hours,
        quiet_hours_start: rule.quiet_hours_start,
        quiet_hours_end: rule.quiet_hours_end,
        priority: rule.priority,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create notification rule: ${error.message}`);
    }

    return data;
  }

  /**
   * Update a notification rule
   */
  async updateRule(id: string, updates: Partial<NotificationRuleInput>): Promise<NotificationRule> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('notification_rules')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update notification rule: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a notification rule
   */
  async deleteRule(id: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('notification_rules')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      throw new Error(`Failed to delete notification rule: ${error.message}`);
    }
  }

  /**
   * Evaluate rules for a given email and return notification decision
   */
  async shouldNotify(email: CachedEmail, now: Date = new Date()): Promise<NotificationDecision> {
    const rules = await this.getRules();
    const enabledRules = rules.filter(r => r.enabled);

    for (const rule of enabledRules) {
      const matches = this.matchesRule(rule, email);
      if (!matches) continue;

      // Check quiet hours
      if (rule.respect_quiet_hours && this.isWithinQuietHours(rule, now)) {
        return {
          notify: false,
          rule,
          reason: 'Quiet hours active',
        };
      }

      return {
        notify: true,
        rule,
        channels: {
          desktop: rule.notify_desktop,
          mobile: rule.notify_mobile,
          email: rule.notify_email,
        },
        priority: rule.priority,
      };
    }

    // No matching rule
    return { notify: false, reason: 'No matching rule' };
  }

  /**
   * Check if email matches rule conditions
   */
  private matchesRule(rule: NotificationRule, email: CachedEmail): boolean {
    if (rule.conditions.length === 0) return true;

    return rule.conditions.every(condition => this.evaluateCondition(condition, email));
  }

  private evaluateCondition(condition: NotificationCondition, email: CachedEmail): boolean {
    const { field, operator, value } = condition;

    let fieldValue: string | boolean = '';

    switch (field) {
      case 'from':
        fieldValue = email.from_email.toLowerCase();
        break;
      case 'to':
        fieldValue = email.to_emails.map(t => (typeof t === 'string' ? t : t.email).toLowerCase()).join(' ');
        break;
      case 'subject':
        fieldValue = (email.subject || '').toLowerCase();
        break;
      case 'body':
        fieldValue = (email.body_text || '').toLowerCase();
        break;
      case 'has_attachment':
        fieldValue = email.has_attachments;
        break;
      case 'is_starred':
        fieldValue = email.is_starred;
        break;
      case 'is_important':
        fieldValue = email.is_important;
        break;
      case 'category':
        fieldValue = (email.ai_category || '').toLowerCase();
        break;
      case 'label':
        fieldValue = email.labels?.join(' ').toLowerCase() || '';
        break;
      default:
        return false;
    }

    switch (operator) {
      case 'contains':
        return String(fieldValue).includes(String(value).toLowerCase());
      case 'not_contains':
        return !String(fieldValue).includes(String(value).toLowerCase());
      case 'is':
        if (typeof value === 'boolean') return fieldValue === value;
        return String(fieldValue).toLowerCase() === String(value).toLowerCase();
      case 'is_not':
        if (typeof value === 'boolean') return fieldValue !== value;
        return String(fieldValue).toLowerCase() !== String(value).toLowerCase();
      case 'starts_with':
        return String(fieldValue).startsWith(String(value).toLowerCase());
      case 'ends_with':
        return String(fieldValue).endsWith(String(value).toLowerCase());
      case 'matches_regex':
        try {
          const regex = new RegExp(String(value), 'i');
          return regex.test(String(fieldValue));
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  /**
   * Check if current time is within quiet hours
   * Supports overnight ranges (e.g., 22:00 to 08:00)
   */
  private isWithinQuietHours(rule: NotificationRule, now: Date): boolean {
    if (!rule.quiet_hours_start || !rule.quiet_hours_end) return false;

    const [startH, startM] = rule.quiet_hours_start.split(':').map(Number);
    const [endH, endM] = rule.quiet_hours_end.split(':').map(Number);

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      // Same-day range
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    }

    // Overnight range (e.g., 22:00 to 08:00)
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
}

export const notificationRuleService = new NotificationRuleService();
export default notificationRuleService;
